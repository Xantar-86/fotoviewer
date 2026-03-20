'use client'

import { useState, useEffect, useCallback } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import toast from 'react-hot-toast'
import {
  CalendarDays,
  ChevronLeft,
  ChevronRight,
  Plus,
  X,
  Trash2,
  Clock,
  Loader2,
  Edit3,
} from 'lucide-react'
import {
  getCalendarItems,
  addCalendarItem,
  updateCalendarItem,
  deleteCalendarItem,
  CalendarItem,
} from '@/lib/api'

// ─── Constants ────────────────────────────────────────────────────────────────

const PLATFORMS = ['FeetFinder', 'OnlyFans', 'Fansly', 'Instagram', 'Patreon']
const STATUSES = ['gepland', 'gepost', 'geannuleerd']

const MAANDEN = [
  'Januari', 'Februari', 'Maart', 'April', 'Mei', 'Juni',
  'Juli', 'Augustus', 'September', 'Oktober', 'November', 'December',
]

const DAG_LABELS = ['Ma', 'Di', 'Wo', 'Do', 'Vr', 'Za', 'Zo']

const PLATFORM_TIPS: Record<string, string> = {
  FeetFinder: '19:00–22:00',
  OnlyFans: '20:00–23:00',
  Fansly: '19:00–22:00',
  Instagram: '12:00–14:00 & 19:00–21:00',
  Patreon: '10:00–12:00',
}

const STATUS_STYLES: Record<string, { badge: string; dot: string }> = {
  gepland:     { badge: 'bg-purple-500/20 text-purple-300 border border-purple-500/30', dot: 'bg-purple-400' },
  gepost:      { badge: 'bg-green-500/20  text-green-300  border border-green-500/30',  dot: 'bg-green-400' },
  geannuleerd: { badge: 'bg-red-500/20    text-red-400    border border-red-500/30',    dot: 'bg-red-400' },
}

// ─── April 2026 content calendar preset ───────────────────────────────────────

const APRIL_CALENDAR = [
  // Week 1 - Fresh Start
  { datum: '2026-04-01', platform: 'FeetFinder', titel: 'Lente intro — voeten in het gras', beschrijving: 'Styling: nude nagels, enkelbandjes\nCaption: "Spring is here and so am I 🌸"', status: 'gepland', kleur: '#22c55e' },
  { datum: '2026-04-03', platform: 'FeetFinder', titel: 'Bovenaanzicht marmeren vloer', beschrijving: 'Styling: rode nagels, olie op huid\nCaption: "Marble never looked this good 🤍"', status: 'gepland', kleur: '#22c55e' },
  { datum: '2026-04-05', platform: 'FeetFinder', titel: 'Voeten omhoog tegen witte muur', beschrijving: 'Styling: french manicure\nCaption: "Simple. Clean. Irresistible."', status: 'gepland', kleur: '#22c55e' },
  { datum: '2026-04-06', platform: 'FeetFinder', titel: '🎥 Video — wiggling toes close-up', beschrijving: 'Styling: pastelroze nagels\nCaption: "You asked for it... 🎀"', status: 'gepland', kleur: '#22c55e' },
  // Week 2 - Luxury Vibes
  { datum: '2026-04-07', platform: 'FeetFinder', titel: 'Zijden lakens — voeten gestrekt', beschrijving: 'Styling: bordeaux nagels\nCaption: "Monday mood 🍷"', status: 'gepland', kleur: '#a855f7' },
  { datum: '2026-04-09', platform: 'FeetFinder', titel: 'Voeten in warm bad met rozenblaadjes', beschrijving: 'Styling: naturel, ongelakt\nCaption: "Self-care Sunday... on a Wednesday 🌹"', status: 'gepland', kleur: '#a855f7' },
  { datum: '2026-04-11', platform: 'FeetFinder', titel: 'Enkelbandjes close-up — macro shot', beschrijving: 'Styling: goud/zilver juwelen\nCaption: "Details that make the difference ✨"', status: 'gepland', kleur: '#a855f7' },
  { datum: '2026-04-12', platform: 'FeetFinder', titel: 'Bij kaarslicht — voetzolen zichtbaar', beschrijving: 'Styling: glitter nagels\nCaption: "Late night, just for you 🕯️"', status: 'gepland', kleur: '#a855f7' },
  // Week 3 - Outdoor & Fresh
  { datum: '2026-04-14', platform: 'FeetFinder', titel: 'Terras bij zonsondergang', beschrijving: 'Styling: olie op huid, naturel nagels\nCaption: "Golden hour hits different 🌅"', status: 'gepland', kleur: '#3b82f6' },
  { datum: '2026-04-15', platform: 'FeetFinder', titel: 'Bloemen tussen de tenen', beschrijving: 'Styling: witte nagels\nCaption: "Picked these just for the shoot 🌼"', status: 'gepland', kleur: '#3b82f6' },
  { datum: '2026-04-17', platform: 'FeetFinder', titel: 'Voeten in het zand', beschrijving: 'Styling: nude nagels + enkelbandje\nCaption: "Beach mode: activated 🏖️"', status: 'gepland', kleur: '#3b82f6' },
  { datum: '2026-04-19', platform: 'FeetFinder', titel: '🎥 Video — voeten in gras', beschrijving: 'Styling: pastelgroen nagels\nCaption: "POV: you found me 🌿"', status: 'gepland', kleur: '#3b82f6' },
  { datum: '2026-04-20', platform: 'FeetFinder', titel: 'Reflectie in spiegel — creatief shot', beschrijving: 'Styling: zwarte nagels\nCaption: "Two for the price of one 😏"', status: 'gepland', kleur: '#3b82f6' },
  // Week 4 - Tease & Exclusive
  { datum: '2026-04-21', platform: 'FeetFinder', titel: 'Close-up voetboog — hoge mule', beschrijving: 'Styling: rode nagels, hak zichtbaar\nCaption: "Size EU 39 never looked bigger 🔥"', status: 'gepland', kleur: '#ec4899' },
  { datum: '2026-04-22', platform: 'FeetFinder', titel: 'Jacuzzi / bad — glanzende natte huid', beschrijving: 'Styling: naturel\nCaption: "Fresh out of the bath 💦"', status: 'gepland', kleur: '#ec4899' },
  { datum: '2026-04-24', platform: 'FeetFinder', titel: 'Flat lay — voeten + bloemen + accessoires', beschrijving: 'Styling: pastelpaars nagels\nCaption: "Aesthetic overload 💜"', status: 'gepland', kleur: '#ec4899' },
  { datum: '2026-04-25', platform: 'FeetFinder', titel: 'Custom content preview — half zichtbaar', beschrijving: 'Styling: jouw keuze\nCaption: "Want the full version? You know where to find me 😉"', status: 'gepland', kleur: '#ec4899' },
  { datum: '2026-04-26', platform: 'FeetFinder', titel: 'Witte sokken half uit — speels', beschrijving: 'Styling: kleurrijke nagels\nCaption: "Accidentally your new obsession 🧦"', status: 'gepland', kleur: '#ec4899' },
  // Week 5 - Wrap-up
  { datum: '2026-04-28', platform: 'FeetFinder', titel: 'Kaarslicht + zijden stof — sensueel', beschrijving: 'Styling: nude nagels, olie\nCaption: "April\'s almost over... don\'t miss out 🤍"', status: 'gepland', kleur: '#f97316' },
  { datum: '2026-04-30', platform: 'FeetFinder', titel: 'Best-of recap / teaser voor mei', beschrijving: 'Styling: jouw favoriete look\nCaption: "See you in May 🌸 Subscribe for what\'s coming..."', status: 'gepland', kleur: '#f97316' },
]

function toDateStr(year: number, month: number, day: number): string {
  return `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`
}

function today(): string {
  return new Date().toISOString().split('T')[0]
}

// ─── Empty form helper ────────────────────────────────────────────────────────

function emptyForm(datum = today()): Omit<CalendarItem, 'id'> {
  return { datum, platform: 'FeetFinder', titel: '', beschrijving: '', status: 'gepland', kleur: '#a855f7' }
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function KalenderPage() {
  const now = new Date()
  const [viewYear, setViewYear]   = useState(now.getFullYear())
  const [viewMonth, setViewMonth] = useState(now.getMonth()) // 0-indexed
  const [items, setItems]         = useState<CalendarItem[]>([])
  const [loading, setLoading]     = useState(false)

  // Add modal
  const [showAdd, setShowAdd]   = useState(false)
  const [addForm, setAddForm]   = useState<Omit<CalendarItem, 'id'>>(emptyForm())
  const [saving, setSaving]     = useState(false)

  // Import state
  const [importing, setImporting] = useState(false)

  // Edit modal
  const [editItem, setEditItem] = useState<CalendarItem | null>(null)
  const [editForm, setEditForm] = useState<Omit<CalendarItem, 'id'>>(emptyForm())
  const [deleting, setDeleting] = useState(false)

  // ─── Load items ─────────────────────────────────────────────────────────────

  const loadItems = useCallback(async () => {
    setLoading(true)
    try {
      const { items: data } = await getCalendarItems(viewMonth + 1, viewYear)
      setItems(data)
    } catch {
      toast.error('Kon kalender niet laden')
    } finally {
      setLoading(false)
    }
  }, [viewMonth, viewYear])

  useEffect(() => { loadItems() }, [loadItems])

  // ─── Body scroll lock (iOS fix) ──────────────────────────────────────────────
  useEffect(() => {
    const isOpen = showAdd || !!editItem
    if (isOpen) {
      const scrollY = window.scrollY
      document.body.style.position = 'fixed'
      document.body.style.top = `-${scrollY}px`
      document.body.style.width = '100%'
      document.body.style.overflow = 'hidden'
    } else {
      const top = document.body.style.top
      document.body.style.position = ''
      document.body.style.top = ''
      document.body.style.width = ''
      document.body.style.overflow = ''
      if (top) window.scrollTo(0, -parseInt(top, 10))
    }
    return () => {
      document.body.style.position = ''
      document.body.style.top = ''
      document.body.style.width = ''
      document.body.style.overflow = ''
    }
  }, [showAdd, editItem])

  // ─── Navigation ─────────────────────────────────────────────────────────────

  function prevMonth() {
    if (viewMonth === 0) { setViewMonth(11); setViewYear(y => y - 1) }
    else setViewMonth(m => m - 1)
  }
  function nextMonth() {
    if (viewMonth === 11) { setViewMonth(0); setViewYear(y => y + 1) }
    else setViewMonth(m => m + 1)
  }

  // ─── Calendar grid helpers ───────────────────────────────────────────────────

  // Build list of day cells for the grid (Mon-Sun week start)
  function buildCalendarDays() {
    const firstDay = new Date(viewYear, viewMonth, 1)
    // getDay() returns 0=Sun..6=Sat; convert to Mon=0..Sun=6
    let startOffset = firstDay.getDay() - 1
    if (startOffset < 0) startOffset = 6

    const daysInMonth  = new Date(viewYear, viewMonth + 1, 0).getDate()
    const daysInPrevM  = new Date(viewYear, viewMonth, 0).getDate()

    const cells: { date: string; day: number; currentMonth: boolean }[] = []

    // Previous month fill
    for (let i = startOffset - 1; i >= 0; i--) {
      const d = daysInPrevM - i
      const prevMonth = viewMonth === 0 ? 11 : viewMonth - 1
      const prevYear  = viewMonth === 0 ? viewYear - 1 : viewYear
      cells.push({ date: toDateStr(prevYear, prevMonth, d), day: d, currentMonth: false })
    }

    // Current month
    for (let d = 1; d <= daysInMonth; d++) {
      cells.push({ date: toDateStr(viewYear, viewMonth, d), day: d, currentMonth: true })
    }

    // Next month fill to complete the last row
    const remainder = cells.length % 7
    if (remainder !== 0) {
      const needed = 7 - remainder
      const nextMon  = viewMonth === 11 ? 0 : viewMonth + 1
      const nextYear = viewMonth === 11 ? viewYear + 1 : viewYear
      for (let d = 1; d <= needed; d++) {
        cells.push({ date: toDateStr(nextYear, nextMon, d), day: d, currentMonth: false })
      }
    }

    return cells
  }

  function itemsForDate(date: string) {
    return items.filter(i => i.datum === date)
  }

  // ─── Add item ────────────────────────────────────────────────────────────────

  function openAdd(date: string) {
    setAddForm(emptyForm(date))
    setShowAdd(true)
  }

  async function handleAdd() {
    if (!addForm.titel.trim()) { toast.error('Geef een titel op'); return }
    setSaving(true)
    try {
      await addCalendarItem(addForm)
      toast.success('Item toegevoegd')
      setShowAdd(false)
      loadItems()
    } catch {
      toast.error('Toevoegen mislukt')
    } finally {
      setSaving(false)
    }
  }

  // ─── Edit item ───────────────────────────────────────────────────────────────

  function openEdit(item: CalendarItem, e: React.MouseEvent) {
    e.stopPropagation()
    setEditItem(item)
    setEditForm({ datum: item.datum, platform: item.platform, titel: item.titel, beschrijving: item.beschrijving || '', status: item.status, kleur: item.kleur })
  }

  async function handleUpdate() {
    if (!editItem) return
    if (!editForm.titel.trim()) { toast.error('Geef een titel op'); return }
    setSaving(true)
    try {
      await updateCalendarItem(editItem.id, editForm)
      toast.success('Item bijgewerkt')
      setEditItem(null)
      loadItems()
    } catch {
      toast.error('Bijwerken mislukt')
    } finally {
      setSaving(false)
    }
  }

  async function handleDelete() {
    if (!editItem) return
    setDeleting(true)
    try {
      await deleteCalendarItem(editItem.id)
      toast.success('Item verwijderd')
      setEditItem(null)
      loadItems()
    } catch {
      toast.error('Verwijderen mislukt')
    } finally {
      setDeleting(false)
    }
  }

  // ─── Import April calendar ───────────────────────────────────────────────────

  async function handleImportApril() {
    setImporting(true)
    let success = 0
    let failed = 0
    for (const entry of APRIL_CALENDAR) {
      try {
        await addCalendarItem(entry)
        success++
      } catch {
        failed++
      }
    }
    await loadItems()
    if (failed === 0) toast.success(`${success} content ideeën toegevoegd aan april!`)
    else toast.error(`${success} toegevoegd, ${failed} mislukt`)
    setImporting(false)
  }

  // ─── Grouped list (mobile) ───────────────────────────────────────────────────

  function buildGroupedItems() {
    const map: Record<string, CalendarItem[]> = {}
    for (const item of items) {
      if (!map[item.datum]) map[item.datum] = []
      map[item.datum].push(item)
    }
    return Object.entries(map).sort(([a], [b]) => a.localeCompare(b))
  }

  const calendarDays = buildCalendarDays()
  const todayStr     = today()

  // ─── Modal shared form renderer ──────────────────────────────────────────────

  function FormFields({
    form,
    onChange,
  }: {
    form: Omit<CalendarItem, 'id'>
    onChange: (patch: Partial<Omit<CalendarItem, 'id'>>) => void
  }) {
    return (
      <div className="space-y-3">
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-xs text-white/50 mb-1">Datum</label>
            <input
              type="date"
              value={form.datum}
              onChange={e => onChange({ datum: e.target.value })}
              className="input-dark w-full text-sm"
            />
          </div>
          <div>
            <label className="block text-xs text-white/50 mb-1">Platform</label>
            <select
              value={form.platform}
              onChange={e => onChange({ platform: e.target.value })}
              className="input-dark w-full text-sm"
            >
              {PLATFORMS.map(p => (
                <option key={p} value={p} className="bg-[#1a1a2e]">{p}</option>
              ))}
            </select>
          </div>
        </div>
        <div>
          <label className="block text-xs text-white/50 mb-1">Titel <span className="text-red-400">*</span></label>
          <input
            type="text"
            value={form.titel}
            onChange={e => onChange({ titel: e.target.value })}
            placeholder="Bijv. nieuwe foto set..."
            className="input-dark w-full text-sm"
          />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-xs text-white/50 mb-1">Status</label>
            <select
              value={form.status}
              onChange={e => onChange({ status: e.target.value })}
              className="input-dark w-full text-sm"
            >
              {STATUSES.map(s => (
                <option key={s} value={s} className="bg-[#1a1a2e]">{s.charAt(0).toUpperCase() + s.slice(1)}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-xs text-white/50 mb-1">Kleur</label>
            <div className="flex items-center gap-2">
              <input
                type="color"
                value={form.kleur}
                onChange={e => onChange({ kleur: e.target.value })}
                className="w-9 h-9 rounded-lg border border-white/10 bg-transparent cursor-pointer flex-shrink-0"
              />
              <span className="text-xs text-white/40 font-mono">{form.kleur}</span>
            </div>
          </div>
        </div>
        <div>
          <label className="block text-xs text-white/50 mb-1">Beschrijving (optioneel)</label>
          <textarea
            value={form.beschrijving}
            onChange={e => onChange({ beschrijving: e.target.value })}
            placeholder="Extra details..."
            rows={2}
            className="input-dark w-full resize-none text-sm"
          />
        </div>
      </div>
    )
  }

  // ─── Render ──────────────────────────────────────────────────────────────────

  return (
    <div className="min-h-screen p-4 md:p-8 space-y-6">

      {/* Header */}
      <motion.div
        initial={{ opacity: 0, y: -16 }}
        animate={{ opacity: 1, y: 0 }}
        className="flex items-center justify-between"
      >
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-purple-500/20 border border-purple-500/20 flex items-center justify-center">
            <CalendarDays className="w-5 h-5 text-purple-400" />
          </div>
          <div>
            <h1 className="text-xl font-bold gradient-text">Content Kalender</h1>
            <p className="text-xs text-white/40">Plan je content per platform</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={handleImportApril}
            disabled={importing}
            className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium bg-green-500/20 text-green-300 border border-green-500/30 hover:bg-green-500/30 disabled:opacity-40 transition-all"
          >
            {importing ? <Loader2 className="w-4 h-4 animate-spin" /> : <CalendarDays className="w-4 h-4" />}
            <span className="hidden sm:inline">{importing ? 'Importeren...' : 'Importeer April kalender'}</span>
          </button>
          <button
            onClick={() => openAdd(todayStr)}
            className="glass-button btn-primary flex items-center gap-2 text-sm"
          >
            <Plus className="w-4 h-4" />
            <span className="hidden sm:inline">Toevoegen</span>
          </button>
        </div>
      </motion.div>

      {/* Month navigation */}
      <motion.div
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.05 }}
        className="glass-card flex items-center justify-between px-4 py-3"
      >
        <button
          onClick={prevMonth}
          className="w-9 h-9 flex items-center justify-center rounded-lg hover:bg-white/[0.06] text-white/60 hover:text-white transition-all"
        >
          <ChevronLeft className="w-5 h-5" />
        </button>
        <div className="text-center">
          <p className="text-base font-semibold text-white">
            {MAANDEN[viewMonth]} {viewYear}
          </p>
          {loading && (
            <div className="flex items-center justify-center gap-1 mt-0.5">
              <Loader2 className="w-3 h-3 text-purple-400 animate-spin" />
              <span className="text-[10px] text-white/40">Laden...</span>
            </div>
          )}
        </div>
        <button
          onClick={nextMonth}
          className="w-9 h-9 flex items-center justify-center rounded-lg hover:bg-white/[0.06] text-white/60 hover:text-white transition-all"
        >
          <ChevronRight className="w-5 h-5" />
        </button>
      </motion.div>

      {/* ── Desktop calendar grid (hidden on mobile) ── */}
      <motion.div
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.1 }}
        className="hidden md:block glass-card overflow-hidden"
      >
        {/* Day labels */}
        <div className="grid grid-cols-7 border-b border-white/[0.06]">
          {DAG_LABELS.map(d => (
            <div key={d} className="py-2 text-center text-xs font-semibold text-white/40 uppercase tracking-wider">
              {d}
            </div>
          ))}
        </div>

        {/* Day cells */}
        <div className="grid grid-cols-7">
          {calendarDays.map((cell, idx) => {
            const dayItems  = itemsForDate(cell.date)
            const isToday   = cell.date === todayStr
            const isLastRow = idx >= calendarDays.length - 7
            const isLastCol = (idx + 1) % 7 === 0

            return (
              <div
                key={`${cell.date}-${idx}`}
                onClick={() => cell.currentMonth && openAdd(cell.date)}
                className={[
                  'min-h-[90px] p-2 border-b border-r border-white/[0.04] transition-colors',
                  cell.currentMonth
                    ? 'cursor-pointer hover:bg-white/[0.04]'
                    : 'opacity-30',
                  isLastRow   ? 'border-b-0' : '',
                  isLastCol   ? 'border-r-0' : '',
                ].join(' ')}
              >
                {/* Day number */}
                <div className="flex items-center justify-between mb-1">
                  <span className={[
                    'text-xs font-semibold w-6 h-6 flex items-center justify-center rounded-full transition-colors',
                    isToday && cell.currentMonth
                      ? 'bg-purple-500 text-white ring-2 ring-purple-400/40'
                      : cell.currentMonth
                        ? 'text-white/70'
                        : 'text-white/20',
                  ].join(' ')}>
                    {cell.day}
                  </span>
                  {dayItems.length > 0 && cell.currentMonth && (
                    <span className="text-[9px] text-white/30">{dayItems.length}</span>
                  )}
                </div>

                {/* Items (pills) */}
                <div className="space-y-0.5">
                  {dayItems.slice(0, 3).map(item => (
                    <button
                      key={item.id}
                      onClick={e => openEdit(item, e)}
                      className="w-full text-left rounded px-1.5 py-0.5 text-[10px] font-medium truncate transition-opacity hover:opacity-80"
                      style={{ backgroundColor: item.kleur + '33', color: item.kleur, border: `1px solid ${item.kleur}44` }}
                      title={item.titel}
                    >
                      {item.platform.substring(0, 2)} {item.titel}
                    </button>
                  ))}
                  {dayItems.length > 3 && (
                    <p className="text-[9px] text-white/30 pl-1">+{dayItems.length - 3} meer</p>
                  )}
                </div>
              </div>
            )
          })}
        </div>
      </motion.div>

      {/* ── Mobile list view (hidden on desktop) ── */}
      <motion.div
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.1 }}
        className="md:hidden space-y-3"
      >
        {loading ? (
          <div className="glass-card flex items-center justify-center py-12">
            <Loader2 className="w-6 h-6 text-purple-400 animate-spin" />
          </div>
        ) : buildGroupedItems().length === 0 ? (
          <div className="glass-card text-center py-12">
            <CalendarDays className="w-10 h-10 text-white/20 mx-auto mb-3" />
            <p className="text-white/40 text-sm">Geen items in {MAANDEN[viewMonth]}</p>
            <button
              onClick={() => openAdd(toDateStr(viewYear, viewMonth, 1))}
              className="glass-button btn-primary mt-4 text-sm"
            >
              Eerste item toevoegen
            </button>
          </div>
        ) : (
          buildGroupedItems().map(([date, dayItems]) => {
            const d = new Date(date + 'T00:00:00')
            const dagNamen = ['Zondag', 'Maandag', 'Dinsdag', 'Woensdag', 'Donderdag', 'Vrijdag', 'Zaterdag']
            const dagLabel = `${dagNamen[d.getDay()]} ${d.getDate()} ${MAANDEN[d.getMonth()]}`
            const isToday  = date === todayStr

            return (
              <div key={date} className="glass-card overflow-hidden">
                <div
                  className={[
                    'px-4 py-2 border-b border-white/[0.06] flex items-center justify-between',
                    isToday ? 'bg-purple-500/10' : '',
                  ].join(' ')}
                >
                  <span className={['text-xs font-semibold', isToday ? 'text-purple-300' : 'text-white/50'].join(' ')}>
                    {dagLabel}
                    {isToday && <span className="ml-2 text-[9px] bg-purple-500/30 text-purple-300 px-1.5 py-0.5 rounded-full">Vandaag</span>}
                  </span>
                  <button
                    onClick={() => openAdd(date)}
                    className="w-6 h-6 flex items-center justify-center rounded-md hover:bg-white/[0.06] text-white/40 hover:text-white/80 transition-all"
                  >
                    <Plus className="w-3.5 h-3.5" />
                  </button>
                </div>
                <div className="divide-y divide-white/[0.04]">
                  {dayItems.map(item => {
                    const st = STATUS_STYLES[item.status] || STATUS_STYLES.gepland
                    return (
                      <div
                        key={item.id}
                        className="px-4 py-3 flex items-start gap-3"
                      >
                        <div
                          className="w-1 flex-shrink-0 rounded-full mt-1 self-stretch min-h-[1.5rem]"
                          style={{ backgroundColor: item.kleur }}
                        />
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="text-sm font-medium text-white truncate">{item.titel}</span>
                            <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-medium ${st.badge}`}>
                              {item.status}
                            </span>
                          </div>
                          <p className="text-xs text-white/40 mt-0.5">{item.platform}</p>
                          {item.beschrijving && (
                            <p className="text-xs text-white/30 mt-1 line-clamp-2">{item.beschrijving}</p>
                          )}
                        </div>
                        <button
                          onClick={e => openEdit(item, e)}
                          className="w-7 h-7 flex items-center justify-center rounded-lg hover:bg-white/[0.06] text-white/30 hover:text-white/60 transition-all flex-shrink-0"
                        >
                          <Edit3 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    )
                  })}
                </div>
              </div>
            )
          })
        )}
      </motion.div>

      {/* Best posting times tip */}
      <motion.div
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.15 }}
        className="glass-card"
      >
        <div className="flex items-center gap-2 mb-3">
          <Clock className="w-4 h-4 text-purple-400" />
          <h3 className="text-sm font-semibold text-white/80">Beste posttijden per platform</h3>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
          {Object.entries(PLATFORM_TIPS).map(([platform, times]) => (
            <div key={platform} className="flex items-center justify-between bg-white/[0.04] rounded-lg px-3 py-2">
              <span className="text-xs font-medium text-white/60">{platform}</span>
              <span className="text-xs text-purple-300 font-mono">{times}</span>
            </div>
          ))}
        </div>
      </motion.div>

      {/* ── Add item modal ── */}
      <AnimatePresence>
        {showAdd && (
          <>
            <motion.div
              initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              className="fixed inset-0 z-40 bg-black/60 backdrop-blur-sm"
              onClick={() => setShowAdd(false)}
            />
            {/* Animatie-wrapper: alleen transform, geen overflow */}
            {/* fixed inset-0 flex items-end: stabieler dan fixed bottom-0 op iOS */}
            <div className="fixed inset-0 z-50 flex items-end pointer-events-none">
              <motion.div
                initial={{ y: '100%' }}
                animate={{ y: 0 }}
                exit={{ y: '100%' }}
                transition={{ type: 'spring', damping: 32, stiffness: 320 }}
                className="w-full pointer-events-auto"
                onClick={e => e.stopPropagation()}
              >
                <div className="rounded-t-2xl border border-purple-500/10 shadow-2xl px-5 pt-4 pb-6"
                     style={{ background: 'rgba(10, 10, 20, 0.97)' }}>
                  <div className="w-10 h-1 bg-white/20 rounded-full mx-auto mb-4" />
                  <div className="flex items-center justify-between mb-4">
                    <div className="flex items-center gap-2">
                      <Plus className="w-4 h-4 text-purple-400" />
                      <h2 className="text-sm font-semibold text-white">Nieuw item</h2>
                    </div>
                    <button onClick={() => setShowAdd(false)} className="w-8 h-8 flex items-center justify-center rounded-lg text-white/40 hover:text-white/80">
                      <X className="w-4 h-4" />
                    </button>
                  </div>
                  <FormFields form={addForm} onChange={patch => setAddForm(f => ({ ...f, ...patch }))} />
                  <div className="flex gap-3 mt-4">
                    <button onClick={() => setShowAdd(false)} className="flex-1 glass-button text-sm text-white/60">Annuleren</button>
                    <button onClick={handleAdd} disabled={saving} className="flex-1 glass-button btn-primary text-sm flex items-center justify-center gap-2 disabled:opacity-50">
                      {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
                      Opslaan
                    </button>
                  </div>
                </div>
              </motion.div>
            </div>
          </>
        )}
      </AnimatePresence>

      {/* ── Edit / delete modal ── */}
      <AnimatePresence>
        {editItem && (
          <>
            <motion.div
              initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              className="fixed inset-0 z-40 bg-black/60 backdrop-blur-sm"
              onClick={() => setEditItem(null)}
            />
            <div className="fixed inset-0 z-50 flex items-end pointer-events-none">
              <motion.div
                initial={{ y: '100%' }}
                animate={{ y: 0 }}
                exit={{ y: '100%' }}
                transition={{ type: 'spring', damping: 32, stiffness: 320 }}
                className="w-full pointer-events-auto"
                onClick={e => e.stopPropagation()}
              >
                <div className="rounded-t-2xl border border-purple-500/10 shadow-2xl px-5 pt-4 pb-6"
                     style={{ background: 'rgba(10, 10, 20, 0.97)' }}>
                  <div className="w-10 h-1 bg-white/20 rounded-full mx-auto mb-4" />
                  <div className="flex items-center justify-between mb-4">
                    <div className="flex items-center gap-2">
                      <Edit3 className="w-4 h-4 text-purple-400" />
                      <h2 className="text-sm font-semibold text-white">Item bewerken</h2>
                    </div>
                    <button onClick={() => setEditItem(null)} className="w-8 h-8 flex items-center justify-center rounded-lg text-white/40 hover:text-white/80">
                      <X className="w-4 h-4" />
                    </button>
                  </div>
                  <FormFields form={editForm} onChange={patch => setEditForm(f => ({ ...f, ...patch }))} />
                  <div className="flex gap-3 mt-4">
                    <button onClick={handleDelete} disabled={deleting || saving} className="glass-button text-sm text-red-400 hover:bg-red-500/10 flex items-center gap-2 disabled:opacity-50">
                      {deleting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Trash2 className="w-4 h-4" />}
                      Verwijderen
                    </button>
                    <button onClick={() => setEditItem(null)} className="flex-1 glass-button text-sm text-white/60">Annuleren</button>
                    <button onClick={handleUpdate} disabled={saving || deleting} className="flex-1 glass-button btn-primary text-sm flex items-center justify-center gap-2 disabled:opacity-50">
                      {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Edit3 className="w-4 h-4" />}
                      Opslaan
                    </button>
                  </div>
                </div>
              </motion.div>
            </div>
          </>
        )}
      </AnimatePresence>
    </div>
  )
}
