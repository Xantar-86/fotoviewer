import { NextRequest, NextResponse } from 'next/server'
import sharp from 'sharp'

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData()
    const file = formData.get('file') as File
    const x = parseInt(formData.get('x') as string || '0')
    const y = parseInt(formData.get('y') as string || '0')
    const width = parseInt(formData.get('width') as string || '100')
    const height = parseInt(formData.get('height') as string || '100')
    const strength = parseFloat(formData.get('strength') as string || '15')

    const buffer = Buffer.from(await file.arrayBuffer())
    const meta = await sharp(buffer).metadata()
    const imgW = meta.width || 800
    const imgH = meta.height || 600

    // Clamp region to image bounds
    const rx = Math.max(0, x)
    const ry = Math.max(0, y)
    const rw = Math.min(width, imgW - rx)
    const rh = Math.min(height, imgH - ry)

    if (rw <= 0 || rh <= 0) {
      const result = await sharp(buffer).jpeg({ quality: 92 }).toBuffer()
      return NextResponse.json({ image: result.toString('base64') })
    }

    // Extract region, blur it, composite back
    const region = await sharp(buffer)
      .extract({ left: rx, top: ry, width: rw, height: rh })
      .blur(Math.max(1, strength))
      .toBuffer()

    const result = await sharp(buffer)
      .composite([{ input: region, left: rx, top: ry }])
      .jpeg({ quality: 92 })
      .toBuffer()

    return NextResponse.json({ image: result.toString('base64') })
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}
