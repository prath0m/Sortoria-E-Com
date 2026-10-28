"""GST tax invoices rendered with WeasyPrint."""

from django.conf import settings
from django.core.files.base import ContentFile
from django.template.loader import render_to_string
from django.utils import timezone

from apps.core.models import StoreSettings
from apps.core.money import amount_in_words, rupees
from apps.orders.models import Order

from .numbering import next_invoice_number
from .presentation import address_lines


def _tax_rows(order: Order) -> list[dict]:
    intra = order.igst_paise == 0
    rows = []
    for item in order.items.all():
        taxable = item.line_total_paise - item.tax_paise
        half = item.tax_paise // 2
        rows.append(
            {
                "name": item.product_name,
                "variant": item.variant_label,
                "sku": item.sku,
                "hsn": item.hsn_code,
                "quantity": item.quantity,
                "unit_price": rupees(item.unit_price_paise),
                "discount": rupees(item.line_discount_paise) if item.line_discount_paise else "—",
                "taxable": rupees(taxable),
                "rate": item.tax_rate,
                "cgst": rupees(half) if intra else "—",
                "sgst": rupees(item.tax_paise - half) if intra else "—",
                "igst": "—" if intra else rupees(item.tax_paise),
                "total": rupees(item.line_total_paise),
            }
        )
    return rows


def render_invoice_pdf(order: Order) -> bytes:
    from weasyprint import HTML  # heavy import; only load when rendering

    store = StoreSettings.load()
    service_paise = order.shipping_fee_paise + order.cod_fee_paise
    context = {
        "store": store,
        "order": order,
        "invoice_number": order.invoice_number,
        "invoice_date": (order.placed_at or timezone.now()).strftime("%d %b %Y"),
        "bill_to": address_lines(order.billing_address or order.shipping_address),
        "ship_to": address_lines(order.shipping_address),
        "rows": _tax_rows(order),
        "intra_state": order.igst_paise == 0,
        "subtotal": rupees(order.subtotal_paise),
        "bundle_discount": rupees(order.bundle_discount_paise) if order.bundle_discount_paise else "",
        "coupon_discount": rupees(order.coupon_discount_paise) if order.coupon_discount_paise else "",
        "service_charges": rupees(service_paise) if service_paise else "",
        "cgst": rupees(order.cgst_paise),
        "sgst": rupees(order.sgst_paise),
        "igst": rupees(order.igst_paise),
        "tax_total": rupees(order.tax_total_paise),
        "total": rupees(order.grand_total_paise),
        "total_words": amount_in_words(order.grand_total_paise),
        "payment": "Cash on delivery" if order.payment_method == "cod" else "Prepaid (online)",
        "place_of_supply": order.shipping_address.get("state", ""),
    }
    html = render_to_string("invoices/invoice.html", context)
    return HTML(string=html, base_url=str(settings.BASE_DIR)).write_pdf()


def ensure_invoice(order: Order) -> Order:
    """Assign the invoice number (once) and (re)render the PDF."""
    if not order.invoice_number:
        order.invoice_number = next_invoice_number()
        order.save(update_fields=["invoice_number"])
    pdf = render_invoice_pdf(order)
    if order.invoice_pdf:
        order.invoice_pdf.delete(save=False)
    order.invoice_pdf.save(f"{order.number}.pdf", ContentFile(pdf), save=False)
    order.save(update_fields=["invoice_pdf"])
    return order
