from rest_framework import serializers

from .models import Review


class ReviewSerializer(serializers.ModelSerializer):
    author = serializers.SerializerMethodField()
    photos = serializers.SerializerMethodField()

    class Meta:
        model = Review
        fields = ("id", "rating", "title", "body", "author", "is_verified_buyer", "photos", "admin_reply", "created_at")

    def get_author(self, obj) -> str:
        first = obj.user.first_name or "A Sartoria patron"
        last = obj.user.last_name[:1]
        return f"{first} {last}." if last else first

    def get_photos(self, obj) -> list[str]:
        return [p.image.url for p in obj.photos.all()]


class ReviewInput(serializers.Serializer):
    rating = serializers.IntegerField(min_value=1, max_value=5)
    title = serializers.CharField(max_length=120)
    body = serializers.CharField(min_length=20, max_length=4000, error_messages={
        "min_length": "Tell us a little more: at least 20 characters."
    })
