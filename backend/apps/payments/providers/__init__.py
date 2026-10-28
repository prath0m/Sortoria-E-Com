from functools import cache

from django.conf import settings
from django.utils.module_loading import import_string

from .base import PaymentProvider, ProviderError, WebhookPayload


@cache
def get_provider(code: str) -> PaymentProvider:
    path = settings.PAYMENT_PROVIDERS.get(code)
    if not path:
        raise ProviderError(f"Unknown payment method {code!r}.")
    return import_string(path)()


def available_providers() -> list[PaymentProvider]:
    return [p for p in (get_provider(code) for code in settings.PAYMENT_PROVIDERS) if p.is_available()]


__all__ = ["PaymentProvider", "ProviderError", "WebhookPayload", "available_providers", "get_provider"]
