from apps.core.models import StoreSettings
from apps.payments.models import Payment, Refund

from .base import PaymentProvider


class CashOnDeliveryProvider(PaymentProvider):
    code = "cod"
    display_name = "Cash on delivery"
    prepaid = False

    def is_available(self) -> bool:
        return StoreSettings.load().cod_enabled

    def create_payment(self, order) -> Payment:
        return Payment.objects.create(
            order=order, provider=self.code, amount_paise=order.grand_total_paise, currency=order.currency
        )

    def refund(self, payment, amount_paise: int, *, reason: str = "") -> Refund:
        # Cash can't be reversed electronically: staff transfer it and record the reference.
        return Refund.objects.create(
            payment=payment, amount_paise=amount_paise, reason=reason, status=Refund.Status.MANUAL
        )
