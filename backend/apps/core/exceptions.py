from django.core.exceptions import ValidationError as DjangoValidationError
from rest_framework import status
from rest_framework.exceptions import APIException, ValidationError
from rest_framework.views import exception_handler as drf_exception_handler


class DomainError(APIException):
    """A business rule refused the request. Carries a machine-readable code."""

    status_code = status.HTTP_400_BAD_REQUEST
    default_code = "domain_error"
    default_detail = "This request could not be completed."

    def __init__(self, detail=None, code=None, extra=None):
        super().__init__(detail=detail, code=code)
        self.extra = extra or {}


class ConflictError(DomainError):
    status_code = status.HTTP_409_CONFLICT
    default_code = "conflict"


def exception_handler(exc, context):
    if isinstance(exc, DjangoValidationError):
        exc = ValidationError(exc.message_dict if hasattr(exc, "message_dict") else exc.messages)
    response = drf_exception_handler(exc, context)
    if response is None:
        return None
    if isinstance(exc, DomainError):
        response.data = {
            "detail": str(exc.detail),
            "code": exc.get_codes(),
            **exc.extra,
        }
    return response
