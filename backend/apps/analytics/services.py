"""Dashboard metrics. Order-based figures are computed live; visits come from daily rollups + today."""

from collections import defaultdict
from dataclasses import dataclass
from datetime import date, datetime, time, timedelta

from django.db.models import Count, F, Min, Q, Sum
from django.db.models.functions import Coalesce, TruncDay, TruncHour, TruncMonth
from django.utils import timezone

from apps.catalog.models import Category, Product, ProductVariant
from apps.core.models import StoreSettings
from apps.orders.models import Order, OrderItem, OrderStatus

from .models import DailyMetric, PageVisit

SUCCESS = Order.SUCCESSFUL_STATUSES
STATUS_GROUPS = [
    ("Awaiting payment", (OrderStatus.PENDING_PAYMENT, OrderStatus.PAYMENT_FAILED)),
    ("Processing", (OrderStatus.PLACED, OrderStatus.CONFIRMED, OrderStatus.PACKED)),
    ("In transit", (OrderStatus.SHIPPED, OrderStatus.OUT_FOR_DELIVERY)),
    ("Delivered", (OrderStatus.DELIVERED,)),
    ("Cancelled", (OrderStatus.CANCELLED,)),
]


@dataclass
class Range:
    start: datetime
    end: datetime
    granularity: str  # hour | day | month
    label: str

    @property
    def previous(self) -> "Range":
        length = self.end - self.start
        return Range(self.start - length, self.start, self.granularity, "previous")


def _day_start(d: date) -> datetime:
    return timezone.make_aware(datetime.combine(d, time.min))


def parse_range(preset: str | None, start: str | None = None, end: str | None = None) -> Range:
    today = timezone.localdate()
    tomorrow = _day_start(today + timedelta(days=1))
    if preset == "custom" and start and end:
        s, e = date.fromisoformat(start), date.fromisoformat(end)
        if e < s:
            s, e = e, s
        span = (e - s).days + 1
        granularity = "hour" if span <= 2 else "day" if span <= 92 else "month"
        return Range(_day_start(s), _day_start(e + timedelta(days=1)), granularity, "custom")
    if preset == "today":
        return Range(_day_start(today), tomorrow, "hour", "today")
    if preset == "7d":
        return Range(_day_start(today - timedelta(days=6)), tomorrow, "day", "7d")
    if preset == "12m":
        first = (today.replace(day=1) - timedelta(days=335)).replace(day=1)
        return Range(_day_start(first), tomorrow, "month", "12m")
    return Range(_day_start(today - timedelta(days=29)), tomorrow, "day", "30d")


def _successful(r: Range):
    return Order.objects.filter(status__in=SUCCESS, placed_at__gte=r.start, placed_at__lt=r.end)


def _visits(r: Range) -> int:
    start_day, end_day = timezone.localtime(r.start).date(), timezone.localtime(r.end - timedelta(seconds=1)).date()
    rolled = DailyMetric.objects.filter(date__gte=start_day, date__lte=end_day).aggregate(n=Sum("visits"))["n"] or 0
    rolled_days = set(DailyMetric.objects.filter(date__gte=start_day, date__lte=end_day).values_list("date", flat=True))
    today = timezone.localdate()
    if start_day <= today <= end_day and today not in rolled_days:
        rolled += PageVisit.objects.filter(created_at__gte=_day_start(today)).values("session_id").distinct().count()
    return rolled


def _totals(r: Range) -> dict:
    orders = _successful(r)
    agg = orders.aggregate(revenue=Coalesce(Sum("grand_total_paise"), 0), count=Count("id"))
    customers = orders.values("email").distinct().count()
    visits = _visits(r)
    return {
        "revenue": agg["revenue"],
        "orders": agg["count"],
        "aov": agg["revenue"] // agg["count"] if agg["count"] else 0,
        "customers": customers,
        "conversion": round(agg["count"] * 100 / visits, 2) if visits else 0.0,
        "visits": visits,
    }


def _change(current, previous):
    if not previous:
        return None
    return round((current - previous) * 100 / previous, 1)


def low_stock_queryset():
    default = StoreSettings.load().low_stock_threshold_default
    return (
        ProductVariant.objects.filter(is_active=True, product__is_active=True)
        .filter(
            Q(low_stock_threshold__isnull=False, stock__lte=F("low_stock_threshold"))
            | Q(low_stock_threshold__isnull=True, stock__lte=default)
        )
        .select_related("product")
        .prefetch_related("option_values__attribute")
        .order_by("stock", "product__name")
    )


def _bucket_keys(r: Range) -> list[datetime]:
    keys = []
    cursor = timezone.localtime(r.start)
    end = timezone.localtime(r.end)
    while cursor < end:
        keys.append(cursor)
        if r.granularity == "hour":
            cursor += timedelta(hours=1)
        elif r.granularity == "day":
            cursor += timedelta(days=1)
        else:
            cursor = (cursor.replace(day=1) + timedelta(days=32)).replace(day=1)
    return keys


def _trunc(r: Range):
    return {"hour": TruncHour, "day": TruncDay, "month": TruncMonth}[r.granularity](
        "placed_at", tzinfo=timezone.get_current_timezone()
    )


def revenue_series(r: Range) -> list[dict]:
    rows = (
        _successful(r)
        .annotate(bucket=_trunc(r))
        .values("bucket")
        .annotate(revenue=Sum("grand_total_paise"), orders=Count("id"))
    )
    found = {timezone.localtime(row["bucket"]): row for row in rows}
    series = []
    for key in _bucket_keys(r):
        row = found.get(key, {})
        series.append(
            {"bucket": key.isoformat(), "revenue": row.get("revenue", 0) or 0, "orders": row.get("orders", 0)}
        )
    return series


def orders_by_status(r: Range) -> list[dict]:
    counts = dict(
        Order.objects.filter(created_at__gte=r.start, created_at__lt=r.end)
        .values_list("status")
        .annotate(n=Count("id"))
    )
    return [{"label": label, "count": sum(counts.get(s, 0) for s in statuses)} for label, statuses in STATUS_GROUPS]


def _item_rows(r: Range):
    return (
        OrderItem.objects.filter(order__status__in=SUCCESS, order__placed_at__gte=r.start, order__placed_at__lt=r.end)
        .values("product_id_snapshot", "product_name")
        .annotate(revenue=Sum("line_total_paise"), units=Sum("quantity"))
    )


def top_products(r: Range, limit: int = 8) -> list[dict]:
    rows = sorted(_item_rows(r), key=lambda x: x["revenue"], reverse=True)[:limit]
    return [
        {
            "product_id": x["product_id_snapshot"],
            "name": x["product_name"],
            "revenue": x["revenue"],
            "units": x["units"],
        }
        for x in rows
    ]


def sales_by_category(r: Range) -> list[dict]:
    rows = list(_item_rows(r))
    paths = dict(
        Product.objects.filter(pk__in=[x["product_id_snapshot"] for x in rows]).values_list("pk", "category__path")
    )
    roots = {c.path: c.name for c in Category.get_root_nodes()}
    totals: dict[str, int] = defaultdict(int)
    for x in rows:
        path = paths.get(x["product_id_snapshot"])
        name = roots.get(path[: Category.steplen], "Other") if path else "Other"
        totals[name] += x["revenue"]
    return sorted(({"category": k, "revenue": v} for k, v in totals.items()), key=lambda d: d["revenue"], reverse=True)


def customer_split(r: Range) -> list[dict]:
    """Per bucket: orders from first-time customers vs returning ones (identity = email)."""
    orders = list(_successful(r).values("email", "placed_at"))
    first = dict(
        Order.objects.filter(status__in=SUCCESS, email__in={o["email"] for o in orders})
        .values("email")
        .annotate(first=Min("placed_at"))
        .values_list("email", "first")
    )
    keys = _bucket_keys(r)

    def bucket(moment):
        local = timezone.localtime(moment)
        if r.granularity == "hour":
            return local.replace(minute=0, second=0, microsecond=0)
        if r.granularity == "day":
            return local.replace(hour=0, minute=0, second=0, microsecond=0)
        return local.replace(day=1, hour=0, minute=0, second=0, microsecond=0)

    counts = {k: {"new": 0, "returning": 0} for k in keys}
    for o in orders:
        key = bucket(o["placed_at"])
        if key in counts:
            counts[key]["new" if first.get(o["email"]) == o["placed_at"] else "returning"] += 1
    return [{"bucket": k.isoformat(), **v} for k, v in counts.items()]


def recent_orders(limit: int = 8) -> list[dict]:
    orders = Order.objects.exclude(status=OrderStatus.PENDING_PAYMENT).order_by("-created_at")[:limit]
    return [
        {
            "number": o.number,
            "customer": o.shipping_address.get("full_name", o.email),
            "email": o.email,
            "total": o.grand_total_paise,
            "status": o.status,
            "status_label": o.get_status_display(),
            "created_at": o.created_at,
        }
        for o in orders
    ]


def dashboard(r: Range) -> dict:
    current, previous = _totals(r), _totals(r.previous)
    low_stock = low_stock_queryset()
    kpis = {
        key: {"value": current[key], "previous": previous[key], "change": _change(current[key], previous[key])}
        for key in ("revenue", "orders", "aov", "customers", "conversion")
    }
    kpis["pending_orders"] = {
        "value": Order.objects.filter(
            status__in=(OrderStatus.PLACED, OrderStatus.CONFIRMED, OrderStatus.PACKED)
        ).count(),
        "previous": None,
        "change": None,
    }
    kpis["low_stock"] = {"value": low_stock.count(), "previous": None, "change": None}
    return {
        "range": {"label": r.label, "start": r.start, "end": r.end, "granularity": r.granularity},
        "kpis": kpis,
        "visits": current["visits"],
        "revenue_series": revenue_series(r),
        "previous_revenue_series": revenue_series(r.previous),
        "orders_by_status": orders_by_status(r),
        "top_products": top_products(r),
        "sales_by_category": sales_by_category(r),
        "customer_split": customer_split(r),
        "recent_orders": recent_orders(),
        "low_stock": [
            {
                "variant_id": v.pk,
                "product_id": v.product_id,
                "product": v.product.name,
                "label": v.label,
                "sku": v.sku,
                "stock": v.stock,
                "threshold": v.threshold(),
            }
            for v in low_stock[:8]
        ],
    }


def rollup_day(day: date) -> DailyMetric:
    start = _day_start(day)
    visits = PageVisit.objects.filter(created_at__gte=start, created_at__lt=start + timedelta(days=1))
    metric, _ = DailyMetric.objects.update_or_create(
        date=day,
        defaults={
            "visits": visits.values("session_id").distinct().count(),
            "page_views": visits.count(),
            "product_views": visits.filter(path__startswith="/products/").count(),
        },
    )
    return metric
