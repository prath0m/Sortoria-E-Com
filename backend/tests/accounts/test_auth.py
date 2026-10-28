import re

import pytest
from django.conf import settings
from django.core import mail
from django.test import override_settings

from tests.factories import PASSWORD, UserFactory

pytestmark = pytest.mark.django_db


def _register(api, **overrides):
    payload = {"email": "Ada@Example.com", "password": PASSWORD, "first_name": "Ada", **overrides}
    return api.post("/api/v1/auth/register/", payload, format="json")


def test_register_creates_customer_sets_cookie_and_sends_welcome(api):
    response = _register(api)
    assert response.status_code == 201
    assert response.data["user"]["email"] == "ada@example.com"
    assert response.data["user"]["role"] == "customer"
    assert response.data["user"]["capabilities"] == []
    assert settings.REFRESH_COOKIE_NAME in response.cookies
    assert response.cookies[settings.REFRESH_COOKIE_NAME]["httponly"]
    assert len(mail.outbox) == 1 and "Welcome" in mail.outbox[0].subject


def test_register_rejects_duplicate_email_case_insensitively(api):
    UserFactory(email="ada@example.com")
    response = _register(api, email="ADA@example.com")
    assert response.status_code == 400
    assert "email" in response.data


def test_register_rejects_weak_password(api):
    response = _register(api, password="password")
    assert response.status_code == 400


def test_login_success_and_failure(api):
    UserFactory(email="ada@example.com")
    bad = api.post("/api/v1/auth/login/", {"email": "ada@example.com", "password": "nope"}, format="json")
    assert bad.status_code == 400
    ok = api.post("/api/v1/auth/login/", {"email": "ADA@example.com", "password": PASSWORD}, format="json")
    assert ok.status_code == 200
    assert ok.data["access"]


def test_refresh_rotates_and_old_token_is_rejected(api):
    UserFactory(email="ada@example.com")
    login = api.post("/api/v1/auth/login/", {"email": "ada@example.com", "password": PASSWORD}, format="json")
    first_refresh = login.cookies[settings.REFRESH_COOKIE_NAME].value

    refreshed = api.post("/api/v1/auth/refresh/")
    assert refreshed.status_code == 200 and refreshed.data["access"]

    api.cookies[settings.REFRESH_COOKIE_NAME] = first_refresh
    replay = api.post("/api/v1/auth/refresh/")
    assert replay.status_code == 401


def test_refresh_requires_client_header():
    from rest_framework.test import APIClient

    response = APIClient().post("/api/v1/auth/refresh/")
    assert response.status_code == 403


def test_logout_blacklists_refresh_token(api):
    UserFactory(email="ada@example.com")
    api.post("/api/v1/auth/login/", {"email": "ada@example.com", "password": PASSWORD}, format="json")
    token = api.cookies[settings.REFRESH_COOKIE_NAME].value
    assert api.post("/api/v1/auth/logout/").status_code == 204
    api.cookies[settings.REFRESH_COOKIE_NAME] = token
    assert api.post("/api/v1/auth/refresh/").status_code == 401


def test_me_requires_auth_and_updates_profile(api, customer, auth):
    assert api.get("/api/v1/auth/me/").status_code == 401
    client = auth(customer)
    response = client.patch("/api/v1/auth/me/", {"first_name": "Grace", "role": "admin"}, format="json")
    assert response.status_code == 200
    customer.refresh_from_db()
    assert customer.first_name == "Grace"
    assert customer.role == "customer"  # role is read-only


def test_staff_me_lists_capabilities(auth, manager):
    caps = auth(manager).get("/api/v1/auth/me/").data["capabilities"]
    assert "orders.manage" in caps
    assert "staff.manage" not in caps


def _reset_link_parts():
    body = mail.outbox[-1].alternatives[0][0]
    match = re.search(r"/reset-password/([^/\"]+)/([^\"<\s]+)", body)
    return match.group(1), match.group(2)


def test_password_reset_flow_is_single_use(api):
    user = UserFactory(email="ada@example.com")
    response = api.post("/api/v1/auth/password/forgot/", {"email": "ada@example.com"}, format="json")
    assert response.status_code == 202
    uid, token = _reset_link_parts()

    new_password = "Bespoke-Wool-77"
    ok = api.post("/api/v1/auth/password/reset/", {"uid": uid, "token": token, "password": new_password}, format="json")
    assert ok.status_code == 200
    user.refresh_from_db()
    assert user.check_password(new_password)

    again = api.post(
        "/api/v1/auth/password/reset/",
        {"uid": uid, "token": token, "password": "Another-Pass-99"},
        format="json",
    )
    assert again.status_code == 400


def test_password_forgot_does_not_reveal_unknown_emails(api):
    response = api.post("/api/v1/auth/password/forgot/", {"email": "ghost@example.com"}, format="json")
    assert response.status_code == 202
    assert len(mail.outbox) == 0


def test_password_change_requires_current_password(auth, customer):
    client = auth(customer)
    bad = client.post(
        "/api/v1/auth/password/change/",
        {"current_password": "wrong", "new_password": "Bespoke-Wool-77"},
        format="json",
    )
    assert bad.status_code == 400
    ok = client.post(
        "/api/v1/auth/password/change/",
        {"current_password": PASSWORD, "new_password": "Bespoke-Wool-77"},
        format="json",
    )
    assert ok.status_code == 200
    customer.refresh_from_db()
    assert customer.check_password("Bespoke-Wool-77")


@override_settings(
    REST_FRAMEWORK={
        **settings.REST_FRAMEWORK,
        "DEFAULT_THROTTLE_RATES": {**settings.REST_FRAMEWORK["DEFAULT_THROTTLE_RATES"], "login": "3/min"},
    }
)
def test_login_is_rate_limited(api):
    from rest_framework.throttling import SimpleRateThrottle

    SimpleRateThrottle.THROTTLE_RATES = settings.REST_FRAMEWORK["DEFAULT_THROTTLE_RATES"]
    try:
        codes = [
            api.post("/api/v1/auth/login/", {"email": "x@example.com", "password": "x"}, format="json").status_code
            for _ in range(4)
        ]
    finally:
        from rest_framework.settings import api_settings

        SimpleRateThrottle.THROTTLE_RATES = api_settings.DEFAULT_THROTTLE_RATES
    assert codes[-1] == 429
