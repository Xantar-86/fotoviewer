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
  FeetFinder: `FeetFinder is een platform waar creators voetenfoto's en -video's verkopen aan betalende kopers.
Schrijf een verleidelijke, zelfverzekerde caption (2-3 zinnen) die kopers aanspreekt.
Focus op wat de voeten zo aantrekkelijk maakt: zachtheid, huidtint, nagelverzorging, pose, sfeer.
Schrijf alsof je post om kopers aan te trekken. Toon: zelfverzekerd, uitnodigend, speels.`,

  OnlyFans: `OnlyFans is een abonnementsplatform waar fans betalen voor exclusieve content.
Schrijf een persoonlijke, exclusieve caption (2-3 zinnen) die fans het gevoel geeft dat dit speciaal voor hen is.
Maak hen nieuwsgierig en laat hen verlangen naar meer. Toon: intiem, persoonlijk, exclusief.`,

  Fansly: `Fansly is een premium creator platform.
Schrijf een mysterieuze, aantrekkelijke caption (2-3 zinnen) die hints geeft naar de content en volgers doet verlangen naar een abonnement.
Toon: mysterieus, zelfverzekerd, exclusief.`,

  Instagram: `Instagram is een publiek social media platform.
Schrijf een esthetische, aansprekende caption (2-3 zinnen) die mooi is en een breed publiek aanspreekt.
Goed om een volgersbase op te bouwen en mensen door te sturen naar betaalde platforms. Toon: zelfverzekerd, artistiek, lifestyle.`,

  Patreon: `Patreon is een fan-ondersteund creator platform.
Schrijf een warme, persoonlijke caption (2-3 zinnen) die supporters bedankt en hen het gevoel geeft dat ze iets speciaals krijgen.
Toon: warm, dankbaar, persoonlijk.`,
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
  const match = cleaned.match(/\{[\s\S]*\}/)
  if (!match) return null
  try {
    return JSON.parse(match[0])
  } catch {
    return null
  }
}

async function analyzeWithGroq(b64: string, mediaType: string, platform: string, groqKey: string) {
  const groq = new Groq({ apiKey: groqKey })
  const context = PLATFORM_CONTEXT[platform] || PLATFORM_CONTEXT['FeetFinder']

  const response = await groq.chat.completions.create({
    model: 'llama-3.2-90b-vision-preview',
    max_tokens: 500,
    messages: [
      {
        role: 'system',
        content: 'Je bent een content creator assistent. Antwoord altijd met alleen geldige JSON, geen markdown, geen uitleg.',
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

Analyseer deze foto en schrijf in het Nederlands:
- "beschrijving": een aansprekende caption van 2-3 zinnen voor dit platform
- "hashtags": 5-8 specifieke hashtags op basis van wat je ziet (kleuren, pose, locatie, sfeer, stijl)

JSON formaat:
{"beschrijving": "...", "hashtags": ["tag1", "tag2", "tag3"]}`,
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
