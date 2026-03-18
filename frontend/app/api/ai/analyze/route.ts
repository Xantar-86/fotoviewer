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
      max_tokens: 1024,
      messages: [{
        role: 'user',
        content: [
          {
            type: 'image',
            source: { type: 'base64', media_type: mediaType, data: b64 },
          },
          {
            type: 'text',
            text: `Analyseer deze foto professioneel voor gebruik op platforms zoals FeetFinder, OnlyFans of Fansly.

Geef je antwoord UITSLUITEND als geldig JSON in dit exacte formaat:
{
  "beschrijving": "Een professionele beschrijving van de foto in het Nederlands (2-3 zinnen)",
  "hashtags": ["#hashtag1", "#hashtag2", "#hashtag3", "#hashtag4", "#hashtag5", "#hashtag6", "#hashtag7", "#hashtag8", "#hashtag9", "#hashtag10"],
  "stemming": "De algemene stemming/sfeer van de foto",
  "tips": ["Tip 1 voor betere presentatie", "Tip 2 voor betere marketing", "Tip 3 voor hogere omzet"]
}

Gebruik Nederlandse hashtags die relevant zijn voor de foto. Wees professioneel maar ook commercieel gericht.`,
          },
        ],
      }],
    })

    const text = (response.content[0] as any).text.trim()
    const match = text.match(/\{[\s\S]*\}/)
    if (match) return NextResponse.json(JSON.parse(match[0]))
    return NextResponse.json({ beschrijving: text, hashtags: [], stemming: '', tips: [] })
  } catch (e: any) {
    const msg = e?.error?.error?.message || e?.message || 'Onbekende fout'
    const httpStatus = e?.status === 401 ? 401 : e?.status === 429 ? 429 : 500
    return NextResponse.json({ error: msg }, { status: httpStatus })
  }
}
