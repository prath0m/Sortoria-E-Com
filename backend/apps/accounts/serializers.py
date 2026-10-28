from django.contrib.auth import authenticate, password_validation
from django.db import transaction
from rest_framework import serializers

from apps.core.permissions import capabilities_for

from .models import Address, User


class UserSerializer(serializers.ModelSerializer):
    capabilities = serializers.SerializerMethodField()
    full_name = serializers.CharField(read_only=True)

    class Meta:
        model = User
        fields = (
            "id",
            "email",
            "first_name",
            "last_name",
            "full_name",
            "phone",
            "role",
            "marketing_opt_in",
            "date_joined",
            "capabilities",
        )
        read_only_fields = ("id", "email", "role", "date_joined", "capabilities")

    def get_capabilities(self, obj) -> list[str]:
        return capabilities_for(obj)


class RegisterSerializer(serializers.Serializer):
    email = serializers.EmailField()
    password = serializers.CharField(write_only=True, min_length=8, style={"input_type": "password"})
    first_name = serializers.CharField(max_length=60)
    last_name = serializers.CharField(max_length=60, required=False, allow_blank=True)
    phone = serializers.CharField(max_length=10, required=False, allow_blank=True)
    marketing_opt_in = serializers.BooleanField(default=False)

    def validate_email(self, value):
        value = value.lower()
        if User.objects.filter(email__iexact=value).exists():
            raise serializers.ValidationError("An account with this email already exists. Try signing in.")
        return value

    def validate(self, attrs):
        candidate = User(email=attrs["email"], first_name=attrs["first_name"])
        password_validation.validate_password(attrs["password"], candidate)
        return attrs

    @transaction.atomic
    def create(self, validated_data):
        return User.objects.create_user(**validated_data)


class LoginSerializer(serializers.Serializer):
    email = serializers.EmailField()
    password = serializers.CharField(write_only=True, style={"input_type": "password"})

    def validate(self, attrs):
        user = authenticate(
            request=self.context.get("request"), username=attrs["email"].lower(), password=attrs["password"]
        )
        if user is None or not user.is_active:
            raise serializers.ValidationError(
                {"detail": "That email and password don't match our records."}, code="invalid_credentials"
            )
        attrs["user"] = user
        return attrs


class PasswordForgotSerializer(serializers.Serializer):
    email = serializers.EmailField()


class PasswordResetSerializer(serializers.Serializer):
    uid = serializers.CharField()
    token = serializers.CharField()
    password = serializers.CharField(write_only=True, min_length=8)


class PasswordChangeSerializer(serializers.Serializer):
    current_password = serializers.CharField(write_only=True)
    new_password = serializers.CharField(write_only=True, min_length=8)

    def validate_current_password(self, value):
        if not self.context["request"].user.check_password(value):
            raise serializers.ValidationError("Your current password isn't right.")
        return value

    def validate_new_password(self, value):
        password_validation.validate_password(value, self.context["request"].user)
        return value


STATE_CODES = {
    "Andaman and Nicobar Islands": "35",
    "Andhra Pradesh": "37",
    "Arunachal Pradesh": "12",
    "Assam": "18",
    "Bihar": "10",
    "Chandigarh": "04",
    "Chhattisgarh": "22",
    "Dadra and Nagar Haveli and Daman and Diu": "26",
    "Delhi": "07",
    "Goa": "30",
    "Gujarat": "24",
    "Haryana": "06",
    "Himachal Pradesh": "02",
    "Jammu and Kashmir": "01",
    "Jharkhand": "20",
    "Karnataka": "29",
    "Kerala": "32",
    "Ladakh": "38",
    "Lakshadweep": "31",
    "Madhya Pradesh": "23",
    "Maharashtra": "27",
    "Manipur": "14",
    "Meghalaya": "17",
    "Mizoram": "15",
    "Nagaland": "13",
    "Odisha": "21",
    "Puducherry": "34",
    "Punjab": "03",
    "Rajasthan": "08",
    "Sikkim": "11",
    "Tamil Nadu": "33",
    "Telangana": "36",
    "Tripura": "16",
    "Uttar Pradesh": "09",
    "Uttarakhand": "05",
    "West Bengal": "19",
}


class AddressFieldsMixin(serializers.Serializer):
    """Shared validation for saved addresses and checkout addresses."""

    state = serializers.ChoiceField(choices=sorted(STATE_CODES))

    def validate(self, attrs):
        attrs = super().validate(attrs)
        if "state" in attrs:
            attrs["state_code"] = STATE_CODES[attrs["state"]]
        return attrs


class AddressSerializer(AddressFieldsMixin, serializers.ModelSerializer):
    class Meta:
        model = Address
        fields = (
            "id",
            "label",
            "full_name",
            "phone",
            "line1",
            "line2",
            "landmark",
            "city",
            "state",
            "state_code",
            "pincode",
            "country",
            "is_default_shipping",
            "is_default_billing",
        )
        read_only_fields = ("id", "state_code", "country")

    @transaction.atomic
    def save(self, **kwargs):
        instance = super().save(**kwargs)
        user = instance.user
        if instance.is_default_shipping:
            user.addresses.exclude(pk=instance.pk).update(is_default_shipping=False)
        if instance.is_default_billing:
            user.addresses.exclude(pk=instance.pk).update(is_default_billing=False)
        if not user.addresses.filter(is_default_shipping=True).exists():
            Address.objects.filter(pk=instance.pk).update(is_default_shipping=True)
            instance.is_default_shipping = True
        return instance
