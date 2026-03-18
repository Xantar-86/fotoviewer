import { NextRequest, NextResponse } from 'next/server'
import Anthropic from '@anthropic-ai/sdk'

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { api_key, platform = 'FeetFinder', theme = 'elegant' } = body
    const apiKey = (api_key || '').trim()

    const client = new Anthropic({ apiKey })
    const response = await client.messages.create({
      model: 'claude-opus-4-6',
      max_tokens: 2048,
      messages: [{
        role: 'user',
        content: `Genereer 10 creatieve fotosessie-ideeën voor een ${platform} creator met thema "${theme}".

Geef je antwoord UITSLUITEND als geldig JSON array:
[
  {
    "titel": "Naam van het concept",
    "beschrijving": "Korte beschrijving wat de sessie inhoudt (1-2 zinnen)",
    "props": "Benodigde attributen/accessoires",
    "locatie": "Aanbevolen locatie of achtergrond",
    "tip": "Marketing tip voor dit concept"
  }
]

Geef precies 10 ideeën. Alles in het Nederlands.`,
      }],
    })

    const text = (response.content[0] as any).text.trim()
    const match = text.match(/\[[\s\S]*\]/)
    if (match) return NextResponse.json({ ideas: JSON.parse(match[0]).slice(0, 10) })
    return NextResponse.json({ ideas: [] })
  } catch (e: any) {
    const msg = e?.error?.error?.message || e?.message || 'Onbekende fout'
    const httpStatus = e?.status === 401 ? 401 : e?.status === 429 ? 429 : 500
    return NextResponse.json({ error: msg }, { status: httpStatus })
  }
}
