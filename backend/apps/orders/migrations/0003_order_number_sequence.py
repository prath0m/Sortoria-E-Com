from django.db import migrations


class Migration(migrations.Migration):
    dependencies = [("orders", "0002_documentcounter_returnrequest_returnphoto_returnitem_and_more")]

    operations = [
        migrations.RunSQL(
            "CREATE SEQUENCE IF NOT EXISTS orders_order_number_seq START 1001",
            "DROP SEQUENCE IF EXISTS orders_order_number_seq",
        )
    ]
