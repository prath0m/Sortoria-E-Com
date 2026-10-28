import factory

from apps.accounts.models import Address, User

PASSWORD = "Tailored-Linen-42"


class UserFactory(factory.django.DjangoModelFactory):
    class Meta:
        model = User
        skip_postgeneration_save = True

    email = factory.Sequence(lambda n: f"patron{n}@example.com")
    first_name = factory.Faker("first_name")
    last_name = factory.Faker("last_name")
    phone = factory.Sequence(lambda n: f"98{n:08d}"[-10:])
    role = "customer"

    @factory.post_generation
    def password(self, create, extracted, **kwargs):
        self.set_password(extracted or PASSWORD)
        if create:
            self.save(update_fields=["password"])


class AddressFactory(factory.django.DjangoModelFactory):
    class Meta:
        model = Address

    user = factory.SubFactory(UserFactory)
    full_name = factory.Faker("name")
    phone = "9876543210"
    line1 = "14 Linking Road"
    city = "Mumbai"
    state = "Maharashtra"
    state_code = "27"
    pincode = "400050"


# --- catalog -----------------------------------------------------------------
from io import BytesIO  # noqa: E402

from django.core.files.base import ContentFile  # noqa: E402
from PIL import Image  # noqa: E402

from apps.catalog.models import (  # noqa: E402
    Attribute,
    AttributeValue,
    Brand,
    Category,
    Product,
    ProductImage,
    ProductVariant,
)
from apps.catalog.services.aggregates import refresh_products, refresh_search_vectors  # noqa: E402


def make_category(name, parent=None, **kwargs):
    if parent is None:
        return Category.add_root(name=name, **kwargs)
    return parent.add_child(name=name, **kwargs)


class BrandFactory(factory.django.DjangoModelFactory):
    class Meta:
        model = Brand
        django_get_or_create = ("name",)

    name = factory.Sequence(lambda n: f"Atelier {n}")


def attribute(name, kind="text", **kwargs):
    attr, _ = Attribute.objects.get_or_create(name=name, defaults={"kind": kind, **kwargs})
    return attr


def attr_value(attr, value, **kwargs):
    from django.utils.text import slugify

    obj, _ = AttributeValue.objects.get_or_create(
        attribute=attr, slug=slugify(value), defaults={"value": value, **kwargs}
    )
    return obj


def png_file(name="product.png", size=(1200, 1500), color=(89, 9, 7)):
    buf = BytesIO()
    Image.new("RGB", size, color).save(buf, "PNG")
    return ContentFile(buf.getvalue(), name=name)


def make_product(
    name="Merino Crew Sweater",
    *,
    category=None,
    brand=None,
    variants=None,
    price=249900,
    mrp=None,
    stock=10,
    tax_rate=5,
    with_image=False,
    **kwargs,
):
    """Create a product with variants.

    `variants` is a list of dicts: {options: [AttributeValue], price, mrp, stock}.
    """
    if category is None:
        category = Category.objects.filter(slug="knitwear").first() or make_category("Knitwear")
    product = Product.objects.create(
        name=name, category=category, brand=brand or BrandFactory(), tax_rate=tax_rate, **kwargs
    )
    specs = variants or [{"options": [], "price": price, "mrp": mrp, "stock": stock}]
    for i, spec in enumerate(specs):
        variant = ProductVariant.objects.create(
            product=product,
            sku=f"{product.slug[:40]}-{i}".upper(),
            price_paise=spec.get("price", price),
            compare_at_paise=spec.get("mrp", mrp),
            stock=spec.get("stock", stock),
        )
        if spec.get("options"):
            variant.option_values.set(spec["options"])
    if with_image:
        ProductImage.objects.create(product=product, image=png_file(), alt_text=f"{name} front view")
    refresh_products([product.pk])
    refresh_search_vectors([product.pk])
    product.refresh_from_db()
    return product
