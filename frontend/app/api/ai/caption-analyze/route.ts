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
  FeetFinder: 'FeetFinder (een platform voor voetenfoto\'s en -video\'s). Beschrijf de foto vanuit het perspectief van een voetenfotograaf: de pose, de textuur, de uitstraling, de aantrekkingskracht van de voeten/benen. Gebruik een verleidelijke maar niet expliciete toon.',
  OnlyFans: 'OnlyFans (een exclusief contentplatform). Beschrijf de foto op een verleidelijke en persoonlijke manier die fans aanspreekt. Focus op de stemming, uitstraling en het exclusieve gevoel.',
  Fansly: 'Fansly (een contentplatform voor exclusieve creators). Schrijf een beschrijving die de mysterieuze en exclusieve uitstraling van de foto benadrukt. Persoonlijk en aantrekkelijk.',
  Instagram: 'Instagram (een visueel social media platform). Beschrijf de foto op een professionele, artistieke manier. Focus op de esthetiek, lichtval, compositie en sfeer.',
  Patreon: 'Patreon (een platform voor fan-ondersteunde creators). Schrijf een warme, persoonlijke beschrijving die fans het gevoel geeft dat ze iets speciaals krijgen.',
}

const PLATFORM_HASHTAGS: Record<string, string[]> = {
  FeetFinder: ['feetfinder', 'feetmodel', 'footmodel', 'feetpics', 'barefeet', 'feetlovers', 'toes', 'footfetish', 'prettyfeet', 'softfeet'],
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
      max_tokens: 400,
      messages: [{
        role: 'user',
        content: [
          { type: 'image', source: { type: 'base64', media_type: mediaType, data: b64 } },
          {
            type: 'text',
            text: `Je bent een ervaren content creator voor ${context}

Analyseer deze foto en genereer:
1. Een aantrekkelijke, platform-specifieke beschrijving (2-3 zinnen) die de stemming en aantrekkingskracht beschrijft — NIET alleen wat er te zien is, maar hoe het voelt en aantrekt.
2. 5-8 specifieke hashtags gebaseerd op wat je ziet op de foto (kleur, pose, locatie, sfeer).

Return UITSLUITEND geldig JSON:
{"beschrijving": "...", "hashtags": ["tag1", "tag2", "tag3"]}`,
          },
        ],
      }],
    })

    const text = (response.content[0] as any).text.trim()
    const match = text.match(/\{[\s\S]*\}/)
    if (!match) throw new Error('Ongeldige AI respons')

    const result = JSON.parse(match[0])

    // Merge photo-specific hashtags with platform defaults (deduplicated)
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
