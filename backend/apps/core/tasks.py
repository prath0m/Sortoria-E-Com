from celery import shared_task


@shared_task
def run_import(job_id: int) -> None:
    from .models import ImportJob
    from .services.dataio import run_job

    job = ImportJob.objects.filter(pk=job_id, status=ImportJob.Status.PENDING).first()
    if job is not None:
        run_job(job)


@shared_task
def build_model_renditions(label: str, pk: int) -> None:
    """(Re)build WebP renditions for any image field of a RenditionsMixin model that changed."""
    from django.apps import apps

    from .images import build_renditions

    model = apps.get_model(label)
    obj = model.objects.filter(pk=pk).first()
    if obj is None:
        return
    renditions = dict(obj.renditions or {})
    changed = False
    for field in model.RENDITION_FIELDS:
        file = getattr(obj, field)
        if not file:
            changed |= renditions.pop(field, None) is not None
            continue
        if (renditions.get(field) or {}).get("src") == file.name:
            continue
        renditions[field] = {"src": file.name, **build_renditions(file)}
        changed = True
    if changed:
        # update() skips post_save, so this doesn't trigger another build; refresh cached pages instead.
        model.objects.filter(pk=pk).update(renditions=renditions)
        from . import caching

        caching.bump(caching.HOME, caching.NAVIGATION, caching.CATALOG)


def register_renditions(model) -> None:
    """Rebuild renditions after every save of `model` (cheap when nothing changed)."""
    from django.db import transaction
    from django.db.models.signals import post_save

    def _queue(sender, instance, **kwargs):
        label = sender._meta.label
        pk = instance.pk
        transaction.on_commit(lambda: build_model_renditions.delay(label, pk))

    post_save.connect(_queue, sender=model, weak=False, dispatch_uid=f"renditions-{model._meta.label}")
