from datetime import timedelta

from celery import shared_task
from django.utils import timezone

from .models import PageVisit
from .services import rollup_day


@shared_task
def rollup_daily_metrics() -> str:
    """Roll up yesterday's visits and prune raw page views older than 90 days."""
    yesterday = timezone.localdate() - timedelta(days=1)
    metric = rollup_day(yesterday)
    PageVisit.objects.filter(created_at__lt=timezone.now() - timedelta(days=90)).delete()
    return f"{metric.date}: {metric.visits} visits"
