"""Homepage, banners and content pages for `seed_demo`, written in the Sartoria voice."""

HERO = [
    {
        "photo": "1586023492125-27b2c045efd7",
        "eyebrow": "The Autumn Edit",
        "headline": "Rooms that feel like you",
        "subtext": "Mid-century chairs, hand-thrown stoneware and lamps that warm a room. Chosen to be lived with.",
        "cta": ("Shop home", "/shop/home-kitchen"),
        "secondary": ("New arrivals", "/shop?sort=newest"),
        "theme": "dark",
        "align": "left",
    },
    {
        "photo": "1602810318383-e386cc2a3ccf",
        "eyebrow": "Tailoring, quietly",
        "headline": "Shirts made to be worn often",
        "subtext": "Two-fold poplin, soft Oxford cloth and mother-of-pearl buttons, cut in small batches.",
        "cta": ("Explore menswear", "/shop/mens-clothing"),
        "secondary": ("The fashion edit", "/shop/fashion"),
        "theme": "light",
        "align": "left",
    },
    {
        "photo": "1496181133206-80ce9b88a853",
        "eyebrow": "Technology, considered",
        "headline": "Fewer gadgets, better ones",
        "subtext": "Laptops with all-day batteries, headphones tuned by ear and tablets that get out of the way.",
        "cta": ("Shop electronics", "/shop/electronics"),
        "secondary": ("Flash sale", "/offers"),
        "theme": "light",
        "align": "left",
    },
    {
        "photo": "1515562141207-7a88fb7ce338",
        "eyebrow": "Small things, kept forever",
        "headline": "Pearls, gold and lasting light",
        "subtext": "Freshwater pearls, gold vermeil and lab-grown stones, finished by hand.",
        "cta": ("Discover jewellery", "/shop/jewellery-watches"),
        "secondary": None,
        "theme": "light",
        "align": "left",
    },
]

# (type, eyebrow, title, subtitle, extra)
SECTIONS = [
    ("hero", "", "", "", {}),
    ("trust_badges", "", "", "", {}),
    (
        "featured_categories",
        "Departments",
        "Shop by department",
        "Ten departments, each edited by a buyer who cares.",
        {},
    ),
    ("flash_sale", "Flash sale", "", "", {}),
    (
        "trending",
        "Trending now",
        "What patrons are loving",
        "",
        {"limit": 12, "cta": ("View all", "/shop?sort=popular")},
    ),
    ("promo_banners", "", "", "", {}),
    ("new_arrivals", "Just in", "New arrivals", "", {"limit": 12, "cta": ("View all", "/shop?sort=newest")}),
    (
        "editorial",
        "Our story",
        "A department store, edited",
        "",
        {
            "photo": "1522708323590-d24dbb6b0267",
            "body": "We started Sartoria because buying well had become exhausting. Endless choice, little of it good. "
            "So we stock fewer things: the headphones our buyers actually use, the shirt that softens with every wash, "
            "the casserole you'll hand down. Every piece is inspected in our Mumbai studio before it reaches you.",
            "cta": ("Read our story", "/pages/about"),
        },
    ),
    (
        "best_sellers",
        "Patrons' favourites",
        "Best sellers",
        "",
        {"limit": 12, "cta": ("View all", "/shop?sort=popular")},
    ),
    ("daily_deals", "", "", "", {}),
    ("bundles", "Better together", "Sets & bundles", "Pairings that cost less as a set.", {}),
    ("counters", "", "", "", {}),
    ("testimonials", "Kind words", "From our patrons", "", {}),
    (
        "newsletter",
        "The Sartoria letter",
        "Considered news, a few times a month",
        "New arrivals, quiet sales and the stories behind our makers. Never more than twice a week.",
        {},
    ),
]

BANNERS = [
    (
        "home",
        "1556909114-f6e7ad7d3136",
        "The kitchen edit",
        "Cookware for slow Sundays",
        "Enamelled cast iron, hand-thrown cups and a burr grinder that changes mornings.",
        ("Shop kitchen", "/shop/cookware"),
        "Up to 20% off",
    ),
    (
        "home",
        "1554068865-24cecd4e34b8",
        "Move well",
        "Gear for the long game",
        "Natural-rubber mats, hex dumbbells and a city bike built to last.",
        ("Shop sports", "/shop/sports-fitness"),
        "",
    ),
    (
        "home",
        "1491637639811-60e2756cc1c7",
        "Carry better",
        "Bags for real journeys",
        "Waxed canvas, vegetable-tanned leather and silent spinner wheels.",
        ("Shop bags", "/shop/bags-travel"),
        "New",
    ),
    (
        "offers",
        "1595950653106-6c9ebd614d3a",
        "Codes worth knowing",
        "FESTIVE15 takes 15% off",
        "On orders above ₹2,999, up to ₹1,500 off. While it lasts.",
        ("Shop now", "/shop"),
        "15% off",
    ),
]

TRUST_BADGES = [
    ("truck", "Complimentary shipping", "On orders above ₹1,999, across 15 cities and counting."),
    ("return", "Easy returns", "Up to 15 days, with free pickup from your door."),
    ("shield", "Secure payment", "Cards, UPI and net banking via Razorpay, or pay on delivery."),
    ("chat", "Real people", "Our team answers Monday to Saturday, 10am to 7pm."),
]

COUNTERS = [
    (12000, "", "+", "Patrons served"),
    (98, "", "%", "Orders delivered on time"),
    (240, "", "+", "Makers we work with"),
    (4, "", ".8★", "Average review"),
]

TESTIMONIALS = [
    (
        "Aditi Menon",
        "Bengaluru",
        "The sofa arrived on the promised day, placed exactly where I wanted it. Two months in, it still looks new. Sartoria is the only place I trust for furniture online.",
    ),
    (
        "Rahul Kapoor",
        "Mumbai",
        "I bought headphones and a shirt in the same order, which says everything. Both are the best I've owned. The packaging alone made me smile.",
    ),
    (
        "Zoya Khan",
        "New Delhi",
        "A return was handled in four days, pickup and all, with a refund before I'd even asked. That's how you keep a customer.",
    ),
    (
        "Vikram Iyer",
        "Chennai",
        "The casserole is extraordinary. Heavy, even, beautiful on the table. I've since bought two as wedding gifts.",
    ),
    (
        "Tara Sen",
        "Kolkata",
        "I appreciate that they don't stock everything. Everything I've ordered has been considered, and the descriptions are honest.",
    ),
    (
        "Kabir Malhotra",
        "Pune",
        "Their flash sales are rare but genuine. I got the leather jacket I'd been eyeing for months, and it's a lifelong piece.",
    ),
    (
        "Meera Nair",
        "Kochi",
        "The handwritten note inside my order was a lovely touch. Feels like buying from a small shop, with the reliability of a big one.",
    ),
    (
        "Arjun Desai",
        "Ahmedabad",
        "Fast delivery, fair prices and real people on the phone. I recommend Sartoria to anyone who asks where I shop.",
    ),
]

PAGES = [
    (
        "about",
        "Our story",
        "A department store, edited for people who would rather buy once.",
        """<p>Sartoria began with a frustration familiar to anyone who shops online: too much choice, too little of it good. We wanted a place where every product had earned its place, where a pair of headphones and a linen shirt were chosen with the same care.</p>
<h2>How we choose</h2>
<p>Our buyers test what we stock. They wear it, cook with it, carry it and live with it before it reaches our shelves. If it doesn't last, it doesn't stay.</p>
<ul><li>We favour natural materials, honest construction and repairability.</li><li>We work directly with more than two hundred makers, many of them in India.</li><li>We inspect every order in our Mumbai studio before it leaves.</li></ul>
<h2>Why "Sartoria"</h2>
<p>In Italian, a sartoria is a tailor's workshop: a place of measuring twice, cutting once and finishing by hand. That is the spirit we bring to everything we sell.</p>""",
    ),
    (
        "shipping-policy",
        "Shipping",
        "How and when your order reaches you.",
        """<p>We dispatch from our Mumbai studio within one working day. Orders placed before 2pm IST usually leave the same day.</p>
<h2>Delivery options</h2>
<ul><li><strong>Standard delivery:</strong> ₹99, complimentary on orders above ₹1,999. Two to six working days depending on your city.</li><li><strong>Express delivery:</strong> ₹249. One to three working days, where available.</li><li><strong>Large items</strong> such as sofas and televisions travel with our white-glove partners and are placed in the room of your choice. A handling charge applies.</li></ul>
<h2>Where we deliver</h2>
<p>We currently deliver to fifteen cities, with more each season. Enter your pincode on any product page to see exact delivery dates.</p>
<h2>Tracking</h2>
<p>You'll receive tracking details by email the moment your order ships, and you can follow it anytime from <a href="/track-order">Track your order</a>.</p>""",
    ),
    (
        "returns-policy",
        "Returns & refunds",
        "If something isn't right, we'll make it right.",
        """<p>We want you to love what you buy. If you don't, returning it should be simple.</p>
<h2>Return windows</h2>
<ul><li><strong>Fashion, footwear, jewellery and bags:</strong> 15 days from delivery.</li><li><strong>Home, sports and toys:</strong> 10 days from delivery.</li><li><strong>Books and stationery:</strong> 7 days from delivery.</li><li><strong>Electronics:</strong> 7-day replacement for items that arrive damaged or develop a fault.</li><li><strong>Beauty and personal care:</strong> for hygiene reasons, returnable only if damaged on arrival.</li></ul>
<h2>How to return</h2>
<p>Open your order, choose <em>Return or replace</em>, and tell us what happened. Once approved, we arrange a free pickup from your delivery address.</p>
<h2>Refunds</h2>
<p>Refunds go back to your original payment method within 5–7 working days of the item reaching us. For cash-on-delivery orders we transfer the refund to the UPI ID you share.</p>""",
    ),
    (
        "privacy-policy",
        "Privacy",
        "What we collect, why, and how we look after it.",
        """<p>We collect only what we need to fulfil your orders and improve your experience: your name, contact details, delivery addresses and order history.</p>
<h2>Payments</h2>
<p>Card and UPI details are handled by our payment partner, Razorpay. We never see or store them.</p>
<h2>Emails</h2>
<p>We send order updates as a matter of course. Marketing emails are sent only if you opt in, and every one has an unsubscribe link.</p>
<h2>Your choices</h2>
<p>You can update your details from your account at any time, or write to us to have your data deleted.</p>""",
    ),
    (
        "terms",
        "Terms of sale",
        "The fine print, written plainly.",
        """<p>By placing an order with Sartoria you agree to these terms.</p>
<h2>Prices</h2>
<p>All prices are in Indian rupees and include GST. The price you pay is the one shown at checkout.</p>
<h2>Orders</h2>
<p>An order is confirmed when you receive our confirmation email. We may cancel an order if a piece becomes unavailable, in which case any payment is refunded in full.</p>
<h2>Cancellations</h2>
<p>You may cancel an order from your account until it has been packed.</p>""",
    ),
    (
        "contact",
        "Contact us",
        "Real people, ready to help.",
        """<p>Our team is available Monday to Saturday, 10am to 7pm IST.</p>
<ul><li><strong>Email:</strong> <a href="mailto:care@sartoria.in">care@sartoria.in</a></li><li><strong>Phone:</strong> +91 22 4000 1234</li><li><strong>WhatsApp:</strong> +91 98200 01234</li></ul>
<h2>Visit the studio</h2>
<p>Ground Floor, Kamala Mills, Senapati Bapat Marg, Lower Parel, Mumbai 400013. By appointment.</p>""",
    ),
]
