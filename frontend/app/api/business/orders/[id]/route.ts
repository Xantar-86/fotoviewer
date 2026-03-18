import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

function getSupabase() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  )
}

export async function PUT(request: NextRequest, { params }: { params: { id: string } }) {
  const { searchParams } = new URL(request.url)
  const status = searchParams.get('status')
  const supabase = getSupabase()
  const { error } = await supabase
    .from('bestellingen')
    .update({ status })
    .eq('id', parseInt(params.id))
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ message: 'Status bijgewerkt' })
}

export async function DELETE(_: NextRequest, { params }: { params: { id: string } }) {
  const supabase = getSupabase()
  const { error } = await supabase.from('bestellingen').delete().eq('id', parseInt(params.id))
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ message: 'Verwijderd' })
}
