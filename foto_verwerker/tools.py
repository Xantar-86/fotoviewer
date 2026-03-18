"""
tools.py — Beeldverwerking, presets, backup en hulpfuncties.
Geen Qt-imports. Pure logica.
"""

import os
import sys
import json
import zipfile
import io
from pathlib import Path
from datetime import datetime
from typing import Optional

from PIL import Image, ImageEnhance, ImageDraw, ImageFont
import cv2
import numpy as np

# ─────────────────────────────────────────────────────────────
# Datamappen
# ─────────────────────────────────────────────────────────────

DATA_DIR = Path.home() / "feetbusiness_data"
DATA_DIR.mkdir(exist_ok=True)

PRESETS_DIR = DATA_DIR / "presets"
PRESETS_DIR.mkdir(exist_ok=True)

BACKUP_KEY_FILE = DATA_DIR / ".backup_key"

# ─────────────────────────────────────────────────────────────
# Platform afmetingen
# ─────────────────────────────────────────────────────────────

PLATFORM_PRESETS: dict[str, dict] = {
    "Geen aanpassing":           {"w": 0,    "h": 0,    "mode": "none"},
    "FeetFinder (1500×1500)":    {"w": 1500, "h": 1500, "mode": "fill"},
    "Etsy (2000×1500)":          {"w": 2000, "h": 1500, "mode": "fit"},
    "Etsy (vierkant 2000×2000)": {"w": 2000, "h": 2000, "mode": "fill"},
    "OnlyFans portret (1080×1350)": {"w": 1080, "h": 1350, "mode": "fit"},
    "OnlyFans liggend (1920×1080)": {"w": 1920, "h": 1080, "mode": "fit"},
    "Instagram vierkant (1080×1080)": {"w": 1080, "h": 1080, "mode": "fill"},
    "Instagram story (1080×1920)": {"w": 1080, "h": 1920, "mode": "fit"},
    "Twitter/X (1280×720)":      {"w": 1280, "h": 720,  "mode": "fit"},
}

PLATFORM_NAMES = list(PLATFORM_PRESETS.keys())

# ─────────────────────────────────────────────────────────────
# Watermerk helpers
# ─────────────────────────────────────────────────────────────

POSITION_MAP = {
    "bottom-right": lambda iw, ih, tw, th, p: (iw - tw - p, ih - th - p),
    "top-left":     lambda iw, ih, tw, th, p: (p, p),
    "top-right":    lambda iw, ih, tw, th, p: (iw - tw - p, p),
    "bottom-left":  lambda iw, ih, tw, th, p: (p, ih - th - p),
    "center":       lambda iw, ih, tw, th, p: ((iw - tw) // 2, (ih - th) // 2),
    "top-center":   lambda iw, ih, tw, th, p: ((iw - tw) // 2, p),
    "bottom-center":lambda iw, ih, tw, th, p: ((iw - tw) // 2, ih - th - p),
}
# Geordende sleutels — zelfde volgorde als de positie-combobox in de UI
POSITION_KEYS: list[str] = list(POSITION_MAP.keys())

# Module-niveau caches (eenmalig laden)
_wm_font_cache: dict[tuple, ImageFont.FreeTypeFont] = {}
_face_cascade: cv2.CascadeClassifier | None = None


def _load_font(fsize: int) -> ImageFont.FreeTypeFont:
    """Laad een font voor watermerktekst; resultaat wordt gecached per grootte."""
    if fsize not in _wm_font_cache:
        font = None
        for fn in ["arial.ttf", "Arial.ttf", "DejaVuSans.ttf", "FreeSans.ttf"]:
            try:
                font = ImageFont.truetype(fn, fsize)
                break
            except Exception:
                continue
        _wm_font_cache[fsize] = font if font is not None else ImageFont.load_default()
    return _wm_font_cache[fsize]


def add_text_watermark(img: Image.Image, settings: dict) -> Image.Image:
    text     = settings.get("text", "Watermerk")
    fsize    = settings.get("font_size", 40)
    opacity  = settings.get("opacity", 180)
    pos_key  = settings.get("position", "bottom-right")
    color    = tuple(settings.get("color", (255, 255, 255)))
    padding  = 20

    overlay = Image.new("RGBA", img.size, (0, 0, 0, 0))
    draw    = ImageDraw.Draw(overlay)
    font    = _load_font(fsize)

    bbox = draw.textbbox((0, 0), text, font=font)
    tw, th = bbox[2] - bbox[0], bbox[3] - bbox[1]
    iw, ih = img.size

    pos_fn = POSITION_MAP.get(pos_key, POSITION_MAP["bottom-right"])
    x, y = pos_fn(iw, ih, tw, th, padding)
    draw.text((x, y), text, font=font, fill=(*color, opacity))

    base = img.convert("RGBA")
    merged = Image.alpha_composite(base, overlay)
    return merged.convert(img.mode) if img.mode != "RGBA" else merged


def add_logo_watermark(img: Image.Image, settings: dict) -> Optional[Image.Image]:
    logo_path = settings.get("logo_path", "")
    if not logo_path or not os.path.isfile(logo_path):
        return None

    logo      = Image.open(logo_path).convert("RGBA")
    size_pct  = settings.get("logo_size", 15)
    opacity   = settings.get("opacity", 180)
    pos_key   = settings.get("position", "bottom-right")
    padding   = 20
    iw, ih    = img.size

    lw = max(10, int(iw * size_pct / 100))
    lh = int(logo.height * lw / logo.width)
    logo = logo.resize((lw, lh), Image.LANCZOS)

    r, g, b, a = logo.split()
    a = a.point(lambda v: int(v * opacity / 255))
    logo.putalpha(a)

    pos_fn = POSITION_MAP.get(pos_key, POSITION_MAP["bottom-right"])
    x, y = pos_fn(iw, ih, lw, lh, padding)

    base = img.convert("RGBA")
    base.paste(logo, (x, y), logo)
    return base.convert(img.mode) if img.mode != "RGBA" else base

# ─────────────────────────────────────────────────────────────
# Auto-verbetering
# ─────────────────────────────────────────────────────────────

def auto_enhance(img: Image.Image,
                 brightness: float = 1.0,
                 contrast: float = 1.0,
                 color: float = 1.0,
                 sharpness: float = 1.0) -> Image.Image:
    """Pas helderheid, contrast, kleurverzadiging en scherpte aan."""
    if brightness != 1.0:
        img = ImageEnhance.Brightness(img).enhance(brightness)
    if contrast != 1.0:
        img = ImageEnhance.Contrast(img).enhance(contrast)
    if color != 1.0:
        img = ImageEnhance.Color(img).enhance(color)
    if sharpness != 1.0:
        img = ImageEnhance.Sharpness(img).enhance(sharpness)
    return img


def strip_exif(img: Image.Image) -> Image.Image:
    """Verwijder EXIF metadata door pixels te kopiëren naar een nieuw image."""
    buf = io.BytesIO()
    fmt = img.format or "JPEG"
    # Sla op zonder EXIF en laad opnieuw — sneller dan putdata() voor grote afbeeldingen
    save_kw: dict = {"exif": b""} if fmt == "JPEG" else {}
    try:
        img.save(buf, format=fmt, **save_kw)
        buf.seek(0)
        return Image.open(buf).copy()
    except Exception:
        # Fallback: pixel-kopie
        clean = Image.new(img.mode, img.size)
        clean.putdata(list(img.getdata()))
        return clean


def normalize_image_mode(img: Image.Image) -> Image.Image:
    """Zorg dat het image een bruikbare modus heeft (RGB, RGBA of L)."""
    if img.mode == "P":
        return img.convert("RGBA")
    if img.mode not in ("RGB", "RGBA", "L"):
        return img.convert("RGB")
    return img


def save_image(img: Image.Image, path: str, fmt: str, quality: int) -> None:
    """Sla een afbeelding op in het opgegeven formaat met correcte opties."""
    fmt = fmt.upper()
    if img.mode == "RGBA" and fmt == "JPEG":
        img = img.convert("RGB")
    elif img.mode not in ("RGB", "RGBA", "L"):
        img = img.convert("RGB")
    kw: dict = {}
    if fmt == "JPEG":
        kw = {"quality": quality, "optimize": True}
    elif fmt == "WEBP":
        kw = {"quality": quality}
    img.save(path, format=fmt, **kw)


# ─────────────────────────────────────────────────────────────
# Gezichtsdetectie
# ─────────────────────────────────────────────────────────────

def _get_face_cascade() -> cv2.CascadeClassifier | None:
    """Laad de Haar cascade eenmalig en cache het resultaat."""
    global _face_cascade
    if _face_cascade is not None:
        return _face_cascade
    if getattr(sys, "frozen", False):
        base = getattr(sys, "_MEIPASS", os.path.dirname(sys.executable))
        cascade_path = os.path.join(base, "cv2", "data", "haarcascade_frontalface_default.xml")
    else:
        cascade_path = cv2.data.haarcascades + "haarcascade_frontalface_default.xml"
    if not os.path.isfile(cascade_path):
        return None
    _face_cascade = cv2.CascadeClassifier(cascade_path)
    return _face_cascade


def detect_faces(img: Image.Image) -> list[tuple[int, int, int, int]]:
    """
    Detecteer gezichten met OpenCV Haar cascade.
    Retourneert lijst van (x, y, w, h) rechthoeken.
    """
    cascade = _get_face_cascade()
    if cascade is None:
        return []
    arr  = np.array(img.convert("RGB"))
    gray = cv2.cvtColor(arr, cv2.COLOR_RGB2GRAY)
    faces = cascade.detectMultiScale(gray, scaleFactor=1.1, minNeighbors=5, minSize=(40, 40))
    if len(faces) == 0:
        return []
    return [(int(x), int(y), int(w), int(h)) for x, y, w, h in faces]

# ─────────────────────────────────────────────────────────────
# Platform resize
# ─────────────────────────────────────────────────────────────

def resize_for_platform(img: Image.Image, platform: str) -> Image.Image:
    """Schaal afbeelding naar aanbevolen afmetingen voor het platform."""
    spec = PLATFORM_PRESETS.get(platform)
    if spec is None or spec["mode"] == "none" or spec["w"] == 0:
        return img

    tw, th = spec["w"], spec["h"]
    mode   = spec["mode"]

    if mode == "fit":
        # Bewaar beeldverhouding, voeg witte randen toe indien nodig
        img_copy = img.copy()
        img_copy.thumbnail((tw, th), Image.LANCZOS)
        bg = Image.new("RGB", (tw, th), (255, 255, 255))
        ox = (tw - img_copy.width) // 2
        oy = (th - img_copy.height) // 2
        paste_img = img_copy.convert("RGB") if img_copy.mode == "RGBA" else img_copy
        bg.paste(paste_img, (ox, oy))
        return bg

    else:  # fill — schaal en centreer-crop
        ratio = max(tw / img.width, th / img.height)
        nw = int(img.width * ratio)
        nh = int(img.height * ratio)
        img = img.resize((nw, nh), Image.LANCZOS)
        ox = (nw - tw) // 2
        oy = (nh - th) // 2
        return img.crop((ox, oy, ox + tw, oy + th))

# ─────────────────────────────────────────────────────────────
# Preset Manager
# ─────────────────────────────────────────────────────────────

class PresetManager:
    """Beheert verwerkings-presets als JSON-bestanden."""

    # PRESETS_DIR is al aangemaakt bij module-import; __init__ doet niets extra.

    @staticmethod
    def _safe_name(name: str) -> str:
        return "".join(c if c.isalnum() or c in " _-" else "_" for c in name)

    def list_presets(self) -> list[str]:
        return sorted(p.stem for p in PRESETS_DIR.glob("*.json"))

    def save_preset(self, name: str, settings: dict) -> None:
        path = PRESETS_DIR / f"{self._safe_name(name)}.json"
        settings["_name"] = name
        settings["_saved"] = datetime.now().isoformat()[:19]
        path.write_text(json.dumps(settings, indent=2, ensure_ascii=False), encoding="utf-8")

    def load_preset(self, name: str) -> dict:
        path = PRESETS_DIR / f"{self._safe_name(name)}.json"
        if not path.exists():
            raise FileNotFoundError(f"Preset '{name}' niet gevonden")
        return json.loads(path.read_text(encoding="utf-8"))

    def delete_preset(self, name: str) -> None:
        path = PRESETS_DIR / f"{self._safe_name(name)}.json"
        if path.exists():
            path.unlink()

# ─────────────────────────────────────────────────────────────
# Backup Manager (Fernet encryptie)
# ─────────────────────────────────────────────────────────────

class BackupManager:
    """Maakt versleutelde backups van de data-map."""

    def _get_key(self) -> bytes:
        try:
            from cryptography.fernet import Fernet
        except ImportError:
            raise ImportError("Installeer 'cryptography': pip install cryptography")

        if BACKUP_KEY_FILE.exists():
            return BACKUP_KEY_FILE.read_bytes()
        key = Fernet.generate_key()
        BACKUP_KEY_FILE.write_bytes(key)
        return key

    def create_backup(self, output_path: str) -> None:
        """Maak een versleuteld ZIP-archief van ~/feetbusiness_data/."""
        from cryptography.fernet import Fernet

        f = Fernet(self._get_key())

        zip_buf = io.BytesIO()
        with zipfile.ZipFile(zip_buf, "w", zipfile.ZIP_DEFLATED) as zf:
            for item in DATA_DIR.rglob("*"):
                if item.is_file() and item != BACKUP_KEY_FILE:
                    zf.write(item, item.relative_to(DATA_DIR))

        encrypted = f.encrypt(zip_buf.getvalue())
        Path(output_path).write_bytes(encrypted)

    def restore_backup(self, backup_path: str, restore_dir: str) -> None:
        """Herstel een versleuteld backup-bestand."""
        from cryptography.fernet import Fernet

        f       = Fernet(self._get_key())
        enc     = Path(backup_path).read_bytes()
        decrypted = f.decrypt(enc)

        Path(restore_dir).mkdir(parents=True, exist_ok=True)
        with zipfile.ZipFile(io.BytesIO(decrypted)) as zf:
            zf.extractall(restore_dir)

# ─────────────────────────────────────────────────────────────
# Prijscalculator
# ─────────────────────────────────────────────────────────────

def calculate_bundle_price(base_price: float,
                            quantity: int,
                            discount_pct: float) -> tuple[float, float]:
    """
    Retourneert (totaal_zonder_korting, totaal_met_korting).
    """
    total = base_price * quantity
    discounted = total * (1 - discount_pct / 100)
    return round(total, 2), round(discounted, 2)
