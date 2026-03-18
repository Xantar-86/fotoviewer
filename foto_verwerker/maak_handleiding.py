"""
maak_handleiding.py -- Genereert een Nederlandstalige PDF-handleiding
voor FotoVerwerker v2.

Gebruik:
    python -m pip install fpdf2
    python maak_handleiding.py
"""

from fpdf import FPDF, XPos, YPos
from pathlib import Path


# -------------------------------------------------------------
# Kleur- en stijlinstellingen
# -------------------------------------------------------------

DONKER  = (30,  30,  40)
PRIMAIR = (52, 152, 219)
ACCENT  = (46, 204, 113)
GRIJS   = (100, 100, 110)
LICHT   = (245, 245, 250)
WIT     = (255, 255, 255)
ROOD    = (231,  76,  60)
ORANJE  = (230, 126,  34)


class Handleiding(FPDF):

    def header(self):
        if self.page_no() == 1:
            return
        self.set_fill_color(*DONKER)
        self.rect(0, 0, 210, 12, "F")
        self.set_text_color(*WIT)
        self.set_font("Helvetica", "B", 8)
        self.set_xy(10, 3)
        self.cell(0, 6, "FotoVerwerker v2 -- Handleiding", new_x=XPos.LMARGIN, new_y=YPos.NEXT)
        self.set_text_color(*DONKER)
        self.ln(4)

    def footer(self):
        if self.page_no() == 1:
            return
        self.set_y(-13)
        self.set_fill_color(*LICHT)
        self.rect(0, self.get_y(), 210, 13, "F")
        self.set_text_color(*GRIJS)
        self.set_font("Helvetica", "", 8)
        self.cell(0, 10, f"Pagina {self.page_no()}", align="C",
                  new_x=XPos.LMARGIN, new_y=YPos.NEXT)
        self.set_text_color(*DONKER)

    # ---- Hulpmethodes ----

    def sectie_titel(self, nummer, titel):
        self.set_fill_color(*PRIMAIR)
        self.rect(0, self.get_y(), 210, 10, "F")
        self.set_text_color(*WIT)
        self.set_font("Helvetica", "B", 13)
        self.set_x(10)
        if nummer:
            self.cell(0, 10, f"{nummer}. {titel}", new_x=XPos.LMARGIN, new_y=YPos.NEXT)
        else:
            self.cell(0, 10, titel, new_x=XPos.LMARGIN, new_y=YPos.NEXT)
        self.set_text_color(*DONKER)
        self.ln(3)

    def sub_titel(self, tekst):
        self.set_font("Helvetica", "B", 11)
        self.set_text_color(*PRIMAIR)
        self.cell(0, 7, tekst, new_x=XPos.LMARGIN, new_y=YPos.NEXT)
        self.set_text_color(*DONKER)
        self.ln(1)

    def tekst(self, inhoud):
        self.set_font("Helvetica", "", 10)
        self.multi_cell(0, 5.5, inhoud, new_x=XPos.LMARGIN, new_y=YPos.NEXT)
        self.ln(1)

    def tip(self, inhoud):
        self.set_fill_color(235, 245, 235)
        self.set_font("Helvetica", "B", 9)
        self.set_text_color(*ACCENT)
        self.set_x(10)
        self.cell(8, 6, "TIP", fill=True, new_x=XPos.RIGHT, new_y=YPos.TOP)
        self.set_font("Helvetica", "", 9)
        self.set_text_color(*DONKER)
        self.multi_cell(0, 6, "  " + inhoud, fill=True,
                        new_x=XPos.LMARGIN, new_y=YPos.NEXT)
        self.ln(1)

    def waarschuwing(self, inhoud):
        self.set_fill_color(255, 243, 230)
        self.set_font("Helvetica", "B", 9)
        self.set_text_color(*ORANJE)
        self.set_x(10)
        self.cell(16, 6, "LET OP", fill=True, new_x=XPos.RIGHT, new_y=YPos.TOP)
        self.set_font("Helvetica", "", 9)
        self.set_text_color(*DONKER)
        self.multi_cell(0, 6, "  " + inhoud, fill=True,
                        new_x=XPos.LMARGIN, new_y=YPos.NEXT)
        self.ln(1)

    def stap(self, nummer, tekst_inhoud):
        self.set_fill_color(*PRIMAIR)
        self.set_text_color(*WIT)
        self.set_font("Helvetica", "B", 9)
        self.set_x(10)
        self.cell(7, 6, str(nummer), fill=True, align="C",
                  new_x=XPos.RIGHT, new_y=YPos.TOP)
        self.set_text_color(*DONKER)
        self.set_font("Helvetica", "", 9)
        self.multi_cell(0, 6, f"  {tekst_inhoud}",
                        new_x=XPos.LMARGIN, new_y=YPos.NEXT)

    def punt(self, tekst_inhoud):
        self.set_font("Helvetica", "", 10)
        self.set_x(12)
        self.multi_cell(0, 5.5, f"- {tekst_inhoud}",
                        new_x=XPos.LMARGIN, new_y=YPos.NEXT)

    def tabel_rij(self, kolom1, kolom2, header=False):
        if header:
            self.set_fill_color(*PRIMAIR)
            self.set_text_color(*WIT)
            self.set_font("Helvetica", "B", 9)
        else:
            self.set_fill_color(*LICHT)
            self.set_text_color(*DONKER)
            self.set_font("Helvetica", "", 9)
        self.cell(70, 6, kolom1, fill=True, border=1, new_x=XPos.RIGHT, new_y=YPos.TOP)
        self.cell(0, 6, kolom2, fill=True, border=1, new_x=XPos.LMARGIN, new_y=YPos.NEXT)
        self.set_text_color(*DONKER)


# -------------------------------------------------------------
# Pagina-functies
# -------------------------------------------------------------

def pagina_voorblad(pdf: Handleiding):
    pdf.add_page()
    pdf.set_fill_color(*DONKER)
    pdf.rect(0, 0, 210, 297, "F")

    pdf.set_fill_color(*PRIMAIR)
    pdf.rect(0, 60, 210, 50, "F")
    pdf.set_text_color(*WIT)
    pdf.set_font("Helvetica", "B", 32)
    pdf.set_xy(0, 68)
    pdf.cell(210, 14, "FotoVerwerker", align="C", new_x=XPos.LMARGIN, new_y=YPos.NEXT)
    pdf.set_font("Helvetica", "", 16)
    pdf.cell(210, 10, "Productfoto verwerking voor content creators", align="C",
             new_x=XPos.LMARGIN, new_y=YPos.NEXT)

    pdf.set_font("Helvetica", "B", 12)
    pdf.set_text_color(*ACCENT)
    pdf.set_xy(0, 120)
    pdf.cell(210, 8, "Complete Gebruikshandleiding  v2.0", align="C",
             new_x=XPos.LMARGIN, new_y=YPos.NEXT)

    functies = [
        "EXIF verwijderen  |  Blur & Crop",
        "Watermerk  |  Auto verbetering",
        "Batch verwerking  |  Presets",
        "Claude AI analyse  |  Titels & Hashtags",
        "Sessie-ideeen  |  Klantreacties",
        "Inkomsten tracker  |  Bestellingen",
        "Prijscalculator  |  Versleutelde backup",
    ]
    pdf.set_y(185)
    pdf.set_font("Helvetica", "", 9)
    pdf.set_text_color(150, 180, 210)
    for f in functies:
        pdf.cell(210, 6, f, align="C", new_x=XPos.LMARGIN, new_y=YPos.NEXT)

    pdf.set_y(265)
    pdf.set_font("Helvetica", "", 8)
    pdf.set_text_color(*GRIJS)
    pdf.cell(210, 6, "Versie 2.0  |  Platform: Windows", align="C",
             new_x=XPos.LMARGIN, new_y=YPos.NEXT)
    pdf.set_text_color(*DONKER)


def pagina_inhoudsopgave(pdf: Handleiding):
    pdf.add_page()
    pdf.set_font("Helvetica", "B", 18)
    pdf.set_text_color(*DONKER)
    pdf.cell(0, 12, "Inhoudsopgave", new_x=XPos.LMARGIN, new_y=YPos.NEXT)
    pdf.set_draw_color(*PRIMAIR)
    pdf.line(10, pdf.get_y(), 200, pdf.get_y())
    pdf.ln(4)

    hoofdstukken = [
        ("1",  "Installatie & Opstarten"),
        ("2",  "Foto laden & Basisweergave"),
        ("3",  "Privacy & EXIF verwijdering"),
        ("4",  "Foto verbeteren"),
        ("5",  "Watermerk toevoegen"),
        ("6",  "Batch verwerking"),
        ("7",  "Presets opslaan & laden"),
        ("8",  "AI Foto analyse"),
        ("9",  "AI Tools (titels, ideeen, reacties)"),
        ("10", "Export & Platform formaten"),
        ("11", "Business: inkomen & bestellingen"),
        ("12", "Prijscalculator"),
        ("13", "Backup & herstel"),
        ("14", "Veelgestelde vragen & tips"),
    ]

    for nr, titel in hoofdstukken:
        pdf.set_font("Helvetica", "", 11)
        pdf.set_text_color(*DONKER)
        pdf.cell(15, 8, nr + ".", new_x=XPos.RIGHT, new_y=YPos.TOP)
        pdf.set_font("Helvetica", "B", 11)
        pdf.cell(0, 8, titel, new_x=XPos.LMARGIN, new_y=YPos.NEXT)
        pdf.set_draw_color(*LICHT)
        pdf.line(10, pdf.get_y(), 200, pdf.get_y())


def pagina_installatie(pdf: Handleiding):
    pdf.add_page()
    pdf.sectie_titel("1", "Installatie & Opstarten")

    pdf.sub_titel("Systeemvereisten")
    pdf.punt("Windows 10 of hoger")
    pdf.punt("Python 3.10+ of het meegeleverde .exe bestand")
    pdf.punt("Minimaal 4 GB RAM (8 GB aanbevolen)")
    pdf.punt("Internetverbinding voor Claude AI functies")
    pdf.punt("Anthropic API-sleutel (gratis aan te maken op anthropic.com)")
    pdf.ln(2)

    pdf.sub_titel("Installatie via Python")
    pdf.stap(1, "Download het FotoVerwerker pakket en pak het uit.")
    pdf.stap(2, "Open een terminal in de map foto_verwerker.")
    pdf.stap(3, "Installeer de vereiste pakketten:")
    pdf.set_font("Courier", "", 9)
    pdf.set_fill_color(240, 240, 240)
    pdf.set_x(15)
    pdf.multi_cell(170, 5.5, "pip install -r requirements.txt",
                   fill=True, new_x=XPos.LMARGIN, new_y=YPos.NEXT)
    pdf.stap(4, "Start de app:")
    pdf.set_font("Courier", "", 9)
    pdf.set_x(15)
    pdf.multi_cell(170, 5.5, "python main.py",
                   fill=True, new_x=XPos.LMARGIN, new_y=YPos.NEXT)
    pdf.ln(2)

    pdf.sub_titel("Installatie als .exe (aanbevolen voor dagelijks gebruik)")
    pdf.stap(1, "Voer build.bat uit om het .exe bestand te bouwen.")
    pdf.stap(2, "Het bestand FotoVerwerker.exe verschijnt in de dist\\ map.")
    pdf.stap(3, "Dubbelklik op FotoVerwerker.exe om de app te starten.")
    pdf.tip("Zet FotoVerwerker.exe op je bureaublad voor snelle toegang.")
    pdf.ln(2)

    pdf.sub_titel("API-sleutel instellen")
    pdf.tekst(
        "Voor AI-functies heb je een Claude API-sleutel nodig van Anthropic."
    )
    pdf.stap(1, "Ga naar anthropic.com en maak een account aan.")
    pdf.stap(2, "Ga naar 'API Keys' in je dashboard en maak een sleutel aan.")
    pdf.stap(3, "Open de app en ga naar het tabblad 'AI Foto' of 'AI Tools'.")
    pdf.stap(4, "Plak je API-sleutel in het veld 'Claude API-sleutel'.")
    pdf.stap(5, "Klik op 'Sleutel opslaan'. Een groen vinkje bevestigt opslag.")
    pdf.waarschuwing(
        "Deel je API-sleutel nooit met anderen. Behandel het als een wachtwoord."
    )


def pagina_foto_laden(pdf: Handleiding):
    pdf.add_page()
    pdf.sectie_titel("2", "Foto laden & Basisweergave")

    pdf.sub_titel("Foto openen")
    pdf.tekst(
        "Klik op de knop 'Foto laden' (linksboven) of gebruik het "
        "menu Bestand > Openen. De app ondersteunt JPEG, PNG en WebP."
    )
    pdf.stap(1, "Klik op 'Foto laden'.")
    pdf.stap(2, "Blader naar je foto en klik op 'Openen'.")
    pdf.stap(3, "De foto verschijnt in het hoofdvenster.")
    pdf.stap(4, "De bestandsnaam en afmetingen staan onder de foto.")
    pdf.ln(2)

    pdf.sub_titel("Navigatie")
    pdf.punt("Gebruik de pijltjes (< >) om door meerdere fotos in dezelfde map te bladeren.")
    pdf.punt("'Reset' herstelt de foto naar de originele staat.")
    pdf.punt("De statusbalk onderaan toont huidige bewerkingen.")
    pdf.ln(2)

    pdf.sub_titel("Weergave-instellingen")
    pdf.tekst(
        "De foto wordt automatisch passend geschaald voor het scherm. "
        "De originele resolutie blijft behouden voor export."
    )
    pdf.tip(
        "Laad altijd de hoogste kwaliteit foto voor de beste resultaten "
        "bij verwerking en AI-analyse."
    )


def pagina_privacy(pdf: Handleiding):
    pdf.add_page()
    pdf.sectie_titel("3", "Privacy & EXIF verwijdering")

    pdf.sub_titel("Wat is EXIF-data?")
    pdf.tekst(
        "EXIF-metadata is informatie die automatisch door je camera of "
        "smartphone wordt opgeslagen in je foto's. Dit bevat gevoelige "
        "gegevens die je privacy kunnen schaden."
    )
    pdf.ln(1)

    pdf.sub_titel("Welke gegevens worden opgeslagen?")
    items = [
        ("GPS-locatie", "Exacte coordinaten waar de foto genomen is"),
        ("Tijdstip", "Datum en exacte tijd van de opname"),
        ("Apparaat", "Merk, model en serienummer van je camera/telefoon"),
        ("Software", "Welke app of camera-software gebruikt is"),
        ("Belichting", "ISO, sluitertijd, diafragma, brandpuntafstand"),
    ]
    pdf.tabel_rij("Gegevenstype", "Beschrijving", header=True)
    for k, v in items:
        pdf.tabel_rij(k, v)
    pdf.ln(3)

    pdf.sub_titel("EXIF verwijderen")
    pdf.stap(1, "Laad je foto in de app.")
    pdf.stap(2, "Vink 'EXIF verwijderen' aan in het paneel links.")
    pdf.stap(3, "Klik op 'Toepassen' of verwerk via Batch voor meerdere fotos.")
    pdf.stap(4, "De verwerkte foto heeft geen metadata meer.")
    pdf.waarschuwing(
        "Verwijder altijd EXIF-data voordat je fotos publiceert op "
        "FeetFinder, OnlyFans of andere platformen. GPS-locatie kan "
        "je woonadres of werkomgeving verraden!"
    )
    pdf.ln(2)

    pdf.sub_titel("Gezichtsdetectie")
    pdf.tekst(
        "De app detecteert automatisch gezichten in je fotos. Als een "
        "gezicht gevonden wordt, krijg je een waarschuwing. De foto "
        "wordt niet geweigerd, maar je kunt hem zelf controleren."
    )
    pdf.tip(
        "Schakel gezichtsdetectie in via de Batch-instellingen voor "
        "een automatische veiligheidscontrole van al je fotos."
    )


def pagina_verbeteren(pdf: Handleiding):
    pdf.add_page()
    pdf.sectie_titel("4", "Foto verbeteren")

    pdf.sub_titel("Automatische verbetering")
    pdf.tekst(
        "Gebruik de schuifregelaars om helderheid, contrast, "
        "kleurverzadiging en scherpte aan te passen."
    )

    pdf.tabel_rij("Instelling", "Effect", header=True)
    pdf.tabel_rij("Helderheid", "Maakt de foto lichter of donkerder (0.5 - 2.0)")
    pdf.tabel_rij("Contrast", "Vergroot of verkleint het verschil tussen licht en donker")
    pdf.tabel_rij("Kleur", "Verhoogt of verlaagt de kleurverzadiging")
    pdf.tabel_rij("Scherpte", "Maakt details scherper of zachter")
    pdf.ln(3)

    pdf.sub_titel("Blur (vervagen)")
    pdf.tekst(
        "Blur kan gebruikt worden om achtergronden zachter te maken "
        "of details te verbergen."
    )
    pdf.stap(1, "Selecteer het blur-gebied met de muisknop (klik en sleep).")
    pdf.stap(2, "Stel de blur-sterkte in met de schuifregelaar.")
    pdf.stap(3, "Klik op 'Blur toepassen'.")
    pdf.tip(
        "Gebruik blur om herkennbare achtergronden, tekst of "
        "identificerende kenmerken te verbergen."
    )
    pdf.ln(2)

    pdf.sub_titel("Bijsnijden (Crop)")
    pdf.stap(1, "Klik op 'Crop modus activeren'.")
    pdf.stap(2, "Trek een rechthoek over het gewenste deel van de foto.")
    pdf.stap(3, "Klik op 'Crop toepassen' om te bevestigen.")
    pdf.stap(4, "Gebruik 'Reset' om terug te gaan naar de originele foto.")
    pdf.ln(2)

    pdf.sub_titel("Marges instellen")
    pdf.tekst(
        "Voeg witruimte toe rondom je foto met de marge-instellingen. "
        "Handig voor bepaalde platform-vereisten."
    )


def pagina_watermerk(pdf: Handleiding):
    pdf.add_page()
    pdf.sectie_titel("5", "Watermerk toevoegen")

    pdf.sub_titel("Wat is een watermerk?")
    pdf.tekst(
        "Een watermerk is een zichtbaar logo of tekst die over je foto "
        "geplaatst wordt om copyright aan te geven en ongeautoriseerd "
        "gebruik te ontmoedigen."
    )
    pdf.ln(1)

    pdf.sub_titel("Tekstwatermerk")
    pdf.stap(1, "Selecteer 'Tekst' als type watermerk.")
    pdf.stap(2, "Typ je tekst in het tekstveld (bijv. je naam of website).")
    pdf.stap(3, "Stel de grootte en doorzichtigheid in.")
    pdf.stap(4, "Kies een positie uit het dropdown-menu.")
    pdf.stap(5, "Klik op 'Watermerk toepassen'.")
    pdf.ln(2)

    pdf.sub_titel("Logo watermerk")
    pdf.stap(1, "Selecteer 'Logo' als type watermerk.")
    pdf.stap(2, "Klik op 'Logo kiezen' en selecteer je afbeelding (PNG met transparantie).")
    pdf.stap(3, "Stel de grootte in procenten in (standaard 15%).")
    pdf.stap(4, "Kies de positie en doorzichtigheid.")
    pdf.stap(5, "Klik op 'Watermerk toepassen'.")
    pdf.ln(2)

    pdf.sub_titel("Watermerk posities")
    posities = [
        ("bottom-right", "Rechtsonder (standaard, meest gebruikelijk)"),
        ("bottom-left", "Linksonder"),
        ("top-right", "Rechtsboven"),
        ("top-left", "Linksboven"),
        ("center", "Gecentreerd (maximale bescherming)"),
        ("top-center", "Boven in het midden"),
        ("bottom-center", "Onder in het midden"),
    ]
    pdf.tabel_rij("Positie", "Beschrijving", header=True)
    for p, d in posities:
        pdf.tabel_rij(p, d)
    pdf.ln(3)

    pdf.tip(
        "Gebruik een semi-transparant watermerk (doorzichtigheid 120-160) "
        "voor een professionele uitstraling zonder de foto te overschaduwen."
    )


def pagina_batch(pdf: Handleiding):
    pdf.add_page()
    pdf.sectie_titel("6", "Batch verwerking")

    pdf.sub_titel("Wat is batch verwerking?")
    pdf.tekst(
        "Met batch verwerking kun je tientallen of honderden fotos "
        "tegelijk verwerken met dezelfde instellingen. Dit bespaart "
        "enorm veel tijd bij het voorbereiden van content."
    )
    pdf.ln(1)

    pdf.sub_titel("Batch instellen en starten")
    pdf.stap(1, "Ga naar het tabblad 'Batch'.")
    pdf.stap(2, "Klik op 'Invoermap kiezen' en selecteer de map met je fotos.")
    pdf.stap(3, "Klik op 'Uitvoermap kiezen' voor de verwerkte fotos.")
    pdf.stap(4, "Stel de gewenste bewerkingen in:")
    pdf.punt("EXIF verwijderen (aanbevolen: altijd aan)")
    pdf.punt("Auto verbetering met aangepaste waarden")
    pdf.punt("Gezichtsdetectie waarschuwing")
    pdf.punt("Watermerk (tekst of logo)")
    pdf.punt("Platform formaat (automatisch bijsnijden)")
    pdf.stap(5, "Kies het uitvoerformaat: JPEG, PNG of WebP.")
    pdf.stap(6, "Stel de kwaliteit in (85-95 voor JPEG).")
    pdf.stap(7, "Kies een prefix voor bestandsnamen (bijv. 'product_').")
    pdf.stap(8, "Vink 'Anonimiseer bestandsnamen' aan voor willekeurige namen.")
    pdf.stap(9, "Klik op 'Start batch' en wacht tot de voortgangsbalk klaar is.")
    pdf.ln(2)

    pdf.waarschuwing(
        "Zorg dat de uitvoermap leeg is of gebruik een aparte map. "
        "Bestaande bestanden met dezelfde naam worden overschreven."
    )
    pdf.tip(
        "Gebruik anonieme bestandsnamen voor extra privacy. "
        "Fotonamen als 'IMG_20231015_142302.jpg' kunnen het tijdstip "
        "van opname verraden."
    )


def pagina_presets(pdf: Handleiding):
    pdf.add_page()
    pdf.sectie_titel("7", "Presets opslaan & laden")

    pdf.sub_titel("Wat zijn presets?")
    pdf.tekst(
        "Presets zijn opgeslagen combinaties van verwerkingsinstellingen. "
        "Je kunt je favoriete instellingen bewaren en later met een klik "
        "toepassen."
    )
    pdf.ln(1)

    pdf.sub_titel("Preset opslaan")
    pdf.stap(1, "Stel alle gewenste bewerkingen in.")
    pdf.stap(2, "Klik op 'Preset opslaan'.")
    pdf.stap(3, "Geef de preset een herkenbare naam (bijv. 'FeetFinder standaard').")
    pdf.stap(4, "Klik op 'Opslaan'. De preset verschijnt in de lijst.")
    pdf.ln(2)

    pdf.sub_titel("Preset laden")
    pdf.stap(1, "Selecteer een preset uit de dropdown lijst.")
    pdf.stap(2, "Klik op 'Laden'. Alle instellingen worden automatisch ingevuld.")
    pdf.stap(3, "Pas eventueel kleine aanpassingen toe.")
    pdf.ln(2)

    pdf.sub_titel("Preset verwijderen")
    pdf.stap(1, "Selecteer de preset die je wilt verwijderen.")
    pdf.stap(2, "Klik op 'Verwijderen' en bevestig.")
    pdf.ln(2)

    pdf.tip(
        "Maak een preset per platform: 'FeetFinder', 'Etsy', 'Instagram'. "
        "Zo schakel je snel tussen de juiste instellingen."
    )

    pdf.sub_titel("Voorbeeldpresets")
    presets = [
        ("FeetFinder std", "EXIF aan, 1500x1500 fill, JPEG 90%, watermerk rechtsonder"),
        ("Etsy product", "EXIF aan, 2000x1500, PNG, watermerk rechtsboven"),
        ("Instagram story", "EXIF aan, 1080x1920, JPEG 85%, geen watermerk"),
        ("Batch nacht", "Alles aan, gezichtsdetectie, anonieme namen"),
    ]
    pdf.tabel_rij("Preset naam", "Instellingen", header=True)
    for naam, instellingen in presets:
        pdf.tabel_rij(naam, instellingen)


def pagina_ai_foto(pdf: Handleiding):
    pdf.add_page()
    pdf.sectie_titel("8", "AI Foto analyse")

    pdf.sub_titel("Overzicht")
    pdf.tekst(
        "De AI Foto tab gebruikt Claude Opus 4.6 om je productfotos "
        "te analyseren en automatisch professionele content te genereren. "
        "Dit bespaart je veel tijd bij het schrijven van beschrijvingen "
        "en het vinden van de juiste hashtags."
    )
    pdf.ln(1)

    pdf.sub_titel("Beschrijving & Hashtags genereren")
    pdf.stap(1, "Laad een foto in de app.")
    pdf.stap(2, "Ga naar het tabblad 'AI Foto'.")
    pdf.stap(3, "Zorg dat je API-sleutel is ingesteld (groen vinkje).")
    pdf.stap(4, "Klik op 'Analyseer foto'.")
    pdf.stap(5, "Wacht 5-15 seconden terwijl de AI de foto analyseert.")
    pdf.stap(6, "De beschrijving en 15 hashtags verschijnen automatisch.")
    pdf.stap(7, "Gebruik 'Kopieer' om de tekst naar het klembord te sturen.")
    pdf.ln(2)

    pdf.sub_titel("Titels genereren per platform")
    pdf.stap(1, "Selecteer het gewenste platform uit de dropdown.")
    pdf.stap(2, "Klik op 'Genereer titels'.")
    pdf.stap(3, "Je krijgt 5 pakkende titels (max. 60 tekens).")
    pdf.ln(2)

    pdf.tabel_rij("Platform", "Titelstijl", header=True)
    pdf.tabel_rij("FeetFinder", "Verleidelijk, voet-gericht, specifiek")
    pdf.tabel_rij("Etsy", "Productgericht, sleutelwoorden, SEO-vriendelijk")
    pdf.tabel_rij("OnlyFans", "Exclusief, persoonlijk, wervend")
    pdf.tabel_rij("Instagram", "Kort, trendy, hashtag-vriendelijk")
    pdf.tabel_rij("Algemeen", "Neutraal, professioneel")
    pdf.ln(3)

    pdf.tip(
        "Genereer titels voor meerdere platformen tegelijk en bewaar "
        "de beste in een tekstbestand voor hergebruik."
    )
    pdf.waarschuwing(
        "AI-analyse vereist een actieve internetverbinding en "
        "verbruikt API-credits. Elke analyse kost ongeveer EUR 0,01-0,05."
    )


def pagina_ai_tools(pdf: Handleiding):
    pdf.add_page()
    pdf.sectie_titel("9", "AI Tools")

    pdf.sub_titel("Sessie-ideeen")
    pdf.tekst(
        "Laat de AI creatieve ideeen genereren voor je volgende fotosessie, "
        "afgestemd op het platform en je gewenste stijl."
    )
    pdf.stap(1, "Ga naar het tabblad 'AI Tools'.")
    pdf.stap(2, "Selecteer 'Sessie-ideeen' in het menu.")
    pdf.stap(3, "Kies het doelplatform.")
    pdf.stap(4, "Voer optioneel een thema of stijl in (bijv. 'zomer', 'vintage').")
    pdf.stap(5, "Kies het aantal ideeen (standaard 10).")
    pdf.stap(6, "Klik op 'Genereer ideeen'.")
    pdf.ln(2)

    pdf.sub_titel("Klantreactie-templates")
    pdf.tekst(
        "Genereer professionele antwoord-templates voor veelvoorkomende "
        "klantsituaties."
    )
    pdf.stap(1, "Selecteer 'Klantreacties' in het menu.")
    pdf.stap(2, "Kies de situatie.")
    pdf.stap(3, "Selecteer de gewenste toon.")
    pdf.stap(4, "Klik op 'Genereer templates'. Je krijgt 3 kant-en-klare reacties.")
    pdf.ln(2)

    situaties = [
        "Klant vraagt naar prijs",
        "Klant vraagt naar levering/beschikbaarheid",
        "Klant wil aangepaste bestelling (custom request)",
        "Klant geeft compliment / positieve review",
        "Klant klaagt / is ontevreden",
        "Klant vraagt naar korting / bundel deal",
        "Bedankje na aankoop",
        "Klant vraagt om meer fotos van product",
    ]
    pdf.sub_titel("Beschikbare situaties")
    for s in situaties:
        pdf.punt(s)
    pdf.ln(2)

    pdf.tip(
        "Personaliseer de templates door [naam] te vervangen met "
        "de naam van de klant en [product] met je specifieke product."
    )


def pagina_export(pdf: Handleiding):
    pdf.add_page()
    pdf.sectie_titel("10", "Export & Platform formaten")

    pdf.sub_titel("Enkele foto exporteren")
    pdf.stap(1, "Verwerk je foto met de gewenste bewerkingen.")
    pdf.stap(2, "Klik op 'Exporteren' of 'Opslaan als'.")
    pdf.stap(3, "Kies het formaat: JPEG, PNG of WebP.")
    pdf.stap(4, "Stel de kwaliteit in en kies de opslaglocatie.")
    pdf.ln(2)

    pdf.sub_titel("Platform-specifieke formaten")
    pdf.tabel_rij("Platform", "Formaat & Grootte", header=True)
    pdf.tabel_rij("FeetFinder", "1500 x 1500 px (fill - centraal bijsnijden)")
    pdf.tabel_rij("Etsy liggend", "2000 x 1500 px (fit - witte randen)")
    pdf.tabel_rij("Etsy vierkant", "2000 x 2000 px (fill)")
    pdf.tabel_rij("OnlyFans portret", "1080 x 1350 px (fit)")
    pdf.tabel_rij("OnlyFans liggend", "1920 x 1080 px (fit)")
    pdf.tabel_rij("Instagram vierkant", "1080 x 1080 px (fill)")
    pdf.tabel_rij("Instagram story", "1080 x 1920 px (fit)")
    pdf.tabel_rij("Twitter/X", "1280 x 720 px (fit)")
    pdf.ln(3)

    pdf.sub_titel("Verschil fill en fit")
    pdf.punt("Fill: foto wordt vergroot en centraal bijgesneden om het hele kader te vullen.")
    pdf.punt("Fit: foto wordt verkleind en witte randen worden toegevoegd. Geen informatie gaat verloren.")
    pdf.ln(2)

    pdf.sub_titel("Formaatvergelijking")
    pdf.tabel_rij("Formaat", "Voordelen / Gebruik", header=True)
    pdf.tabel_rij("JPEG", "Kleine bestandsgrootte, breed ondersteund, kwaliteit 85-95%")
    pdf.tabel_rij("PNG", "Verliesvrij, transparantie, groter bestand")
    pdf.tabel_rij("WebP", "Modern formaat, kleinste bestand, niet overal ondersteund")

    pdf.tip(
        "Gebruik JPEG (kwaliteit 90%) voor FeetFinder en OnlyFans. "
        "Gebruik PNG voor Etsy productfotos waarbij kwaliteit essentieel is."
    )


def pagina_business(pdf: Handleiding):
    pdf.add_page()
    pdf.sectie_titel("11", "Business: Inkomsten & Bestellingen")

    pdf.sub_titel("Inkomsten tracker")
    pdf.tekst(
        "Houd je inkomsten per platform bij in de ingebouwde tracker. "
        "Alle data wordt lokaal opgeslagen in een beveiligde database."
    )
    pdf.stap(1, "Ga naar het tabblad 'Business'.")
    pdf.stap(2, "Klik op 'Inkomst toevoegen'.")
    pdf.stap(3, "Selecteer het platform.")
    pdf.stap(4, "Vul het bedrag en datum in.")
    pdf.stap(5, "Voeg een optionele beschrijving toe.")
    pdf.stap(6, "Klik op 'Toevoegen'. De entry verschijnt in de lijst.")
    pdf.ln(2)

    pdf.sub_titel("Inkomsten analyseren")
    pdf.punt("Totaal per platform wordt automatisch berekend.")
    pdf.punt("Filter op platform via de dropdown.")
    pdf.punt("Verwijder een entry door hem te selecteren en op 'Verwijderen' te klikken.")
    pdf.ln(2)

    pdf.sub_titel("Bestellingenbeheer")
    pdf.stap(1, "Klik op 'Bestelling toevoegen'.")
    pdf.stap(2, "Vul klantnaam, platform, beschrijving en prijs in.")
    pdf.stap(3, "De status begint op 'Nieuw'.")
    pdf.stap(4, "Update de status: Nieuw > In behandeling > Geleverd > Betaald.")
    pdf.ln(2)

    statussen = [
        ("Nieuw", "Zojuist ontvangen, nog niet begonnen"),
        ("In behandeling", "Je bent ermee bezig"),
        ("Geleverd", "Fotos verstuurd naar klant"),
        ("Betaald", "Betaling ontvangen"),
        ("Geannuleerd", "Bestelling geannuleerd"),
    ]
    pdf.tabel_rij("Status", "Betekenis", header=True)
    for s, m in statussen:
        pdf.tabel_rij(s, m)
    pdf.ln(3)

    pdf.tip(
        "Voeg bij elke inkomst een beschrijving toe zodat je later "
        "precies weet waar het vandaan komt."
    )


def pagina_prijs(pdf: Handleiding):
    pdf.add_page()
    pdf.sectie_titel("12", "Prijscalculator")

    pdf.sub_titel("Hoe werkt de prijscalculator?")
    pdf.tekst(
        "De prijscalculator helpt je de juiste prijs te berekenen voor "
        "bundels en meerdere producten."
    )
    pdf.ln(1)

    pdf.sub_titel("Berekening uitvoeren")
    pdf.stap(1, "Ga naar het tabblad 'Business' en scroll naar Prijscalculator.")
    pdf.stap(2, "Voer de basisprijs per item in (bijv. EUR 5,00 per foto).")
    pdf.stap(3, "Voer het aantal items in.")
    pdf.stap(4, "Voer het kortingspercentage in (bijv. 15% voor bundel).")
    pdf.stap(5, "Klik op 'Bereken'.")
    pdf.ln(2)

    pdf.sub_titel("Voorbeeldberekening")
    pdf.tabel_rij("Invoer", "Waarde", header=True)
    pdf.tabel_rij("Basisprijs", "EUR 4,00 per foto")
    pdf.tabel_rij("Aantal", "25 fotos")
    pdf.tabel_rij("Korting", "20%")
    pdf.tabel_rij("Totaal (geen korting)", "EUR 100,00")
    pdf.tabel_rij("Totaal (met korting)", "EUR 80,00")
    pdf.ln(3)

    pdf.tip(
        "Gebruik een korting van 10-20% voor bundels van 5+ items. "
        "Dit stimuleert klanten tot grotere aankopen."
    )


def pagina_backup(pdf: Handleiding):
    pdf.add_page()
    pdf.sectie_titel("13", "Backup & Herstel")

    pdf.sub_titel("Wat wordt opgeslagen?")
    pdf.punt("Inkomsten-database (SQLite)")
    pdf.punt("Bestellingen-database")
    pdf.punt("Opgeslagen presets")
    pdf.punt("App-instellingen")
    pdf.ln(2)

    pdf.sub_titel("Backup aanmaken")
    pdf.stap(1, "Ga naar het tabblad 'Instellingen'.")
    pdf.stap(2, "Klik op 'Backup aanmaken'.")
    pdf.stap(3, "Kies een opslaglocatie (externe schijf of cloudopslag).")
    pdf.stap(4, "De backup wordt versleuteld opgeslagen als .bak bestand.")
    pdf.ln(2)

    pdf.sub_titel("Backup herstel")
    pdf.stap(1, "Klik op 'Backup herstellen'.")
    pdf.stap(2, "Selecteer je .bak bestand.")
    pdf.stap(3, "Kies de herstelmap.")
    pdf.stap(4, "De gegevens worden ontsleuteld en hersteld.")
    pdf.ln(2)

    pdf.sub_titel("Versleuteling")
    pdf.tekst(
        "Backups worden versleuteld met Fernet AES-128 encryptie. "
        "De sleutel staat in 'feetbusiness_data/.backup_key'."
    )
    pdf.waarschuwing(
        "Zonder de .backup_key kun je de backup NIET herstellen. "
        "Maak een kopie op een veilige locatie (USB-stick of wachtwoordmanager)."
    )
    pdf.tip(
        "Maak wekelijks een backup en sla op in de cloud. "
        "Zo ben je beschermd bij verlies of beschadiging van je laptop."
    )


def pagina_faq(pdf: Handleiding):
    pdf.add_page()
    pdf.sectie_titel("14", "Veelgestelde vragen & Tips")

    vragen = [
        (
            "De app start niet. Wat doe ik?",
            "Controleer of Python 3.10+ geinstalleerd is. "
            "Voer 'pip install -r requirements.txt' opnieuw uit."
        ),
        (
            "AI-analyse geeft een foutmelding.",
            "Controleer je API-sleutel en internetverbinding. "
            "Controleer je API-credits op anthropic.com."
        ),
        (
            "Mijn foto wordt niet goed bijgesneden.",
            "Controleer het ingestelde platform-formaat. "
            "'Fill' snijdt bij, 'Fit' voegt randen toe."
        ),
        (
            "Gezichtsdetectie herkent geen gezichten.",
            "Gezichtsdetectie werkt het beste bij frontale gezichten. "
            "Profielfoto's of kleine gezichten worden mogelijk gemist."
        ),
        (
            "Kan ik de app op meerdere computers gebruiken?",
            "Ja, kopieer de volledige foto_verwerker map. "
            "De database is per computer afzonderlijk."
        ),
        (
            "Hoe reset ik alle instellingen?",
            "Verwijder de map 'feetbusiness_data' uit je thuismap. "
            "De app maakt alles opnieuw aan bij de volgende start."
        ),
        (
            "Zijn mijn fotos veilig bij AI-analyse?",
            "Fotos worden tijdelijk naar Anthropic gestuurd voor analyse "
            "en niet permanent opgeslagen. Zie anthropic.com/privacy."
        ),
        (
            "Welk formaat is het best voor FeetFinder?",
            "JPEG, kwaliteit 90%, formaat 1500x1500 px. EXIF altijd verwijderen!"
        ),
    ]

    for vraag, antwoord in vragen:
        pdf.set_font("Helvetica", "B", 10)
        pdf.set_text_color(*PRIMAIR)
        pdf.multi_cell(0, 6, "V: " + vraag, new_x=XPos.LMARGIN, new_y=YPos.NEXT)
        pdf.set_font("Helvetica", "", 10)
        pdf.set_text_color(*DONKER)
        pdf.multi_cell(0, 5.5, "A: " + antwoord, new_x=XPos.LMARGIN, new_y=YPos.NEXT)
        pdf.ln(2)

    pdf.add_page()
    pdf.sectie_titel("", "Professionele Tips")

    tips = [
        ("Consistentie",
         "Gebruik altijd dezelfde preset per platform voor een professionele uitstraling."),
        ("Bestandsnamen",
         "Gebruik anonieme bestandsnamen. Originele namen kunnen metadata bevatten."),
        ("Kwaliteit vs grootte",
         "JPEG 90% is de sweet spot: hoge kwaliteit, acceptabele bestandsgrootte."),
        ("Watermerken",
         "Gebruik je naam of website-URL als watermerk voor naamsbekendheid."),
        ("AI beschrijvingen",
         "Controleer AI-beschrijvingen altijd voor je ze publiceert. Pas aan naar je stijl."),
        ("Backup routine",
         "Maak elke week een backup. Sla op buiten je laptop (cloud of USB)."),
        ("EXIF altijd uit",
         "Zet EXIF-verwijdering standaard aan. Het kost niets en beschermt je privacy."),
        ("Batch 's avonds",
         "Verwerk grote batches 's avonds zodat je overdag niet gehinderd wordt."),
    ]
    for titel, inhoud in tips:
        pdf.set_font("Helvetica", "B", 10)
        pdf.set_text_color(*ACCENT)
        pdf.cell(0, 6, titel, new_x=XPos.LMARGIN, new_y=YPos.NEXT)
        pdf.set_font("Helvetica", "", 10)
        pdf.set_text_color(*DONKER)
        pdf.multi_cell(0, 5.5, inhoud, new_x=XPos.LMARGIN, new_y=YPos.NEXT)
        pdf.ln(1)


# -------------------------------------------------------------
# Hoofdfunctie
# -------------------------------------------------------------

def maak_pdf():
    pdf = Handleiding()
    pdf.set_auto_page_break(auto=True, margin=15)
    pdf.set_margins(10, 15, 10)

    pagina_voorblad(pdf)
    pagina_inhoudsopgave(pdf)
    pagina_installatie(pdf)
    pagina_foto_laden(pdf)
    pagina_privacy(pdf)
    pagina_verbeteren(pdf)
    pagina_watermerk(pdf)
    pagina_batch(pdf)
    pagina_presets(pdf)
    pagina_ai_foto(pdf)
    pagina_ai_tools(pdf)
    pagina_export(pdf)
    pagina_business(pdf)
    pagina_prijs(pdf)
    pagina_backup(pdf)
    pagina_faq(pdf)

    output_path = Path(__file__).parent / "FotoVerwerker_Handleiding.pdf"
    pdf.output(str(output_path))
    print(f"Handleiding opgeslagen: {output_path}")


if __name__ == "__main__":
    maak_pdf()
