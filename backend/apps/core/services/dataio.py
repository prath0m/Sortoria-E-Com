"""CSV import and export. Imports validate row by row, apply what's valid and return a report of the rest."""

import csv
import io
import secrets
from collections import OrderedDict
from dataclasses import dataclass, field
from decimal import Decimal, InvalidOperation

from django.core.exceptions import ValidationError
from django.core.files.base import ContentFile
from django.db import transaction
from django.utils.text import slugify

MAX_ROWS = 20_000
MAX_BYTES = 5 * 1024 * 1024

PRODUCT_COLUMNS = [
    "product_slug",
    "product_name",
    "category_slug",
    "brand",
    "short_description",
    "description",
    "tax_rate",
    "hsn_code",
    "product_type",
    "is_active",
    "sku",
    "options",
    "price",
    "mrp",
    "stock",
    "weight_g",
]
INVENTORY_COLUMNS = ["sku", "stock"]
PINCODE_COLUMNS = ["pincode", "zone", "city", "state", "state_code", "is_active"]

TEMPLATES = {
    "products": (
        PRODUCT_COLUMNS,
        [
            "linen-camp-shirt",
            "Linen Camp Shirt",
            "mens-clothing",
            "Wayfarer",
            "Breathable linen for warm days.",
            "<p>Cut from washed linen.</p>",
            "5",
            "6205",
            "standard",
            "yes",
            "LCS-NAVY-M",
            "Colour=Navy; Size=M",
            "2490",
            "2990",
            "12",
            "300",
        ],
    ),
    "inventory": (INVENTORY_COLUMNS, ["LCS-NAVY-M", "12"]),
    "pincodes": (PINCODE_COLUMNS, ["400001", "Metro", "Mumbai", "Maharashtra", "27", "yes"]),
}


class RowError(Exception):
    pass


@dataclass
class ImportResult:
    total: int = 0
    succeeded: int = 0
    errors: list[tuple[dict, str]] = field(default_factory=list)
    fieldnames: list[str] = field(default_factory=list)

    def report(self) -> bytes | None:
        if not self.errors:
            return None
        out = io.StringIO()
        writer = csv.DictWriter(out, fieldnames=["row", *self.fieldnames, "error"], extrasaction="ignore")
        writer.writeheader()
        for row, message in self.errors:
            writer.writerow({**row, "error": message})
        return out.getvalue().encode("utf-8-sig")


# --------------------------------------------------------------------------- parsing helpers
def read_rows(data: bytes, required: list[str]) -> tuple[list[str], list[dict]]:
    if len(data) > MAX_BYTES:
        raise ValidationError("Files must be 5 MB or smaller. Split larger catalogues into several files.")
    try:
        text = data.decode("utf-8-sig")
    except UnicodeDecodeError as exc:
        raise ValidationError("Save the file as CSV (UTF-8) and try again.") from exc
    reader = csv.DictReader(io.StringIO(text))
    fieldnames = [f.strip().lower() for f in (reader.fieldnames or [])]
    missing = [c for c in required if c not in fieldnames]
    if missing:
        raise ValidationError(f"Missing columns: {', '.join(missing)}. Download the template to see the layout.")
    reader.fieldnames = fieldnames
    rows = []
    for i, row in enumerate(reader, start=2):  # row 1 is the header
        if i - 1 > MAX_ROWS:
            raise ValidationError(f"Files can have up to {MAX_ROWS:,} rows.")
        clean = {k: (v or "").strip() for k, v in row.items() if k}
        if any(clean.values()):
            rows.append({"row": i, **clean})
    return fieldnames, rows


def _paise(value: str, label: str, *, required=True) -> int | None:
    if not value:
        if required:
            raise RowError(f"{label} is required.")
        return None
    try:
        amount = Decimal(value.replace(",", "").replace("₹", ""))
    except InvalidOperation as exc:
        raise RowError(f"{label} must be a number in rupees, like 2490 or 2490.50.") from exc
    if amount < 1:
        raise RowError(f"{label} must be at least ₹1.")
    return int((amount * 100).to_integral_value())


def _int(value: str, label: str, *, default=None, minimum=0) -> int:
    if value == "":
        if default is None:
            raise RowError(f"{label} is required.")
        return default
    try:
        number = int(Decimal(value))
    except (InvalidOperation, ValueError) as exc:
        raise RowError(f"{label} must be a whole number.") from exc
    if number < minimum:
        raise RowError(f"{label} can't be below {minimum}.")
    return number


def _bool(value: str, default=True) -> bool:
    if value == "":
        return default
    return value.lower() in ("yes", "y", "true", "1", "active")


# --------------------------------------------------------------------------- imports
def import_inventory(data: bytes, actor=None) -> ImportResult:
    from apps.catalog.models import ProductVariant, StockMovement
    from apps.catalog.services.stock import set_stock

    fieldnames, rows = read_rows(data, INVENTORY_COLUMNS)
    result = ImportResult(total=len(rows), fieldnames=fieldnames)
    variants = dict(ProductVariant.objects.filter(sku__in=[r["sku"] for r in rows]).values_list("sku", "pk"))
    touched = set()
    for row in rows:
        try:
            if row["sku"] not in variants:
                raise RowError("No variant has this SKU.")
            stock = _int(row["stock"], "Stock")
            with transaction.atomic():
                set_stock(variants[row["sku"]], stock, StockMovement.Reason.IMPORT, reference="CSV import", actor=actor)
            touched.add(variants[row["sku"]])
            result.succeeded += 1
        except RowError as exc:
            result.errors.append((row, str(exc)))
    if touched:
        from apps.catalog.services.aggregates import refresh_products

        refresh_products(list(ProductVariant.objects.filter(pk__in=touched).values_list("product_id", flat=True)))
    return result


def import_pincodes(data: bytes, actor=None) -> ImportResult:
    from apps.accounts.serializers import STATE_CODES
    from apps.shipping.models import ServiceablePincode, ShippingZone

    fieldnames, rows = read_rows(data, ["pincode", "zone", "city", "state"])
    result = ImportResult(total=len(rows), fieldnames=fieldnames)
    zones = {z.name.lower(): z for z in ShippingZone.objects.all()}
    for row in rows:
        try:
            pincode = row["pincode"]
            if not (len(pincode) == 6 and pincode.isdigit() and pincode[0] != "0"):
                raise RowError("Pincodes are six digits and don't start with 0.")
            zone = zones.get(row["zone"].lower())
            if zone is None:
                raise RowError(f"No shipping zone called “{row['zone']}”. Create it first.")
            if not row["city"] or not row["state"]:
                raise RowError("City and state are required.")
            state_code = row.get("state_code") or STATE_CODES.get(row["state"], "")
            ServiceablePincode.objects.update_or_create(
                pincode=pincode,
                defaults={
                    "zone": zone,
                    "city": row["city"][:80],
                    "state": row["state"][:80],
                    "state_code": state_code[:2],
                    "is_active": _bool(row.get("is_active", "")),
                },
            )
            result.succeeded += 1
        except RowError as exc:
            result.errors.append((row, str(exc)))
    return result


def _parse_options(text: str, attributes: dict) -> list:
    """'Colour=Navy; Size=M' -> AttributeValue objects, creating new values on existing attributes."""
    from apps.catalog.models import AttributeValue

    values = []
    for part in [p.strip() for p in text.split(";") if p.strip()]:
        if "=" not in part:
            raise RowError(f"Write options as Name=Value; “{part}” is missing the =.")
        name, value = (s.strip() for s in part.split("=", 1))
        attribute = attributes.get(name.lower())
        if attribute is None:
            raise RowError(f"No attribute called “{name}”. Add it under Attributes first.")
        if not attribute.is_variant_axis:
            raise RowError(f"“{name}” isn't something products vary by.")
        match = next((v for v in attribute.values.all() if v.value.lower() == value.lower()), None)
        if match is None:
            match = AttributeValue.objects.create(
                attribute=attribute, value=value[:60], slug=slugify(value)[:70] or "value"
            )
            attribute._prefetched_objects_cache = {}
        values.append(match)
    return values


def import_products(data: bytes, actor=None) -> ImportResult:
    from apps.catalog.models import Attribute, Brand, Category, Product, ProductVariant, StockMovement
    from apps.catalog.services.aggregates import refresh_products, refresh_search_vectors
    from apps.catalog.services.stock import set_stock
    from apps.core import caching

    fieldnames, rows = read_rows(data, ["product_slug", "sku", "price"])
    result = ImportResult(total=len(rows), fieldnames=fieldnames)
    categories = {c.slug: c for c in Category.objects.all()}
    attributes = {a.name.lower(): a for a in Attribute.objects.prefetch_related("values")}
    valid_rates = {r for r, _ in Product._meta.get_field("tax_rate").choices}
    groups: OrderedDict[str, list[dict]] = OrderedDict()
    for row in rows:
        groups.setdefault(row["product_slug"].lower(), []).append(row)

    touched = []
    for slug, group in groups.items():
        first = group[0]
        try:
            with transaction.atomic():
                if not slug or slugify(slug) != slug:
                    raise RowError("product_slug must be lowercase words joined by hyphens.")
                product = Product.objects.filter(slug=slug).first()
                creating = product is None
                if creating:
                    if not first.get("product_name") or not first.get("category_slug"):
                        raise RowError("New products need product_name and category_slug.")
                    product = Product(slug=slug)
                if first.get("product_name"):
                    product.name = first["product_name"][:160]
                if first.get("category_slug"):
                    category = categories.get(first["category_slug"])
                    if category is None:
                        raise RowError(f"No category with slug “{first['category_slug']}”.")
                    if not category.is_leaf():
                        raise RowError("Use the most specific category, not a department.")
                    product.category = category
                if first.get("brand"):
                    product.brand = Brand.objects.filter(name__iexact=first["brand"]).first() or Brand.objects.create(
                        name=first["brand"][:80]
                    )
                for column, attr, limit in (
                    ("short_description", "short_description", 300),
                    ("hsn_code", "hsn_code", 8),
                ):
                    if first.get(column):
                        setattr(product, attr, first[column][:limit])
                if first.get("description"):
                    product.description = first["description"]
                if first.get("tax_rate"):
                    rate = _int(first["tax_rate"], "tax_rate")
                    if rate not in valid_rates:
                        raise RowError(f"tax_rate must be one of {', '.join(map(str, sorted(valid_rates)))}.")
                    product.tax_rate = rate
                if first.get("product_type"):
                    if first["product_type"] not in Product.Type.values:
                        raise RowError("product_type is standard or bulky.")
                    product.product_type = first["product_type"]
                if first.get("is_active"):
                    product.is_active = _bool(first["is_active"])
                product.save()

                for row in group:
                    try:
                        _import_variant(product, row, attributes, actor, ProductVariant, StockMovement, set_stock)
                    except RowError as exc:
                        raise RowError(f"SKU {row.get('sku') or '(blank)'}: {exc}") from exc
                if creating and not product.variants.exists():
                    raise RowError("New products need at least one variant row.")
            touched.append(product.pk)
            result.succeeded += len(group)
        except (RowError, ValidationError) as exc:
            message = str(exc) if isinstance(exc, RowError) else "; ".join(exc.messages)
            result.errors.extend((row, message) for row in group)

    if touched:
        refresh_products(touched)
        refresh_search_vectors(touched)
        caching.bump(caching.CATALOG, caching.NAVIGATION, caching.HOME)
    return result


def _import_variant(product, row, attributes, actor, ProductVariant, StockMovement, set_stock):  # noqa: N803
    sku = row.get("sku", "").upper()
    if not sku:
        raise RowError("sku is required.")
    variant = ProductVariant.objects.filter(sku=sku).first()
    if variant and variant.product_id != product.pk:
        raise RowError("This SKU belongs to another product.")
    price = _paise(row.get("price", ""), "price")
    mrp = _paise(row.get("mrp", ""), "mrp", required=False)
    if mrp is not None and mrp < price:
        raise RowError("mrp can't be below price.")
    creating = variant is None
    variant = variant or ProductVariant(product=product, sku=sku)
    variant.price_paise = price
    variant.compare_at_paise = mrp
    if row.get("weight_g"):
        variant.weight_g = _int(row["weight_g"], "weight_g", minimum=1)
    variant.full_clean(exclude=["product", "stock"])
    variant.save()
    if row.get("options") or creating:
        variant.option_values.set(_parse_options(row.get("options", ""), attributes))
    if row.get("stock") != "":
        stock = _int(row.get("stock", ""), "stock", default=0)
        set_stock(variant.pk, stock, StockMovement.Reason.IMPORT, reference="CSV import", actor=actor)


IMPORTERS = {"products": import_products, "inventory": import_inventory, "pincodes": import_pincodes}


def run_job(job) -> None:
    """Execute an ImportJob and store the counts and error report on it."""
    from apps.core.models import ImportJob

    job.status = ImportJob.Status.RUNNING
    job.save(update_fields=["status", "updated_at"])
    try:
        job.file.open("rb")
        data = job.file.read()
        job.file.close()
        result = IMPORTERS[job.kind](data, actor=job.created_by)
    except ValidationError as exc:
        job.status = ImportJob.Status.FAILED
        job.message = "; ".join(exc.messages)
        job.save(update_fields=["status", "message", "updated_at"])
        return
    job.total_rows = result.total
    job.success_rows = result.succeeded
    job.error_rows = len(result.errors)
    report = result.report()
    if report:
        # Random names: media is served publicly, so these must not be guessable.
        job.error_report.save(f"{secrets.token_urlsafe(16)}.csv", ContentFile(report), save=False)
    job.status = ImportJob.Status.COMPLETED
    job.message = (
        f"{result.succeeded} of {result.total} rows imported."
        if not result.errors
        else f"{result.succeeded} of {result.total} rows imported; {len(result.errors)} need fixing."
    )
    job.save()


# --------------------------------------------------------------------------- exports
def _yn(value: bool) -> str:
    return "yes" if value else "no"


def _rupees(paise) -> str:
    if paise is None:
        return ""
    return f"{paise / 100:.2f}".rstrip("0").rstrip(".")


def export_rows(kind: str, params) -> tuple[list[str], object]:
    """Return (header, row iterator) for an export. Product exports re-import cleanly."""
    if kind == "products":
        from apps.catalog.models import ProductVariant

        qs = (
            ProductVariant.objects.select_related("product__category", "product__brand")
            .prefetch_related("option_values__attribute")
            .order_by("product__name", "position", "id")
        )

        def rows():
            for v in qs.iterator(chunk_size=500):
                p = v.product
                options = "; ".join(
                    f"{o.attribute.name}={o.value}"
                    for o in sorted(v.option_values.all(), key=lambda o: (o.attribute.position, o.attribute_id))
                )
                yield [
                    p.slug,
                    p.name,
                    p.category.slug,
                    p.brand.name if p.brand else "",
                    p.short_description,
                    p.description,
                    p.tax_rate,
                    p.hsn_code,
                    p.product_type,
                    _yn(p.is_active),
                    v.sku,
                    options,
                    _rupees(v.price_paise),
                    _rupees(v.compare_at_paise),
                    v.stock,
                    v.weight_g,
                ]

        return PRODUCT_COLUMNS, rows()

    if kind == "inventory":
        from apps.catalog.models import ProductVariant

        qs = ProductVariant.objects.select_related("product").order_by("product__name", "position")
        return ["sku", "stock", "product", "price"], (
            [v.sku, v.stock, v.product.name, _rupees(v.price_paise)] for v in qs.iterator(chunk_size=1000)
        )

    if kind == "orders":
        from apps.orders.models import Order

        qs = Order.objects.order_by("-created_at")
        if params.get("date_from"):
            qs = qs.filter(created_at__date__gte=params["date_from"])
        if params.get("date_to"):
            qs = qs.filter(created_at__date__lte=params["date_to"])
        if params.get("status"):
            qs = qs.filter(status=params["status"])
        header = [
            "number",
            "created_at",
            "status",
            "payment_method",
            "payment_status",
            "customer",
            "email",
            "phone",
            "city",
            "state",
            "pincode",
            "subtotal",
            "discount",
            "shipping",
            "cod_fee",
            "tax",
            "total",
            "coupon",
            "invoice_number",
        ]

        def order_rows():
            for o in qs.iterator(chunk_size=500):
                a = o.shipping_address
                discount = o.item_discount_paise + o.bundle_discount_paise + o.coupon_discount_paise
                yield [
                    o.number,
                    o.created_at.isoformat(),
                    o.status,
                    o.payment_method,
                    o.payment_status,
                    a.get("full_name", ""),
                    o.email,
                    o.phone,
                    a.get("city", ""),
                    a.get("state", ""),
                    a.get("pincode", ""),
                    _rupees(o.subtotal_paise),
                    _rupees(discount),
                    _rupees(o.shipping_fee_paise),
                    _rupees(o.cod_fee_paise),
                    _rupees(o.tax_total_paise),
                    _rupees(o.grand_total_paise),
                    o.coupon_code,
                    o.invoice_number,
                ]

        return header, order_rows()

    if kind == "customers":
        from django.db.models import Count, Q, Sum
        from django.db.models.functions import Coalesce

        from apps.accounts.models import User
        from apps.orders.models import Order

        success = Q(orders__status__in=Order.SUCCESSFUL_STATUSES)
        qs = (
            User.objects.filter(role=User.Role.CUSTOMER)
            .annotate(
                n=Count("orders", filter=success, distinct=True),
                ltv=Coalesce(Sum("orders__grand_total_paise", filter=success), 0),
            )
            .order_by("-date_joined")
        )
        return [
            "email",
            "first_name",
            "last_name",
            "phone",
            "joined",
            "orders",
            "lifetime_value",
            "marketing_opt_in",
            "active",
        ], (
            [
                u.email,
                u.first_name,
                u.last_name,
                u.phone,
                u.date_joined.date().isoformat(),
                u.n,
                _rupees(u.ltv) or "0",
                _yn(u.marketing_opt_in),
                _yn(u.is_active),
            ]
            for u in qs.iterator(chunk_size=1000)
        )

    if kind == "pincodes":
        from apps.shipping.models import ServiceablePincode

        qs = ServiceablePincode.objects.select_related("zone")
        return PINCODE_COLUMNS, (
            [p.pincode, p.zone.name, p.city, p.state, p.state_code, _yn(p.is_active)]
            for p in qs.iterator(chunk_size=2000)
        )

    raise KeyError(kind)


class Echo:
    """File-like that returns what's written, for streaming CSV responses."""

    def write(self, value):
        return value


def stream_csv(header, rows):
    writer = csv.writer(Echo())
    yield "﻿"  # BOM so Excel reads UTF-8 (₹, accented names) correctly
    yield writer.writerow(header)
    for row in rows:
        yield writer.writerow(row)
