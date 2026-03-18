import { NextRequest, NextResponse } from 'next/server'
import sharp from 'sharp'

function hexToRgb(hex: string) {
  const r = parseInt(hex.slice(1, 3), 16)
  const g = parseInt(hex.slice(3, 5), 16)
  const b = parseInt(hex.slice(5, 7), 16)
  return { r, g, b }
}

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData()
    const file = formData.get('file') as File
    const text = formData.get('text') as string || '© FeetBusiness'
    const position = formData.get('position') as string || 'bottom-right'
    const opacity = parseInt(formData.get('opacity') as string || '180')
    const fontSize = parseInt(formData.get('font_size') as string || '36')
    const color = formData.get('color') as string || '#ffffff'

    const buffer = Buffer.from(await file.arrayBuffer())
    const meta = await sharp(buffer).metadata()
    const w = meta.width || 800
    const h = meta.height || 600

    const { r, g, b } = hexToRgb(color)
    const alpha = (opacity / 255).toFixed(2)
    const shadowAlpha = (opacity / 255 * 0.5).toFixed(2)

    // Estimate text dimensions
    const textWidth = Math.round(fontSize * 0.6 * text.length)
    const textHeight = fontSize
    const pad = 20

    const positions: Record<string, { x: number; y: number }> = {
      'top-left':     { x: pad, y: pad + textHeight },
      'top-right':    { x: w - textWidth - pad, y: pad + textHeight },
      'bottom-left':  { x: pad, y: h - pad },
      'bottom-right': { x: w - textWidth - pad, y: h - pad },
      'center':       { x: (w - textWidth) / 2, y: (h + textHeight) / 2 },
    }
    const { x, y } = positions[position] || positions['bottom-right']

    const svg = `<svg width="${w}" height="${h}" xmlns="http://www.w3.org/2000/svg">
      <text x="${x + 2}" y="${y + 2}" font-size="${fontSize}" font-family="Arial, sans-serif" font-weight="bold" fill="rgba(0,0,0,${shadowAlpha})">${text}</text>
      <text x="${x}" y="${y}" font-size="${fontSize}" font-family="Arial, sans-serif" font-weight="bold" fill="rgba(${r},${g},${b},${alpha})">${text}</text>
    </svg>`

    const result = await sharp(buffer)
      .composite([{ input: Buffer.from(svg), gravity: 'northwest' }])
      .jpeg({ quality: 92 })
      .toBuffer()

    return NextResponse.json({ image: result.toString('base64') })
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}
