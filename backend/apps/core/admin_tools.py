"""Building blocks shared by the admin APIs of several apps."""

from django.core.exceptions import ValidationError as DjangoValidationError
from django.db import transaction
from drf_spectacular.types import OpenApiTypes
from drf_spectacular.utils import extend_schema
from rest_framework import serializers
from rest_framework.decorators import action
from rest_framework.response import Response

from .audit import record
from .exceptions import DomainError
from .models import AuditLog


class ModelCleanMixin:
    """Run the model's clean() on the would-be instance so admin edits obey the same rules as Django admin."""

    def validate(self, attrs):
        attrs = super().validate(attrs)
        model = self.Meta.model
        plain = {
            k: v
            for k, v in attrs.items()
            if not isinstance(v, (list, dict)) and k in {f.name for f in model._meta.concrete_fields}
        }
        if self.instance is not None:
            probe = model(**{f.attname: getattr(self.instance, f.attname) for f in model._meta.concrete_fields})
            for key, value in plain.items():
                setattr(probe, key, value)
        else:
            probe = model(**plain)
        try:
            probe.clean()
        except DjangoValidationError as exc:
            raise serializers.ValidationError(exc.message_dict if hasattr(exc, "error_dict") else exc.messages) from exc
        return attrs


class ReorderMixin:
    """POST {ids: [...]} to set `position` in the given order (drag-and-drop lists)."""

    def after_reorder(self):
        """Override to bump caches; bulk_update doesn't send post_save."""

    @extend_schema(request=OpenApiTypes.OBJECT, responses=OpenApiTypes.OBJECT)
    @action(detail=False, methods=["post"])
    def reorder(self, request):
        ids = [int(i) for i in request.data.get("ids", []) if str(i).isdigit()]
        if not ids:
            raise DomainError("Send the ids in their new order.", code="bad_order")
        model = self.get_queryset().model
        objects = {o.pk: o for o in model.objects.filter(pk__in=ids)}
        if len(objects) != len(set(ids)):
            raise DomainError("Some of those items no longer exist. Refresh and try again.", code="bad_order")
        with transaction.atomic():
            for position, pk in enumerate(ids):
                objects[pk].position = position
            model.objects.bulk_update(objects.values(), ["position"])
        # bulk_update skips signals, so fire the cache bump the model's save would have.
        self.after_reorder()
        record(
            request,
            AuditLog.Action.UPDATE,
            object_type=model._meta.label,
            object_repr=f"reordered {len(ids)}",
            changes={"order": ids},
        )
        return Response({"ids": ids})


class SafeImageField(serializers.ImageField):
    """Validates the upload is a real image, re-encodes it (dropping metadata), and accepts "" to clear it."""

    def __init__(self, *args, max_side: int = 2400, **kwargs):
        self.max_side = max_side
        kwargs.setdefault("required", False)
        super().__init__(*args, **kwargs)
        # Lets an empty multipart value through as "" (clear) instead of being skipped.
        self.allow_blank = not self.required

    def validate_empty_values(self, data):
        if data == "" and not self.required:
            return True, ""
        return super().validate_empty_values(data)

    def to_internal_value(self, data):
        from .images import reencode_upload, validate_image_file

        try:
            validate_image_file(data)
        except DjangoValidationError as exc:
            raise serializers.ValidationError(exc.messages) from exc
        except AttributeError as exc:
            raise serializers.ValidationError("Upload an image file.") from exc
        return reencode_upload(data, max_side=self.max_side)


class FormBooleanMixin:
    """With multipart data DRF reads a missing boolean as False (HTML checkbox rules).

    Admin forms post uploads as multipart, so fall back to the model default instead.
    """

    def __init__(self, *args, **kwargs):
        super().__init__(*args, **kwargs)
        for field in self.fields.values():
            if isinstance(field, serializers.BooleanField):
                field.default_empty_html = serializers.empty
