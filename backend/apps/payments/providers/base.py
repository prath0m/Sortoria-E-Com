"""Payment provider interface. Add a gateway by subclassing and registering it in PAYMENT_PROVIDERS."""

from abc import ABC, abstractmethod
from dataclasses import dataclass


class ProviderError(Exception):
    """A gateway refused or failed a request; the message is safe to show the shopper."""


@dataclass
class WebhookPayload:
    event_id: str
    event_type: str
    payload: dict


class PaymentProvider(ABC):
    code: str = ""
    display_name: str = ""
    #: Collected online before the order is confirmed (vs. on delivery).
    prepaid: bool = True

    def is_available(self) -> bool:
        return True

    @abstractmethod
    def create_payment(self, order):
        """Create a Payment for the order and return it. Prepaid providers open a gateway order."""

    def client_payload(self, payment) -> dict | None:
        """What the browser needs to open the gateway's checkout widget, if anything."""
        return None

    def verify_client_callback(self, payment, data: dict) -> bool:
        """Verify the signed callback the browser posts after paying."""
        raise ProviderError("This payment method doesn't use a client callback.")

    def parse_webhook(self, body: bytes, headers) -> WebhookPayload:
        raise ProviderError("This payment method doesn't send webhooks.")

    @abstractmethod
    def refund(self, payment, amount_paise: int, *, reason: str = ""):
        """Refund `amount_paise` against `payment`; returns a Refund."""
