from django.contrib.postgres.operations import TrigramExtension, UnaccentExtension
from django.db import migrations


class Migration(migrations.Migration):
    initial = True
    dependencies: list = []
    operations = [TrigramExtension(), UnaccentExtension()]
