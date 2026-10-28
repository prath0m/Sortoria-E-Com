"""Money helpers. Amounts are integer paise everywhere; these only convert at the edges."""


def rupees(paise: int) -> str:
    """Format paise as an Indian-grouped rupee string, e.g. 12345600 -> '₹1,23,456'."""
    negative = paise < 0
    paise = abs(int(paise))
    whole, frac = divmod(paise, 100)
    digits = str(whole)
    if len(digits) > 3:
        head, tail = digits[:-3], digits[-3:]
        groups = []
        while len(head) > 2:
            groups.insert(0, head[-2:])
            head = head[:-2]
        if head:
            groups.insert(0, head)
        digits = ",".join(groups + [tail])
    text = f"₹{digits}" if not frac else f"₹{digits}.{frac:02d}"
    return f"-{text}" if negative else text


def allocate(total: int, weights: list[int]) -> list[int]:
    """Split `total` across `weights` proportionally so the parts sum exactly (largest remainder)."""
    weight_sum = sum(weights)
    if total == 0 or weight_sum == 0:
        return [0] * len(weights)
    raw = [total * w / weight_sum for w in weights]
    parts = [int(r) for r in raw]
    remainder = total - sum(parts)
    order = sorted(range(len(weights)), key=lambda i: raw[i] - parts[i], reverse=True)
    for i in order[:remainder]:
        parts[i] += 1
    return parts


def inclusive_tax(amount: int, rate_percent: int) -> int:
    """GST contained in a tax-inclusive amount."""
    if not rate_percent:
        return 0
    return round(amount * rate_percent / (100 + rate_percent))


_ONES = (
    "Zero One Two Three Four Five Six Seven Eight Nine Ten Eleven Twelve Thirteen "
    "Fourteen Fifteen Sixteen Seventeen Eighteen Nineteen"
).split()
_TENS = "_ _ Twenty Thirty Forty Fifty Sixty Seventy Eighty Ninety".split()


def _words_below_thousand(n: int) -> str:
    parts = []
    if n >= 100:
        parts.append(f"{_ONES[n // 100]} Hundred")
        n %= 100
    if n >= 20:
        parts.append(_TENS[n // 10] + (f" {_ONES[n % 10]}" if n % 10 else ""))
    elif n or not parts:
        parts.append(_ONES[n])
    return " ".join(parts)


def amount_in_words(paise: int) -> str:
    """Indian numbering in words, used on invoices: 'Rupees One Lakh Twenty Only'."""
    whole, frac = divmod(int(paise), 100)
    if whole == 0:
        text = "Zero"
    else:
        chunks = []
        for name, size in (("Crore", 10_000_000), ("Lakh", 100_000), ("Thousand", 1000)):
            if whole >= size:
                chunks.append(f"{_words_below_thousand(whole // size)} {name}")
                whole %= size
        if whole:
            chunks.append(_words_below_thousand(whole))
        text = " ".join(chunks)
    if frac:
        return f"Rupees {text} and {_words_below_thousand(frac)} Paise Only"
    return f"Rupees {text} Only"
