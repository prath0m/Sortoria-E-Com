from collections import OrderedDict

from drf_spectacular.utils import extend_schema_field
from rest_framework import serializers

from apps.offers.services.flash import effective_price

from .models import Attribute, AttributeValue, Brand, Category, Product, ProductImage, ProductVariant


def file_url(field) -> str | None:
    return field.url if field else None


class ImageSerializer(serializers.ModelSerializer):
    url = serializers.SerializerMethodField()
    alt = serializers.CharField(source="alt_text")
    option_value = serializers.SerializerMethodField()

    class Meta:
        model = ProductImage
        fields = ("id", "url", "alt", "renditions", "width", "height", "option_value")

    def get_url(self, obj) -> str:
        return obj.image.url

    def get_option_value(self, obj) -> str | None:
        return obj.option_value.slug if obj.option_value_id else None


class BrandSerializer(serializers.ModelSerializer):
    logo = serializers.SerializerMethodField()

    class Meta:
        model = Brand
        fields = ("id", "name", "slug", "logo", "description")

    def get_logo(self, obj) -> str | None:
        return file_url(obj.logo)


class CategoryLinkSerializer(serializers.ModelSerializer):
    class Meta:
        model = Category
        fields = ("id", "name", "slug")


class CategoryDetailSerializer(serializers.ModelSerializer):
    image = serializers.SerializerMethodField()
    banner_image = serializers.SerializerMethodField()
    banner_mobile_image = serializers.SerializerMethodField()
    breadcrumbs = serializers.SerializerMethodField()
    children = serializers.SerializerMethodField()
    return_policy = serializers.SerializerMethodField()
    renditions = serializers.SerializerMethodField()

    class Meta:
        model = Category
        fields = (
            "id",
            "name",
            "slug",
            "description",
            "renditions",
            "image",
            "banner_image",
            "banner_mobile_image",
            "banner_headline",
            "banner_subtext",
            "seo_title",
            "seo_description",
            "breadcrumbs",
            "children",
            "return_policy",
        )

    def get_image(self, obj) -> str | None:
        return file_url(obj.image)

    @extend_schema_field(serializers.DictField())
    def get_renditions(self, obj):
        return obj.srcsets()

    def get_banner_image(self, obj) -> str | None:
        return file_url(obj.banner_image)

    def get_banner_mobile_image(self, obj) -> str | None:
        return file_url(obj.banner_mobile_image)

    @extend_schema_field(CategoryLinkSerializer(many=True))
    def get_breadcrumbs(self, obj):
        return CategoryLinkSerializer(list(obj.get_ancestors()) + [obj], many=True).data

    @extend_schema_field(serializers.ListField(child=serializers.DictField()))
    def get_children(self, obj):
        return [
            {"id": c.id, "name": c.name, "slug": c.slug, "image": file_url(c.image), "renditions": c.srcsets()}
            for c in obj.get_children().filter(is_active=True)
        ]

    @extend_schema_field(serializers.DictField())
    def get_return_policy(self, obj):
        policy, window = obj.effective_return_policy()
        return {"policy": policy, "window_days": window}


class SwatchSerializer(serializers.Serializer):
    slug = serializers.CharField()
    value = serializers.CharField()
    hex = serializers.CharField()


class ProductCardSerializer(serializers.ModelSerializer):
    """Compact product used in grids, carousels and search. Expects prefetched images/variants."""

    brand = serializers.CharField(source="brand.name", default=None)
    category = serializers.CharField(source="category.name")
    images = serializers.SerializerMethodField()
    price_paise = serializers.IntegerField(source="min_price_paise")
    max_price_paise = serializers.IntegerField()
    discount_pct = serializers.IntegerField(source="max_discount_pct")
    rating_avg = serializers.FloatField()
    is_new = serializers.BooleanField()
    swatches = serializers.SerializerMethodField()
    variant_count = serializers.SerializerMethodField()
    default_variant_id = serializers.SerializerMethodField()
    flash_sale = serializers.SerializerMethodField()

    class Meta:
        model = Product
        fields = (
            "id",
            "slug",
            "name",
            "brand",
            "category",
            "short_description",
            "images",
            "price_paise",
            "max_price_paise",
            "mrp_paise",
            "discount_pct",
            "rating_avg",
            "rating_count",
            "in_stock",
            "is_new",
            "is_featured",
            "swatches",
            "variant_count",
            "default_variant_id",
            "flash_sale",
        )

    @extend_schema_field(ImageSerializer(many=True))
    def get_images(self, obj):
        return ImageSerializer(list(obj.images.all())[:2], many=True).data

    def _active_variants(self, obj):
        return [v for v in obj.variants.all() if v.is_active]

    @extend_schema_field(SwatchSerializer(many=True))
    def get_swatches(self, obj):
        seen = OrderedDict()
        for variant in self._active_variants(obj):
            for value in variant.option_values.all():
                if value.attribute.kind == Attribute.Kind.SWATCH and value.slug not in seen:
                    seen[value.slug] = {"slug": value.slug, "value": value.value, "hex": value.hex}
        return list(seen.values())[:6]

    def get_variant_count(self, obj) -> int:
        return len(self._active_variants(obj))

    def get_default_variant_id(self, obj) -> int | None:
        variants = self._active_variants(obj)
        if len(variants) == 1:
            return variants[0].pk
        return None

    @extend_schema_field(serializers.DictField(allow_null=True))
    def get_flash_sale(self, obj):
        item = self.context.get("flash", {}).get(obj.pk)
        if not item:
            return None
        return {
            "title": item.sale.title,
            "slug": item.sale.slug,
            "ends_at": item.sale.ends_at,
            "kind": item.sale.kind,
        }


class AttributeValueSerializer(serializers.ModelSerializer):
    attribute = serializers.CharField(source="attribute.slug")

    class Meta:
        model = AttributeValue
        fields = ("attribute", "slug", "value", "hex")


class VariantSerializer(serializers.ModelSerializer):
    options = serializers.SerializerMethodField()
    price_paise = serializers.SerializerMethodField()
    mrp_paise = serializers.IntegerField()
    label = serializers.CharField()
    is_low_stock = serializers.SerializerMethodField()
    stock = serializers.SerializerMethodField()

    class Meta:
        model = ProductVariant
        fields = ("id", "sku", "label", "options", "price_paise", "mrp_paise", "stock", "is_low_stock")

    @extend_schema_field(serializers.DictField(child=serializers.CharField()))
    def get_options(self, obj):
        return {v.attribute.slug: v.slug for v in obj.option_values.all()}

    def get_price_paise(self, obj) -> int:
        return effective_price(obj.price_paise, self.context.get("flash_item"))

    def get_stock(self, obj) -> int:
        # Exact counts help shoppers only when scarce; cap what we disclose.
        return min(max(obj.stock, 0), 10)

    def get_is_low_stock(self, obj) -> bool:
        return 0 < obj.stock <= obj.threshold()


class ProductDetailSerializer(ProductCardSerializer):
    brand = BrandSerializer(allow_null=True)
    category = CategoryLinkSerializer()
    breadcrumbs = serializers.SerializerMethodField()
    images = ImageSerializer(many=True)
    variants = serializers.SerializerMethodField()
    axes = serializers.SerializerMethodField()
    specs = serializers.SerializerMethodField()
    facts = serializers.SerializerMethodField()
    return_policy = serializers.SerializerMethodField()

    class Meta(ProductCardSerializer.Meta):
        fields = ProductCardSerializer.Meta.fields + (
            "description",
            "highlights",
            "care_info",
            "warranty_info",
            "box_contents",
            "product_type",
            "tax_rate",
            "seo_title",
            "seo_description",
            "breadcrumbs",
            "variants",
            "axes",
            "specs",
            "facts",
            "return_policy",
            "published_at",
        )

    @extend_schema_field(CategoryLinkSerializer(many=True))
    def get_breadcrumbs(self, obj):
        return CategoryLinkSerializer(list(obj.category.get_ancestors()) + [obj.category], many=True).data

    @extend_schema_field(VariantSerializer(many=True))
    def get_variants(self, obj):
        item = self.context.get("flash", {}).get(obj.pk)
        return VariantSerializer(self._active_variants(obj), many=True, context={"flash_item": item}).data

    @extend_schema_field(serializers.ListField(child=serializers.DictField()))
    def get_axes(self, obj):
        """The attributes this product varies by, with the values actually offered, in display order."""
        axes: dict[int, dict] = {}
        for variant in self._active_variants(obj):
            for value in variant.option_values.all():
                attr = value.attribute
                axis = axes.setdefault(
                    attr.pk,
                    {
                        "slug": attr.slug,
                        "name": attr.name,
                        "kind": attr.kind,
                        "position": attr.position,
                        "values": OrderedDict(),
                    },
                )
                axis["values"][value.slug] = {
                    "slug": value.slug,
                    "value": value.value,
                    "hex": value.hex,
                    "position": value.position,
                }
        result = []
        for axis in sorted(axes.values(), key=lambda a: a["position"]):
            values = sorted(axis["values"].values(), key=lambda v: v["position"])
            result.append(
                {
                    "slug": axis["slug"],
                    "name": axis["name"],
                    "kind": axis["kind"],
                    "values": [{k: v[k] for k in ("slug", "value", "hex")} for v in values],
                }
            )
        return result

    @extend_schema_field(serializers.ListField(child=serializers.DictField()))
    def get_specs(self, obj):
        groups: OrderedDict[str, list] = OrderedDict()
        for spec in obj.specs.all():
            groups.setdefault(spec.group or "General", []).append({"key": spec.key, "value": spec.value})
        return [{"group": g, "items": items} for g, items in groups.items()]

    @extend_schema_field(serializers.ListField(child=serializers.DictField()))
    def get_facts(self, obj):
        return [{"name": v.attribute.name, "value": v.value} for v in obj.attribute_values.all()]

    @extend_schema_field(serializers.DictField())
    def get_return_policy(self, obj):
        policy, window = obj.return_terms()
        return {"policy": policy, "window_days": window}
