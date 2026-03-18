"""
workers.py — Alle QThread achtergrond-workers.
"""

import base64
import io
import os
from pathlib import Path

# Max breedte/hoogte voor API-aanroepen (Claude ondersteunt max ~8000px maar kleine
# afbeeldingen zijn sneller en goedkoper; 1568px is Claude's optimale resolutie)
_API_MAX_PX = 1568


def _shrink_for_api(image_bytes: bytes, media_type: str) -> tuple[bytes, str]:
    """Verklein afbeelding naar max _API_MAX_PX aan de langste zijde als hij te groot is."""
    img = Image.open(io.BytesIO(image_bytes))
    if max(img.width, img.height) > _API_MAX_PX:
        img.thumbnail((_API_MAX_PX, _API_MAX_PX), Image.LANCZOS)
        buf = io.BytesIO()
        fmt = "JPEG" if media_type == "image/jpeg" else "PNG"
        img.convert("RGB").save(buf, format=fmt, quality=90)
        return buf.getvalue(), f"image/{fmt.lower()}"
    return image_bytes, media_type

import anthropic
from PyQt6.QtCore import QThread, pyqtSignal
from PIL import Image

from tools import (
    auto_enhance, add_text_watermark, add_logo_watermark,
    resize_for_platform, detect_faces,
    strip_exif, normalize_image_mode, save_image,
)

# Enkel model-ID hier zodat een versie-upgrade één wijziging is
MODEL = "claude-opus-4-6"

# ─────────────────────────────────────────────────────────────
# Gedeelde basisklasse voor alle Claude AI workers
# ─────────────────────────────────────────────────────────────

class _BaseClaudeWorker(QThread):
    """Gemeenschappelijke basis: API-sleutel opslaan en client aanmaken."""

    error_occurred = pyqtSignal(str)
    progress       = pyqtSignal(str)

    def __init__(self, api_key: str):
        super().__init__()
        self.api_key = api_key

    def _make_client(self) -> anthropic.Anthropic:
        return anthropic.Anthropic(api_key=self.api_key)

    def _on_error(self, exc: Exception) -> None:
        self.error_occurred.emit(str(exc))


# ─────────────────────────────────────────────────────────────
# Claude AI – Beschrijving + Hashtags
# ─────────────────────────────────────────────────────────────

class ClaudeWorker(_BaseClaudeWorker):
    """Genereert productbeschrijving en hashtags via Claude Opus 4.6."""

    result_ready = pyqtSignal(str, str)   # caption, hashtags

    def __init__(self, api_key: str, image_bytes: bytes, media_type: str = "image/jpeg"):
        super().__init__(api_key)
        self.image_bytes = image_bytes
        self.media_type  = media_type

    def run(self):
        try:
            self.progress.emit("Verbinding maken met Claude AI…")
            client = self._make_client()

            self.progress.emit("Foto analyseren met Claude Opus 4.6…")
            img_bytes, img_type = _shrink_for_api(self.image_bytes, self.media_type)
            data = base64.standard_b64encode(img_bytes).decode("utf-8")

            response = client.messages.create(
                model=MODEL,
                max_tokens=1200,
                system=(
                    "Je bent een professionele marketing-copywriter gespecialiseerd "
                    "in voetzorg, pedicure en voetaesthetiek. Je schrijft "
                    "productbeschrijvingen en hashtags voor foto's van voeten, "
                    "nagellak, pedicure-resultaten en voetsieraden voor "
                    "e-commerce platforms. Focus op esthetische kenmerken: "
                    "huidverzorging, nagellak, pose, verlichting en sfeer."
                ),
                messages=[{
                    "role": "user",
                    "content": [
                        {"type": "image", "source": {
                            "type": "base64",
                            "media_type": img_type,
                            "data": data,
                        }},
                        {"type": "text", "text": (
                            "Schrijf een productbeschrijving en hashtags voor "
                            "deze foto. Beschrijf de esthetische kenmerken: "
                            "huidtint, nagelverzorging, nagellak kleur/afwerking, "
                            "pose, sieraden, achtergrond en algehele sfeer.\n\n"
                            "Antwoord EXACT in dit formaat:\n"
                            "BESCHRIJVING: [2-3 zinnen beschrijving]\n"
                            "HASHTAGS: [#tag1 #tag2 ... #tag15]"
                        )},
                    ],
                }],
            )
            text = response.content[0].text.strip()
            caption, hashtags = self._parse(text)
            self.result_ready.emit(caption, hashtags)

        except Exception as exc:
            self._on_error(exc)

    def _parse(self, text: str) -> tuple[str, str]:
        if "BESCHRIJVING:" in text and "HASHTAGS:" in text:
            parts    = text.split("HASHTAGS:")
            caption  = parts[0].replace("BESCHRIJVING:", "").strip()
            hashtags = parts[1].strip() if len(parts) > 1 else ""
        else:
            caption, hashtags = text, ""
        return caption, hashtags


# ─────────────────────────────────────────────────────────────
# Claude AI – Titel genereren
# ─────────────────────────────────────────────────────────────

class TitleWorker(_BaseClaudeWorker):
    """Genereert productitels per platform."""

    title_ready = pyqtSignal(str)

    PLATFORM_CONTEXT = {
        "FeetFinder":  "FeetFinder (voet-gerelateerde content platform)",
        "Etsy":        "Etsy (handgemaakte/vintage producten webshop)",
        "OnlyFans":    "OnlyFans (exclusieve content platform)",
        "Instagram":   "Instagram (sociaal media platform)",
        "Algemeen":    "algemene sociale media",
    }

    def __init__(self, api_key: str, image_bytes: bytes,
                 platform: str = "Algemeen", media_type: str = "image/jpeg"):
        super().__init__(api_key)
        self.image_bytes = image_bytes
        self.platform    = platform
        self.media_type  = media_type

    def run(self):
        try:
            self.progress.emit("Titels genereren…")
            client = self._make_client()
            platform_ctx = self.PLATFORM_CONTEXT.get(self.platform, self.platform)
            img_bytes, img_type = _shrink_for_api(self.image_bytes, self.media_type)
            data = base64.standard_b64encode(img_bytes).decode("utf-8")

            response = client.messages.create(
                model=MODEL,
                max_tokens=400,
                system=(
                    "Je bent een professionele marketing-copywriter gespecialiseerd "
                    "in voetzorg, pedicure en voetaesthetiek. Je schrijft "
                    "pakkende producttitels voor e-commerce platforms."
                ),
                messages=[{
                    "role": "user",
                    "content": [
                        {"type": "image", "source": {
                            "type": "base64",
                            "media_type": img_type,
                            "data": data,
                        }},
                        {"type": "text", "text": (
                            f"Genereer 5 producttitels voor deze foto op {platform_ctx}.\n"
                            "Beschrijf de esthetiek: nagellak, verzorging, pose, sfeer.\n"
                            "Eisen: max. 60 tekens per titel, verkoopgericht.\n"
                            "Geef alleen de 5 titels, genummerd 1-5. Geen uitleg."
                        )},
                    ],
                }],
            )
            self.title_ready.emit(response.content[0].text.strip())

        except Exception as exc:
            self._on_error(exc)


# ─────────────────────────────────────────────────────────────
# Claude AI – Sessie-ideeën
# ─────────────────────────────────────────────────────────────

class SessionIdeasWorker(_BaseClaudeWorker):
    """Genereert fotosessie-ideeën op basis van platform en thema."""

    ideas_ready = pyqtSignal(str)

    def __init__(self, api_key: str, platform: str, thema: str, aantal: int = 10):
        super().__init__(api_key)
        self.platform = platform
        self.thema    = thema
        self.aantal   = aantal

    def run(self):
        try:
            self.progress.emit("Sessie-ideeën genereren…")
            client = self._make_client()

            response = client.messages.create(
                model=MODEL,
                max_tokens=800,
                messages=[{
                    "role": "user",
                    "content": (
                        f"Geef {self.aantal} creatieve fotosessie-ideeën voor {self.platform}.\n"
                        f"Thema/stijl voorkeur: {self.thema or 'vrij te kiezen'}.\n\n"
                        "Per idee: een korte naam (vet) + 1-2 zinnen beschrijving.\n"
                        "Focus op wat populair en goed verkoopt op dit platform.\n"
                        "Antwoord in het Nederlands."
                    ),
                }],
            )
            self.ideas_ready.emit(response.content[0].text.strip())

        except Exception as exc:
            self._on_error(exc)


# ─────────────────────────────────────────────────────────────
# Claude AI – Klantreactie templates
# ─────────────────────────────────────────────────────────────

class ReplyTemplateWorker(_BaseClaudeWorker):
    """Genereert kant-en-klare klantreactie-templates."""

    templates_ready = pyqtSignal(str)

    SITUATIES = [
        "Klant vraagt naar prijs",
        "Klant vraagt naar levering/beschikbaarheid",
        "Klant wil aangepaste bestelling (custom request)",
        "Klant geeft compliment / positieve review",
        "Klant klaagt / is ontevreden",
        "Klant vraagt naar korting / bundel deal",
        "Bedankje na aankoop",
        "Klant vraagt om meer foto's van product",
    ]

    def __init__(self, api_key: str, situatie: str, toon: str = "vriendelijk professioneel"):
        super().__init__(api_key)
        self.situatie = situatie
        self.toon     = toon

    def run(self):
        try:
            self.progress.emit("Templates genereren…")
            client = self._make_client()

            response = client.messages.create(
                model=MODEL,
                max_tokens=600,
                messages=[{
                    "role": "user",
                    "content": (
                        f"Schrijf 3 klantreactie-templates voor deze situatie:\n"
                        f"Situatie: {self.situatie}\n"
                        f"Toon: {self.toon}\n\n"
                        "Elk template moet:\n"
                        "- Klaar zijn om direct te gebruiken (vul [naam] etc. in)\n"
                        "- Professioneel maar persoonlijk zijn\n"
                        "- Kort en duidelijk (max. 5 zinnen)\n\n"
                        "Formaat: Template 1:\\n[tekst]\\n\\nTemplate 2:\\n[tekst]\\n\\nTemplate 3:\\n[tekst]\n"
                        "Antwoord in het Nederlands."
                    ),
                }],
            )
            self.templates_ready.emit(response.content[0].text.strip())

        except Exception as exc:
            self._on_error(exc)


# ─────────────────────────────────────────────────────────────
# Batch verwerking worker
# ─────────────────────────────────────────────────────────────

_EXT_MAP = {"JPEG": "jpg", "PNG": "png", "WEBP": "webp"}

class BatchWorker(QThread):
    """Verwerkt een map met foto's in de achtergrond."""

    progress_update = pyqtSignal(int, int, str)   # huidig, totaal, bestandsnaam
    finished        = pyqtSignal(int, int)         # geslaagd, mislukt
    error_occurred  = pyqtSignal(str)

    def __init__(self, files: list[str], settings: dict, output_dir: str):
        super().__init__()
        self.files      = files
        self.settings   = settings
        self.output_dir = output_dir

    def run(self):
        import uuid

        Path(self.output_dir).mkdir(parents=True, exist_ok=True)
        ok = 0
        fail = 0
        s = self.settings

        for i, fpath in enumerate(self.files):
            name = Path(fpath).name
            self.progress_update.emit(i + 1, len(self.files), name)
            try:
                img = Image.open(fpath)
                img = normalize_image_mode(img)

                # EXIF verwijderen
                if s.get("exif_remove"):
                    img = strip_exif(img)

                # Auto verbetering
                if s.get("enhance"):
                    img = auto_enhance(
                        img,
                        brightness = s.get("brightness", 1.0),
                        contrast   = s.get("contrast", 1.0),
                        color      = s.get("color", 1.0),
                        sharpness  = s.get("sharpness", 1.0),
                    )

                # Gezichtsdetectie waarschuwing (log alleen, stop niet)
                if s.get("face_check"):
                    faces = detect_faces(img)
                    if faces:
                        self.error_occurred.emit(
                            f"⚠ Gezicht gedetecteerd in: {name} ({len(faces)} gezicht(en))"
                        )

                # Watermerk
                if s.get("watermark") and s.get("wm_settings"):
                    wm = s["wm_settings"]
                    if wm.get("type") == "text":
                        img = add_text_watermark(img, wm)
                    elif wm.get("type") == "logo":
                        result = add_logo_watermark(img, wm)
                        if result:
                            img = result

                # Platform resize
                if s.get("platform") and s.get("platform") != "Geen aanpassing":
                    img = resize_for_platform(img, s["platform"])

                # Opslaan
                fmt = s.get("format", "JPEG").upper()
                q   = s.get("quality", 90)
                ext = _EXT_MAP.get(fmt, "jpg")

                if s.get("anonymize", True):
                    out_name = f"{s.get('prefix', 'product_')}{uuid.uuid4().hex[:12]}.{ext}"
                else:
                    out_name = f"{s.get('prefix', '')}{Path(fpath).stem}.{ext}"

                out_path = os.path.join(self.output_dir, out_name)
                save_image(img, out_path, fmt, q)
                ok += 1

            except Exception as exc:
                self.error_occurred.emit(f"❌ {name}: {exc}")
                fail += 1

        self.finished.emit(ok, fail)
