import { NextRequest, NextResponse } from 'next/server'
import Anthropic from '@anthropic-ai/sdk'

function detectMediaType(file: File): 'image/jpeg' | 'image/png' | 'image/gif' | 'image/webp' {
  const t = (file.type || '').toLowerCase()
  if (t === 'image/png') return 'image/png'
  if (t === 'image/gif') return 'image/gif'
  if (t === 'image/webp') return 'image/webp'
  return 'image/jpeg'
}

function getPlatformInstructions(platform: string): string {
  switch (platform) {
    case 'FeetFinder':
    case 'OnlyFans':
    case 'Fansly':
      return 'Gebruik een suggestieve maar niet expliciete toon. Voeg 5-8 hashtags toe in het Engels.'
    case 'Instagram':
      return 'Gebruik een professionele en artistieke toon. Voeg 10-15 hashtags toe in een mix van Nederlands en Engels.'
    case 'Patreon':
      return 'Gebruik een persoonlijke en dankbare toon naar fans. Voeg 3-5 hashtags toe.'
    default:
      return 'Gebruik een passende toon voor het platform. Voeg 5-8 relevante hashtags toe.'
  }
}

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData()
    const file = formData.get('file') as File | null
    const apiKey = ((formData.get('api_key') as string) || '').trim()
    const platform = ((formData.get('platform') as string) || 'FeetFinder').trim()
    const theme = ((formData.get('theme') as string) || '').trim()
    const toon = ((formData.get('toon') as string) || 'sensueel').trim()

    if (!apiKey) return NextResponse.json({ error: 'API sleutel vereist' }, { status: 400 })
    if (!theme) return NextResponse.json({ error: 'Beschrijving van de content is vereist' }, { status: 400 })

    const platformInstructions = getPlatformInstructions(platform)

    const promptText = `Je bent een expert social media copywriter voor content creators op ${platform}.

Maak 3 verschillende onderschriften (captions) in het Nederlands voor een post op ${platform}.

Content beschrijving: ${theme}
Gewenste toon: ${toon}

Platform-specifieke instructies: ${platformInstructions}

Geef UITSLUITEND een geldig JSON array terug met precies 3 objecten, zonder extra tekst of uitleg:
[
  {"tekst": "Volledige caption tekst hier...", "hashtags": ["hashtag1", "hashtag2", "hashtag3"]},
  {"tekst": "Volledige caption tekst hier...", "hashtags": ["hashtag1", "hashtag2", "hashtag3"]},
  {"tekst": "Volledige caption tekst hier...", "hashtags": ["hashtag1", "hashtag2", "hashtag3"]}
]

Let op:
- Elke caption moet uniek en anders van stijl zijn
- Hashtags zonder # teken
- Caption tekst mag emoji bevatten
- Alles in het Nederlands behalve de hashtags (conform platform instructies)`

    const client = new Anthropic({ apiKey })

    let messageContent: Anthropic.MessageParam['content']

    if (file) {
      const buffer = Buffer.from(await file.arrayBuffer())
      const b64 = buffer.toString('base64')
      const mediaType = detectMediaType(file)
      messageContent = [
        { type: 'image', source: { type: 'base64', media_type: mediaType, data: b64 } },
        { type: 'text', text: promptText },
      ]
    } else {
      messageContent = promptText
    }

    const response = await client.messages.create({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 800,
      messages: [{ role: 'user', content: messageContent }],
    })

    const text = (response.content[0] as { type: string; text: string }).text.trim()
    const match = text.match(/\[[\s\S]*\]/)
    if (match) {
      const parsed = JSON.parse(match[0])
      return NextResponse.json({ captions: parsed.slice(0, 3) })
    }

    return NextResponse.json({ captions: [] })
  } catch (e: unknown) {
    const err = e as { error?: { error?: { message?: string } }; message?: string; status?: number }
    const msg = err?.error?.error?.message || err?.message || 'Onbekende fout'
    const httpStatus = err?.status === 401 ? 401 : err?.status === 429 ? 429 : 500
    return NextResponse.json({ error: msg }, { status: httpStatus })
  }
}
