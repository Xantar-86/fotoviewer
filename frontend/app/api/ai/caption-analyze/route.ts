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
  FeetFinder: 'FeetFinder (foot photography platform). Describe the photo focusing on: foot pose, skin texture, nail care, lighting quality, composition, and overall aesthetic appeal. Write a creative, engaging description for a foot photography audience.',
  OnlyFans: 'OnlyFans (exclusive content platform). Describe the photo focusing on: mood, atmosphere, composition, lighting, outfit/styling, and the overall vibe. Write a personal and engaging description for subscribers.',
  Fansly: 'Fansly (exclusive creator platform). Describe the photo focusing on: the unique atmosphere, styling, composition, and what makes this content special. Write a description that highlights the exclusive nature.',
  Instagram: 'Instagram (visual social media). Describe the photo focusing on: artistic composition, lighting, color palette, mood, and aesthetic. Write a professional, visually-focused description.',
  Patreon: 'Patreon (fan-supported creator platform). Describe the photo warmly and personally, focusing on: what went into creating it, the mood, styling, and why supporters will appreciate it.',
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
      messages: [{
        role: 'user',
        content: [
          { type: 'image', source: { type: 'base64', media_type: mediaType, data: b64 } },
          {
            type: 'text',
            text: `You are a content creator assistant for ${context}

Analyze this photo and generate in Dutch:
1. A platform-specific description (2-3 sentences) capturing the mood, style, and key visual elements.
2. 5-8 specific hashtags based on what you see (colors, pose, location, mood, style details).

Return ONLY valid JSON, nothing else:
{"beschrijving": "...", "hashtags": ["tag1", "tag2", "tag3"]}`,
          },
        ],
      }],
    })

    const rawText = (response.content[0] as any).text.trim()

    // Try to extract JSON from the response
    const match = rawText.match(/\{[\s\S]*?\}(?=\s*$)/) || rawText.match(/\{[\s\S]*\}/)
    if (!match) {
      // Return a fallback using just the platform defaults if AI doesn't return JSON
      return NextResponse.json({
        beschrijving: '',
        hashtags: baseHashtags,
      })
    }

    let result: { beschrijving?: string; hashtags?: string[] }
    try {
      result = JSON.parse(match[0])
    } catch {
      return NextResponse.json({
        beschrijving: '',
        hashtags: baseHashtags,
      })
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
