import { NextRequest, NextResponse } from 'next/server'
import Anthropic from '@anthropic-ai/sdk'
import sharp from 'sharp'

async function translateToEnglish(prompt: string, anthropicKey: string): Promise<string> {
  const client = new Anthropic({ apiKey: anthropicKey })
  const response = await client.messages.create({
    model: 'claude-haiku-4-5-20251001',
    max_tokens: 150,
    messages: [{
      role: 'user',
      content: `Translate this background description to vivid English for an AI image generator. Return ONLY the English description, nothing else.\n\n"${prompt}"`,
    }],
  })
  return ((response.content[0] as any).text || prompt).trim().replace(/^"|"$/g, '')
}

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData()
    const file = formData.get('file') as File
    const anthropicKey = ((formData.get('anthropic_key') as string) || '').trim()
    const removeBgKey = ((formData.get('remove_bg_key') as string) || '').trim()
    const promptRaw = (formData.get('prompt') as string || '').trim()

    if (!file) return NextResponse.json({ error: 'Geen bestand ontvangen' }, { status: 400 })
    if (!promptRaw) return NextResponse.json({ error: 'Beschrijf de nieuwe achtergrond' }, { status: 400 })
    if (!removeBgKey) return NextResponse.json({ error: 'remove.bg API sleutel vereist. Voeg gratis toe bij Instellingen (50/maand).' }, { status: 400 })

    // Translate prompt to English for image generation
    const englishPrompt = anthropicKey
      ? await translateToEnglish(promptRaw, anthropicKey)
      : promptRaw

    // Step 1: Remove background from subject
    const removeBgForm = new FormData()
    removeBgForm.append('image_file', file)
    removeBgForm.append('size', 'auto')
    const removeBgRes = await fetch('https://api.remove.bg/v1.0/removebg', {
      method: 'POST',
      headers: { 'X-Api-Key': removeBgKey },
      body: removeBgForm,
    })
    if (!removeBgRes.ok) {
      let errMsg = `remove.bg fout (${removeBgRes.status})`
      try { errMsg = (await removeBgRes.json()).errors?.[0]?.title || errMsg } catch {}
      return NextResponse.json({ error: errMsg }, { status: 400 })
    }
    const subjectPng = Buffer.from(await removeBgRes.arrayBuffer())

    const meta = await sharp(subjectPng).metadata()
    const w = meta.width || 1080
    const h = meta.height || 1080

    // Step 2: Generate background via Pollinations.ai (free, no API key needed)
    const seed = Math.floor(Math.random() * 999999)
    const bgUrl = `https://image.pollinations.ai/prompt/${encodeURIComponent(englishPrompt)}?width=${w}&height=${h}&model=flux&nologo=true&seed=${seed}`
    const bgRes = await fetch(bgUrl, { signal: AbortSignal.timeout(90000) })
    if (!bgRes.ok) throw new Error(`Achtergrond genereren mislukt (${bgRes.status})`)
    const bgBuffer = Buffer.from(await bgRes.arrayBuffer())

    // Step 3: Composite subject over generated background
    const result = await (sharp(bgBuffer)
      .resize(w, h, { fit: 'cover' })
      .composite([{ input: subjectPng, blend: 'over' }])
      .jpeg({ quality: 92 })
      .toBuffer() as Promise<Buffer>)

    return NextResponse.json({
      image: result.toString('base64'),
      uitleg: `AI achtergrond gegenereerd: "${promptRaw}"`,
    })
  } catch (e: any) {
    const msg = e?.error?.error?.message || e?.message || 'Onbekende fout'
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}

export const maxDuration = 120
