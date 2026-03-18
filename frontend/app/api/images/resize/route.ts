import { NextRequest, NextResponse } from 'next/server'
import sharp from 'sharp'

const PLATFORM_PRESETS: Record<string, { w: number; h: number; mode: string; description: string }> = {
  "FeetFinder":        { w: 1080, h: 1080, mode: "cover", description: "Vierkant profiel (1080x1080)" },
  "FeetFinder_Banner": { w: 1500, h: 500,  mode: "cover", description: "Banner (1500x500)" },
  "OnlyFans":          { w: 1080, h: 1350, mode: "cover", description: "Portret (1080x1350)" },
  "OnlyFans_Cover":    { w: 1600, h: 400,  mode: "cover", description: "Cover foto (1600x400)" },
  "Instagram_Post":    { w: 1080, h: 1080, mode: "cover", description: "Instagram post (1080x1080)" },
  "Instagram_Story":   { w: 1080, h: 1920, mode: "cover", description: "Instagram story (1080x1920)" },
  "Twitter":           { w: 1200, h: 675,  mode: "cover", description: "Twitter/X post (1200x675)" },
  "Patreon":           { w: 1600, h: 400,  mode: "cover", description: "Patreon cover (1600x400)" },
  "Fansly":            { w: 1080, h: 1080, mode: "cover", description: "Fansly post (1080x1080)" },
}

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData()
    const file = formData.get('file') as File
    const platform = formData.get('platform') as string || 'FeetFinder'

    const preset = PLATFORM_PRESETS[platform]
    if (!preset) return NextResponse.json({ error: 'Onbekend platform' }, { status: 400 })

    const buffer = Buffer.from(await file.arrayBuffer())
    const result = await sharp(buffer)
      .rotate()
      .resize({
        width: preset.w,
        height: preset.h,
        fit: preset.mode === 'cover' ? 'cover' : 'contain',
        background: { r: 0, g: 0, b: 0, alpha: 1 },
      })
      .jpeg({ quality: 92 })
      .toBuffer()

    return NextResponse.json({ image: result.toString('base64'), width: preset.w, height: preset.h })
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}
