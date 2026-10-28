"""Versioned cache namespaces: bumping a namespace invalidates every key under it at once."""

from django.core.cache import cache


def _version_key(namespace: str) -> str:
    return f"ns-version:{namespace}"


def namespace_version(namespace: str) -> int:
    version = cache.get(_version_key(namespace))
    if version is None:
        version = 1
        cache.set(_version_key(namespace), version, None)
    return version


def bump(*namespaces: str) -> None:
    for namespace in namespaces:
        try:
            cache.incr(_version_key(namespace))
        except ValueError:
            cache.set(_version_key(namespace), 2, None)


def cached(namespace: str, key: str, producer, timeout: int = 60 * 15):
    full_key = f"{namespace}:v{namespace_version(namespace)}:{key}"
    value = cache.get(full_key)
    if value is None:
        value = producer()
        cache.set(full_key, value, timeout)
    return value


# Namespaces used across apps, bumped by signals when the underlying data changes.
CATALOG = "catalog"
NAVIGATION = "navigation"
HOME = "home"
OFFERS = "offers"
SHIPPING = "shipping"
