from rest_framework.throttling import SimpleRateThrottle


class LoginEmailThrottle(SimpleRateThrottle):
    """Caps attempts per account regardless of IP, slowing distributed guessing."""

    scope = "login_email"

    def get_cache_key(self, request, view):
        email = str(request.data.get("email", "")).strip().lower()
        if not email:
            return None
        return self.cache_format % {"scope": self.scope, "ident": email}
