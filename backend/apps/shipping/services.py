"""Delivery estimates: which methods serve a pincode, what they cost and when they arrive."""

from dataclasses import dataclass
from datetime import date, datetime, timedelta

from django.utils import timezone

from apps.core.models import StoreSettings

from .models import ServiceablePincode, ShippingMethod, ShippingZone


@dataclass
class ShippingOption:
    code: str
    name: str
    description: str
    fee_paise: int
    base_fee_paise: int
    free: bool
    available: bool
    unavailable_reason: str
    eta_from: date | None
    eta_to: date | None

    def as_dict(self):
        return {
            "code": self.code,
            "name": self.name,
            "description": self.description,
            "fee_paise": self.fee_paise,
            "base_fee_paise": self.base_fee_paise,
            "free": self.free,
            "available": self.available,
            "unavailable_reason": self.unavailable_reason,
            "eta_from": self.eta_from.isoformat() if self.eta_from else None,
            "eta_to": self.eta_to.isoformat() if self.eta_to else None,
        }


def lookup_pincode(pincode: str | None) -> ServiceablePincode | None:
    if not pincode:
        return None
    return ServiceablePincode.objects.select_related("zone").filter(pincode=pincode.strip(), is_active=True).first()


def add_working_days(start: date, days: int) -> date:
    """Advance by `days` working days (Sundays off)."""
    current = start
    remaining = days
    while remaining > 0:
        current += timedelta(days=1)
        if current.weekday() != 6:
            remaining -= 1
    return current


def dispatch_date(now: datetime | None = None) -> date:
    now = timezone.localtime(now or timezone.now())
    cutoff = StoreSettings.load().dispatch_cutoff_hour
    day = now.date()
    if now.hour >= cutoff or day.weekday() == 6:
        day = add_working_days(day, 1)
    return day


def shipping_options(
    zone: ShippingZone | None,
    *,
    subtotal_after_discounts: int,
    bulky_units: int = 0,
    now: datetime | None = None,
) -> list[ShippingOption]:
    """Options for a zone (or indicative options when no pincode is known yet)."""
    options = []
    ships = dispatch_date(now)
    for method in ShippingMethod.objects.filter(is_active=True):
        available, reason = True, ""
        if zone is not None and method.code == ShippingMethod.Code.EXPRESS and not zone.express_available:
            available, reason = False, "Express isn't available for this pincode yet."
        if bulky_units and not method.allows_bulky:
            available, reason = False, "Large items travel by Standard delivery."
        base = method.base_rate_paise + (zone.extra_fee_paise if zone else 0)
        free = method.free_threshold_paise is not None and subtotal_after_discounts >= method.free_threshold_paise
        fee = (0 if free else base) + bulky_units * method.bulky_surcharge_paise
        eta_from = eta_to = None
        if zone is not None:
            lo, hi = zone.days_for(method.code)
            eta_from, eta_to = add_working_days(ships, lo), add_working_days(ships, hi)
        options.append(
            ShippingOption(
                code=method.code,
                name=method.name,
                description=method.description,
                fee_paise=fee,
                base_fee_paise=base,
                free=free and not bulky_units,
                available=available,
                unavailable_reason=reason,
                eta_from=eta_from,
                eta_to=eta_to,
            )
        )
    return options


def free_shipping_threshold() -> int | None:
    method = ShippingMethod.objects.filter(is_active=True, code=ShippingMethod.Code.STANDARD).first()
    return method.free_threshold_paise if method else None
