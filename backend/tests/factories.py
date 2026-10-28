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
