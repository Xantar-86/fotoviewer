import { NextRequest, NextResponse } from 'next/server'
import sharp from 'sharp'

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData()
    const file = formData.get('file') as File
    const top = parseInt(formData.get('top') as string || '0')
    const right = parseInt(formData.get('right') as string || '0')
    const bottom = parseInt(formData.get('bottom') as string || '0')
    const left = parseInt(formData.get('left') as string || '0')

    const buffer = Buffer.from(await file.arrayBuffer())
    const meta = await sharp(buffer).metadata()
    const w = (meta.width || 800) - left - right
    const h = (meta.height || 600) - top - bottom

    if (w <= 0 || h <= 0) return NextResponse.json({ error: 'Crop te groot' }, { status: 400 })

    const result = await sharp(buffer)
      .rotate()
      .extract({ left, top, width: w, height: h })
      .jpeg({ quality: 92 })
      .toBuffer()

    return NextResponse.json({ image: result.toString('base64') })
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}
