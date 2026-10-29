from django.db import migrations
from django.db.models import F, Value
from django.db.models.functions import Replace


def forwards(apps, schema_editor):
    AdminNotification = apps.get_model("core", "AdminNotification")
    AdminNotification.objects.filter(link__startswith="/admin-panel").update(
        link=Replace(F("link"), Value("/admin-panel"), Value("/admin"))
    )


def backwards(apps, schema_editor):
    AdminNotification = apps.get_model("core", "AdminNotification")
    AdminNotification.objects.filter(link__startswith="/admin/").update(
        link=Replace(F("link"), Value("/admin/"), Value("/admin-panel/"))
    )


class Migration(migrations.Migration):
    """The admin moved from /admin-panel to /admin; rewrite links stored on existing notifications."""

    dependencies = [("core", "0002_alter_auditlog_action")]
    operations = [migrations.RunPython(forwards, backwards)]
