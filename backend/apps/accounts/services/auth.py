from django.conf import settings
from django.contrib.auth.tokens import default_token_generator
from django.utils.encoding import force_bytes, force_str
from django.utils.http import urlsafe_base64_decode, urlsafe_base64_encode
from rest_framework_simplejwt.token_blacklist.models import BlacklistedToken, OutstandingToken
from rest_framework_simplejwt.tokens import RefreshToken

from apps.accounts.models import User
from apps.core.emails import send_email


def issue_tokens(user: User) -> dict:
    """Single entry point for minting tokens, so future login methods (OAuth etc.) reuse it."""
    refresh = RefreshToken.for_user(user)
    refresh["role"] = user.role
    return {"refresh": str(refresh), "access": str(refresh.access_token)}


def revoke_all_tokens(user: User) -> None:
    for token in OutstandingToken.objects.filter(user=user):
        BlacklistedToken.objects.get_or_create(token=token)


def reset_link(user: User, path: str = "reset-password") -> str:
    uid = urlsafe_base64_encode(force_bytes(user.pk))
    token = default_token_generator.make_token(user)
    return f"{settings.FRONTEND_URL.rstrip('/')}/{path}/{uid}/{token}"


def send_password_reset(email: str) -> None:
    """Send a reset link if the account exists. Silent otherwise, so emails can't be enumerated."""
    user = User.objects.filter(email__iexact=email, is_active=True).first()
    if user is None:
        return
    send_email(
        "password_reset",
        user.email,
        {"first_name": user.first_name, "reset_url": reset_link(user)},
    )


def user_from_reset_token(uidb64: str, token: str) -> User | None:
    try:
        user = User.objects.get(pk=force_str(urlsafe_base64_decode(uidb64)), is_active=True)
    except (User.DoesNotExist, ValueError, TypeError, OverflowError):
        return None
    if not default_token_generator.check_token(user, token):
        return None
    return user


def set_new_password(user: User, password: str) -> None:
    # Changing the password changes the hash, which invalidates every outstanding reset token.
    user.set_password(password)
    user.save(update_fields=["password"])
    revoke_all_tokens(user)
    send_email("password_changed", user.email, {"first_name": user.first_name})
