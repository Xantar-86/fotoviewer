import { NextRequest, NextResponse } from 'next/server'

async function pollStabilityResult(id: string, apiKey: string): Promise<string> {
  for (let i = 0; i < 40; i++) {
    await new Promise((r) => setTimeout(r, 3000))
    const res = await fetch(`https://api.stability.ai/v2beta/results/${id}`, {
      headers: { Authorization: `Bearer ${apiKey}`, Accept: 'application/json' },
    })
    if (res.status === 202) continue // still processing
    if (res.ok) {
      const json = await res.json()
      if (json.image) return json.image as string
      throw new Error('Geen afbeelding in Stability AI respons')
    }
    let errMsg = `Stability AI fout (${res.status})`
    try {
      const err = await res.json()
      errMsg = err.message || err.errors?.[0]?.message || errMsg
    } catch {}
    throw new Error(errMsg)
  }
  throw new Error('Stability AI timeout — probeer opnieuw')
}

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
          Accept: 'application/json',
        },
        body: stabForm,
      }
    )

    if (!res.ok && res.status !== 202) {
      let errMsg = `Stability AI fout (${res.status})`
      try {
        const err = await res.json()
        errMsg = err.message || err.errors?.[0]?.message || errMsg
      } catch {}
      const httpStatus = res.status === 401 ? 401 : res.status === 402 ? 402 : 400
      return NextResponse.json({ error: errMsg }, { status: httpStatus })
    }

    const json = await res.json()

    let imageBase64: string
    if (res.status === 202) {
      // Async — poll for result
      imageBase64 = await pollStabilityResult(json.id, apiKey)
    } else {
      imageBase64 = json.image
    }

    return NextResponse.json({
      image: imageBase64,
      uitleg: `AI heeft de achtergrond vervangen met: "${prompt}"`,
    })
  } catch (e: any) {
    const msg = e?.message || 'Onbekende fout'
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}

export const maxDuration = 120
