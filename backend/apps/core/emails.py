"""Branded transactional email. Everything is rendered and sent from a Celery task."""

import logging

from celery import shared_task
from django.conf import settings
from django.core.mail import EmailMultiAlternatives
from django.template.loader import render_to_string
from django.utils.html import strip_tags

from .models import StoreSettings

logger = logging.getLogger(__name__)


def brand_context() -> dict:
    store = StoreSettings.load()
    base = settings.BACKEND_PUBLIC_URL.rstrip("/")
    logo = f"{base}{store.logo.url}" if store.logo else f"{base}{settings.STATIC_URL}brand/wordmark.png"
    return {
        "store": {
            "name": store.name,
            "tagline": store.tagline,
            "email": store.contact_email,
            "phone": store.support_phone,
            "hours": store.support_hours,
            "address": ", ".join(p for p in (store.address_line1, store.address_line2, store.city, store.pincode) if p),
            "instagram": store.instagram_url,
            "facebook": store.facebook_url,
            "pinterest": store.pinterest_url,
        },
        "logo_url": logo,
        "site_url": settings.FRONTEND_URL.rstrip("/"),
    }


def render_email(template: str, context: dict) -> tuple[str, str, str]:
    ctx = {**brand_context(), **context}
    subject = render_to_string(f"emails/{template}.subject.txt", ctx).strip()
    html = render_to_string(f"emails/{template}.html", ctx)
    text = strip_tags(html)
    text = "\n".join(line.strip() for line in text.splitlines() if line.strip())
    return subject, html, text


@shared_task(bind=True, max_retries=3, default_retry_delay=60)
def send_templated_email(self, template: str, to: list[str], context: dict, attachments=None):
    subject, html, text = render_email(template, context)
    store_name = StoreSettings.load().name
    from_email = settings.DEFAULT_FROM_EMAIL
    if "<" not in from_email:
        from_email = f"{store_name} <{from_email}>"
    message = EmailMultiAlternatives(subject, text, from_email, to)
    message.attach_alternative(html, "text/html")
    for name, path, mimetype in attachments or []:
        with open(path, "rb") as fh:
            message.attach(name, fh.read(), mimetype)
    try:
        message.send()
    except Exception as exc:  # SMTP errors are transient more often than not
        logger.warning("Email %s to %s failed: %s", template, to, exc)
        raise self.retry(exc=exc)


def send_email(template: str, to: str | list[str], context: dict | None = None, attachments=None):
    """Queue an email. Context must be JSON-serialisable (it crosses the Celery boundary)."""
    recipients = [to] if isinstance(to, str) else list(to)
    send_templated_email.delay(template, recipients, context or {}, attachments)
