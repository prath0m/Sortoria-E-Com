import hashlib
import hmac
import json
import logging

import razorpay
from django.conf import settings

from apps.payments.models import Payment, Refund

from .base import PaymentProvider, ProviderError, WebhookPayload

logger = logging.getLogger(__name__)


class RazorpayProvider(PaymentProvider):
    code = "razorpay"
    display_name = "Card, UPI or net banking"

    def is_available(self) -> bool:
        return bool(settings.RAZORPAY_KEY_ID and settings.RAZORPAY_KEY_SECRET)

    @property
    def client(self):
        return razorpay.Client(auth=(settings.RAZORPAY_KEY_ID, settings.RAZORPAY_KEY_SECRET))

    def create_payment(self, order) -> Payment:
        try:
            gateway_order = self.client.order.create(
                {
                    "amount": order.grand_total_paise,
                    "currency": order.currency,
                    "receipt": order.number,
                    "notes": {"order_number": order.number},
                }
            )
        except Exception as exc:  # network errors and gateway rejections alike
            logger.exception("Razorpay order creation failed for %s", order.number)
            raise ProviderError("We couldn't reach our payment partner. Please try again in a moment.") from exc
        return Payment.objects.create(
            order=order,
            provider=self.code,
            provider_order_id=gateway_order["id"],
            amount_paise=order.grand_total_paise,
            currency=order.currency,
            raw={"order": gateway_order},
        )

    def client_payload(self, payment) -> dict:
        order = payment.order
        address = order.shipping_address
        return {
            "provider": self.code,
            "key_id": settings.RAZORPAY_KEY_ID,
            "razorpay_order_id": payment.provider_order_id,
            "amount": payment.amount_paise,
            "currency": payment.currency,
            "prefill": {"name": address.get("full_name", ""), "email": order.email, "contact": order.phone},
        }

    def verify_client_callback(self, payment, data: dict) -> bool:
        if data.get("razorpay_order_id") != payment.provider_order_id:
            return False
        message = f"{payment.provider_order_id}|{data.get('razorpay_payment_id', '')}".encode()
        expected = hmac.new(settings.RAZORPAY_KEY_SECRET.encode(), message, hashlib.sha256).hexdigest()
        return hmac.compare_digest(expected, str(data.get("razorpay_signature", "")))

    def parse_webhook(self, body: bytes, headers) -> WebhookPayload:
        signature = headers.get("X-Razorpay-Signature", "")
        secret = settings.RAZORPAY_WEBHOOK_SECRET
        if not secret:
            raise ProviderError("Webhook secret is not configured.")
        expected = hmac.new(secret.encode(), body, hashlib.sha256).hexdigest()
        if not hmac.compare_digest(expected, signature):
            raise ProviderError("Invalid webhook signature.")
        payload = json.loads(body)
        event_id = headers.get("X-Razorpay-Event-Id") or f"{payload.get('event')}:{payload.get('created_at')}"
        return WebhookPayload(event_id=event_id, event_type=payload.get("event", ""), payload=payload)

    def refund(self, payment, amount_paise: int, *, reason: str = "") -> Refund:
        refund = Refund.objects.create(payment=payment, amount_paise=amount_paise, reason=reason)
        try:
            result = self.client.payment.refund(
                payment.provider_payment_id, {"amount": amount_paise, "notes": {"reason": reason[:200]}}
            )
        except Exception as exc:
            logger.exception("Razorpay refund failed for payment %s", payment.pk)
            refund.status = Refund.Status.FAILED
            refund.raw = {"error": str(exc)}
            refund.save(update_fields=["status", "raw"])
            raise ProviderError("The refund couldn't be issued just now. Please retry shortly.") from exc
        refund.provider_refund_id = result.get("id", "")
        refund.status = Refund.Status.PROCESSED if result.get("status") == "processed" else Refund.Status.PENDING
        refund.raw = result
        refund.save(update_fields=["provider_refund_id", "status", "raw"])
        return refund
