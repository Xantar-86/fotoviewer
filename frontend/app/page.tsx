'use client'

import { useEffect, useState } from 'react'
import { motion } from 'framer-motion'
import Link from 'next/link'
import {
  TrendingUp,
  ShoppingBag,
  ImageIcon,
  Sparkles,
  Euro,
  ArrowUpRight,
  Zap,
  Clock,
  CheckCircle2,
  AlertCircle,
} from 'lucide-react'
import { getIncome, getOrders } from '@/lib/api'

interface Stats {
  totalIncome: number
  incomeCount: number
  totalOrders: number
  pendingOrders: number
  completedOrders: number
}

const fadeInUp = {
  initial: { opacity: 0, y: 20 },
  animate: { opacity: 1, y: 0 },
}

const stagger = {
  animate: { transition: { staggerChildren: 0.07 } },
}

export default function DashboardPage() {
  const [stats, setStats] = useState<Stats>({
    totalIncome: 0,
    incomeCount: 0,
    totalOrders: 0,
    pendingOrders: 0,
    completedOrders: 0,
  })
  const [loading, setLoading] = useState(true)
  const [recentOrders, setRecentOrders] = useState<any[]>([])

  useEffect(() => {
    async function loadStats() {
      try {
        const [incomeData, ordersData] = await Promise.all([
          getIncome(),
          getOrders(),
        ])
        const orders = ordersData.items
        setStats({
          totalIncome: incomeData.total,
          incomeCount: incomeData.items.length,
          totalOrders: orders.length,
          pendingOrders: orders.filter((o) => o.status === 'Nieuw' || o.status === 'In behandeling').length,
          completedOrders: orders.filter((o) => o.status === 'Voltooid').length,
        })
        setRecentOrders(orders.slice(0, 5))
      } catch (e) {
        // API might not be running locally
      } finally {
        setLoading(false)
      }
    }
    loadStats()
  }, [])

  const statCards = [
    {
      label: 'Totaal Inkomen',
      value: `€${stats.totalIncome.toFixed(2)}`,
      sub: `${stats.incomeCount} transacties`,
      icon: Euro,
      color: 'from-purple-600/20 to-violet-600/10',
      iconColor: 'text-purple-400',
      iconBg: 'bg-purple-500/20',
    },
    {
      label: 'Bestellingen',
      value: String(stats.totalOrders),
      sub: `${stats.pendingOrders} in behandeling`,
      icon: ShoppingBag,
      color: 'from-blue-600/20 to-cyan-600/10',
      iconColor: 'text-blue-400',
      iconBg: 'bg-blue-500/20',
    },
    {
      label: 'Voltooid',
      value: String(stats.completedOrders),
      sub: 'voltooide orders',
      icon: CheckCircle2,
      color: 'from-green-600/20 to-emerald-600/10',
      iconColor: 'text-green-400',
      iconBg: 'bg-green-500/20',
    },
    {
      label: 'Actief',
      value: String(stats.pendingOrders),
      sub: 'openstaande orders',
      icon: AlertCircle,
      color: 'from-orange-600/20 to-yellow-600/10',
      iconColor: 'text-orange-400',
      iconBg: 'bg-orange-500/20',
    },
  ]

  const quickActions = [
    {
      href: '/editor',
      icon: ImageIcon,
      label: "Foto's bewerken",
      description: 'Open de geavanceerde foto-editor',
      gradient: 'from-purple-600 to-violet-700',
    },
    {
      href: '/ai',
      icon: Sparkles,
      label: 'AI Studio',
      description: "Analyseer foto's met Claude AI",
      gradient: 'from-pink-600 to-purple-700',
    },
    {
      href: '/business',
      icon: TrendingUp,
      label: 'Inkomen bijhouden',
      description: 'Voeg nieuwe transactie toe',
      gradient: 'from-blue-600 to-cyan-700',
    },
  ]

  const statusColors: Record<string, string> = {
    Nieuw: 'badge-purple',
    'In behandeling': 'badge-yellow',
    Voltooid: 'badge-green',
    Geannuleerd: 'badge-red',
  }

  return (
    <div className="max-w-7xl mx-auto">
      {/* Hero */}
      <motion.div
        variants={stagger}
        initial="initial"
        animate="animate"
        className="mb-10"
      >
        <motion.div variants={fadeInUp} className="flex items-center gap-3 mb-2">
          <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-purple-500 to-violet-600 flex items-center justify-center">
            <Zap className="w-4 h-4 text-white" />
          </div>
          <span className="text-sm font-medium text-purple-400 uppercase tracking-widest">Dashboard</span>
        </motion.div>

        <motion.h1 variants={fadeInUp} className="text-4xl font-black mb-3">
          <span className="gradient-text-vibrant">Welkom terug,</span>
          <br />
          <span className="text-white/90">FeetBusiness Studio</span>
        </motion.h1>

        <motion.p variants={fadeInUp} className="text-white/40 text-lg max-w-xl">
          Beheer je content, analyseer je inkomsten en creëer professionele foto's — alles op één plek.
        </motion.p>
      </motion.div>

      {/* Stats grid */}
      <motion.div
        variants={stagger}
        initial="initial"
        animate="animate"
        className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8"
      >
        {statCards.map((card) => {
          const Icon = card.icon
          return (
            <motion.div
              key={card.label}
              variants={fadeInUp}
              className={`glass-card p-5 bg-gradient-to-br ${card.color}`}
            >
              <div className="flex items-start justify-between mb-4">
                <div className={`w-10 h-10 ${card.iconBg} rounded-xl flex items-center justify-center`}>
                  <Icon className={`w-5 h-5 ${card.iconColor}`} />
                </div>
                <ArrowUpRight className="w-4 h-4 text-white/20" />
              </div>
              {loading ? (
                <div className="h-7 w-20 bg-white/10 rounded-lg animate-pulse mb-1" />
              ) : (
                <div className="text-2xl font-bold text-white mb-0.5">{card.value}</div>
              )}
              <div className="text-xs text-white/40">{card.sub}</div>
            </motion.div>
          )
        })}
      </motion.div>

      {/* Quick actions */}
      <motion.div
        variants={stagger}
        initial="initial"
        animate="animate"
        className="mb-8"
      >
        <motion.h2 variants={fadeInUp} className="text-lg font-semibold text-white/70 mb-4">
          Snelle acties
        </motion.h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {quickActions.map((action) => {
            const Icon = action.icon
            return (
              <motion.div key={action.href} variants={fadeInUp}>
                <Link
                  href={action.href}
                  className="group glass-card p-5 flex items-start gap-4 hover:border-purple-500/30 transition-all duration-200"
                >
                  <div className={`w-12 h-12 rounded-xl bg-gradient-to-br ${action.gradient} flex items-center justify-center flex-shrink-0 shadow-glow-sm group-hover:shadow-glow transition-all duration-300`}>
                    <Icon className="w-6 h-6 text-white" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="font-semibold text-white mb-1">{action.label}</div>
                    <div className="text-sm text-white/40">{action.description}</div>
                  </div>
                  <ArrowUpRight className="w-4 h-4 text-white/20 group-hover:text-purple-400 transition-colors flex-shrink-0 mt-0.5" />
                </Link>
              </motion.div>
            )
          })}
        </div>
      </motion.div>

      {/* Recent orders */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.3 }}
      >
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold text-white/70">Recente bestellingen</h2>
          <Link href="/business" className="text-sm text-purple-400 hover:text-purple-300 transition-colors flex items-center gap-1">
            Alle bestellingen
            <ArrowUpRight className="w-3.5 h-3.5" />
          </Link>
        </div>

        <div className="glass-card overflow-hidden">
          {loading ? (
            <div className="p-8 text-center">
              <div className="spinner mx-auto mb-3" />
              <p className="text-white/30 text-sm">Laden...</p>
            </div>
          ) : recentOrders.length === 0 ? (
            <div className="p-10 text-center">
              <ShoppingBag className="w-10 h-10 text-white/10 mx-auto mb-3" />
              <p className="text-white/30 text-sm">Nog geen bestellingen</p>
              <Link href="/business" className="mt-3 inline-block text-sm text-purple-400 hover:text-purple-300 transition-colors">
                Eerste bestelling toevoegen →
              </Link>
            </div>
          ) : (
            <div className="table-scroll">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Klant</th>
                  <th>Platform</th>
                  <th>Prijs</th>
                  <th>Datum</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                {recentOrders.map((order) => (
                  <tr key={order.id}>
                    <td className="font-medium text-white">{order.klant}</td>
                    <td>
                      <span className="badge-purple">{order.platform}</span>
                    </td>
                    <td className="text-green-400 font-semibold">€{order.prijs.toFixed(2)}</td>
                    <td className="text-white/50 flex items-center gap-1.5">
                      <Clock className="w-3.5 h-3.5" />
                      {order.datum}
                    </td>
                    <td>
                      <span className={statusColors[order.status] || 'badge-purple'}>
                        {order.status}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            </div>
          )}
        </div>
      </motion.div>

      {/* Feature highlights */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.4 }}
        className="mt-8 grid grid-cols-1 md:grid-cols-2 gap-4"
      >
        <div className="glass-card p-6 bg-gradient-to-br from-purple-600/10 to-transparent">
          <div className="flex items-center gap-3 mb-3">
            <div className="w-9 h-9 bg-purple-500/20 rounded-xl flex items-center justify-center">
              <ImageIcon className="w-4.5 h-4.5 text-purple-400" />
            </div>
            <h3 className="font-semibold text-white">Foto Verwerking</h3>
          </div>
          <ul className="space-y-2 text-sm text-white/50">
            {[
              'EXIF data verwijderen voor privacy',
              'Automatische beeldverbetering',
              'Tekst- en logo watermerken',
              'Platform-specifieke formaten',
              'Bijsnijden & blur tools',
            ].map((f) => (
              <li key={f} className="flex items-center gap-2">
                <CheckCircle2 className="w-3.5 h-3.5 text-purple-400 flex-shrink-0" />
                {f}
              </li>
            ))}
          </ul>
        </div>

        <div className="glass-card p-6 bg-gradient-to-br from-pink-600/10 to-transparent">
          <div className="flex items-center gap-3 mb-3">
            <div className="w-9 h-9 bg-pink-500/20 rounded-xl flex items-center justify-center">
              <Sparkles className="w-4.5 h-4.5 text-pink-400" />
            </div>
            <h3 className="font-semibold text-white">AI Studio</h3>
          </div>
          <ul className="space-y-2 text-sm text-white/50">
            {[
              "Foto's analyseren met Claude AI",
              'Nederlandse titels genereren',
              'Hashtag suggesties',
              'Sessie-ideeën op maat',
              'Antwoordsjablonen voor klanten',
            ].map((f) => (
              <li key={f} className="flex items-center gap-2">
                <CheckCircle2 className="w-3.5 h-3.5 text-pink-400 flex-shrink-0" />
                {f}
              </li>
            ))}
          </ul>
        </div>
      </motion.div>
    </div>
  )
}
