import { NextRequest, NextResponse } from 'next/server'
import sharp from 'sharp'

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData()
    const file = formData.get('file') as File
    if (!file) return NextResponse.json({ error: 'Geen bestand' }, { status: 400 })

    const buffer = Buffer.from(await file.arrayBuffer())
    // sharp strips all metadata by default (no .withMetadata() call)
    const result = await sharp(buffer).rotate().jpeg({ quality: 92 }).toBuffer()

    return new NextResponse(new Uint8Array(result), {
      headers: {
        'Content-Type': 'image/jpeg',
        'Content-Disposition': `attachment; filename="cleaned_${file.name}"`,
      },
    })
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}
