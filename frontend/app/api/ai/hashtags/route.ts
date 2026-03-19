import { NextRequest, NextResponse } from 'next/server'
import Anthropic from '@anthropic-ai/sdk'

function detectMediaType(file: File): 'image/jpeg' | 'image/png' | 'image/gif' | 'image/webp' {
  const t = (file.type || '').toLowerCase()
  if (t === 'image/png') return 'image/png'
  if (t === 'image/gif') return 'image/gif'
  if (t === 'image/webp') return 'image/webp'
  return 'image/jpeg'
}

const PLATFORM_HASHTAGS: Record<string, string[]> = {
  FeetFinder: [
    'feetfinder', 'feetmodel', 'footmodel', 'feetpics', 'barefeet',
    'feetlovers', 'toes', 'footfetish', 'prettyfeet', 'softfeet',
    'feetofinstagram', 'footcare', 'pedicure', 'feetphotography', 'footpose',
    'solefeet', 'naturalnails', 'toenails', 'cutefeet', 'feetgram',
  ],
  OnlyFans: [
    'onlyfans', 'onlyfanscreator', 'contentcreator', 'exclusive', 'subscribe',
    'fanpage', 'model', 'creator', 'onlyfansgirl', 'linkinbio',
    'adultcontent', 'exclusivecontent', 'fansonly', 'subscribenow', 'newpost',
  ],
  Fansly: [
    'fansly', 'fanslymodel', 'contentcreator', 'exclusive', 'fanslycreator',
    'subscribe', 'fanslypage', 'creator', 'fanslyexclusive', 'fanslylife',
    'exclusivecontent', 'fanslystar', 'onlinecreator', 'digitalcreator',
  ],
  Instagram: [
    'photography', 'model', 'aesthetic', 'lifestyle', 'content',
    'creator', 'instagood', 'photooftheday', 'instadaily', 'picoftheday',
    'instaphoto', 'photo', 'fashion', 'beauty', 'style',
    'pose', 'photoart', 'visualart', 'artphotography',
  ],
  Patreon: [
    'patreon', 'supporter', 'exclusive', 'behindthescenes', 'creator',
    'thankyou', 'patronsonly', 'supportme', 'createandshare', 'exclusiveaccess',
    'joinpatreon', 'communitybuilding', 'independentcreator',
  ],
}

const PLATFORM_PROMPT: Record<string, string> = {
  FeetFinder: 'FeetFinder (voetenfoto platform). Genereer hashtags gericht op voetenfoto liefhebbers, foot models, voet poses, nagels, texturen, en foot fetish community.',
  OnlyFans: 'OnlyFans (exclusief content platform). Genereer hashtags voor content creators, exclusieve content, abonnementen, en fan engagement.',
  Fansly: 'Fansly (exclusief content platform). Genereer hashtags die passen bij het Fansly platform en zijn creators en subscribers.',
  Instagram: 'Instagram (visueel social media). Genereer hashtags voor esthetische fotografie, lifestyle content, en brede Instagram reach.',
  Patreon: 'Patreon (fan-ondersteund platform). Genereer hashtags voor community building, exclusieve content, en creator support.',
}

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData()
    const apiKey = ((formData.get('api_key') as string) || '').trim()
    const platform = ((formData.get('platform') as string) || 'FeetFinder').trim()
    const file = formData.get('file') as File | null

    if (!apiKey) return NextResponse.json({ error: 'API sleutel vereist' }, { status: 400 })

    const client = new Anthropic({ apiKey })
    const baseHashtags = PLATFORM_HASHTAGS[platform] || PLATFORM_HASHTAGS['FeetFinder']
    const platformPrompt = PLATFORM_PROMPT[platform] || PLATFORM_PROMPT['FeetFinder']

    let messageContent: any[]

    if (file) {
      const buffer = Buffer.from(await file.arrayBuffer())
      const b64 = buffer.toString('base64')
      const mediaType = detectMediaType(file)
      messageContent = [
        { type: 'image', source: { type: 'base64', media_type: mediaType, data: b64 } },
        {
          type: 'text',
          text: `Je bent een social media expert voor ${platformPrompt}

Analyseer deze foto en genereer 20-25 relevante hashtags specifiek voor dit platform. Mix:
- Populaire platform-hashtags
- Foto-specifieke hashtags (kleur, pose, sfeer, locatie, lichaamsdeel, accessoires)
- Niche hashtags voor betere vindbaarheid
- Trending hashtags voor het platform

Return UITSLUITEND geldig JSON:
{"hashtags": ["tag1", "tag2", "tag3", ...]}`,
        },
      ]
    } else {
      messageContent = [
        {
          type: 'text',
          text: `Je bent een social media expert voor ${platformPrompt}

Genereer 25-30 krachtige hashtags voor dit platform. Mix:
- Populaire platform-hashtags met hoog bereik
- Niche hashtags voor gerichte doelgroep
- Trending hashtags in de community
- Engagement-boosting hashtags

Return UITSLUITEND geldig JSON:
{"hashtags": ["tag1", "tag2", "tag3", ...]}`,
        },
      ]
    }

    const response = await client.messages.create({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 400,
      messages: [{ role: 'user', content: messageContent }],
    })

    const text = (response.content[0] as any).text.trim()
    const match = text.match(/\{[\s\S]*\}/)
    if (!match) throw new Error('Ongeldige AI respons')

    const result = JSON.parse(match[0])
    const aiHashtags: string[] = (result.hashtags || []).map((h: string) =>
      h.startsWith('#') ? h.slice(1) : h
    )

    // Merge AI hashtags with platform defaults, deduplicated
    const allHashtags = [...new Set([...aiHashtags, ...baseHashtags])]

    return NextResponse.json({ hashtags: allHashtags })
  } catch (e: any) {
    const msg = e?.error?.error?.message || e?.message || 'Onbekende fout'
    const status = e?.status === 401 ? 401 : 500
    return NextResponse.json({ error: msg }, { status })
  }
}

export const maxDuration = 30
