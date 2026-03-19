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
  FeetFinder: 'FeetFinder (foot content creator platform). Write an engaging, confident caption that highlights the appeal of the feet in the photo — skin tone, nail care, pose, softness. The caption should make viewers want to see more content. Keep it tasteful but compelling.',
  OnlyFans: 'OnlyFans (exclusive subscription platform). Write a personal, engaging caption from the creator to their fans. Highlight the exclusive nature of the content and make subscribers feel they are getting something special. Warm and personal tone.',
  Fansly: 'Fansly (premium creator platform). Write a confident, engaging caption that highlights what makes this content worth subscribing for. Focus on the mood, aesthetic, and exclusivity. Compelling and personal tone.',
  Instagram: 'Instagram (lifestyle and creator platform). Write an aesthetic, engaging caption focused on the visual appeal, mood, and lifestyle. Great composition for building a following. Confident and artistic tone.',
  Patreon: 'Patreon (creator support platform). Write a warm, appreciative caption from the creator to their supporters. Personal and grateful tone that makes fans feel valued for their support.',
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
            text: `You are a social media content assistant for: ${context}

Look at this photo and generate in Dutch:
- "beschrijving": An engaging 2-3 sentence caption written for this platform's audience. Not a neutral description — write it as the creator posting this photo, highlighting what makes it appealing. Use specific details from the photo (pose, skin, nails, setting, mood).
- "hashtags": 5-8 specific hashtags based on what you see in the photo (colors, pose, location, style details)

Respond with JSON only:
{"beschrijving": "...", "hashtags": ["tag1", "tag2"]}`,
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
