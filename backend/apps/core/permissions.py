"""Staff capabilities. One table drives both API enforcement and what the admin UI shows."""

from rest_framework.permissions import BasePermission

MANAGER = "manager"
ADMIN = "admin"
STAFF_ROLES = (MANAGER, ADMIN)

CAPABILITIES: dict[str, tuple[str, ...]] = {
    "dashboard.view": (MANAGER, ADMIN),
    "orders.view": (MANAGER, ADMIN),
    "orders.manage": (MANAGER, ADMIN),
    "orders.refund": (MANAGER, ADMIN),
    "returns.manage": (MANAGER, ADMIN),
    "customers.view": (MANAGER, ADMIN),
    "customers.manage": (ADMIN,),
    "reviews.manage": (MANAGER, ADMIN),
    "inventory.manage": (MANAGER, ADMIN),
    "catalog.edit": (MANAGER, ADMIN),
    "catalog.delete": (ADMIN,),
    "offers.manage": (MANAGER, ADMIN),
    "cms.manage": (MANAGER, ADMIN),
    "export.run": (MANAGER, ADMIN),
    "import.run": (ADMIN,),
    "shipping.manage": (ADMIN,),
    "settings.manage": (ADMIN,),
    "staff.manage": (ADMIN,),
    "audit.view": (ADMIN,),
}


def is_staff_member(user) -> bool:
    return bool(user and user.is_authenticated and user.is_active and user.role in STAFF_ROLES)


def has_capability(user, capability: str) -> bool:
    if not is_staff_member(user):
        return False
    return user.role in CAPABILITIES[capability]


def capabilities_for(user) -> list[str]:
    return sorted(cap for cap, roles in CAPABILITIES.items() if is_staff_member(user) and user.role in roles)


class IsStaffMember(BasePermission):
    def has_permission(self, request, view):
        return is_staff_member(request.user)


def HasCapability(read: str, write: str | None = None, delete: str | None = None):  # noqa: N802
    """Permission class factory: `read` for safe methods, `write` for mutations, `delete` for DELETE."""

    class _HasCapability(BasePermission):
        def has_permission(self, request, view):
            if request.method in ("GET", "HEAD", "OPTIONS"):
                needed = read
            elif request.method == "DELETE":
                needed = delete or write or read
            else:
                needed = write or read
            return has_capability(request.user, needed)

    _HasCapability.__name__ = f"HasCapability_{read.replace('.', '_')}"
    return _HasCapability
