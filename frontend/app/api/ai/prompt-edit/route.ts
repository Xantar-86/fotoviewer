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
    const apiKey = formData.get('api_key') as string
    const prompt = formData.get('prompt') as string

    if (!apiKey) return NextResponse.json({ error: 'Anthropic API sleutel vereist' }, { status: 400 })
    if (!file) return NextResponse.json({ error: 'Geen bestand ontvangen' }, { status: 400 })
    if (!prompt?.trim()) return NextResponse.json({ error: 'Geen bewerkingsopdracht opgegeven' }, { status: 400 })

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
          {
            type: 'text',
            text: `Je bent een professionele foto-editor. Analyseer de foto en de bewerkingsopdracht.

Bewerkingsopdracht van de gebruiker: "${prompt}"

Geef bewerkingsparameters terug die dit effect realiseren met sharp.js.
Return UITSLUITEND dit JSON object (geen uitleg erbuiten):
{
  "brightness": <0.5-1.8, standaard 1.0>,
  "saturation": <0.0-2.0, standaard 1.0, 0.0=zwart-wit>,
  "hue": <-180 tot 180, graden hue rotatie, 0=geen>,
  "sharpness": <0.0-3.0, 0=geen scherpte, 0.8=normaal>,
  "blur": <0.0-15.0, 0=geen blur>,
  "grayscale": <true of false>,
  "gamma": <0.5-3.0, 1.0=normaal, >1=lichter schaduwen>,
  "uitleg": "Korte Nederlandse uitleg wat je hebt gedaan en waarom"
}

Interpreteer de opdracht intelligent (NL/EN):
- "warmer/warm" → hue: 8, saturation: 1.1, brightness: 1.05
- "koeler/koel/cool" → hue: -8, saturation: 0.95
- "vintage/retro" → saturation: 0.65, brightness: 0.93, gamma: 1.15, hue: 6
- "zwart-wit/monochroom/b&w" → grayscale: true
- "helderder/lichter/brighter" → brightness: 1.25, gamma: 1.1
- "donkerder/darker" → brightness: 0.78, gamma: 0.88
- "levendig/vibrant/kleurrijker" → saturation: 1.5, brightness: 1.05
- "matte/mat" → saturation: 0.7, brightness: 0.93, gamma: 1.08
- "scherper/sharper" → sharpness: 2.0
- "zachter/softer" → blur: 1.8, sharpness: 0
- "dramatisch/dramatic" → saturation: 1.35, brightness: 0.85, sharpness: 1.2
- "roze/roze tint/pink" → hue: -30, saturation: 1.2
- "goud/golden" → hue: 15, saturation: 1.15, brightness: 1.1`,
          },
        ],
      }],
    })

    const text = (response.content[0] as any).text.trim()
    const match = text.match(/\{[\s\S]*\}/)
    if (!match) throw new Error('Claude gaf geen geldige parameters terug')

    const params = JSON.parse(match[0])

    // Apply edits with sharp
    let pipeline = sharp(buffer)

    if (params.grayscale === true) {
      pipeline = pipeline.grayscale()
    }

    if (params.gamma && Math.abs(params.gamma - 1.0) > 0.01) {
      pipeline = pipeline.gamma(Math.max(0.1, Math.min(3.0, params.gamma)))
    }

    pipeline = pipeline.modulate({
      brightness: Math.max(0.3, Math.min(2.0, Number(params.brightness) || 1.0)),
      saturation: Math.max(0.0, Math.min(3.0, Number(params.saturation) ?? 1.0)),
      hue: Number(params.hue) || 0,
    })

    if (params.blur && Number(params.blur) > 0) {
      pipeline = pipeline.blur(Math.min(15, Number(params.blur)))
    } else if (params.sharpness && Number(params.sharpness) > 0) {
      pipeline = pipeline.sharpen({ sigma: Math.min(3, Number(params.sharpness) * 0.7) })
    }

    const result = await pipeline.jpeg({ quality: 92 }).toBuffer()

    return NextResponse.json({
      image: result.toString('base64'),
      uitleg: params.uitleg || '',
      params,
    })
  } catch (e: any) {
    const msg = e?.error?.error?.message || e?.message || 'Onbekende fout'
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
