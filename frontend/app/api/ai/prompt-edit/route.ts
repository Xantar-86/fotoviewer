import { NextRequest, NextResponse } from 'next/server'
import Anthropic from '@anthropic-ai/sdk'
import sharp from 'sharp'

async function pollStabilityResult(id: string, apiKey: string): Promise<string> {
  for (let i = 0; i < 40; i++) {
    await new Promise((r) => setTimeout(r, 3000))
    const res = await fetch(`https://api.stability.ai/v2beta/results/${id}`, {
      headers: { Authorization: `Bearer ${apiKey}`, Accept: 'application/json' },
    })
    if (res.status === 202) continue
    if (res.ok) {
      const json = await res.json()
      if (json.image) return json.image as string
      throw new Error('Geen afbeelding in Stability AI respons')
    }
    let errMsg = `Stability AI fout (${res.status})`
    try {
      const err = await res.json()
      errMsg = err.message || err.errors?.[0]?.message || errMsg
    } catch {}
    throw new Error(errMsg)
  }
  throw new Error('Stability AI timeout — probeer opnieuw')
}

function detectMediaType(file: File): 'image/jpeg' | 'image/png' | 'image/gif' | 'image/webp' {
  const t = (file.type || '').toLowerCase()
  if (t === 'image/png') return 'image/png'
  if (t === 'image/gif') return 'image/gif'
  if (t === 'image/webp') return 'image/webp'
  return 'image/jpeg'
}

function parseHex(hex: string): { r: number; g: number; b: number } {
  const h = hex.replace('#', '').slice(0, 6).padEnd(6, '0')
  return {
    r: parseInt(h.slice(0, 2), 16) || 0,
    g: parseInt(h.slice(2, 4), 16) || 0,
    b: parseInt(h.slice(4, 6), 16) || 0,
  }
}

async function generateBgBuffer(params: any, w: number, h: number): Promise<Buffer> {
  if (params.bg_type === 'gradient' && params.bg_from && params.bg_to) {
    const angle = params.bg_direction === 'lr' ? 'x1="0%" y1="0%" x2="100%" y2="0%"' : 'x1="0%" y1="0%" x2="0%" y2="100%"'
    const svg = `<svg width="${w}" height="${h}" xmlns="http://www.w3.org/2000/svg">
      <defs>
        <linearGradient id="g" ${angle}>
          <stop offset="0%" stop-color="${params.bg_from}"/>
          <stop offset="100%" stop-color="${params.bg_to}"/>
        </linearGradient>
      </defs>
      <rect width="${w}" height="${h}" fill="url(#g)"/>
    </svg>`
    return sharp(Buffer.from(svg)).png().toBuffer() as Promise<Buffer>
  }
  const color = params.bg_color ? parseHex(params.bg_color) : { r: 255, g: 255, b: 255 }
  return sharp({ create: { width: w, height: h, channels: 3, background: color } }).png().toBuffer() as Promise<Buffer>
}

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData()
    const file = formData.get('file') as File
    const apiKey = ((formData.get('api_key') as string) || '').trim()
    const removeBgKey = ((formData.get('remove_bg_key') as string) || '').trim()
    const stabilityKey = ((formData.get('stability_key') as string) || '').trim()
    const prompt = (formData.get('prompt') as string || '').trim()

    if (!apiKey) return NextResponse.json({ error: 'Anthropic API sleutel vereist' }, { status: 400 })
    if (!file) return NextResponse.json({ error: 'Geen bestand ontvangen' }, { status: 400 })
    if (!prompt) return NextResponse.json({ error: 'Geen bewerkingsopdracht opgegeven' }, { status: 400 })

    const buffer = Buffer.from(await file.arrayBuffer())
    const b64 = buffer.toString('base64')
    const mediaType = detectMediaType(file)

    const client = new Anthropic({ apiKey })
    const response = await client.messages.create({
      model: 'claude-opus-4-6',
      max_tokens: 600,
      messages: [{
        role: 'user',
        content: [
          { type: 'image', source: { type: 'base64', media_type: mediaType, data: b64 } },
          {
            type: 'text',
            text: `Je bent een professionele foto-editor. Analyseer de foto en de bewerkingsopdracht.

Bewerkingsopdracht: "${prompt}"

Bepaal het TYPE bewerking en return UITSLUITEND geldig JSON (geen tekst erbuiten):

Als de opdracht over KLEUR/FILTER/HELDERHEID gaat → type "color_grade":
{
  "type": "color_grade",
  "brightness": <0.5-1.8, 1.0=normaal>,
  "saturation": <0.0-2.0, 1.0=normaal, 0.0=zwart-wit>,
  "hue": <-180 tot 180, 0=geen>,
  "sharpness": <0.0-3.0, 0=geen>,
  "blur": <0.0-15.0, 0=geen>,
  "grayscale": <true/false>,
  "gamma": <0.5-3.0, 1.0=normaal>,
  "uitleg": "Korte NL uitleg"
}

Als de opdracht over de ACHTERGROND gaat (andere achtergrond, locatie, sfeer, natuur, etc.) → type "background_change":
{
  "type": "background_change",
  "background_prompt": "Detailed English description for photorealistic AI background generation, e.g. 'tropical beach with clear turquoise water, white sand, palm trees, golden hour sunlight'",
  "uitleg": "Korte NL uitleg"
}

Vertaal de achtergrond-opdracht altijd naar een gedetailleerde Engelse scènebeschrijving voor background_prompt.
Voorbeelden: strand→beach scene, kerst→Christmas winter scene with snow, studio→professional photography studio with soft lighting, zonsondergang→romantic sunset with warm golden colors.

Filter voorbeelden:
warmer=hue+8,sat1.1, koeler=hue-8, vintage=sat0.65,gamma1.15,hue6
zwart-wit=grayscale true, levendig=sat1.5, dramatisch=sat1.35,brightness0.85
matte=sat0.7,brightness0.93, scherper=sharpness2.0, zachter=blur1.8`,
          },
        ],
      }],
    })

    const text = (response.content[0] as any).text.trim()
    const match = text.match(/\{[\s\S]*\}/)
    if (!match) throw new Error('Claude gaf geen geldige parameters terug')

    const params = JSON.parse(match[0])

    // ── Background change ──────────────────────────────────────────────────
    if (params.type === 'background_change') {
      // Route 1: Stability AI → photorealistic background
      if (stabilityKey) {
        const stabForm = new FormData()
        stabForm.append(
          'subject_image',
          new Blob([buffer], { type: file.type || 'image/jpeg' }),
          'subject.jpg'
        )
        stabForm.append('background_prompt', params.background_prompt || prompt)
        stabForm.append('foreground_ratio', '0.9')
        stabForm.append('output_format', 'jpeg')

        const stabRes = await fetch(
          'https://api.stability.ai/v2beta/stable-image/edit/replace-background-and-relight',
          {
            method: 'POST',
            headers: { Authorization: `Bearer ${stabilityKey}`, Accept: 'application/json' },
            body: stabForm,
          }
        )
        if (!stabRes.ok && stabRes.status !== 202) {
          let errMsg = `Stability AI fout (${stabRes.status})`
          try {
            const err = await stabRes.json()
            errMsg = err.message || err.errors?.[0]?.message || errMsg
          } catch {}
          return NextResponse.json({ error: errMsg }, { status: stabRes.status === 401 ? 401 : 400 })
        }

        const stabJson = await stabRes.json()
        let imageBase64: string
        if (stabRes.status === 202) {
          imageBase64 = await pollStabilityResult(stabJson.id, stabilityKey)
        } else {
          imageBase64 = stabJson.image
        }

        return NextResponse.json({
          image: imageBase64,
          uitleg: params.uitleg || '',
          params,
        })
      }

      // Route 2: remove.bg + solid/gradient fallback
      if (!removeBgKey) {
        return NextResponse.json({
          error: 'Achtergrond wijzigen vereist een Stability AI sleutel (fotorealistisch) of remove.bg sleutel. Voeg toe bij Instellingen.',
        }, { status: 400 })
      }

      const removeBgForm = new FormData()
      removeBgForm.append('image_file', file)
      removeBgForm.append('size', 'auto')
      const removeBgRes = await fetch('https://api.remove.bg/v1.0/removebg', {
        method: 'POST',
        headers: { 'X-Api-Key': removeBgKey },
        body: removeBgForm,
      })
      if (!removeBgRes.ok) {
        const errText = await removeBgRes.text()
        let errMsg = `remove.bg fout (${removeBgRes.status})`
        try { errMsg = JSON.parse(errText).errors?.[0]?.title || errMsg } catch {}
        return NextResponse.json({ error: errMsg }, { status: 400 })
      }

      const subjectPng = Buffer.from(await removeBgRes.arrayBuffer())
      const meta = await sharp(subjectPng).metadata()
      const w = meta.width || 1080
      const h = meta.height || 1080

      // Fallback: white background since new prompt format no longer has bg_color
      const bgBuffer = await (sharp({ create: { width: w, height: h, channels: 3, background: { r: 255, g: 255, b: 255 } } }).png().toBuffer() as Promise<Buffer>)

      const result = await (sharp(bgBuffer)
        .composite([{ input: subjectPng, blend: 'over' }])
        .jpeg({ quality: 92 })
        .toBuffer() as Promise<Buffer>)

      return NextResponse.json({
        image: result.toString('base64'),
        uitleg: params.uitleg || '',
        params,
      })
    }

    // ── Color grade ────────────────────────────────────────────────────────
    let pipeline = sharp(buffer)

    if (params.grayscale === true) pipeline = pipeline.grayscale()

    if (params.gamma && Math.abs(Number(params.gamma) - 1.0) > 0.01) {
      pipeline = pipeline.gamma(Math.max(0.1, Math.min(3.0, Number(params.gamma))))
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

    const result = await (pipeline.jpeg({ quality: 92 }).toBuffer() as Promise<Buffer>)

    return NextResponse.json({
      image: result.toString('base64'),
      uitleg: params.uitleg || '',
      params,
    })
  } catch (e: any) {
    const msg = e?.error?.error?.message || e?.message || 'Onbekende fout'
    const httpStatus = e?.status === 401 ? 401 : e?.status === 429 ? 429 : 500
    return NextResponse.json({ error: msg }, { status: httpStatus })
  }
}

export const maxDuration = 120
