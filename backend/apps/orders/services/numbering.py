from django.db import connection, transaction
from django.utils import timezone

from apps.orders.models import DocumentCounter


def next_order_number() -> str:
    """SRT-2026-001042. Backed by a Postgres sequence: unique, concurrency-safe, never reused."""
    with connection.cursor() as cursor:
        cursor.execute("SELECT nextval('orders_order_number_seq')")
        (value,) = cursor.fetchone()
    return f"SRT-{timezone.localdate().year}-{value:06d}"


def financial_year(date=None) -> str:
    date = date or timezone.localdate()
    start = date.year if date.month >= 4 else date.year - 1
    return f"{start}-{str(start + 1)[-2:]}"


@transaction.atomic
def _next(key: str) -> int:
    counter, _ = DocumentCounter.objects.select_for_update().get_or_create(key=key)
    counter.value += 1
    counter.save(update_fields=["value"])
    return counter.value


def next_invoice_number() -> str:
    """SRT/INV/2026-27/00001: sequential within each Indian financial year, as GST requires."""
    fy = financial_year()
    return f"SRT/INV/{fy}/{_next(f'invoice:{fy}'):05d}"


def next_return_number() -> str:
    return f"RET-{timezone.localdate().year}-{_next('return'):05d}"
