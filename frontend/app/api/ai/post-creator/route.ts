import { NextRequest, NextResponse } from 'next/server'
import Groq from 'groq-sdk'

function detectMediaType(file: File): string {
  const t = (file.type || '').toLowerCase()
  if (t === 'image/png') return 'image/png'
  if (t === 'image/gif') return 'image/gif'
  if (t === 'image/webp') return 'image/webp'
  return 'image/jpeg'
}

const PLATFORM_PROMPTS: Record<string, string> = {
  FeetFinder: `You are writing a caption for FeetFinder. Style: flirty, confident, teasing, focused on foot appeal. Max 2 sentences. Example: "Silky soft and oh so irresistible 🤍 Come find out why my fans keep coming back for more."`,
  OnlyFans: `You are writing a caption for OnlyFans. Style: intimate, personal, exclusive. Max 2 sentences. Example: "Just for my favorite people 💜 You already know what to do if you want more of this..."`,
  Fansly: `You are writing a caption for Fansly. Style: mysterious, teasing. Max 2 sentences. Example: "Not everyone gets to see this 🖤 Subscribe and find out what you've been missing."`,
  Instagram: `You are writing a caption for Instagram. Style: aesthetic, lifestyle, soft CTA. Max 2 sentences. Example: "Golden hour never looked this good ✨ Link in bio for exclusive content."`,
  Reddit: `You are writing a caption for Reddit. Style: casual, engaging, inviting comments. Max 2 sentences. Example: "Size EU 39, are they small enough for you? 🍑 Let me know what you think..."`,
  Twitter: `You are writing a caption for Twitter. Style: punchy, bold, teasing. Max 1-2 sentences. Example: "Small feet, big energy 🍑🔥 DM for customs 💌"`,
  Patreon: `You are writing a caption for Patreon. Style: warm, grateful, personal. Max 2 sentences.`,
}

async function generateForPlatform(
  b64: string,
  mediaType: string,
  platform: string,
  groq: Groq
): Promise<{ caption: string; hashtags: string[] }> {
  const platformPrompt = PLATFORM_PROMPTS[platform] || PLATFORM_PROMPTS['FeetFinder']

  const response = await groq.chat.completions.create({
    model: 'meta-llama/llama-4-scout-17b-16e-instruct',
    max_tokens: 512,
    temperature: 1.1,
    messages: [
      {
        role: 'system',
        content:
          'You are a content creator assistant for adult content platforms. Write unique, sensual captions. Always respond with valid JSON only: {"caption": "...", "hashtags": ["tag1", "tag2"]}',
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
            text: `${platformPrompt}

Look at this photo carefully and generate:
- "caption": a SHORT unique caption in English (max 2 sentences) — use specific visual details from THIS photo
- "hashtags": 5-8 specific hashtags relevant to the photo and platform

Respond with valid JSON only:
{"caption": "...", "hashtags": ["tag1", "tag2"]}`,
          },
        ],
      },
    ],
  } as any)

  const raw = (response.choices[0]?.message?.content || '').trim()

  // Extract JSON from response
  const cleaned = raw.replace(/^```(?:json)?\s*/i, '').replace(/\s*```\s*$/, '').trim()
  const match = cleaned.match(/\{[\s\S]*\}/)
  if (match) {
    try {
      const parsed = JSON.parse(match[0])
      if (parsed.caption) {
        return {
          caption: parsed.caption,
          hashtags: Array.isArray(parsed.hashtags) ? parsed.hashtags : [],
        }
      }
    } catch {}
  }

  // Fallback: extract caption from partial JSON
  const captionMatch = cleaned.match(/"caption"\s*:\s*"([\s\S]*?)(?:"|$)/)
  if (captionMatch?.[1]) {
    return { caption: captionMatch[1].trim(), hashtags: [] }
  }

  throw new Error(`Could not parse AI response for ${platform}: ${raw.slice(0, 200)}`)
}

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData()
    const file = formData.get('file') as File
    const platformsRaw = ((formData.get('platforms') as string) || '').trim()
    const groqKey = ((formData.get('groq_key') as string) || '').trim()

    if (!groqKey) {
      return NextResponse.json({ error: 'Groq API key required' }, { status: 400 })
    }
    if (!file) {
      return NextResponse.json({ error: 'No file received' }, { status: 400 })
    }
    if (!platformsRaw) {
      return NextResponse.json({ error: 'No platforms specified' }, { status: 400 })
    }

    const platforms = platformsRaw.split(',').map(p => p.trim()).filter(Boolean)
    const buffer = Buffer.from(await file.arrayBuffer())
    const b64 = buffer.toString('base64')
    const mediaType = detectMediaType(file)

    const groq = new Groq({ apiKey: groqKey })

    // Run all platform generations in parallel
    const entries = await Promise.all(
      platforms.map(async (platform) => {
        const result = await generateForPlatform(b64, mediaType, platform, groq)
        return [platform, result] as const
      })
    )

    const results: Record<string, { caption: string; hashtags: string[] }> = {}
    for (const [platform, result] of entries) {
      results[platform] = result
    }

    return NextResponse.json({ results })
  } catch (e: any) {
    const msg = e?.error?.error?.message || e?.message || 'Unknown error'
    const status = e?.status === 401 ? 401 : 500
    return NextResponse.json({ error: msg }, { status })
  }
}

export const maxDuration = 60
