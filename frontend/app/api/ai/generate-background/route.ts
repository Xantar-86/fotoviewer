import { NextRequest, NextResponse } from 'next/server'

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData()
    const file = formData.get('file') as File
    const apiKey = ((formData.get('api_key') as string) || '').trim()
    const prompt = (formData.get('prompt') as string || '').trim()

    if (!apiKey) return NextResponse.json({ error: 'Stability AI API sleutel vereist. Voeg toe bij Instellingen.' }, { status: 400 })
    if (!file) return NextResponse.json({ error: 'Geen bestand ontvangen' }, { status: 400 })
    if (!prompt) return NextResponse.json({ error: 'Beschrijf de nieuwe achtergrond' }, { status: 400 })

    const buffer = Buffer.from(await file.arrayBuffer())

    const stabForm = new FormData()
    stabForm.append(
      'subject_image',
      new Blob([buffer], { type: file.type || 'image/jpeg' }),
      'subject.jpg'
    )
    stabForm.append('background_prompt', prompt)
    stabForm.append('foreground_ratio', '0.9')
    stabForm.append('output_format', 'jpeg')

    const res = await fetch(
      'https://api.stability.ai/v2beta/stable-image/edit/replace-background-and-relight',
      {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${apiKey}`,
          Accept: 'image/*',
        },
        body: stabForm,
      }
    )

    if (!res.ok) {
      let errMsg = `Stability AI fout (${res.status})`
      try {
        const ct = res.headers.get('content-type') || ''
        if (ct.includes('json')) {
          const err = await res.json()
          errMsg = err.message || err.errors?.[0]?.message || errMsg
        }
      } catch {}
      const httpStatus = res.status === 401 ? 401 : res.status === 402 ? 402 : 400
      return NextResponse.json({ error: errMsg }, { status: httpStatus })
    }

    const imageBuffer = Buffer.from(await res.arrayBuffer())

    return NextResponse.json({
      image: imageBuffer.toString('base64'),
      uitleg: `AI heeft de achtergrond vervangen met: "${prompt}"`,
    })
  } catch (e: any) {
    const msg = e?.message || 'Onbekende fout'
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
