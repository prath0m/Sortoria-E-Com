import shutil

import pytest
from django.conf import settings
from django.core.cache import cache
from rest_framework.test import APIClient

from tests.factories import UserFactory


@pytest.fixture(autouse=True)
def _clear_cache():
    cache.clear()
    yield
    cache.clear()


@pytest.fixture(scope="session", autouse=True)
def _clean_media():
    yield
    shutil.rmtree(settings.MEDIA_ROOT, ignore_errors=True)


@pytest.fixture
def api():
    return APIClient(HTTP_X_SARTORIA_CLIENT="1")


@pytest.fixture
def customer(db):
    return UserFactory()


@pytest.fixture
def manager(db):
    return UserFactory(role="manager")


@pytest.fixture
def admin_user(db):
    return UserFactory(role="admin")


@pytest.fixture
def auth(api):
    """Return a client authenticated as the given user."""

    def _auth(user):
        api.force_authenticate(user)
        return api

    return _auth
