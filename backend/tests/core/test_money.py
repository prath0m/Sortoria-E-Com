import pytest

from apps.core.money import allocate, amount_in_words, inclusive_tax, rupees


@pytest.mark.parametrize(
    ("paise", "expected"),
    [(0, "₹0"), (9900, "₹99"), (129950, "₹1,299.50"), (12345600, "₹1,23,456"), (1234567800, "₹1,23,45,678")],
)
def test_rupees_uses_indian_grouping(paise, expected):
    assert rupees(paise) == expected


def test_allocate_sums_exactly_and_is_proportional():
    parts = allocate(1000, [3333, 3333, 3334])
    assert sum(parts) == 1000
    assert max(parts) - min(parts) <= 1


def test_allocate_handles_zero_weights():
    assert allocate(500, [0, 0]) == [0, 0]
    assert allocate(0, [10, 20]) == [0, 0]


def test_inclusive_tax_extracts_gst_from_gross():
    # ₹1,180 at 18% inclusive carries ₹180 of tax.
    assert inclusive_tax(118000, 18) == 18000
    assert inclusive_tax(105000, 5) == 5000
    assert inclusive_tax(100000, 0) == 0


def test_amount_in_words():
    assert amount_in_words(12000000) == "Rupees One Lakh Twenty Thousand Only"
    assert amount_in_words(10050) == "Rupees One Hundred and Fifty Paise Only"
    assert amount_in_words(1234567800) == (
        "Rupees One Crore Twenty Three Lakh Forty Five Thousand Six Hundred Seventy Eight Only"
    )
