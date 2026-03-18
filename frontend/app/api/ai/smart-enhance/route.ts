import { NextRequest, NextResponse } from 'next/server'
import Anthropic from '@anthropic-ai/sdk'
import sharp from 'sharp'

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

    if (!apiKey) return NextResponse.json({ error: 'Anthropic API sleutel vereist' }, { status: 400 })
    if (!file) return NextResponse.json({ error: 'Geen bestand ontvangen' }, { status: 400 })

    const buffer = Buffer.from(await file.arrayBuffer())
    const b64 = buffer.toString('base64')
    const mediaType = detectMediaType(file)

    // Step 1: Ask Claude to analyze and suggest enhancement parameters
    const client = new Anthropic({ apiKey })
    const response = await client.messages.create({
      model: 'claude-opus-4-6',
      max_tokens: 512,
      messages: [{
        role: 'user',
        content: [
          { type: 'image', source: { type: 'base64', media_type: mediaType, data: b64 } },
          {
            type: 'text',
            text: `Je bent een professionele fotograaf gespecialiseerd in content voor platforms zoals FeetFinder en OnlyFans.
Analyseer deze foto en geef optimale bewerkingsparameters terug als JSON.

Geef UITSLUITEND dit JSON object terug (geen uitleg erbuiten):
{
  "brightness": <getal 0.7-1.4, 1.0=normaal, verhoog als de foto donker is>,
  "saturation": <getal 0.7-1.6, 1.0=normaal, verhoog voor levendigere kleuren>,
  "sharpness": <getal 0.3-2.0, gebruik 0.8 standaard, 1.5+ voor details>,
  "uitleg": "Korte Nederlandse uitleg (1-2 zinnen) wat je verbetert en waarom"
}

Focus op: optimale helderheid, levendige aantrekkelijke kleuren, scherpe details.`,
          },
        ],
      }],
    })

    const text = (response.content[0] as any).text.trim()
    const match = text.match(/\{[\s\S]*\}/)
    if (!match) throw new Error('Claude gaf geen geldige parameters terug')

    const params = JSON.parse(match[0])
    const brightness = Math.max(0.5, Math.min(1.5, Number(params.brightness) || 1.0))
    const saturation = Math.max(0.5, Math.min(1.8, Number(params.saturation) || 1.0))
    const sharpness = Math.max(0.3, Math.min(2.5, Number(params.sharpness) || 0.8))

    // Step 2: Apply with sharp
    const enhanced = await sharp(buffer)
      .modulate({ brightness, saturation })
      .sharpen({ sigma: sharpness * 0.7, m1: 0.5, m2: 0.5 })
      .jpeg({ quality: 92 })
      .toBuffer()

    return NextResponse.json({
      image: enhanced.toString('base64'),
      uitleg: params.uitleg || '',
      params: { brightness, saturation, sharpness },
    })
  } catch (e: any) {
    const msg = e?.error?.error?.message || e?.message || 'Onbekende fout'
    const httpStatus = e?.status === 401 ? 401 : e?.status === 429 ? 429 : 500
    return NextResponse.json({ error: msg }, { status: httpStatus })
  }
}
