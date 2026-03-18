import io
import os
from typing import Tuple, Optional
from PIL import Image, ImageEnhance, ImageDraw, ImageFont, ImageFilter
import numpy as np
import cv2

# Platform presets: width, height, mode
PLATFORM_PRESETS = {
    "FeetFinder": {
        "w": 1080,
        "h": 1080,
        "mode": "cover",
        "description": "Vierkant profiel (1080x1080)"
    },
    "FeetFinder_Banner": {
        "w": 1500,
        "h": 500,
        "mode": "cover",
        "description": "Banner (1500x500)"
    },
    "OnlyFans": {
        "w": 1080,
        "h": 1350,
        "mode": "cover",
        "description": "Portret (1080x1350)"
    },
    "OnlyFans_Cover": {
        "w": 1600,
        "h": 400,
        "mode": "cover",
        "description": "Cover foto (1600x400)"
    },
    "Instagram_Post": {
        "w": 1080,
        "h": 1080,
        "mode": "cover",
        "description": "Instagram post (1080x1080)"
    },
    "Instagram_Story": {
        "w": 1080,
        "h": 1920,
        "mode": "cover",
        "description": "Instagram story (1080x1920)"
    },
    "Twitter": {
        "w": 1200,
        "h": 675,
        "mode": "cover",
        "description": "Twitter/X post (1200x675)"
    },
    "Patreon": {
        "w": 1600,
        "h": 400,
        "mode": "cover",
        "description": "Patreon cover (1600x400)"
    },
    "Fansly": {
        "w": 1080,
        "h": 1080,
        "mode": "cover",
        "description": "Fansly post (1080x1080)"
    },
}


def _load_image(data: bytes) -> Image.Image:
    """Load image from bytes, handling EXIF orientation."""
    img = Image.open(io.BytesIO(data))
    # Auto-rotate based on EXIF
    try:
        from PIL import ImageOps
        img = ImageOps.exif_transpose(img)
    except Exception:
        pass
    if img.mode not in ("RGB", "RGBA"):
        img = img.convert("RGB")
    return img


def _save_image(img: Image.Image, quality: int = 92) -> bytes:
    """Save PIL image to JPEG bytes."""
    if img.mode == "RGBA":
        # Convert RGBA to RGB with white background
        background = Image.new("RGB", img.size, (255, 255, 255))
        background.paste(img, mask=img.split()[3])
        img = background
    buf = io.BytesIO()
    img.save(buf, format="JPEG", quality=quality, optimize=True)
    return buf.getvalue()


def strip_exif(data: bytes) -> bytes:
    """Remove all EXIF metadata from image."""
    img = _load_image(data)
    # Create a clean image without any metadata
    clean = Image.new(img.mode, img.size)
    clean.putdata(list(img.getdata()))
    return _save_image(clean)


def auto_enhance(
    data: bytes,
    brightness: float = 1.0,
    contrast: float = 1.0,
    color: float = 1.0,
    sharpness: float = 1.0,
) -> bytes:
    """Apply brightness/contrast/color/sharpness enhancements."""
    img = _load_image(data)

    if brightness != 1.0:
        img = ImageEnhance.Brightness(img).enhance(brightness)
    if contrast != 1.0:
        img = ImageEnhance.Contrast(img).enhance(contrast)
    if color != 1.0:
        img = ImageEnhance.Color(img).enhance(color)
    if sharpness != 1.0:
        img = ImageEnhance.Sharpness(img).enhance(sharpness)

    return _save_image(img)


def add_text_watermark(
    data: bytes,
    text: str = "© FeetBusiness",
    position: str = "bottom-right",
    opacity: int = 180,
    font_size: int = 36,
    color: str = "#ffffff",
) -> bytes:
    """Add a text watermark to the image."""
    img = _load_image(data).convert("RGBA")
    overlay = Image.new("RGBA", img.size, (0, 0, 0, 0))
    draw = ImageDraw.Draw(overlay)

    # Parse color
    try:
        r = int(color[1:3], 16)
        g = int(color[3:5], 16)
        b = int(color[5:7], 16)
    except Exception:
        r, g, b = 255, 255, 255

    # Try to load a font, fall back to default
    font = None
    font_paths = [
        "/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf",
        "/usr/share/fonts/truetype/liberation/LiberationSans-Bold.ttf",
        "/System/Library/Fonts/Helvetica.ttc",
        "C:/Windows/Fonts/arial.ttf",
    ]
    for fp in font_paths:
        if os.path.exists(fp):
            try:
                font = ImageFont.truetype(fp, font_size)
                break
            except Exception:
                continue

    if font is None:
        font = ImageFont.load_default()

    # Get text bounding box
    bbox = draw.textbbox((0, 0), text, font=font)
    text_w = bbox[2] - bbox[0]
    text_h = bbox[3] - bbox[1]

    padding = 20
    w, h = img.size

    position_map = {
        "top-left": (padding, padding),
        "top-right": (w - text_w - padding, padding),
        "bottom-left": (padding, h - text_h - padding),
        "bottom-right": (w - text_w - padding, h - text_h - padding),
        "center": ((w - text_w) // 2, (h - text_h) // 2),
    }

    x, y = position_map.get(position, (w - text_w - padding, h - text_h - padding))

    # Draw shadow for readability
    shadow_color = (0, 0, 0, opacity)
    draw.text((x + 2, y + 2), text, font=font, fill=shadow_color)
    draw.text((x, y), text, font=font, fill=(r, g, b, opacity))

    combined = Image.alpha_composite(img, overlay)
    return _save_image(combined.convert("RGB"))


def add_logo_watermark(
    data: bytes,
    logo_data: bytes,
    position: str = "bottom-right",
    opacity: int = 180,
    scale: float = 0.15,
) -> bytes:
    """Add a logo watermark to the image."""
    img = _load_image(data).convert("RGBA")
    logo = Image.open(io.BytesIO(logo_data)).convert("RGBA")

    # Scale logo
    logo_w = int(img.width * scale)
    logo_h = int(logo.height * (logo_w / logo.width))
    logo = logo.resize((logo_w, logo_h), Image.LANCZOS)

    # Apply opacity
    r, g, b, a = logo.split()
    a = a.point(lambda x: int(x * opacity / 255))
    logo.putalpha(a)

    padding = 20
    w, h = img.size

    position_map = {
        "top-left": (padding, padding),
        "top-right": (w - logo_w - padding, padding),
        "bottom-left": (padding, h - logo_h - padding),
        "bottom-right": (w - logo_w - padding, h - logo_h - padding),
        "center": ((w - logo_w) // 2, (h - logo_h) // 2),
    }

    x, y = position_map.get(position, (w - logo_w - padding, h - logo_h - padding))

    overlay = Image.new("RGBA", img.size, (0, 0, 0, 0))
    overlay.paste(logo, (x, y), logo)
    combined = Image.alpha_composite(img, overlay)
    return _save_image(combined.convert("RGB"))


def blur_area(
    data: bytes,
    x: int = 0,
    y: int = 0,
    width: int = 100,
    height: int = 100,
    strength: int = 15,
) -> bytes:
    """Apply blur to a specific rectangular area."""
    img = _load_image(data)
    w, h = img.size

    # Clamp values to image bounds
    x = max(0, min(x, w))
    y = max(0, min(y, h))
    x2 = max(0, min(x + width, w))
    y2 = max(0, min(y + height, h))

    if x2 <= x or y2 <= y:
        return _save_image(img)

    region = img.crop((x, y, x2, y2))
    # Apply Gaussian blur using strength as radius
    blur_radius = max(1, strength)
    blurred = region.filter(ImageFilter.GaussianBlur(radius=blur_radius))
    img.paste(blurred, (x, y))
    return _save_image(img)


def resize_for_platform(
    data: bytes,
    target_w: int,
    target_h: int,
    mode: str = "cover",
) -> bytes:
    """
    Resize image for a specific platform.
    mode='cover': crop to fill (like CSS background-size: cover)
    mode='contain': fit inside with letterbox
    mode='stretch': force exact dimensions
    """
    img = _load_image(data)
    orig_w, orig_h = img.size

    if mode == "stretch":
        img = img.resize((target_w, target_h), Image.LANCZOS)

    elif mode == "contain":
        ratio = min(target_w / orig_w, target_h / orig_h)
        new_w = int(orig_w * ratio)
        new_h = int(orig_h * ratio)
        img = img.resize((new_w, new_h), Image.LANCZOS)
        # Paste onto background
        bg = Image.new("RGB", (target_w, target_h), (0, 0, 0))
        x_off = (target_w - new_w) // 2
        y_off = (target_h - new_h) // 2
        bg.paste(img, (x_off, y_off))
        img = bg

    else:  # cover (default)
        ratio = max(target_w / orig_w, target_h / orig_h)
        new_w = int(orig_w * ratio)
        new_h = int(orig_h * ratio)
        img = img.resize((new_w, new_h), Image.LANCZOS)
        # Center crop
        x_off = (new_w - target_w) // 2
        y_off = (new_h - target_h) // 2
        img = img.crop((x_off, y_off, x_off + target_w, y_off + target_h))

    return _save_image(img)


def detect_faces(data: bytes) -> list:
    """
    Detect faces in image using OpenCV Haar cascades.
    Returns list of dicts: [{x, y, width, height, confidence}]
    """
    nparr = np.frombuffer(data, np.uint8)
    img_cv = cv2.imdecode(nparr, cv2.IMREAD_COLOR)
    if img_cv is None:
        return []

    gray = cv2.cvtColor(img_cv, cv2.COLOR_BGR2GRAY)

    cascade_path = cv2.data.haarcascades + "haarcascade_frontalface_default.xml"
    face_cascade = cv2.CascadeClassifier(cascade_path)

    faces = face_cascade.detectMultiScale(
        gray,
        scaleFactor=1.1,
        minNeighbors=5,
        minSize=(30, 30),
    )

    result = []
    for x, y, w, h in faces:
        result.append({
            "x": int(x),
            "y": int(y),
            "width": int(w),
            "height": int(h),
        })

    return result


def crop_image(
    data: bytes,
    top: int = 0,
    right: int = 0,
    bottom: int = 0,
    left: int = 0,
) -> bytes:
    """Crop image by removing pixels from each edge."""
    img = _load_image(data)
    w, h = img.size

    x1 = max(0, left)
    y1 = max(0, top)
    x2 = max(x1 + 1, w - right)
    y2 = max(y1 + 1, h - bottom)

    img = img.crop((x1, y1, x2, y2))
    return _save_image(img)
