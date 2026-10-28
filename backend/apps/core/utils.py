from django.utils.text import slugify


def unique_slug(instance, value: str, field: str = "slug", max_length: int = 80) -> str:
    """Slugify `value`, appending -2, -3… until it is unique for the instance's model."""
    base = slugify(value)[:max_length].strip("-") or "item"
    model = type(instance)
    candidate = base
    n = 2
    while model._default_manager.filter(**{field: candidate}).exclude(pk=instance.pk).exists():
        suffix = f"-{n}"
        candidate = f"{base[: max_length - len(suffix)]}{suffix}"
        n += 1
    return candidate
