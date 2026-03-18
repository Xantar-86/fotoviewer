import { NextRequest, NextResponse } from 'next/server'
import Anthropic from '@anthropic-ai/sdk'

const SCENARIOS: Record<string, string> = {
  'Prijsvraag': 'een klant vraagt naar de prijs van content of een custom video',
  'Custom verzoek': 'een klant vraagt om aangepaste/persoonlijke content',
  'Abonnement vragen': 'een klant vraagt hoe ze zich kunnen abonneren',
  'Afwijzing': 'je wil een verzoek beleefd weigeren dat niet bij jouw grenzen past',
  'Dankwoord': 'je wil een klant bedanken voor hun aankoop of steun',
  'Onbeleefde klant': 'een klant gedraagt zich ongepast of onbeleefd',
  'Korting vragen': 'een klant vraagt om korting',
  'Tip ontvangen': 'je hebt een fooi ontvangen en wil bedanken',
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { api_key, scenario = 'Prijsvraag' } = body
    const context = SCENARIOS[scenario] || `scenario: ${scenario}`

    const client = new Anthropic({ apiKey: api_key })
    const response = await client.messages.create({
      model: 'claude-opus-4-6',
      max_tokens: 1024,
      messages: [{
        role: 'user',
        content: `Genereer 3 antwoordsjablonen in het Nederlands voor wanneer ${context}.

Geef UITSLUITEND een JSON array:
[
  {
    "naam": "Korte naam voor dit sjabloon (bijv: Professioneel, Vriendelijk, Direct)",
    "bericht": "Het volledige antwoordbericht dat je kunt kopiëren en sturen",
    "toon": "De toon van het bericht"
  }
]

Regels: Alles in het Nederlands. Professioneel maar persoonlijk. Klaar om te gebruiken. Maximaal 200 woorden per bericht.`,
      }],
    })

    const text = (response.content[0] as any).text.trim()
    const match = text.match(/\[[\s\S]*\]/)
    if (match) return NextResponse.json({ templates: JSON.parse(match[0]).slice(0, 3) })
    return NextResponse.json({ templates: [] })
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}
