import { NextRequest, NextResponse } from 'next/server'
import sharp from 'sharp'

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData()
    const file = formData.get('file') as File
    const brightness = parseFloat(formData.get('brightness') as string || '1')
    const contrast = parseFloat(formData.get('contrast') as string || '1')
    const color = parseFloat(formData.get('color') as string || '1')
    const sharpness = parseFloat(formData.get('sharpness') as string || '1')

    const buffer = Buffer.from(await file.arrayBuffer())
    let pipeline = sharp(buffer).rotate()

    if (brightness !== 1.0 || color !== 1.0) {
      pipeline = pipeline.modulate({ brightness, saturation: color })
    }
    if (contrast !== 1.0) {
      pipeline = pipeline.linear(contrast, -(128 * (contrast - 1)))
    }
    if (sharpness > 1.0) {
      pipeline = pipeline.sharpen({ sigma: sharpness * 1.5 })
    }

    const result = await pipeline.jpeg({ quality: 92 }).toBuffer()
    const encoded = result.toString('base64')
    return NextResponse.json({ image: encoded, filename: file.name })
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}
