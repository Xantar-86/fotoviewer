import { NextRequest, NextResponse } from 'next/server'
import Anthropic from '@anthropic-ai/sdk'

function detectMediaType(file: File): 'image/jpeg' | 'image/png' | 'image/gif' | 'image/webp' {
  const t = (file.type || '').toLowerCase()
  if (t === 'image/png') return 'image/png'
  if (t === 'image/gif') return 'image/gif'
  if (t === 'image/webp') return 'image/webp'
  return 'image/jpeg'
}

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData()
    const file = formData.get('file') as File
    const apiKey = ((formData.get('api_key') as string) || '').trim()

    if (!apiKey) return NextResponse.json({ error: 'API sleutel vereist' }, { status: 400 })
    if (!file) return NextResponse.json({ error: 'Geen bestand ontvangen' }, { status: 400 })

    const buffer = Buffer.from(await file.arrayBuffer())
    const b64 = buffer.toString('base64')
    const mediaType = detectMediaType(file)

    const client = new Anthropic({ apiKey })
    const response = await client.messages.create({
      model: 'claude-opus-4-6',
      max_tokens: 512,
      messages: [{
        role: 'user',
        content: [
          { type: 'image', source: { type: 'base64', media_type: mediaType, data: b64 } },
          { type: 'text', text: `Bekijk deze foto en genereer 5 pakkende titels voor gebruik op platforms zoals FeetFinder, OnlyFans en Fansly.

Geef UITSLUITEND een JSON array terug:
["Titel 1", "Titel 2", "Titel 3", "Titel 4", "Titel 5"]

Regels:
- Titels in het Nederlands
- Prikkelend maar niet te expliciet
- Maximaal 60 tekens per titel
- Mix van speels, elegant en verleidelijk` },
        ],
      }],
    })

    const text = (response.content[0] as any).text.trim()
    const match = text.match(/\[[\s\S]*\]/)
    if (match) return NextResponse.json({ titles: JSON.parse(match[0]).slice(0, 5) })
    return NextResponse.json({ titles: [] })
  } catch (e: any) {
    const msg = e?.error?.error?.message || e?.message || 'Onbekende fout'
    const httpStatus = e?.status === 401 ? 401 : e?.status === 429 ? 429 : 500
    return NextResponse.json({ error: msg }, { status: httpStatus })
  }
}
