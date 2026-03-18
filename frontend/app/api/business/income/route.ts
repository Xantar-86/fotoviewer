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
  const platform = searchParams.get('platform')
  const supabase = getSupabase()

  let query = supabase.from('inkomen').select('*').order('datum', { ascending: false })
  if (platform) query = query.eq('platform', platform)

  const { data, error } = await query
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  const total = (data || []).reduce((sum, item) => sum + item.bedrag, 0)
  return NextResponse.json({ items: data || [], total })
}

export async function POST(request: NextRequest) {
  const body = await request.json()
  const supabase = getSupabase()
  const { data, error } = await supabase.from('inkomen').insert(body).select().single()
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ id: data.id, message: 'Inkomen toegevoegd' })
}
