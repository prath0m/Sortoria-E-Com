from rest_framework import serializers

from .models import StoreSettings


class StoreSettingsSerializer(serializers.ModelSerializer):
    """Public, storefront-facing subset of the settings."""

    class Meta:
        model = StoreSettings
        fields = (
            "name",
            "tagline",
            "logo",
            "logo_monogram",
            "favicon",
            "og_default_image",
            "contact_email",
            "support_phone",
            "whatsapp",
            "support_hours",
            "address_line1",
            "address_line2",
            "city",
            "state",
            "pincode",
            "instagram_url",
            "facebook_url",
            "pinterest_url",
            "youtube_url",
            "x_url",
            "announcement_text",
            "announcement_enabled",
            "footer_blurb",
            "meta_title_suffix",
            "meta_description",
            "return_window_days",
            "cod_enabled",
            "cod_fee_paise",
            "infinite_scroll_mobile",
        )


class AdminStoreSettingsSerializer(serializers.ModelSerializer):
    class Meta:
        model = StoreSettings
        exclude = ("id", "created_at", "updated_at")
