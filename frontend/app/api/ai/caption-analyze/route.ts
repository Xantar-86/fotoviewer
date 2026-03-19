import { NextRequest, NextResponse } from 'next/server'
import Anthropic from '@anthropic-ai/sdk'

function detectMediaType(file: File): 'image/jpeg' | 'image/png' | 'image/gif' | 'image/webp' {
  const t = (file.type || '').toLowerCase()
  if (t === 'image/png') return 'image/png'
  if (t === 'image/gif') return 'image/gif'
  if (t === 'image/webp') return 'image/webp'
  return 'image/jpeg'
}

const PLATFORM_CONTEXT: Record<string, string> = {
  FeetFinder: 'FeetFinder — a marketplace where creators sell foot photos and videos to paying buyers. Write a short, enticing sales description (2-3 sentences) that makes buyers want to purchase this content. Focus on what makes these feet desirable: softness, skin tone, nail style, pose, and the fantasy/appeal. Write as if posting to attract buyers. Tone: flirty, confident, teasing but tasteful.',
  OnlyFans: 'OnlyFans — a subscription platform where fans pay for exclusive content. Write a personal, teasing caption (2-3 sentences) that makes fans feel this is exclusive content just for them. Make them feel special and eager to subscribe or buy. Tone: intimate, personal, exclusive.',
  Fansly: 'Fansly — a premium fan platform. Write a mysterious, enticing caption (2-3 sentences) that teases the content and makes followers want to subscribe for more. Hint at what they are missing. Tone: mysterious, confident, exclusive.',
  Instagram: 'Instagram — public social media. Write an aesthetic, engaging caption (2-3 sentences) that is tasteful and visually focused. Great for building a following and directing people to paid platforms. Tone: confident, artistic, lifestyle-focused.',
  Patreon: 'Patreon — fan-supported creator platform. Write a warm, personal caption (2-3 sentences) thanking supporters and making them feel valued for supporting this exclusive content. Tone: warm, grateful, personal.',
}

const PLATFORM_HASHTAGS: Record<string, string[]> = {
  FeetFinder: ['feetfinder', 'feetmodel', 'footmodel', 'feetpics', 'barefeet', 'feetlovers', 'toes', 'prettyfeet', 'softfeet', 'feetphotography'],
  OnlyFans: ['onlyfans', 'onlyfanscreator', 'contentcreator', 'exclusive', 'subscribe', 'fanpage', 'model', 'creator'],
  Fansly: ['fansly', 'fanslymodel', 'contentcreator', 'exclusive', 'fanslycreator', 'subscribe'],
  Instagram: ['photography', 'model', 'aesthetic', 'lifestyle', 'content', 'creator', 'instagood', 'photooftheday'],
  Patreon: ['patreon', 'supporter', 'exclusive', 'behindthescenes', 'creator', 'thankyou'],
}

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData()
    const file = formData.get('file') as File
    const apiKey = ((formData.get('api_key') as string) || '').trim()
    const platform = ((formData.get('platform') as string) || 'FeetFinder').trim()

    if (!apiKey) return NextResponse.json({ error: 'API sleutel vereist' }, { status: 400 })
    if (!file) return NextResponse.json({ error: 'Geen bestand ontvangen' }, { status: 400 })

    const buffer = Buffer.from(await file.arrayBuffer())
    const b64 = buffer.toString('base64')
    const mediaType = detectMediaType(file)
    const context = PLATFORM_CONTEXT[platform] || PLATFORM_CONTEXT['FeetFinder']
    const baseHashtags = PLATFORM_HASHTAGS[platform] || []

    const client = new Anthropic({ apiKey })
    const response = await client.messages.create({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 500,
      system: 'You are a content creator assistant. Always respond with valid JSON only. No markdown, no explanation, just the JSON object.',
      messages: [{
        role: 'user',
        content: [
          { type: 'image', source: { type: 'base64', media_type: mediaType, data: b64 } },
          {
            type: 'text',
            text: `You are writing marketing copy for: ${context}

Look at the photo and write in Dutch:
- "beschrijving": A sales-oriented caption (2-3 sentences) written TO potential buyers/fans — not a neutral photo description, but enticing copy that makes people want to buy or subscribe. Use the specific visual details (skin, pose, nails, setting) to sell the appeal.
- "hashtags": 5-8 specific hashtags based on what you see (colors, pose, location, style, details visible in the photo)

JSON format:
{"beschrijving": "Verleidelijke verkooptekst hier.", "hashtags": ["tag1", "tag2", "tag3"]}`,
          },
        ],
      }],
    })

    const rawText = (response.content[0] as any).text.trim()

    // Strip markdown code fences if present
    const cleaned = rawText
      .replace(/^```(?:json)?\s*/i, '')
      .replace(/\s*```\s*$/, '')
      .trim()

    // Extract JSON object
    const match = cleaned.match(/\{[\s\S]*\}/)
    if (!match) {
      return NextResponse.json({ beschrijving: '', hashtags: baseHashtags })
    }

    let result: { beschrijving?: string; hashtags?: string[] }
    try {
      result = JSON.parse(match[0])
    } catch {
      return NextResponse.json({ beschrijving: '', hashtags: baseHashtags })
    }

    const allHashtags = [...new Set([...(result.hashtags || []), ...baseHashtags])]

    return NextResponse.json({
      beschrijving: result.beschrijving || '',
      hashtags: allHashtags,
    })
  } catch (e: any) {
    const msg = e?.error?.error?.message || e?.message || 'Onbekende fout'
    const status = e?.status === 401 ? 401 : 500
    return NextResponse.json({ error: msg }, { status })
  }
}

export const maxDuration = 30
