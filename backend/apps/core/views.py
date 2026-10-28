from drf_spectacular.utils import extend_schema
from rest_framework.response import Response
from rest_framework.views import APIView

from .models import StoreSettings
from .serializers import StoreSettingsSerializer


class StoreSettingsView(APIView):
    authentication_classes: list = []

    @extend_schema(responses=StoreSettingsSerializer)
    def get(self, request):
        data = StoreSettingsSerializer(StoreSettings.load(), context={"request": request}).data
        response = Response(data)
        response["Cache-Control"] = "public, max-age=60"
        return response
