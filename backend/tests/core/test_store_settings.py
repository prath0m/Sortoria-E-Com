import pytest

from apps.core.models import StoreSettings

pytestmark = pytest.mark.django_db


def test_public_settings_reflect_admin_edits(api):
    settings_obj = StoreSettings.load()
    settings_obj.name = "Sartoria"
    settings_obj.tagline = "Crafted with intention."
    settings_obj.save()
    data = api.get("/api/v1/store/settings/").data
    assert data["name"] == "Sartoria"
    assert data["tagline"] == "Crafted with intention."
    assert "gstin" not in data  # internal fields stay private


def test_settings_is_a_singleton():
    StoreSettings.load()
    StoreSettings(name="Other").save()
    assert StoreSettings.objects.count() == 1
