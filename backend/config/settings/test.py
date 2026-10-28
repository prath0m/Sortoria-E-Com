from .base import *  # noqa: F403
from .base import REST_FRAMEWORK, env

DEBUG = False
DATABASES["default"]["NAME"] = env("TEST_DATABASE_NAME", "sartoria_test")  # noqa: F405
PASSWORD_HASHERS = ["django.contrib.auth.hashers.MD5PasswordHasher"]
EMAIL_BACKEND = "django.core.mail.backends.locmem.EmailBackend"
CELERY_TASK_ALWAYS_EAGER = True
CELERY_TASK_EAGER_PROPAGATES = True
CACHES = {"default": {"BACKEND": "django.core.cache.backends.locmem.LocMemCache"}}
MEDIA_ROOT = BASE_DIR / ".test-media"  # noqa: F405
RAZORPAY_KEY_ID = "rzp_test_dummy"
RAZORPAY_KEY_SECRET = "test_secret"
RAZORPAY_WEBHOOK_SECRET = "webhook_secret"
# Throttles are exercised explicitly in their own tests.
REST_FRAMEWORK = {
    **REST_FRAMEWORK,
    "DEFAULT_THROTTLE_RATES": {key: "10000/min" for key in REST_FRAMEWORK["DEFAULT_THROTTLE_RATES"]},
}
