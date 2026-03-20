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
  FeetFinder: `Je schrijft een verleidelijke verkooptekst voor FeetFinder, een platform waar voetenfoto's worden verkocht.
Schrijf een flirterige, zelfverzekerde caption van 2-3 zinnen VANUIT de creator, gericht aan potentiële kopers.
Focus op de aantrekkingskracht van de voeten op de foto: de zachtheid, huidtint, nagels, pose.
Maak de koper nieuwsgierig en laat hen verlangen naar meer. Eindig met een uitnodiging.
Voorbeeld: "Deze zachte, perfecte voeten wachten op jou 🤍 Voel de zijdezachte huid en ontdek waarom mijn fans steeds terugkomen voor meer. Wil jij ook toegang?"`,

  OnlyFans: `Je schrijft een intieme, exclusieve caption voor OnlyFans.
Schrijf een persoonlijke caption van 2-3 zinnen VANUIT de creator, alsof je rechtstreeks tegen je fans spreekt.
Geef hen het gevoel dat dit content speciaal voor hen is. Teasend, warm, exclusief.
Maak hen verlangen naar een abonnement. Gebruik eventueel een emoji.
Voorbeeld: "Speciaal voor mijn liefste fans 💜 Dit is precies het soort content dat jullie me altijd vragen. Abonneer je en krijg elke week meer van dit."`,

  Fansly: `Je schrijft een mysterieuze, verleidelijke caption voor Fansly.
Schrijf een teasende caption van 2-3 zinnen VANUIT de creator.
Hint naar wat abonnees te wachten staat zonder alles te onthullen. Mysterieus en zelfverzekerd.
Voorbeeld: "Niet iedereen mag dit zien 🖤 Alleen mijn subscribers weten wat er nog meer is. Durf jij een kijkje te nemen?"`,

  Instagram: `Je schrijft een esthetische lifestyle caption voor Instagram.
Schrijf een zelfverzekerde, artistieke caption van 2-3 zinnen VANUIT de creator.
Focus op sfeer, esthetiek en lifestyle. Aansprekend voor een breed publiek, met link in bio verwijzing.
Voorbeeld: "Soft, golden hour vibes ✨ Soms is het de kleine dingen die het verschil maken. Link in bio voor meer exclusieve content."`,

  Patreon: `Je schrijft een warme, persoonlijke caption voor Patreon.
Schrijf een dankbare caption van 2-3 zinnen VANUIT de creator, gericht aan supporters.
Geef hen het gevoel dat ze iets speciaals krijgen als beloning voor hun support. Warm en oprecht.
Voorbeeld: "Dit is speciaal voor jullie, mijn trouwste supporters 💖 Zonder jullie zou dit niet mogelijk zijn. Geniet van deze exclusieve content als dankjewel."`,
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
    model: 'meta-llama/llama-4-scout-17b-16e-instruct',
    max_tokens: 1024,
    temperature: 1.1,
    messages: [
      {
        role: 'system',
        content: 'Je bent een creatieve content creator assistent. Schrijf elke keer een unieke, frisse caption — nooit dezelfde formule herhalen. Varieer in opbouw, woordkeuze en toon. Antwoord altijd met alleen geldige JSON, geen markdown, geen uitleg.',
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
- "beschrijving": een unieke, aansprekende caption van 2-3 zinnen voor dit platform — gebruik specifieke details van DEZE foto (kleur, pose, locatie, nagels, sfeer). Varieer je stijl: soms beginnen met een vraag, soms met een statement, soms met een emoji.
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
