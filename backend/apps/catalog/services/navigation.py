from apps.catalog.models import Category
from apps.core import caching


def _build_tree(menu_only: bool) -> list[dict]:
    nodes = Category.get_tree().filter(is_active=True)
    if menu_only:
        nodes = nodes.filter(show_in_menu=True)
    by_path: dict[str, dict] = {}
    roots: list[dict] = []
    for cat in nodes:  # get_tree() yields parents before children
        node = {
            "id": cat.pk,
            "name": cat.name,
            "slug": cat.slug,
            "image": cat.image.url if cat.image else None,
            "menu_image": cat.menu_image.url if cat.menu_image else None,
            "position": cat.position,
            "children": [],
        }
        by_path[cat.path] = node
        parent_path = cat.path[: -Category.steplen]
        if cat.depth == 1:
            roots.append(node)
        elif parent_path in by_path:
            by_path[parent_path]["children"].append(node)

    def order(items):
        items.sort(key=lambda n: (n["position"], n["name"]))
        for item in items:
            order(item["children"])
            item.pop("position")
        return items

    return order(roots)


def category_tree(menu_only: bool = False) -> list[dict]:
    key = "menu" if menu_only else "all"
    return caching.cached(caching.NAVIGATION, f"tree:{key}", lambda: _build_tree(menu_only), timeout=60 * 60)
