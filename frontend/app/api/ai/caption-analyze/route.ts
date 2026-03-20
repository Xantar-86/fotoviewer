import { NextRequest, NextResponse } from 'next/server'
import Anthropic from '@anthropic-ai/sdk'
import Groq from 'groq-sdk'

function detectMediaType(file: File): 'image/jpeg' | 'image/png' | 'image/gif' | 'image/webp' {
  const t = (file.type || '').toLowerCase()
  if (t === 'image/png') return 'image/png'
  if (t === 'image/gif') return 'image/gif'
  if (t === 'image/webp') return 'image/webp'
  return 'image/jpeg'
}

const PLATFORM_CONTEXT: Record<string, string> = {
  FeetFinder: `Write a short, seductive FeetFinder caption in ENGLISH. Max 2 sentences. Written by the creator to potential buyers.
Flirty, confident, teasing. Use the specific details you see in the photo (skin tone, nails, pose). End with a hook.
Example: "Silky soft and oh so irresistible 🤍 Come find out why my fans keep coming back for more."`,

  OnlyFans: `Write a short, intimate OnlyFans caption in ENGLISH. Max 2 sentences. Written by the creator directly to fans.
Personal, exclusive, warm. Make them feel this was made just for them.
Example: "Just for my favorite people 💜 You already know what to do if you want more of this..."`,

  Fansly: `Write a short, mysterious Fansly caption in ENGLISH. Max 2 sentences. Written by the creator.
Teasing, confident, leave them wanting more. Don't reveal everything.
Example: "Not everyone gets to see this 🖤 Subscribe and find out what you've been missing."`,

  Instagram: `Write a short, aesthetic Instagram caption in ENGLISH. Max 2 sentences. Written by the creator.
Lifestyle, confident, visually focused. Add a soft call to action.
Example: "Golden hour never looked this good ✨ Link in bio for exclusive content."`,

  Patreon: `Write a short, warm Patreon caption in ENGLISH. Max 2 sentences. Written by the creator to supporters.
Grateful, personal, make them feel valued.
Example: "This one's just for you 💖 Thank you for making this possible, enjoy."`,
}

const PLATFORM_HASHTAGS: Record<string, string[]> = {
  FeetFinder: ['feetfinder', 'feetmodel', 'footmodel', 'feetpics', 'barefeet', 'feetlovers', 'toes', 'prettyfeet', 'softfeet', 'feetphotography'],
  OnlyFans: ['onlyfans', 'onlyfanscreator', 'contentcreator', 'exclusive', 'subscribe', 'fanpage', 'model', 'creator'],
  Fansly: ['fansly', 'fanslymodel', 'contentcreator', 'exclusive', 'fanslycreator', 'subscribe'],
  Instagram: ['photography', 'model', 'aesthetic', 'lifestyle', 'content', 'creator', 'instagood', 'photooftheday'],
  Patreon: ['patreon', 'supporter', 'exclusive', 'behindthescenes', 'creator', 'thankyou'],
}

function extractJson(text: string): { beschrijving?: string; hashtags?: string[] } | null {
  const cleaned = text.replace(/^```(?:json)?\s*/i, '').replace(/\s*```\s*$/, '').trim()

  // Try full JSON parse first
  const match = cleaned.match(/\{[\s\S]*\}/)
  if (match) {
    try {
      const parsed = JSON.parse(match[0])
      if (parsed.beschrijving) return parsed
    } catch {}
  }

  // Fallback: extract beschrijving even from truncated/incomplete JSON
  const descMatch = cleaned.match(/"beschrijving"\s*:\s*"([\s\S]*?)(?:"|$)/)
  if (descMatch && descMatch[1] && descMatch[1].length > 20) {
    // Extract hashtags separately if present
    const hashMatch = cleaned.match(/"hashtags"\s*:\s*\[([^\]]*)\]/)
    const hashtags: string[] = []
    if (hashMatch) {
      const tagMatches = hashMatch[1].matchAll(/"([^"]+)"/g)
      for (const m of tagMatches) hashtags.push(m[1])
    }
    return { beschrijving: descMatch[1].replace(/\\n/g, ' ').trim(), hashtags }
  }

  return null
}

async function analyzeWithGroq(b64: string, mediaType: string, platform: string, groqKey: string) {
  const groq = new Groq({ apiKey: groqKey })
  const context = PLATFORM_CONTEXT[platform] || PLATFORM_CONTEXT['FeetFinder']

  const response = await groq.chat.completions.create({
    model: 'meta-llama/llama-4-scout-17b-16e-instruct',
    max_tokens: 2048,
    temperature: 1.1,
    messages: [
      {
        role: 'system',
        content: 'You are a creative content creator assistant. Write a unique caption every time — never repeat the same formula. Vary the opening, wording and tone. Always respond with valid JSON only, no markdown, no explanation.',
      },
      {
        role: 'user',
        content: [
          {
            type: 'image_url',
            image_url: { url: `data:${mediaType};base64,${b64}` },
          },
          {
            type: 'text',
            text: `${context}

Look at this photo and generate:
- "beschrijving": a SHORT unique caption in ENGLISH (max 2 sentences) — use specific details from THIS photo (color, pose, nails, skin, setting). Vary your style each time.
- "hashtags": 5-8 specific hashtags based on what you see

JSON only:
{"beschrijving": "...", "hashtags": ["tag1", "tag2"]}`,
          },
        ],
      },
    ],
  } as any)

  return (response.choices[0]?.message?.content || '').trim()
}

async function analyzeWithClaude(b64: string, mediaType: string, platform: string, anthropicKey: string) {
  const client = new Anthropic({ apiKey: anthropicKey })
  const context = PLATFORM_CONTEXT[platform] || PLATFORM_CONTEXT['FeetFinder']

  const response = await client.messages.create({
    model: 'claude-haiku-4-5-20251001',
    max_tokens: 500,
    system: 'You are a content creator assistant. Always respond with valid JSON only. No markdown, no explanation.',
    messages: [{
      role: 'user',
      content: [
        { type: 'image', source: { type: 'base64', media_type: mediaType as any, data: b64 } },
        {
          type: 'text',
          text: `${context}

Analyze this photo and write in Dutch:
- "beschrijving": an engaging 2-3 sentence caption for this platform
- "hashtags": 5-8 specific hashtags based on what you see

JSON only:
{"beschrijving": "...", "hashtags": ["tag1", "tag2"]}`,
        },
      ],
    }],
  })

  return ((response.content[0] as any).text || '').trim()
}

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData()
    const file = formData.get('file') as File
    const anthropicKey = ((formData.get('api_key') as string) || '').trim()
    const groqKey = ((formData.get('groq_key') as string) || '').trim()
    const platform = ((formData.get('platform') as string) || 'FeetFinder').trim()

    if (!anthropicKey && !groqKey) {
      return NextResponse.json({ error: 'API sleutel vereist (Anthropic of Groq)' }, { status: 400 })
    }
    if (!file) return NextResponse.json({ error: 'Geen bestand ontvangen' }, { status: 400 })

    const buffer = Buffer.from(await file.arrayBuffer())
    const b64 = buffer.toString('base64')
    const mediaType = detectMediaType(file)
    const baseHashtags = PLATFORM_HASHTAGS[platform] || []

    // Use Groq if key available, otherwise fall back to Claude
    let rawText = ''
    if (groqKey) {
      rawText = await analyzeWithGroq(b64, mediaType, platform, groqKey)
    } else {
      rawText = await analyzeWithClaude(b64, mediaType, platform, anthropicKey)
    }

    const result = extractJson(rawText)
    if (!result || !result.beschrijving) {
      // Return raw text as error so frontend can show it
      return NextResponse.json(
        { error: `AI gaf geen geldige beschrijving. Antwoord: ${rawText.slice(0, 200)}` },
        { status: 500 }
      )
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
