'use client'

import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  CartesianGrid,
} from 'recharts'
import { IncomeItem } from '@/lib/api'

interface Props {
  items: IncomeItem[]
}

const MONTH_LABELS = ['Jan', 'Feb', 'Mar', 'Apr', 'Mei', 'Jun', 'Jul', 'Aug', 'Sep', 'Okt', 'Nov', 'Dec']

const PLATFORM_COLORS: Record<string, string> = {
  FeetFinder: '#a855f7',
  OnlyFans: '#ec4899',
  Fansly:   '#6366f1',
  Patreon:  '#f97316',
  Instagram:'#06b6d4',
  Anders:   '#8b5cf6',
}

function getPlatformColor(platform: string): string {
  return PLATFORM_COLORS[platform] ?? '#a855f7'
}

export default function IncomeChart({ items }: Props) {
  const currentYear = new Date().getFullYear()

  // Build monthly totals for the current year
  const monthlyTotals = Array.from({ length: 12 }, (_, i) => ({
    month: MONTH_LABELS[i],
    bedrag: 0,
  }))

  items.forEach((item) => {
    const date = new Date(item.datum)
    if (date.getFullYear() === currentYear) {
      monthlyTotals[date.getMonth()].bedrag =
        Math.round((monthlyTotals[date.getMonth()].bedrag + item.bedrag) * 100) / 100
    }
  })

  // Platform breakdown (all-time from provided items, filtered to current year)
  const byPlatform: Record<string, number> = {}
  items.forEach((item) => {
    const date = new Date(item.datum)
    if (date.getFullYear() === currentYear) {
      byPlatform[item.platform] = Math.round(((byPlatform[item.platform] ?? 0) + item.bedrag) * 100) / 100
    }
  })
  const platformEntries = Object.entries(byPlatform).sort((a, b) => b[1] - a[1])

  const hasData = monthlyTotals.some((m) => m.bedrag > 0)

  return (
    <div className="glass-card p-5">
      {hasData ? (
        <>
          <ResponsiveContainer width="100%" height={200}>
            <BarChart data={monthlyTotals} margin={{ top: 4, right: 4, left: -16, bottom: 0 }}>
              <CartesianGrid vertical={false} stroke="rgba(255,255,255,0.04)" />
              <XAxis
                dataKey="month"
                tick={{ fill: 'rgba(255,255,255,0.35)', fontSize: 11 }}
                axisLine={false}
                tickLine={false}
              />
              <YAxis
                tick={{ fill: 'rgba(255,255,255,0.35)', fontSize: 11 }}
                axisLine={false}
                tickLine={false}
                tickFormatter={(v) => `€${v}`}
              />
              <Tooltip
                cursor={{ fill: 'rgba(168,85,247,0.08)' }}
                formatter={(value: number) => [`€${value.toFixed(2)}`, 'Inkomen']}
                contentStyle={{
                  background: 'rgba(15, 15, 30, 0.95)',
                  border: '1px solid rgba(168, 85, 247, 0.2)',
                  borderRadius: '10px',
                  color: '#f8fafc',
                  fontSize: '12px',
                }}
                labelStyle={{ color: 'rgba(255,255,255,0.6)', marginBottom: 4 }}
              />
              <Bar dataKey="bedrag" fill="#a855f7" radius={[4, 4, 0, 0]} maxBarSize={36} />
            </BarChart>
          </ResponsiveContainer>

          {platformEntries.length > 0 && (
            <div className="flex flex-wrap gap-x-4 gap-y-2 mt-4 pt-4 border-t border-white/[0.06]">
              {platformEntries.map(([platform, total]) => (
                <div key={platform} className="flex items-center gap-1.5 text-xs">
                  <span
                    className="w-2 h-2 rounded-full flex-shrink-0"
                    style={{ background: getPlatformColor(platform) }}
                  />
                  <span className="text-white/50">{platform}</span>
                  <span className="text-white/70 font-medium">€{total.toFixed(2)}</span>
                </div>
              ))}
            </div>
          )}
        </>
      ) : (
        <div className="h-[200px] flex flex-col items-center justify-center">
          <p className="text-white/20 text-sm">Geen inkomsten dit jaar</p>
        </div>
      )}
    </div>
  )
}
