from django.contrib import admin

from .models import AdminNotification, AuditLog, ImportJob, StoreSettings

admin.site.register(StoreSettings)
admin.site.register(ImportJob)
admin.site.register(AdminNotification)


@admin.register(AuditLog)
class AuditLogAdmin(admin.ModelAdmin):
    list_display = ("created_at", "actor", "action", "object_type", "object_repr")
    list_filter = ("action", "object_type")
    readonly_fields = [f.name for f in AuditLog._meta.fields]
