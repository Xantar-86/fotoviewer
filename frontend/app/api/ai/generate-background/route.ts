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

async function generateWithPollinations(prompt: string, w: number, h: number): Promise<Buffer> {
  // Try with params first, fall back to no params
  const urls = [
    `https://image.pollinations.ai/prompt/${encodeURIComponent(prompt)}?width=${w}&height=${h}&seed=${Math.floor(Math.random() * 99999)}`,
    `https://image.pollinations.ai/prompt/${encodeURIComponent(prompt)}`,
  ]
  for (const url of urls) {
    try {
      const res = await fetch(url)
      if (res.ok) {
        const buf = Buffer.from(await res.arrayBuffer())
        // Verify it's an image (JPEG or PNG magic bytes)
        if ((buf[0] === 0xFF && buf[1] === 0xD8) || (buf[0] === 0x89 && buf[1] === 0x50)) {
          return buf
        }
      }
    } catch {}
  }
  throw new Error('Pollinations.ai kon geen afbeelding genereren. Probeer opnieuw of gebruik een kortere beschrijving.')
}

async function generateWithHuggingFace(prompt: string, hfKey: string): Promise<Buffer> {
  const res = await fetch(
    'https://router.huggingface.co/hf-inference/models/black-forest-labs/FLUX.1-schnell',
    {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${hfKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ inputs: prompt }),
    }
  )
  if (!res.ok) {
    const err = await res.text().catch(() => '')
    throw new Error(`HuggingFace fout (${res.status}): ${err.slice(0, 100)}`)
  }
  return Buffer.from(await res.arrayBuffer())
}

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData()
    const file = formData.get('file') as File
    const anthropicKey = ((formData.get('anthropic_key') as string) || '').trim()
    const removeBgKey = ((formData.get('remove_bg_key') as string) || '').trim()
    const hfKey = ((formData.get('hf_key') as string) || '').trim()
    const promptRaw = (formData.get('prompt') as string || '').trim()

    if (!file) return NextResponse.json({ error: 'Geen bestand ontvangen' }, { status: 400 })
    if (!promptRaw) return NextResponse.json({ error: 'Beschrijf de nieuwe achtergrond' }, { status: 400 })
    if (!removeBgKey) return NextResponse.json({ error: 'remove.bg API sleutel vereist. Voeg gratis toe bij Instellingen (50/maand).' }, { status: 400 })

    // Translate prompt to English
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
    const origW = meta.width || 1080
    const origH = meta.height || 1080

    // Cap to 1024px for generation
    const maxDim = 1024
    const scale = Math.min(1, maxDim / Math.max(origW, origH))
    const genW = Math.round((origW * scale) / 8) * 8
    const genH = Math.round((origH * scale) / 8) * 8

    // Step 2: Generate background (HuggingFace if key available, else Pollinations)
    let bgBuffer: Buffer
    if (hfKey) {
      bgBuffer = await generateWithHuggingFace(englishPrompt, hfKey)
    } else {
      bgBuffer = await generateWithPollinations(englishPrompt, genW, genH)
    }

    // Step 3: Composite subject over generated background
    const result = await (sharp(bgBuffer)
      .resize(origW, origH, { fit: 'cover' })
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
