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
    const groqKey = ((formData.get('groq_key') as string) || '').trim()
    const platform = ((formData.get('platform') as string) || 'FeetFinder').trim()
    const file = formData.get('file') as File | null

    if (!apiKey && !groqKey) return NextResponse.json({ error: 'API sleutel vereist' }, { status: 400 })

    const baseHashtags = PLATFORM_HASHTAGS[platform] || PLATFORM_HASHTAGS['FeetFinder']
    const platformPrompt = PLATFORM_PROMPT[platform] || PLATFORM_PROMPT['FeetFinder']

    const systemMsg = 'Je bent een social media hashtag expert. Antwoord altijd met alleen geldige JSON, geen markdown, geen uitleg.'

    let rawText = ''

    if (groqKey) {
      const groq = new Groq({ apiKey: groqKey })
      let userContent: any[]

      if (file) {
        const buffer = Buffer.from(await file.arrayBuffer())
        const b64 = buffer.toString('base64')
        const mediaType = detectMediaType(file)
        userContent = [
          { type: 'image_url', image_url: { url: `data:${mediaType};base64,${b64}` } },
          { type: 'text', text: `Genereer 20-25 hashtags voor ${platformPrompt}\n\nAnalyseer de foto: gebruik foto-specifieke tags (kleur, pose, sfeer, locatie) + platform-specifieke tags.\n\nJSON: {"hashtags": ["tag1", "tag2"]}` },
        ]
      } else {
        userContent = [
          { type: 'text', text: `Genereer 25-30 krachtige hashtags voor ${platformPrompt}\n\nMix populaire, niche en trending hashtags.\n\nJSON: {"hashtags": ["tag1", "tag2"]}` },
        ]
      }

      const res = await (groq.chat.completions.create as any)({
        model: 'llama-3.2-90b-vision-preview',
        max_tokens: 400,
        messages: [{ role: 'system', content: systemMsg }, { role: 'user', content: userContent }],
      })
      rawText = (res.choices[0]?.message?.content || '').trim()
    } else {
      const client = new Anthropic({ apiKey })
      let messageContent: any[]

      if (file) {
        const buffer = Buffer.from(await file.arrayBuffer())
        const b64 = buffer.toString('base64')
        const mediaType = detectMediaType(file)
        messageContent = [
          { type: 'image', source: { type: 'base64', media_type: mediaType, data: b64 } },
          { type: 'text', text: `Genereer 20-25 hashtags voor ${platformPrompt}\n\nAnalyseer de foto. JSON: {"hashtags": ["tag1", "tag2"]}` },
        ]
      } else {
        messageContent = [
          { type: 'text', text: `Genereer 25-30 hashtags voor ${platformPrompt}\n\nJSON: {"hashtags": ["tag1", "tag2"]}` },
        ]
      }

      const response = await client.messages.create({
        model: 'claude-haiku-4-5-20251001',
        max_tokens: 400,
        system: systemMsg,
        messages: [{ role: 'user', content: messageContent }],
      })
      rawText = ((response.content[0] as any).text || '').trim()
    }

    const cleaned = rawText.replace(/^```(?:json)?\s*/i, '').replace(/\s*```\s*$/, '').trim()
    const match = cleaned.match(/\{[\s\S]*\}/)
    const result = match ? JSON.parse(match[0]) : {}
    const aiHashtags: string[] = (result.hashtags || []).map((h: string) =>
      h.startsWith('#') ? h.slice(1) : h
    )
    const allHashtags = [...new Set([...aiHashtags, ...baseHashtags])]

    return NextResponse.json({ hashtags: allHashtags })
  } catch (e: any) {
    const msg = e?.error?.error?.message || e?.message || 'Onbekende fout'
    const status = e?.status === 401 ? 401 : 500
    return NextResponse.json({ error: msg }, { status })
  }
}

export const maxDuration = 30
