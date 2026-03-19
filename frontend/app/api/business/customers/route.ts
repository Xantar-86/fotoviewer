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
  const geblokkeerdParam = searchParams.get('geblokkeerd')
  const supabase = getSupabase()

  let query = supabase.from('klanten').select('*').order('datum', { ascending: false })
  if (geblokkeerdParam !== null) {
    query = query.eq('geblokkeerd', geblokkeerdParam === 'true')
  }

  const { data, error } = await query
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ items: data || [] })
}

export async function POST(request: NextRequest) {
  const body = await request.json()
  const supabase = getSupabase()
  const { data, error } = await supabase.from('klanten').insert(body).select().single()
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ id: data.id, message: 'Klant toegevoegd' })
}
