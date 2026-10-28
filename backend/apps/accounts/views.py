from django.conf import settings
from django.contrib.auth import password_validation
from django.core.exceptions import ValidationError as DjangoValidationError
from drf_spectacular.utils import extend_schema, inline_serializer
from rest_framework import permissions, serializers, status, viewsets
from rest_framework.decorators import action
from rest_framework.exceptions import PermissionDenied
from rest_framework.response import Response
from rest_framework.throttling import ScopedRateThrottle
from rest_framework.views import APIView
from rest_framework_simplejwt.exceptions import TokenError
from rest_framework_simplejwt.tokens import RefreshToken

from apps.core.emails import send_email

from .models import Address, User
from .serializers import (
    AddressSerializer,
    LoginSerializer,
    PasswordChangeSerializer,
    PasswordForgotSerializer,
    PasswordResetSerializer,
    RegisterSerializer,
    UserSerializer,
)
from .services.auth import issue_tokens, send_password_reset, set_new_password, user_from_reset_token
from .throttles import LoginEmailThrottle

# Cookie-authenticated endpoints (refresh/logout) require this header. Browsers only send custom
# headers cross-origin after a CORS preflight, which our allow-list refuses, so it blocks CSRF.
CLIENT_HEADER = "HTTP_X_SARTORIA_CLIENT"

AuthResponse = inline_serializer(
    "AuthResponse", fields={"access": serializers.CharField(), "user": UserSerializer()}
)


def _set_refresh_cookie(response, refresh: str):
    response.set_cookie(
        settings.REFRESH_COOKIE_NAME,
        refresh,
        max_age=int(settings.SIMPLE_JWT["REFRESH_TOKEN_LIFETIME"].total_seconds()),
        httponly=True,
        secure=settings.REFRESH_COOKIE_SECURE,
        samesite=settings.REFRESH_COOKIE_SAMESITE,
        path=settings.REFRESH_COOKIE_PATH,
    )


def _clear_refresh_cookie(response):
    response.delete_cookie(
        settings.REFRESH_COOKIE_NAME,
        path=settings.REFRESH_COOKIE_PATH,
        samesite=settings.REFRESH_COOKIE_SAMESITE,
    )


def _auth_response(user, request, status_code=status.HTTP_200_OK):
    tokens = issue_tokens(user)
    response = Response(
        {"access": tokens["access"], "user": UserSerializer(user, context={"request": request}).data},
        status=status_code,
    )
    _set_refresh_cookie(response, tokens["refresh"])
    return response


def _require_client_header(request):
    if request.META.get(CLIENT_HEADER) != "1":
        raise PermissionDenied("Missing client header.")


class RegisterView(APIView):
    authentication_classes: list = []
    throttle_classes = [ScopedRateThrottle]
    throttle_scope = "register"

    @extend_schema(request=RegisterSerializer, responses={201: AuthResponse})
    def post(self, request):
        serializer = RegisterSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        user = serializer.save()
        send_email("welcome", user.email, {"first_name": user.first_name})
        return _auth_response(user, request, status.HTTP_201_CREATED)


class LoginView(APIView):
    authentication_classes: list = []
    throttle_classes = [ScopedRateThrottle, LoginEmailThrottle]
    throttle_scope = "login"

    @extend_schema(request=LoginSerializer, responses={200: AuthResponse})
    def post(self, request):
        serializer = LoginSerializer(data=request.data, context={"request": request})
        serializer.is_valid(raise_exception=True)
        return _auth_response(serializer.validated_data["user"], request)


class RefreshView(APIView):
    authentication_classes: list = []

    @extend_schema(request=None, responses={200: AuthResponse})
    def post(self, request):
        _require_client_header(request)
        raw = request.COOKIES.get(settings.REFRESH_COOKIE_NAME)
        if not raw:
            return Response({"detail": "Not signed in."}, status=status.HTTP_401_UNAUTHORIZED)
        try:
            old = RefreshToken(raw)
            user = User.objects.get(pk=old["user_id"], is_active=True)
            old.blacklist()
        except (TokenError, User.DoesNotExist, KeyError):
            response = Response({"detail": "Your session has ended."}, status=status.HTTP_401_UNAUTHORIZED)
            _clear_refresh_cookie(response)
            return response
        return _auth_response(user, request)


class LogoutView(APIView):
    authentication_classes: list = []

    @extend_schema(request=None, responses={204: None})
    def post(self, request):
        _require_client_header(request)
        raw = request.COOKIES.get(settings.REFRESH_COOKIE_NAME)
        if raw:
            try:
                RefreshToken(raw).blacklist()
            except TokenError:
                pass
        response = Response(status=status.HTTP_204_NO_CONTENT)
        _clear_refresh_cookie(response)
        return response


class MeView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    @extend_schema(responses=UserSerializer)
    def get(self, request):
        return Response(UserSerializer(request.user).data)

    @extend_schema(request=UserSerializer, responses=UserSerializer)
    def patch(self, request):
        serializer = UserSerializer(request.user, data=request.data, partial=True)
        serializer.is_valid(raise_exception=True)
        serializer.save()
        return Response(serializer.data)


class PasswordForgotView(APIView):
    authentication_classes: list = []
    throttle_classes = [ScopedRateThrottle]
    throttle_scope = "password_reset"

    @extend_schema(request=PasswordForgotSerializer, responses={202: None})
    def post(self, request):
        serializer = PasswordForgotSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        send_password_reset(serializer.validated_data["email"])
        # Same response whether or not the account exists.
        return Response(
            {"detail": "If an account exists for that email, a reset link is on its way."},
            status=status.HTTP_202_ACCEPTED,
        )


class PasswordResetView(APIView):
    authentication_classes: list = []
    throttle_classes = [ScopedRateThrottle]
    throttle_scope = "password_reset"

    @extend_schema(request=PasswordResetSerializer, responses={200: None})
    def post(self, request):
        serializer = PasswordResetSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        data = serializer.validated_data
        user = user_from_reset_token(data["uid"], data["token"])
        if user is None:
            return Response(
                {"detail": "This link has expired or was already used. Please request a new one."},
                status=status.HTTP_400_BAD_REQUEST,
            )
        try:
            password_validation.validate_password(data["password"], user)
        except DjangoValidationError as exc:
            return Response({"password": list(exc.messages)}, status=status.HTTP_400_BAD_REQUEST)
        set_new_password(user, data["password"])
        return Response({"detail": "Your password has been updated. You can sign in now."})


class PasswordChangeView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    @extend_schema(request=PasswordChangeSerializer, responses={200: AuthResponse})
    def post(self, request):
        serializer = PasswordChangeSerializer(data=request.data, context={"request": request})
        serializer.is_valid(raise_exception=True)
        set_new_password(request.user, serializer.validated_data["new_password"])
        # Old refresh tokens were revoked; hand this device a fresh session.
        return _auth_response(request.user, request)


class AddressViewSet(viewsets.ModelViewSet):
    serializer_class = AddressSerializer
    permission_classes = [permissions.IsAuthenticated]
    pagination_class = None

    def get_queryset(self):
        return Address.objects.filter(user=self.request.user)

    def perform_create(self, serializer):
        serializer.save(user=self.request.user)

    def perform_destroy(self, instance):
        was_default = instance.is_default_shipping
        instance.delete()
        if was_default:
            replacement = Address.objects.filter(user=self.request.user).first()
            if replacement:
                replacement.is_default_shipping = True
                replacement.save(update_fields=["is_default_shipping"])

    @extend_schema(request=None, responses=AddressSerializer)
    @action(detail=True, methods=["post"], url_path="set-default")
    def set_default(self, request, pk=None):
        address = self.get_object()
        self.get_queryset().update(is_default_shipping=False)
        address.is_default_shipping = True
        address.save(update_fields=["is_default_shipping"])
        return Response(AddressSerializer(address).data)
