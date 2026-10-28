import pytest

from tests.factories import AddressFactory

pytestmark = pytest.mark.django_db

PAYLOAD = {
    "full_name": "Ada Lovelace",
    "phone": "9876543210",
    "line1": "22 Residency Road",
    "city": "Bengaluru",
    "state": "Karnataka",
    "pincode": "560025",
}


def test_first_address_becomes_default_and_state_code_is_derived(auth, customer):
    response = auth(customer).post("/api/v1/account/addresses/", PAYLOAD, format="json")
    assert response.status_code == 201
    assert response.data["is_default_shipping"] is True
    assert response.data["state_code"] == "29"


def test_rejects_invalid_pincode_and_phone(auth, customer):
    response = auth(customer).post(
        "/api/v1/account/addresses/", {**PAYLOAD, "pincode": "012345", "phone": "12345"}, format="json"
    )
    assert response.status_code == 400
    assert {"pincode", "phone"} <= set(response.data)


def test_only_one_default_and_set_default_action(auth, customer):
    client = auth(customer)
    first = client.post("/api/v1/account/addresses/", PAYLOAD, format="json").data
    second = client.post("/api/v1/account/addresses/", {**PAYLOAD, "is_default_shipping": True}, format="json").data
    listing = {a["id"]: a for a in client.get("/api/v1/account/addresses/").data}
    assert listing[second["id"]]["is_default_shipping"] and not listing[first["id"]]["is_default_shipping"]

    client.post(f"/api/v1/account/addresses/{first['id']}/set-default/")
    listing = {a["id"]: a for a in client.get("/api/v1/account/addresses/").data}
    assert listing[first["id"]]["is_default_shipping"] and not listing[second["id"]]["is_default_shipping"]


def test_cannot_see_other_users_addresses(auth, customer):
    other = AddressFactory()
    client = auth(customer)
    assert client.get("/api/v1/account/addresses/").data == []
    assert client.get(f"/api/v1/account/addresses/{other.id}/").status_code == 404
