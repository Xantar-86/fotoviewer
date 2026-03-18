import { NextRequest, NextResponse } from 'next/server'
import Anthropic from '@anthropic-ai/sdk'

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData()
    const file = formData.get('file') as File
    const apiKey = formData.get('api_key') as string

    const buffer = Buffer.from(await file.arrayBuffer())
    const b64 = buffer.toString('base64')

    const client = new Anthropic({ apiKey })
    const response = await client.messages.create({
      model: 'claude-opus-4-6',
      max_tokens: 512,
      messages: [{
        role: 'user',
        content: [
          { type: 'image', source: { type: 'base64', media_type: 'image/jpeg', data: b64 } },
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
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}
