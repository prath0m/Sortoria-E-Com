from .base import *  # noqa: F403
from .base import REST_FRAMEWORK

DEBUG = True
ALLOWED_HOSTS = ["*"]

# Local development and the browser suite sign in far more often than any real person. Sign-in limits
# are relaxed here only; base/prod keep the strict values (5/min per IP, 20/hour per email).
REST_FRAMEWORK = {
    **REST_FRAMEWORK,
    "DEFAULT_THROTTLE_RATES": {
        **REST_FRAMEWORK["DEFAULT_THROTTLE_RATES"],
        "login": "120/min",
        "login_email": "600/hour",
    },
}
