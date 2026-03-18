import asyncio
import base64
import json
import re
from typing import List, Dict, Any
import anthropic


MODEL = "claude-opus-4-6"


def _get_client(api_key: str) -> anthropic.Anthropic:
    return anthropic.Anthropic(api_key=api_key)


def _image_to_base64(data: bytes) -> str:
    return base64.standard_b64encode(data).decode("utf-8")


async def analyze_photo(image_data: bytes, api_key: str) -> Dict[str, Any]:
    """
    Analyze a photo and return description + hashtags in Dutch.
    Returns: {description: str, hashtags: list[str], mood: str, tips: list[str]}
    """
    client = _get_client(api_key)
    b64 = _image_to_base64(image_data)

    prompt = """Analyseer deze foto professioneel voor gebruik op platforms zoals FeetFinder, OnlyFans of Fansly.

Geef je antwoord UITSLUITEND als geldig JSON in dit exacte formaat:
{
  "beschrijving": "Een professionele beschrijving van de foto in het Nederlands (2-3 zinnen)",
  "hashtags": ["#hashtag1", "#hashtag2", "#hashtag3", "#hashtag4", "#hashtag5", "#hashtag6", "#hashtag7", "#hashtag8", "#hashtag9", "#hashtag10"],
  "stemming": "De algemene stemming/sfeer van de foto (bijv: sensueel, elegant, speels, romantisch)",
  "tips": [
    "Tip 1 voor betere presentatie",
    "Tip 2 voor betere marketing",
    "Tip 3 voor hogere omzet"
  ]
}

Gebruik Nederlandse hashtags die relevant zijn voor de foto. Wees professioneel maar ook commercieel gericht."""

    def _call():
        return client.messages.create(
            model=MODEL,
            max_tokens=1024,
            messages=[
                {
                    "role": "user",
                    "content": [
                        {
                            "type": "image",
                            "source": {
                                "type": "base64",
                                "media_type": "image/jpeg",
                                "data": b64,
                            },
                        },
                        {
                            "type": "text",
                            "text": prompt,
                        },
                    ],
                }
            ],
        )

    try:
        response = await asyncio.to_thread(_call)
        text = response.content[0].text.strip()
        json_match = re.search(r'\{.*\}', text, re.DOTALL)
        if json_match:
            return json.loads(json_match.group())
        return {"beschrijving": text, "hashtags": [], "stemming": "", "tips": []}

    except Exception as e:
        raise Exception(f"AI analyse mislukt: {str(e)}")


async def generate_titles(image_data: bytes, api_key: str) -> List[str]:
    """
    Generate 5 platform-specific titles in Dutch for the photo.
    Returns list of 5 title strings.
    """
    client = _get_client(api_key)
    b64 = _image_to_base64(image_data)

    prompt = """Bekijk deze foto en genereer 5 pakkende titels voor gebruik op platforms zoals FeetFinder, OnlyFans en Fansly.

Geef UITSLUITEND een JSON array terug:
["Titel 1", "Titel 2", "Titel 3", "Titel 4", "Titel 5"]

Regels:
- Titels in het Nederlands
- Prikkelend maar niet te expliciet
- Geschikt voor volwassen content platforms
- Maximaal 60 tekens per titel
- Mix van speels, elegant en verleidelijk
- Gebruik emoji's waar passend"""

    def _call():
        return client.messages.create(
            model=MODEL,
            max_tokens=512,
            messages=[
                {
                    "role": "user",
                    "content": [
                        {
                            "type": "image",
                            "source": {
                                "type": "base64",
                                "media_type": "image/jpeg",
                                "data": b64,
                            },
                        },
                        {
                            "type": "text",
                            "text": prompt,
                        },
                    ],
                }
            ],
        )

    try:
        response = await asyncio.to_thread(_call)
        text = response.content[0].text.strip()
        json_match = re.search(r'\[.*\]', text, re.DOTALL)
        if json_match:
            titles = json.loads(json_match.group())
            return titles[:5] if len(titles) >= 5 else titles
        lines = [l.strip().strip('"').strip("'").strip('-').strip() for l in text.split('\n') if l.strip()]
        return [l for l in lines if l][:5]

    except Exception as e:
        raise Exception(f"Titels genereren mislukt: {str(e)}")


async def generate_session_ideas(
    platform: str = "FeetFinder",
    theme: str = "elegant",
    api_key: str = "",
) -> List[Dict[str, str]]:
    """
    Generate 10 creative photo session ideas in Dutch.
    Returns list of {title, beschrijving, props, locatie} dicts.
    """
    client = _get_client(api_key)

    prompt = f"""Genereer 10 creatieve fotosessie-ideeën voor een {platform} creator met thema "{theme}".

Geef je antwoord UITSLUITEND als geldig JSON array:
[
  {{
    "titel": "Naam van het concept",
    "beschrijving": "Korte beschrijving wat de sessie inhoudt (1-2 zinnen)",
    "props": "Benodigde attributen/accessoires",
    "locatie": "Aanbevolen locatie of achtergrond",
    "tip": "Marketing tip voor dit concept"
  }}
]

Geef precies 10 ideeën. Alles in het Nederlands. Wees creatief en commercieel gericht.
Houd het professioneel maar verleidelijk passend bij het platform."""

    def _call():
        return client.messages.create(
            model=MODEL,
            max_tokens=2048,
            messages=[{"role": "user", "content": prompt}],
        )

    try:
        response = await asyncio.to_thread(_call)
        text = response.content[0].text.strip()
        json_match = re.search(r'\[.*\]', text, re.DOTALL)
        if json_match:
            ideas = json.loads(json_match.group())
            return ideas[:10]
        return [{"titel": "Idee kon niet worden gegenereerd", "beschrijving": text, "props": "", "locatie": "", "tip": ""}]

    except Exception as e:
        raise Exception(f"Sessie-ideeën genereren mislukt: {str(e)}")


async def generate_reply_templates(
    scenario: str = "Prijsvraag",
    api_key: str = "",
) -> List[Dict[str, str]]:
    """
    Generate 3 reply templates in Dutch for a given scenario.
    Returns list of {naam, bericht, toon} dicts.
    """
    client = _get_client(api_key)

    scenario_context = {
        "Prijsvraag": "een klant vraagt naar de prijs van content of een custom video",
        "Custom verzoek": "een klant vraagt om aangepaste/persoonlijke content",
        "Abonnement vragen": "een klant vraagt hoe ze zich kunnen abonneren",
        "Afwijzing": "je wil een verzoek beleefd weigeren dat niet bij jouw grenzen past",
        "Dankwoord": "je wil een klant bedanken voor hun aankoop of steun",
        "Onbeleefde klant": "een klant gedraagt zich ongepast of onbeleefd",
        "Korting vragen": "een klant vraagt om korting",
        "Tip ontvangen": "je hebt een fooi ontvangen en wil bedanken",
    }

    context = scenario_context.get(scenario, f"scenario: {scenario}")

    prompt = f"""Genereer 3 antwoordsjablonen in het Nederlands voor wanneer {context}.

Geef UITSLUITEND een JSON array:
[
  {{
    "naam": "Korte naam voor dit sjabloon (bijv: Professioneel, Vriendelijk, Direct)",
    "bericht": "Het volledige antwoordbericht dat je kunt kopiëren en sturen",
    "toon": "De toon van het bericht (bijv: formeel, informeel, assertief)"
  }}
]

Regels:
- Alles in het Nederlands
- Professioneel maar persoonlijk
- Klaar om te gebruiken, zonder [invulvelden] waar mogelijk
- Passend voor volwassen content creators
- Maximaal 200 woorden per bericht"""

    def _call():
        return client.messages.create(
            model=MODEL,
            max_tokens=1024,
            messages=[{"role": "user", "content": prompt}],
        )

    try:
        response = await asyncio.to_thread(_call)
        text = response.content[0].text.strip()
        json_match = re.search(r'\[.*\]', text, re.DOTALL)
        if json_match:
            templates = json.loads(json_match.group())
            return templates[:3]
        return [{"naam": "Gegenereerd sjabloon", "bericht": text, "toon": "neutraal"}]

    except Exception as e:
        raise Exception(f"Antwoordsjablonen genereren mislukt: {str(e)}")
