from django.contrib.auth.models import AbstractBaseUser, BaseUserManager, PermissionsMixin
from django.core.validators import RegexValidator
from django.db import models
from django.utils import timezone

from apps.core.models import BaseModel

pincode_validator = RegexValidator(r"^[1-9][0-9]{5}$", "Enter a valid 6-digit pincode.")
phone_validator = RegexValidator(r"^[6-9][0-9]{9}$", "Enter a valid 10-digit mobile number.")


class UserManager(BaseUserManager):
    use_in_migrations = True

    def _create_user(self, email, password, **extra):
        if not email:
            raise ValueError("Email is required.")
        email = self.normalize_email(email).lower()
        user = self.model(email=email, **extra)
        user.set_password(password)
        user.save(using=self._db)
        return user

    def create_user(self, email, password=None, **extra):
        extra.setdefault("role", User.Role.CUSTOMER)
        return self._create_user(email, password, **extra)

    def create_superuser(self, email, password=None, **extra):
        extra.update(role=User.Role.ADMIN, is_staff=True, is_superuser=True)
        return self._create_user(email, password, **extra)

    def get_by_natural_key(self, username):
        return self.get(email__iexact=username)


class User(AbstractBaseUser, PermissionsMixin):
    class Role(models.TextChoices):
        CUSTOMER = "customer", "Customer"
        MANAGER = "manager", "Manager"
        ADMIN = "admin", "Admin"

    email = models.EmailField(unique=True)
    first_name = models.CharField(max_length=60, blank=True)
    last_name = models.CharField(max_length=60, blank=True)
    phone = models.CharField(max_length=10, blank=True, validators=[phone_validator])
    role = models.CharField(max_length=10, choices=Role.choices, default=Role.CUSTOMER, db_index=True)
    marketing_opt_in = models.BooleanField(default=False)
    is_active = models.BooleanField(default=True)
    is_staff = models.BooleanField(default=False, help_text="Can log in to the Django admin.")
    date_joined = models.DateTimeField(default=timezone.now, db_index=True)

    objects = UserManager()

    USERNAME_FIELD = "email"
    REQUIRED_FIELDS: list[str] = []

    class Meta:
        ordering = ("-date_joined",)

    def __str__(self):
        return self.email

    @property
    def full_name(self):
        return f"{self.first_name} {self.last_name}".strip()

    @property
    def is_store_staff(self):
        return self.role in (self.Role.MANAGER, self.Role.ADMIN)

    def save(self, *args, **kwargs):
        self.email = self.email.lower()
        super().save(*args, **kwargs)


class Address(BaseModel):
    user = models.ForeignKey(User, on_delete=models.CASCADE, related_name="addresses")
    label = models.CharField(max_length=30, blank=True, help_text="Home, Work…")
    full_name = models.CharField(max_length=120)
    phone = models.CharField(max_length=10, validators=[phone_validator])
    line1 = models.CharField(max_length=160)
    line2 = models.CharField(max_length=160, blank=True)
    landmark = models.CharField(max_length=120, blank=True)
    city = models.CharField(max_length=80)
    state = models.CharField(max_length=80)
    state_code = models.CharField(max_length=2)
    pincode = models.CharField(max_length=6, validators=[pincode_validator])
    country = models.CharField(max_length=2, default="IN")
    is_default_shipping = models.BooleanField(default=False)
    is_default_billing = models.BooleanField(default=False)

    class Meta:
        ordering = ("-is_default_shipping", "-updated_at")
        verbose_name_plural = "addresses"

    def __str__(self):
        return f"{self.full_name}, {self.city} {self.pincode}"

    def as_snapshot(self) -> dict:
        return {
            "full_name": self.full_name,
            "phone": self.phone,
            "line1": self.line1,
            "line2": self.line2,
            "landmark": self.landmark,
            "city": self.city,
            "state": self.state,
            "state_code": self.state_code,
            "pincode": self.pincode,
            "country": self.country,
        }
