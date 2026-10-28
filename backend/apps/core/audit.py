from django.forms.models import model_to_dict

from .models import AuditLog

_SKIP_FIELDS = {"password", "search_vector", "updated_at", "created_at", "renditions"}


def _client_ip(request):
    forwarded = request.META.get("HTTP_X_FORWARDED_FOR")
    if forwarded:
        return forwarded.split(",")[0].strip()
    return request.META.get("REMOTE_ADDR")


def snapshot(instance) -> dict:
    data = model_to_dict(instance)
    clean = {}
    for key, value in data.items():
        if key in _SKIP_FIELDS:
            continue
        if hasattr(value, "name"):  # file fields
            value = value.name or ""
        elif isinstance(value, list):
            value = [getattr(v, "pk", v) for v in value]
        json_safe = isinstance(value, (str, int, float, bool, list, dict, type(None)))
        clean[key] = value if json_safe else str(value)
    return clean


def diff(before: dict, after: dict) -> dict:
    keys = set(before) | set(after)
    return {k: {"from": before.get(k), "to": after.get(k)} for k in sorted(keys) if before.get(k) != after.get(k)}


def record(request, action, *, obj=None, object_type=None, object_id="", object_repr="", changes=None):
    actor = request.user if request and request.user.is_authenticated else None
    return AuditLog.objects.create(
        actor=actor,
        action=action,
        object_type=object_type or (obj._meta.label if obj is not None else ""),
        object_id=str(obj.pk) if obj is not None else str(object_id),
        object_repr=(object_repr or str(obj))[:200] if (obj is not None or object_repr) else "",
        changes=changes or {},
        ip=_client_ip(request) if request else None,
        user_agent=(request.META.get("HTTP_USER_AGENT", "")[:300] if request else ""),
    )


class AuditedViewSetMixin:
    """Writes an AuditLog row for every create, update and delete made through the viewset."""

    def perform_create(self, serializer):
        instance = serializer.save()
        record(self.request, AuditLog.Action.CREATE, obj=instance, changes=snapshot(instance))

    def perform_update(self, serializer):
        before = snapshot(serializer.instance)
        instance = serializer.save()
        changes = diff(before, snapshot(instance))
        if changes:
            record(self.request, AuditLog.Action.UPDATE, obj=instance, changes=changes)

    def perform_destroy(self, instance):
        record(
            self.request,
            AuditLog.Action.DELETE,
            obj=instance,
            changes=snapshot(instance),
        )
        instance.delete()
