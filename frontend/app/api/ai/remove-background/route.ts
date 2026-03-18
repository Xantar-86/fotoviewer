import { NextRequest, NextResponse } from 'next/server'
import sharp from 'sharp'

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData()
    const file = formData.get('file') as File
    const apiKey = formData.get('api_key') as string // remove.bg API key
    const bgColor = (formData.get('bg_color') as string) || ''

    if (!file) return NextResponse.json({ error: 'Geen bestand ontvangen' }, { status: 400 })
    if (!apiKey) return NextResponse.json({ error: 'remove.bg API sleutel vereist' }, { status: 400 })

    // Call remove.bg API
    const removeBgForm = new FormData()
    removeBgForm.append('image_file', file)
    removeBgForm.append('size', 'auto')

    const removeBgRes = await fetch('https://api.remove.bg/v1.0/removebg', {
      method: 'POST',
      headers: { 'X-Api-Key': apiKey },
      body: removeBgForm,
    })

    if (!removeBgRes.ok) {
      const err = await removeBgRes.text()
      let msg = `remove.bg fout (${removeBgRes.status})`
      try {
        const parsed = JSON.parse(err)
        msg = parsed.errors?.[0]?.title || msg
      } catch {}
      return NextResponse.json({ error: msg }, { status: 400 })
    }

    const resultBuffer = Buffer.from(await removeBgRes.arrayBuffer())

    // If bg_color provided, composite over solid color background
    if (bgColor && /^#[0-9a-fA-F]{6}$/.test(bgColor)) {
      const hex = bgColor.replace('#', '')
      const r = parseInt(hex.slice(0, 2), 16)
      const g = parseInt(hex.slice(2, 4), 16)
      const b = parseInt(hex.slice(4, 6), 16)

      const meta = await sharp(resultBuffer).metadata()
      const w = meta.width || 1080
      const h = meta.height || 1080

      const bg = await sharp({
        create: { width: w, height: h, channels: 3, background: { r, g, b } },
      }).png().toBuffer()

      const composite = await sharp(bg)
        .composite([{ input: resultBuffer, blend: 'over' }])
        .jpeg({ quality: 92 })
        .toBuffer()

      return NextResponse.json({ image: composite.toString('base64'), format: 'jpeg' })
    }

    // Return transparent PNG
    return NextResponse.json({ image: resultBuffer.toString('base64'), format: 'png' })
  } catch (e: any) {
    return NextResponse.json({ error: e.message || 'Onbekende fout' }, { status: 500 })
  }
}
