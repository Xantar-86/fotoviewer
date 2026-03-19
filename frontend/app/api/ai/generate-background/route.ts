import { NextRequest, NextResponse } from 'next/server'
import Anthropic from '@anthropic-ai/sdk'

async function translateToEnglish(prompt: string, anthropicKey: string): Promise<string> {
  const client = new Anthropic({ apiKey: anthropicKey })
  const response = await client.messages.create({
    model: 'claude-haiku-4-5-20251001',
    max_tokens: 200,
    messages: [{
      role: 'user',
      content: `Translate this background scene description to English for an AI image generator. Return ONLY the English translation, nothing else.\n\n"${prompt}"`,
    }],
  })
  return ((response.content[0] as any).text || prompt).trim()
}

async function pollStabilityResult(id: string, apiKey: string): Promise<string> {
  for (let i = 0; i < 40; i++) {
    await new Promise((r) => setTimeout(r, 3000))
    const res = await fetch(`https://api.stability.ai/v2beta/results/${id}`, {
      headers: { Authorization: `Bearer ${apiKey}`, Accept: 'application/json' },
    })
    if (res.status === 202) continue
    if (res.status === 200) {
      const json = await res.json()
      if (json.image) return json.image as string
      if (json.result) return json.result as string
      throw new Error('Geen afbeelding in poll respons: ' + JSON.stringify(json).slice(0, 200))
    }
    let errMsg = `Stability AI poll fout (${res.status})`
    try { const t = await res.text(); errMsg = t.slice(0, 200) || errMsg } catch {}
    throw new Error(errMsg)
  }
  throw new Error('Stability AI timeout — probeer opnieuw')
}

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData()
    const file = formData.get('file') as File
    const apiKey = ((formData.get('api_key') as string) || '').trim()
    const anthropicKey = ((formData.get('anthropic_key') as string) || '').trim()
    const promptRaw = (formData.get('prompt') as string || '').trim()

    if (!apiKey) return NextResponse.json({ error: 'Stability AI API sleutel vereist. Voeg toe bij Instellingen.' }, { status: 400 })
    if (!file) return NextResponse.json({ error: 'Geen bestand ontvangen' }, { status: 400 })
    if (!promptRaw) return NextResponse.json({ error: 'Beschrijf de nieuwe achtergrond' }, { status: 400 })

    // Translate to English (required by Stability AI)
    let prompt = promptRaw
    if (anthropicKey) {
      prompt = await translateToEnglish(promptRaw, anthropicKey)
    }

    const buffer = Buffer.from(await file.arrayBuffer())

    const stabForm = new FormData()
    stabForm.append(
      'subject_image',
      new Blob([buffer], { type: file.type || 'image/jpeg' }),
      'subject.jpg'
    )
    stabForm.append('background_prompt', prompt)
    stabForm.append('foreground_ratio', '0.9')
    stabForm.append('output_format', 'jpeg')

    const res = await fetch(
      'https://api.stability.ai/v2beta/stable-image/edit/replace-background-and-relight',
      {
        method: 'POST',
        headers: { Authorization: `Bearer ${apiKey}`, Accept: 'image/*' },
        body: stabForm,
      }
    )

    if (!res.ok && res.status !== 202) {
      let errMsg = `Stability AI fout (${res.status})`
      try { const t = await res.text(); errMsg = t.slice(0, 300) || errMsg } catch {}
      return NextResponse.json({ error: errMsg }, { status: res.status === 401 ? 401 : res.status === 402 ? 402 : 400 })
    }

    const bodyBytes = Buffer.from(await res.arrayBuffer())
    const isImage = (bodyBytes[0] === 0xFF && bodyBytes[1] === 0xD8) || (bodyBytes[0] === 0x89 && bodyBytes[1] === 0x50)

    if (isImage) {
      return NextResponse.json({
        image: bodyBytes.toString('base64'),
        uitleg: `AI achtergrond: "${promptRaw}"`,
      })
    }

    let json: any
    try { json = JSON.parse(bodyBytes.toString('utf8')) } catch {
      throw new Error('Onverwachte Stability AI respons: ' + bodyBytes.slice(0, 100).toString('utf8'))
    }

    if (json.id) {
      const imageBase64 = await pollStabilityResult(json.id, apiKey)
      return NextResponse.json({
        image: imageBase64,
        uitleg: `AI achtergrond: "${promptRaw}"`,
      })
    }

    const errMsg = json.errors?.[0] || json.message || JSON.stringify(json).slice(0, 200)
    return NextResponse.json({ error: errMsg }, { status: 400 })

  } catch (e: any) {
    const msg = e?.error?.error?.message || e?.message || 'Onbekende fout'
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}

export const maxDuration = 120
