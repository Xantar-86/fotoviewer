import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

function getSupabase() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  )
}

function calcBtw(bedrag: number) {
  const btw_21 = bedrag - bedrag / 1.21
  const btw_netto = bedrag / 1.21
  return { btw_21, btw_netto }
}

const QUARTERS = [
  { kwartaal: 'Q1', van: 'jan', tot: 'mrt', startMonth: 1, endMonth: 3 },
  { kwartaal: 'Q2', van: 'apr', tot: 'jun', startMonth: 4, endMonth: 6 },
  { kwartaal: 'Q3', van: 'jul', tot: 'sep', startMonth: 7, endMonth: 9 },
  { kwartaal: 'Q4', van: 'okt', tot: 'dec', startMonth: 10, endMonth: 12 },
]

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url)
  const jaar = parseInt(searchParams.get('jaar') ?? String(new Date().getFullYear()), 10)

  const supabase = getSupabase()
  const { data, error } = await supabase
    .from('inkomen')
    .select('platform, datum, bedrag')
    .gte('datum', `${jaar}-01-01`)
    .lte('datum', `${jaar}-12-31`)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  const rows = data || []

  const kwartalen = QUARTERS.map(({ kwartaal, van, tot, startMonth, endMonth }) => {
    const filtered = rows.filter((row) => {
      const month = new Date(row.datum).getMonth() + 1
      return month >= startMonth && month <= endMonth
    })
    const bedrag = filtered.reduce((sum, row) => sum + (row.bedrag ?? 0), 0)
    const { btw_21, btw_netto } = calcBtw(bedrag)
    return {
      kwartaal,
      van,
      tot,
      bedrag: Math.round(bedrag * 100) / 100,
      btw_21: Math.round(btw_21 * 100) / 100,
      btw_netto: Math.round(btw_netto * 100) / 100,
    }
  })

  const totaal_jaar = rows.reduce((sum, row) => sum + (row.bedrag ?? 0), 0)
  const { btw_21: btw_21_jaar, btw_netto: btw_netto_jaar } = calcBtw(totaal_jaar)

  return NextResponse.json({
    jaar,
    kwartalen,
    totaal_jaar: Math.round(totaal_jaar * 100) / 100,
    btw_21_jaar: Math.round(btw_21_jaar * 100) / 100,
    btw_netto_jaar: Math.round(btw_netto_jaar * 100) / 100,
  })
}
