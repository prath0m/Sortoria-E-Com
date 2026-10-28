"""Customers, order history, reviews and returns for `seed_demo`."""

FIRST_NAMES = [
    "Aarav",
    "Ananya",
    "Vihaan",
    "Diya",
    "Kabir",
    "Ishita",
    "Arjun",
    "Meera",
    "Rohan",
    "Saanvi",
    "Aditya",
    "Kavya",
    "Nikhil",
    "Priya",
    "Siddharth",
    "Tara",
    "Rahul",
    "Neha",
    "Karan",
    "Aisha",
    "Vikram",
    "Zoya",
    "Dev",
    "Riya",
    "Imran",
    "Lakshmi",
    "Farhan",
    "Nandini",
    "Harsh",
    "Pooja",
    "Aman",
    "Sneha",
    "Yash",
    "Mira",
    "Varun",
    "Anika",
    "Gautam",
    "Ira",
    "Kunal",
    "Leela",
]
LAST_NAMES = [
    "Sharma",
    "Iyer",
    "Mehta",
    "Reddy",
    "Kapoor",
    "Nair",
    "Banerjee",
    "Rao",
    "Shah",
    "Menon",
    "Gupta",
    "Khan",
    "Pillai",
    "Desai",
    "Chatterjee",
    "Malhotra",
    "Joshi",
    "Verma",
    "Bose",
    "Singh",
]
STREETS = [
    "Carter Road",
    "Linking Road",
    "Residency Road",
    "Park Street",
    "Anna Salai",
    "Jubilee Hills Road No. 36",
    "Koregaon Park Lane 5",
    "Prithviraj Road",
    "MG Road",
    "Lavelle Road",
    "Hauz Khas Village",
    "Boat Club Road",
]
# (city, state, pincode) — all inside the seeded serviceable ranges
CITIES = [
    ("Mumbai", "Maharashtra", "400050"),
    ("Mumbai", "Maharashtra", "400026"),
    ("Pune", "Maharashtra", "411001"),
    ("New Delhi", "Delhi", "110003"),
    ("New Delhi", "Delhi", "110016"),
    ("Bengaluru", "Karnataka", "560025"),
    ("Bengaluru", "Karnataka", "560034"),
    ("Chennai", "Tamil Nadu", "600018"),
    ("Hyderabad", "Telangana", "500033"),
    ("Kolkata", "West Bengal", "700019"),
    ("Ahmedabad", "Gujarat", "380015"),
    ("Jaipur", "Rajasthan", "302001"),
    ("Kochi", "Kerala", "682016"),
    ("Chandigarh", "Chandigarh", "160017"),
]
COURIERS = [
    ("Delhivery", "https://www.delhivery.com/track/package/{}"),
    ("Blue Dart", "https://www.bluedart.com/tracking?awb={}"),
    ("Ekart", "https://ekartlogistics.com/track/{}"),
]

REVIEWS = {
    5: [
        (
            "Better than I hoped",
            "The quality is immediately obvious. It feels considered in every detail and arrived beautifully packed.",
        ),
        (
            "Worth every rupee",
            "I've used it daily for weeks now and it still feels new. Exactly as described, and then some.",
        ),
        (
            "A keeper",
            "Lovely finish, generous in the right places, and the kind of piece you stop noticing because it simply works.",
        ),
        (
            "Gifted it, then bought another",
            "Bought this as a present and liked it so much I ordered one for myself the next day.",
        ),
    ],
    4: [
        (
            "Very good",
            "Well made and true to the photos. Delivery took a day longer than estimated, but it was worth the wait.",
        ),
        (
            "Lovely, one small quibble",
            "Beautiful quality. I'd have liked one more colour option, but I'm very happy with it.",
        ),
        (
            "Solid and handsome",
            "Feels sturdy and looks better in person. Takes a little getting used to, then it's perfect.",
        ),
    ],
    3: [
        ("Good, not great", "Nicely made, though it's a touch smaller than I expected. Read the dimensions carefully."),
        ("Does the job", "Quality is fine for the price. Nothing wrong with it, it just didn't wow me."),
    ],
    2: [
        (
            "Not quite for me",
            "The finish is lovely but the fit didn't suit me. Customer care was helpful with the return.",
        ),
    ],
    1: [
        (
            "Arrived damaged",
            "Unfortunately mine arrived with a mark on it. The team arranged a replacement quickly, which I appreciated.",
        ),
    ],
}
RATING_WEIGHTS = [(5, 55), (4, 28), (3, 10), (2, 5), (1, 2)]

# (status, reason, resolution, admin note)
RETURNS = [
    ("requested", "wrong_size", "refund", ""),
    ("requested", "changed_mind", "refund", ""),
    ("approved", "not_as_described", "refund", ""),
    ("approved", "wrong_size", "refund", ""),
    ("pickup_scheduled", "damaged", "refund", ""),
    ("received", "wrong_size", "refund", ""),
    ("refunded", "changed_mind", "refund", ""),
    ("refunded", "damaged", "refund", ""),
    (
        "rejected",
        "changed_mind",
        "refund",
        "The piece showed signs of wear, so we couldn't accept it back. We've shared photos by email.",
    ),
    ("replaced", "defective", "replacement", ""),
]
