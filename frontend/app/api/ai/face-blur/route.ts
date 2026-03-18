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

    if (!apiKey) return NextResponse.json({ error: 'Anthropic API sleutel vereist' }, { status: 400 })
    if (!file) return NextResponse.json({ error: 'Geen bestand ontvangen' }, { status: 400 })

    const buffer = Buffer.from(await file.arrayBuffer())
    const b64 = buffer.toString('base64')
    const mediaType = detectMediaType(file)

    // Step 1: Ask Claude to detect faces and return bounding boxes
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
            text: `Detecteer alle gezichten in deze afbeelding. Geef de exacte locatie van elk gezicht als fractie van de afbeeldingsdimensies.

Return UITSLUITEND geldig JSON (geen tekst eromheen):
{
  "faces": [
    {"x": 0.25, "y": 0.10, "width": 0.20, "height": 0.28}
  ],
  "count": 1
}

Regels:
- x, y = linkerbovenhoek (fractie 0.0-1.0)
- width, height = breedte en hoogte (fractie 0.0-1.0)
- Voeg automatisch 15% extra padding toe rondom elk gezicht
- Als er geen gezichten zijn: {"faces": [], "count": 0}
- Detecteer ook gedeeltelijk zichtbare gezichten`,
          },
        ],
      }],
    })

    const text = (response.content[0] as any).text.trim()
    const match = text.match(/\{[\s\S]*\}/)
    if (!match) throw new Error('Claude gaf geen geldige coördinaten terug')

    const parsed = JSON.parse(match[0])
    const faces: Array<{ x: number; y: number; width: number; height: number }> = parsed.faces || []

    if (faces.length === 0) {
      return NextResponse.json({
        image: null,
        facesDetected: 0,
        message: 'Geen gezichten gevonden in de foto',
      })
    }

    // Step 2: Get image dimensions
    const meta = await sharp(buffer).metadata()
    const imgW = meta.width!
    const imgH = meta.height!

    // Step 3: Blur each detected face iteratively
    let currentBuffer: Buffer = buffer
    for (const face of faces) {
      const left = Math.max(0, Math.floor(face.x * imgW))
      const top = Math.max(0, Math.floor(face.y * imgH))
      const width = Math.min(imgW - left, Math.ceil(face.width * imgW))
      const height = Math.min(imgH - top, Math.ceil(face.height * imgH))

      if (width < 2 || height < 2) continue

      const blurredFace = await sharp(currentBuffer)
        .extract({ left, top, width, height })
        .blur(28)
        .toBuffer()

      currentBuffer = await sharp(currentBuffer)
        .composite([{ input: blurredFace, left, top }])
        .toBuffer()
    }

    const result = await sharp(currentBuffer)
      .jpeg({ quality: 90 })
      .toBuffer()

    return NextResponse.json({
      image: result.toString('base64'),
      facesDetected: faces.length,
      message: `${faces.length} gezicht${faces.length > 1 ? 'en' : ''} gedetecteerd en geblurd`,
    })
  } catch (e: any) {
    const msg = e?.error?.error?.message || e?.message || 'Onbekende fout'
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
