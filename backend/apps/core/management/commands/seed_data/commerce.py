"""Shipping network and offers for `seed_demo`."""

# zone -> (standard days, express days, express?, cod?, extra fee ₹)
ZONES = {
    "Metro": ((2, 4), (1, 2), True, True, 0),
    "Tier 2 cities": ((3, 5), (2, 3), True, True, 0),
    "North East & Hills": ((5, 8), (3, 5), True, True, 50),
    "Islands": ((7, 12), (0, 0), False, False, 150),
}

# (city, state, zone, first pincode, last pincode)
PINCODE_RANGES = [
    ("Mumbai", "Maharashtra", "Metro", 400001, 400104),
    ("Pune", "Maharashtra", "Metro", 411001, 411062),
    ("New Delhi", "Delhi", "Metro", 110001, 110096),
    ("Bengaluru", "Karnataka", "Metro", 560001, 560103),
    ("Chennai", "Tamil Nadu", "Metro", 600001, 600119),
    ("Hyderabad", "Telangana", "Metro", 500001, 500096),
    ("Kolkata", "West Bengal", "Metro", 700001, 700156),
    ("Ahmedabad", "Gujarat", "Tier 2 cities", 380001, 380061),
    ("Jaipur", "Rajasthan", "Tier 2 cities", 302001, 302039),
    ("Lucknow", "Uttar Pradesh", "Tier 2 cities", 226001, 226031),
    ("Kochi", "Kerala", "Tier 2 cities", 682001, 682041),
    ("Chandigarh", "Chandigarh", "Tier 2 cities", 160001, 160036),
    ("Guwahati", "Assam", "North East & Hills", 781001, 781040),
    ("Srinagar", "Jammu and Kashmir", "North East & Hills", 190001, 190025),
    ("Port Blair", "Andaman and Nicobar Islands", "Islands", 744101, 744112),
]

# code, name, description, base ₹, free above ₹, bulky surcharge ₹, allows bulky
METHODS = [
    ("standard", "Standard delivery", "Tracked, insured and gently packed.", 99, 1999, 499, True),
    ("express", "Express delivery", "Priority dispatch the same working day.", 249, None, 0, False),
]

# (product name, discount type, value, cap). Percent values are % off; fixed_price values are ₹.
FLASH_SALE = {
    "title": "The Midnight Edit",
    "subtitle": "Thirty-six hours of quietly brilliant prices on pieces we rarely mark down.",
    "hours": 36,
    "items": [
        ("Aria Studio Over-Ear Headphones", "percent", 25, 40),
        ("Lumen Air Earbuds", "percent", 20, None),
        ("Biker Leather Jacket", "percent", 30, 15),
        ("Emerald Velvet Sofa", "percent", 18, 5),
        ("Ranger Leather Boots", "percent", 22, None),
        ("Tempus Rosé Chronograph", "percent", 25, 20),
        ("Enamel Cast Iron Casserole", "percent", 20, None),
        ("Scarlet Top-Handle Bag", "percent", 28, 10),
    ],
}

DAILY_DEALS = [
    ("Today's deal: the morning ritual", 0, [("Brew Theory Burr Grinder", "percent", 30, 25)]),
    ("Tomorrow's deal: desk upgrade", 1, [("Quill Wireless Keyboard", "percent", 35, 30)]),
]

# title, description, discount type, value (percent or ₹), product names
BUNDLES = [
    (
        "The Considered Desk",
        "Keyboard and mouse in matching white aluminium. Better together, and better priced.",
        "percent",
        12,
        ["Quill Wireless Keyboard", "Quill Glide Wireless Mouse"],
    ),
    (
        "Coffee Ritual Set",
        "Grind fresh, pour slow: our burr grinder with a set of hand-thrown cappuccino cups.",
        "fixed_off",
        1500,
        ["Brew Theory Burr Grinder", "Barista Cappuccino Cup Set"],
    ),
    (
        "Yoga Starter Kit",
        "Everything for a calm home practice: the Align mat and a full resistance band set.",
        "percent",
        15,
        ["Ananda Align Yoga Mat", "Kinetic Resistance Band Set"],
    ),
]

# code, description, type, value (percent or ₹), cap ₹, min order ₹, kwargs
COUPONS = [
    ("WELCOME10", "10% off your first order (up to ₹500)", "percent", 10, 500, 0, {"first_order_only": True}),
    ("SARTORIA500", "₹500 off orders above ₹4,999", "fixed", 500, None, 4999, {}),
    (
        "FESTIVE15",
        "15% off orders above ₹2,999 (up to ₹1,500)",
        "percent",
        15,
        1500,
        2999,
        {"usage_limit_total": 500},
    ),
    ("HOMEWEEK", "12% off Home & Kitchen", "percent", 12, 2000, 0, {"categories": ["Home & Kitchen"]}),
    ("SUMMER20", "Summer sale (ended)", "percent", 20, None, 0, {"expired": True}),
    (
        "FIRST50",
        "₹50 off for the first fifty patrons (fully redeemed)",
        "fixed",
        50,
        None,
        0,
        {"usage_limit_total": 50, "times_used": 50},
    ),
]
