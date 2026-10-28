from celery import shared_task


@shared_task
def run_import(job_id: int) -> None:
    from .models import ImportJob
    from .services.dataio import run_job

    job = ImportJob.objects.filter(pk=job_id, status=ImportJob.Status.PENDING).first()
    if job is not None:
        run_job(job)
