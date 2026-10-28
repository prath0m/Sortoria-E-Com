from django.db import models


class PageVisit(models.Model):
    """One row per page view from the storefront beacon. Rolled up nightly, pruned after 90 days."""

    session_id = models.CharField(max_length=64, db_index=True)
    path = models.CharField(max_length=300)
    referrer = models.CharField(max_length=300, blank=True)
    created_at = models.DateTimeField(auto_now_add=True, db_index=True)

    class Meta:
        ordering = ("-created_at",)

    def __str__(self):
        return self.path


class DailyMetric(models.Model):
    date = models.DateField(unique=True)
    visits = models.PositiveIntegerField(default=0, help_text="Distinct sessions.")
    page_views = models.PositiveIntegerField(default=0)
    product_views = models.PositiveIntegerField(default=0)

    class Meta:
        ordering = ("-date",)

    def __str__(self):
        return f"{self.date}: {self.visits} visits"
