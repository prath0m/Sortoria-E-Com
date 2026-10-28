"""Admin API for the catalogue: products (with variants, specs, images), categories, brands, attributes."""

from django.db import transaction
from django.db.models import Count, Max, Min, Prefetch, ProtectedError, Q, Sum, Value
from django.db.models.functions import Coalesce
from django.shortcuts import get_object_or_404
from django_filters import rest_framework as filters
from drf_spectacular.types import OpenApiTypes
from drf_spectacular.utils import extend_schema
from rest_framework import serializers, status, viewsets
from rest_framework.decorators import action
from rest_framework.parsers import FormParser, JSONParser, MultiPartParser
from rest_framework.response import Response

from apps.core.admin_tools import FormBooleanMixin, SafeImageField
from apps.core.audit import AuditedViewSetMixin, record
from apps.core.exceptions import DomainError
from apps.core.images import reencode_upload, validate_image_file
from apps.core.models import AuditLog
from apps.core.pagination import AdminPagination
from apps.core.permissions import HasCapability, has_capability

from .models import (
    Attribute,
    AttributeValue,
    Brand,
    Category,
    Product,
    ProductImage,
    ProductSpec,
    ProductVariant,
    StockMovement,
)
from .services.aggregates import refresh_products, refresh_search_vectors
from .services.stock import set_stock

CatalogPermission = HasCapability("catalog.edit", "catalog.edit", "catalog.delete")


# --------------------------------------------------------------------------- serializers
class AdminVariantSerializer(serializers.ModelSerializer):
    id = serializers.IntegerField(required=False)
    option_values = serializers.PrimaryKeyRelatedField(many=True, queryset=AttributeValue.objects.all(), required=False)
    stock = serializers.IntegerField(min_value=0, required=False)
    label = serializers.CharField(read_only=True)

    class Meta:
        model = ProductVariant
        fields = (
            "id",
            "sku",
            "label",
            "option_values",
            "price_paise",
            "compare_at_paise",
            "stock",
            "low_stock_threshold",
            "weight_g",
            "is_active",
            "position",
        )
        extra_kwargs = {"sku": {"validators": []}}

    def validate(self, attrs):
        mrp = attrs.get("compare_at_paise")
        if mrp is not None and mrp < attrs.get("price_paise", 0):
            raise serializers.ValidationError({"compare_at_paise": "MRP can't be lower than the selling price."})
        return attrs


class AdminSpecSerializer(serializers.ModelSerializer):
    class Meta:
        model = ProductSpec
        fields = ("group", "key", "value")


class AdminImageSerializer(serializers.ModelSerializer):
    url = serializers.SerializerMethodField()
    thumb = serializers.SerializerMethodField()

    class Meta:
        model = ProductImage
        fields = ("id", "url", "thumb", "alt_text", "option_value", "position", "width", "height")
        read_only_fields = ("id", "url", "thumb", "position", "width", "height")

    def get_url(self, obj) -> str:
        return obj.image.url

    def get_thumb(self, obj) -> str:
        return obj.renditions.get("400") or obj.image.url


class AdminProductListSerializer(serializers.ModelSerializer):
    brand = serializers.CharField(source="brand.name", default=None)
    category = serializers.CharField(source="category.name")
    thumb = serializers.SerializerMethodField()
    variant_count = serializers.IntegerField()

    class Meta:
        model = Product
        fields = (
            "id",
            "name",
            "slug",
            "brand",
            "category",
            "thumb",
            "min_price_paise",
            "max_price_paise",
            "total_stock",
            "in_stock",
            "is_active",
            "is_featured",
            "variant_count",
            "rating_avg",
            "rating_count",
            "sales_count",
            "updated_at",
        )

    def get_thumb(self, obj) -> str | None:
        images = list(obj.images.all())
        return (images[0].renditions.get("400") or images[0].image.url) if images else None


class AdminProductSerializer(serializers.ModelSerializer):
    variants = AdminVariantSerializer(many=True)
    specs = AdminSpecSerializer(many=True, required=False)
    images = AdminImageSerializer(many=True, read_only=True)
    attribute_values = serializers.PrimaryKeyRelatedField(
        many=True, queryset=AttributeValue.objects.all(), required=False
    )
    extra_categories = serializers.PrimaryKeyRelatedField(many=True, queryset=Category.objects.all(), required=False)
    slug = serializers.SlugField(required=False, allow_blank=True)

    class Meta:
        model = Product
        fields = (
            "id",
            "name",
            "slug",
            "brand",
            "category",
            "extra_categories",
            "product_type",
            "short_description",
            "description",
            "highlights",
            "care_info",
            "warranty_info",
            "box_contents",
            "attribute_values",
            "tax_rate",
            "hsn_code",
            "is_returnable",
            "is_active",
            "is_featured",
            "published_at",
            "seo_title",
            "seo_description",
            "variants",
            "specs",
            "images",
            "rating_avg",
            "rating_count",
            "sales_count",
        )
        read_only_fields = ("id", "rating_avg", "rating_count", "sales_count")

    def validate_slug(self, value):
        if value and Product.objects.filter(slug=value).exclude(pk=getattr(self.instance, "pk", None)).exists():
            raise serializers.ValidationError("Another product already uses this URL.")
        return value

    def validate_category(self, value):
        if not value.is_leaf():
            raise serializers.ValidationError("Choose the most specific category (one without subcategories).")
        return value

    def validate_variants(self, variants):
        if not variants:
            raise serializers.ValidationError("Add at least one variant with a price.")
        skus = [v["sku"].strip().upper() for v in variants]
        if len(set(skus)) != len(skus):
            raise serializers.ValidationError("Each variant needs its own SKU.")
        own_ids = {v["id"] for v in variants if v.get("id")}
        taken = ProductVariant.objects.filter(sku__in=skus).exclude(pk__in=own_ids)
        if taken.exists():
            raise serializers.ValidationError(f"SKU {taken.first().sku} is already used by another product.")
        # Every variant must pick exactly one value from the same set of attributes, with no duplicate combos.
        axes_sets, combos = set(), set()
        for v in variants:
            values = v.get("option_values", [])
            attrs = [val.attribute_id for val in values]
            if len(attrs) != len(set(attrs)):
                raise serializers.ValidationError("A variant can only have one value per attribute.")
            axes_sets.add(frozenset(attrs))
            combo = frozenset(val.pk for val in values)
            if combo in combos:
                raise serializers.ValidationError("Two variants have the same options.")
            combos.add(combo)
        if len(axes_sets) > 1:
            raise serializers.ValidationError(
                "All variants must use the same attributes (e.g. every one has a Colour and a Size)."
            )
        return variants

    def _sync_variants(self, product, variants, request):
        existing = {v.pk: v for v in product.variants.all()}
        seen = set()
        for position, data in enumerate(variants):
            data = dict(data)
            options = data.pop("option_values", [])
            stock = data.pop("stock", None)
            data["sku"] = data["sku"].strip().upper()
            data.setdefault("position", position)
            variant = existing.get(data.pop("id", None))
            if variant is None:
                variant = ProductVariant.objects.create(product=product, stock=0, **data)
            else:
                for key, value in data.items():
                    setattr(variant, key, value)
                variant.save()
            seen.add(variant.pk)
            variant.option_values.set(options)
            if stock is not None and stock != variant.stock:
                reason = (
                    StockMovement.Reason.INITIAL
                    if variant.stock == 0 and not variant.movements.exists()
                    else StockMovement.Reason.MANUAL
                )
                set_stock(variant.pk, stock, reason, reference="product editor", actor=request.user)
        for pk, variant in existing.items():
            if pk in seen:
                continue
            if variant.order_items.exists():
                variant.is_active = False  # keep order history intact
                variant.save(update_fields=["is_active"])
            else:
                variant.delete()

    def _sync_specs(self, product, specs):
        product.specs.all().delete()
        ProductSpec.objects.bulk_create(
            [ProductSpec(product=product, position=i, **s) for i, s in enumerate(specs) if s.get("key")]
        )

    @transaction.atomic
    def create(self, validated):
        variants = validated.pop("variants")
        specs = validated.pop("specs", [])
        m2m = {k: validated.pop(k) for k in ("attribute_values", "extra_categories") if k in validated}
        product = Product.objects.create(**validated)
        for key, values in m2m.items():
            getattr(product, key).set(values)
        self._sync_variants(product, variants, self.context["request"])
        self._sync_specs(product, specs)
        transaction.on_commit(lambda: (refresh_products([product.pk]), refresh_search_vectors([product.pk])))
        return product

    @transaction.atomic
    def update(self, product, validated):
        variants = validated.pop("variants", None)
        specs = validated.pop("specs", None)
        m2m = {k: validated.pop(k) for k in ("attribute_values", "extra_categories") if k in validated}
        for key, value in validated.items():
            setattr(product, key, value)
        product.save()
        for key, values in m2m.items():
            getattr(product, key).set(values)
        if variants is not None:
            self._sync_variants(product, variants, self.context["request"])
        if specs is not None:
            self._sync_specs(product, specs)
        pk = product.pk
        transaction.on_commit(lambda: (refresh_products([pk]), refresh_search_vectors([pk])))
        return product


# --------------------------------------------------------------------------- products
class ProductFilter(filters.FilterSet):
    category = filters.NumberFilter(method="filter_category")
    brand = filters.NumberFilter(field_name="brand_id")
    status = filters.ChoiceFilter(
        method="filter_status", choices=[("active", "active"), ("inactive", "inactive"), ("featured", "featured")]
    )
    stock = filters.ChoiceFilter(method="filter_stock", choices=[("out", "out"), ("in", "in")])

    class Meta:
        model = Product
        fields = ("category", "brand", "status", "stock")

    def filter_category(self, qs, name, value):
        category = Category.objects.filter(pk=value).first()
        return qs.filter(category__path__startswith=category.path) if category else qs.none()

    def filter_status(self, qs, name, value):
        return {
            "active": qs.filter(is_active=True),
            "inactive": qs.filter(is_active=False),
            "featured": qs.filter(is_featured=True),
        }[value]

    def filter_stock(self, qs, name, value):
        return qs.filter(in_stock=value == "in")


class AdminProductViewSet(AuditedViewSetMixin, viewsets.ModelViewSet):
    permission_classes = [CatalogPermission]
    pagination_class = AdminPagination
    filterset_class = ProductFilter
    search_fields = ("name", "variants__sku", "brand__name")
    ordering_fields = ("name", "min_price_paise", "total_stock", "updated_at", "sales_count", "rating_avg")
    ordering = ("-updated_at",)

    def get_queryset(self):
        qs = Product.objects.select_related("brand", "category")
        if self.action == "list":
            return qs.annotate(variant_count=Count("variants", distinct=True)).prefetch_related(
                Prefetch("images", queryset=ProductImage.objects.order_by("position", "id"))
            )
        return qs.prefetch_related(
            Prefetch("variants", queryset=ProductVariant.objects.prefetch_related("option_values")),
            "specs",
            "attribute_values",
            "extra_categories",
            Prefetch("images", queryset=ProductImage.objects.order_by("position", "id")),
        )

    def get_serializer_class(self):
        return AdminProductListSerializer if self.action == "list" else AdminProductSerializer

    def perform_destroy(self, instance):
        if instance.variants.filter(order_items__isnull=False).exists():
            raise DomainError(
                "This product has orders, so it can't be deleted. Deactivate it instead to hide it from the store.",
                code="has_orders",
            )
        super().perform_destroy(instance)

    @extend_schema(request=OpenApiTypes.OBJECT, responses=OpenApiTypes.OBJECT)
    @action(detail=False, methods=["post"])
    def bulk(self, request):
        ids = [int(i) for i in request.data.get("ids", []) if str(i).isdigit()]
        op = request.data.get("action")
        qs = Product.objects.filter(pk__in=ids)
        if op == "delete":
            if not has_capability(request.user, "catalog.delete"):
                return Response({"detail": "Only admins can delete products."}, status=status.HTTP_403_FORBIDDEN)
            blocked = qs.filter(variants__order_items__isnull=False).distinct()
            deleted = qs.exclude(pk__in=blocked).delete()[1].get("catalog.Product", 0)
            result = {"deleted": deleted, "skipped": blocked.count()}
        elif op in ("activate", "deactivate", "feature", "unfeature"):
            field, value = {
                "activate": ("is_active", True),
                "deactivate": ("is_active", False),
                "feature": ("is_featured", True),
                "unfeature": ("is_featured", False),
            }[op]
            result = {"updated": qs.update(**{field: value})}
        elif op == "set_category":
            category = get_object_or_404(Category, pk=request.data.get("category"))
            if not category.is_leaf():
                raise DomainError("Choose the most specific category.", code="not_leaf")
            result = {"updated": qs.update(category=category)}
        else:
            raise DomainError("Unknown bulk action.", code="bad_action")
        from apps.core import caching

        caching.bump(caching.CATALOG, caching.HOME)
        record(
            request,
            AuditLog.Action.BULK,
            object_type="catalog.Product",
            object_repr=f"{op} × {len(ids)}",
            changes={"ids": ids, **result},
        )
        return Response(result)

    @extend_schema(request={"multipart/form-data": OpenApiTypes.OBJECT}, responses=AdminImageSerializer(many=True))
    @action(detail=True, methods=["post"], parser_classes=[MultiPartParser, FormParser])
    def images(self, request, pk=None):
        product = self.get_object()
        files = request.FILES.getlist("files")
        if not files:
            raise DomainError("Choose at least one image.", code="no_files")
        for f in files:
            validate_image_file(f)
        start = (product.images.aggregate(m=Max("position"))["m"] or -1) + 1
        created = []
        for i, f in enumerate(files):
            created.append(
                ProductImage.objects.create(
                    product=product,
                    image=reencode_upload(f),
                    alt_text=f"{product.name}, view {start + i + 1}",
                    position=start + i,
                )
            )
        record(request, AuditLog.Action.UPDATE, obj=product, changes={"images_added": len(created)})
        return Response(AdminImageSerializer(created, many=True).data, status=status.HTTP_201_CREATED)

    @extend_schema(request=OpenApiTypes.OBJECT, responses=AdminImageSerializer(many=True))
    @action(detail=True, methods=["post"], url_path="images/reorder", parser_classes=[JSONParser])
    def reorder_images(self, request, pk=None):
        product = self.get_object()
        order = [int(i) for i in request.data.get("ids", [])]
        images = {img.pk: img for img in product.images.all()}
        if set(order) != set(images):
            raise DomainError("Send every image id once, in the new order.", code="bad_order")
        for position, image_id in enumerate(order):
            images[image_id].position = position
        ProductImage.objects.bulk_update(images.values(), ["position"])
        from apps.core import caching

        caching.bump(caching.CATALOG)
        return Response(AdminImageSerializer(sorted(images.values(), key=lambda i: i.position), many=True).data)


class AdminImageViewSet(viewsets.GenericViewSet):
    permission_classes = [CatalogPermission]
    serializer_class = AdminImageSerializer
    queryset = ProductImage.objects.all()

    @extend_schema(request=AdminImageSerializer, responses=AdminImageSerializer)
    def partial_update(self, request, pk=None):
        image = self.get_object()
        serializer = self.get_serializer(image, data=request.data, partial=True)
        serializer.is_valid(raise_exception=True)
        serializer.save()
        from apps.core import caching

        caching.bump(caching.CATALOG)
        return Response(serializer.data)

    def destroy(self, request, pk=None):
        image = self.get_object()
        record(request, AuditLog.Action.DELETE, obj=image)
        image.image.delete(save=False)
        image.delete()
        return Response(status=status.HTTP_204_NO_CONTENT)


# --------------------------------------------------------------------------- categories
class AdminCategorySerializer(FormBooleanMixin, serializers.ModelSerializer):
    image = SafeImageField()
    banner_image = SafeImageField()
    banner_mobile_image = SafeImageField()
    menu_image = SafeImageField()
    parent = serializers.IntegerField(write_only=True, required=False, allow_null=True)
    parent_id = serializers.SerializerMethodField()
    depth = serializers.IntegerField(read_only=True)
    product_count = serializers.SerializerMethodField()
    slug = serializers.SlugField(required=False, allow_blank=True)

    class Meta:
        model = Category
        fields = (
            "id",
            "name",
            "slug",
            "parent",
            "parent_id",
            "depth",
            "description",
            "image",
            "banner_image",
            "banner_mobile_image",
            "banner_headline",
            "banner_subtext",
            "menu_image",
            "show_in_menu",
            "is_active",
            "position",
            "return_policy",
            "return_window_days",
            "filterable_attributes",
            "seo_title",
            "seo_description",
            "product_count",
        )

    def get_parent_id(self, obj) -> int | None:
        parent = obj.get_parent()
        return parent.pk if parent else None

    def get_product_count(self, obj) -> int:
        return getattr(obj, "_product_count", 0)

    def validate_slug(self, value):
        if value and Category.objects.filter(slug=value).exclude(pk=getattr(self.instance, "pk", None)).exists():
            raise serializers.ValidationError("Another category already uses this URL.")
        return value

    @transaction.atomic
    def create(self, validated):
        parent_id = validated.pop("parent", None)
        attrs = validated.pop("filterable_attributes", [])
        parent = get_object_or_404(Category, pk=parent_id) if parent_id else None
        node = parent.add_child(**validated) if parent else Category.add_root(**validated)
        node.filterable_attributes.set(attrs)
        return node

    @transaction.atomic
    def update(self, instance, validated):
        parent_id = validated.pop("parent", "unchanged")
        instance = super().update(instance, validated)
        current = instance.get_parent()
        if parent_id != "unchanged" and (parent_id or None) != (current.pk if current else None):
            if parent_id:
                target = get_object_or_404(Category, pk=parent_id)
                if target.path.startswith(instance.path):
                    raise DomainError("A category can't be moved inside itself.", code="bad_move")
                instance.move(target, "sorted-child")
            else:
                instance.move(Category.get_first_root_node(), "sorted-sibling")
            instance.refresh_from_db()
        return instance


class AdminCategoryViewSet(AuditedViewSetMixin, viewsets.ModelViewSet):
    permission_classes = [CatalogPermission]
    serializer_class = AdminCategorySerializer
    pagination_class = None
    parser_classes = [MultiPartParser, FormParser, JSONParser]

    def get_queryset(self):
        return Category.get_tree().prefetch_related("filterable_attributes")

    def list(self, request, *args, **kwargs):
        counts = dict(Product.objects.values_list("category_id").annotate(n=Count("id")))
        nodes = list(self.get_queryset())
        for node in nodes:  # include products of descendants in each node's count
            node._product_count = sum(
                n for cid, n in counts.items() if cid in {d.pk for d in nodes if d.path.startswith(node.path)}
            )
        return Response(self.get_serializer(nodes, many=True).data)

    def perform_destroy(self, instance):
        descendants = Category.objects.filter(path__startswith=instance.path)
        if Product.objects.filter(category__in=descendants).exists():
            raise DomainError("Move or delete this category's products first.", code="has_products")
        try:
            super().perform_destroy(instance)
        except ProtectedError as exc:
            raise DomainError("This category is still in use.", code="in_use") from exc


# --------------------------------------------------------------------------- brands & attributes
class AdminBrandSerializer(FormBooleanMixin, serializers.ModelSerializer):
    logo = SafeImageField(max_side=800)
    product_count = serializers.IntegerField(read_only=True)
    slug = serializers.SlugField(required=False, allow_blank=True)

    class Meta:
        model = Brand
        fields = ("id", "name", "slug", "logo", "description", "is_active", "product_count")


class AdminBrandViewSet(AuditedViewSetMixin, viewsets.ModelViewSet):
    permission_classes = [CatalogPermission]
    serializer_class = AdminBrandSerializer
    pagination_class = AdminPagination
    parser_classes = [MultiPartParser, FormParser, JSONParser]
    search_fields = ("name",)
    ordering_fields = ("name", "product_count")
    ordering = ("name",)

    def get_queryset(self):
        return Brand.objects.annotate(product_count=Count("products"))


class AdminAttributeValueSerializer(serializers.ModelSerializer):
    id = serializers.IntegerField(required=False)
    slug = serializers.SlugField(required=False, allow_blank=True)

    class Meta:
        model = AttributeValue
        fields = ("id", "value", "slug", "hex", "numeric_value", "position")


class AdminAttributeSerializer(serializers.ModelSerializer):
    values = AdminAttributeValueSerializer(many=True)
    slug = serializers.SlugField(required=False, allow_blank=True)

    class Meta:
        model = Attribute
        fields = ("id", "name", "slug", "kind", "unit", "is_variant_axis", "is_filterable", "position", "values")

    @transaction.atomic
    def _sync_values(self, attribute, values):
        existing = {v.pk: v for v in attribute.values.all()}
        keep = set()
        for position, data in enumerate(values):
            pk = data.pop("id", None)
            data["position"] = position
            if pk in existing:
                value = existing[pk]
                for k, v in data.items():
                    setattr(value, k, v)
                value.save()
            else:
                value = AttributeValue.objects.create(attribute=attribute, **data)
            keep.add(value.pk)
        removable = [pk for pk in existing if pk not in keep]
        in_use = (
            AttributeValue.objects.filter(pk__in=removable)
            .filter(Q(variants__isnull=False) | Q(products__isnull=False))
            .distinct()
        )
        if in_use.exists():
            raise DomainError(
                f"“{in_use.first().value}” is used by products, so it can't be removed.", code="value_in_use"
            )
        AttributeValue.objects.filter(pk__in=removable).delete()

    @transaction.atomic
    def create(self, validated):
        values = validated.pop("values", [])
        attribute = Attribute.objects.create(**validated)
        self._sync_values(attribute, values)
        return attribute

    @transaction.atomic
    def update(self, instance, validated):
        values = validated.pop("values", None)
        instance = super().update(instance, validated)
        if values is not None:
            self._sync_values(instance, values)
        return instance


class AdminAttributeViewSet(AuditedViewSetMixin, viewsets.ModelViewSet):
    permission_classes = [CatalogPermission]
    serializer_class = AdminAttributeSerializer
    pagination_class = None
    queryset = Attribute.objects.prefetch_related("values")

    def perform_destroy(self, instance):
        if (
            ProductVariant.objects.filter(option_values__attribute=instance).exists()
            or Product.objects.filter(attribute_values__attribute=instance).exists()
        ):
            raise DomainError("This attribute is used by products, so it can't be deleted.", code="in_use")
        super().perform_destroy(instance)


# --------------------------------------------------------------------------- inventory
class InventoryRowSerializer(serializers.ModelSerializer):
    product_id = serializers.IntegerField()
    product = serializers.CharField(source="product.name")
    label = serializers.CharField()
    threshold = serializers.IntegerField(source="effective_threshold")
    status = serializers.SerializerMethodField()

    class Meta:
        model = ProductVariant
        fields = (
            "id",
            "sku",
            "product_id",
            "product",
            "label",
            "stock",
            "threshold",
            "low_stock_threshold",
            "price_paise",
            "is_active",
            "status",
        )

    def get_status(self, obj) -> str:
        if obj.stock <= 0:
            return "out"
        return "low" if obj.stock <= obj.effective_threshold else "ok"


class InventoryFilter(filters.FilterSet):
    stock = filters.ChoiceFilter(method="filter_stock", choices=[("low", "low"), ("out", "out"), ("ok", "ok")])

    class Meta:
        model = ProductVariant
        fields = ("stock",)

    def filter_stock(self, qs, name, value):
        from apps.analytics.services import low_stock_queryset

        low_ids = low_stock_queryset().values("pk")
        if value == "out":
            return qs.filter(stock__lte=0)
        if value == "low":
            return qs.filter(pk__in=low_ids, stock__gt=0)
        return qs.exclude(pk__in=low_ids)


class AdminInventoryViewSet(viewsets.ReadOnlyModelViewSet):
    permission_classes = [HasCapability("inventory.manage")]
    serializer_class = InventoryRowSerializer
    pagination_class = AdminPagination
    filterset_class = InventoryFilter
    search_fields = ("sku", "product__name")
    ordering_fields = ("stock", "sku", "product__name")
    ordering = ("stock", "product__name")

    def get_queryset(self):
        from apps.core.models import StoreSettings

        default = StoreSettings.load().low_stock_threshold_default
        return (
            ProductVariant.objects.filter(product__is_active=True)
            .select_related("product")
            .prefetch_related("option_values__attribute")
            .annotate(effective_threshold=Coalesce("low_stock_threshold", Value(default)))
        )

    @extend_schema(request=OpenApiTypes.OBJECT, responses=OpenApiTypes.OBJECT)
    @action(detail=False, methods=["post"])
    def bulk(self, request):
        """[{variant_id, stock}] or [{variant_id, delta}] with an optional note."""
        rows = request.data.get("rows", [])
        note = str(request.data.get("note", ""))[:80] or "bulk update"
        if not isinstance(rows, list) or not rows:
            raise DomainError("Nothing to update.", code="empty")
        updated = 0
        with transaction.atomic():
            for row in rows:
                variant = get_object_or_404(ProductVariant, pk=row.get("variant_id"))
                if "stock" in row:
                    target = int(row["stock"])
                else:
                    target = variant.stock + int(row.get("delta", 0))
                if target < 0:
                    raise DomainError(f"Stock for {variant.sku} can't go below zero.", code="negative")
                set_stock(variant.pk, target, StockMovement.Reason.MANUAL, reference=note, actor=request.user)
                updated += 1
        record(
            request,
            AuditLog.Action.BULK,
            object_type="catalog.ProductVariant",
            object_repr=f"stock × {updated}",
            changes={"rows": rows, "note": note},
        )
        return Response({"updated": updated})

    @extend_schema(responses=OpenApiTypes.OBJECT)
    @action(detail=True, methods=["get"])
    def movements(self, request, pk=None):
        variant = get_object_or_404(ProductVariant, pk=pk)
        rows = variant.movements.select_related("actor")[:50]
        return Response(
            [
                {
                    "delta": m.delta,
                    "balance_after": m.balance_after,
                    "reason": m.get_reason_display(),
                    "reference": m.reference,
                    "actor": m.actor.email if m.actor else "System",
                    "created_at": m.created_at,
                }
                for m in rows
            ]
        )


def catalog_options() -> dict:
    """Lookup lists for admin forms (one round trip)."""
    return {
        "categories": [
            {"id": c.pk, "name": c.name, "depth": c.depth, "is_leaf": c.is_leaf()} for c in Category.get_tree()
        ],
        "brands": list(Brand.objects.values("id", "name")),
        "attributes": [
            {
                "id": a.pk,
                "name": a.name,
                "slug": a.slug,
                "kind": a.kind,
                "is_variant_axis": a.is_variant_axis,
                "values": [{"id": v.pk, "value": v.value, "hex": v.hex} for v in a.values.all()],
            }
            for a in Attribute.objects.prefetch_related("values")
        ],
        "tax_rates": [r for r, _ in Product._meta.get_field("tax_rate").choices],
        "price_range": Product.objects.aggregate(
            lo=Min("min_price_paise"), hi=Max("max_price_paise"), stock=Sum("total_stock")
        ),
    }


class CatalogOptionsView(viewsets.ViewSet):
    permission_classes = [HasCapability("catalog.edit")]

    @extend_schema(responses=OpenApiTypes.OBJECT)
    def list(self, request):
        return Response(catalog_options())
