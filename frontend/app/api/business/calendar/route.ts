import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

function getSupabase() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  )
}

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url)
  const maand = searchParams.get('maand')
  const jaar = searchParams.get('jaar')
  const supabase = getSupabase()

  let query = supabase.from('kalender').select('*').order('datum', { ascending: true })

  if (maand && jaar) {
    const m = parseInt(maand, 10)
    const j = parseInt(jaar, 10)
    const vanDatum = `${j}-${String(m).padStart(2, '0')}-01`
    const volgendeMaand = m === 12 ? 1 : m + 1
    const volgendeJaar = m === 12 ? j + 1 : j
    const totDatum = `${volgendeJaar}-${String(volgendeMaand).padStart(2, '0')}-01`
    query = query.gte('datum', vanDatum).lt('datum', totDatum)
  }

  const { data, error } = await query
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json({ items: data || [] })
}

export async function POST(request: NextRequest) {
  const body = await request.json()
  const supabase = getSupabase()
  const { data, error } = await supabase.from('kalender').insert(body).select().single()
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ id: data.id, message: 'Item toegevoegd' })
}
