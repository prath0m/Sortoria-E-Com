"""Upload validation and WebP rendition generation."""

import hashlib
from io import BytesIO
from pathlib import PurePosixPath

from django.conf import settings
from django.core.exceptions import ValidationError
from django.core.files.base import ContentFile
from django.core.files.storage import default_storage
from PIL import Image, ImageOps, UnidentifiedImageError

ALLOWED_FORMATS = {"JPEG", "PNG", "WEBP", "GIF"}


def validate_image_file(file) -> None:
    """Reject anything that isn't a real image of an allowed type and size."""
    if file.size > settings.MAX_UPLOAD_IMAGE_BYTES:
        limit_mb = settings.MAX_UPLOAD_IMAGE_BYTES // (1024 * 1024)
        raise ValidationError(f"Images must be {limit_mb} MB or smaller.")
    try:
        file.seek(0)
        with Image.open(file) as img:
            img.verify()
            fmt = img.format
    except (UnidentifiedImageError, OSError, SyntaxError) as exc:
        raise ValidationError("That file isn't an image we can read.") from exc
    finally:
        file.seek(0)
    if fmt not in ALLOWED_FORMATS:
        raise ValidationError("Please upload a JPEG, PNG, WebP or GIF image.")


def reencode_upload(file, max_side: int = 2400) -> ContentFile:
    """Re-encode an upload to strip metadata and any payload hidden after the image data."""
    file.seek(0)
    with Image.open(file) as img:
        img = ImageOps.exif_transpose(img)
        has_alpha = img.mode in ("RGBA", "LA") or (img.mode == "P" and "transparency" in img.info)
        img = img.convert("RGBA" if has_alpha else "RGB")
        img.thumbnail((max_side, max_side), Image.LANCZOS)
        out = BytesIO()
        if has_alpha:
            img.save(out, "PNG", optimize=True)
            ext = "png"
        else:
            img.save(out, "JPEG", quality=88, optimize=True, progressive=True)
            ext = "jpg"
    stem = PurePosixPath(getattr(file, "name", "upload")).stem[:60] or "upload"
    return ContentFile(out.getvalue(), name=f"{stem}.{ext}")


def build_renditions(field_file, widths=None) -> dict[str, str]:
    """Create WebP copies at each width (never upscaling) and return {width: url}."""
    widths = widths or settings.IMAGE_RENDITION_WIDTHS
    field_file.open("rb")
    try:
        source_bytes = field_file.read()
    finally:
        field_file.close()
    digest = hashlib.sha1(source_bytes).hexdigest()[:16]
    result: dict[str, str] = {}
    with Image.open(BytesIO(source_bytes)) as img:
        img = ImageOps.exif_transpose(img).convert("RGB")
        for width in sorted(widths):
            if width > img.width and result:
                break
            target_w = min(width, img.width)
            ratio = target_w / img.width
            resized = img.resize((target_w, max(1, round(img.height * ratio))), Image.LANCZOS)
            out = BytesIO()
            resized.save(out, "WEBP", quality=80, method=5)
            path = f"renditions/{digest[:2]}/{digest}_{width}.webp"
            if not default_storage.exists(path):
                default_storage.save(path, ContentFile(out.getvalue()))
            result[str(width)] = default_storage.url(path)
    return result
