'use client'

import { useState, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import toast from 'react-hot-toast'
import {
  BarChart3,
  Plus,
  Trash2,
  Euro,
  ShoppingBag,
  TrendingUp,
  Calculator,
  Filter,
  X,
  ChevronDown,
  Loader2,
  ArrowUpRight,
  Clock,
} from 'lucide-react'
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  Legend,
} from 'recharts'
import {
  getIncome,
  addIncome,
  deleteIncome,
  getOrders,
  addOrder,
  updateOrderStatus,
  deleteOrder,
  calculatePrice,
  IncomeItem,
  OrderItem,
} from '@/lib/api'

type Tab = 'inkomen' | 'bestellingen' | 'calculator'

const PLATFORMS = ['FeetFinder', 'OnlyFans', 'Fansly', 'Patreon', 'Instagram', 'Anders']
const ORDER_STATUSES = ['Nieuw', 'In behandeling', 'Voltooid', 'Geannuleerd']

const PIE_COLORS = ['#a855f7', '#7c3aed', '#6d28d9', '#5b21b6', '#4c1d95', '#8b5cf6']

const STATUS_STYLES: Record<string, string> = {
  Nieuw: 'badge-purple',
  'In behandeling': 'badge-yellow',
  Voltooid: 'badge-green',
  Geannuleerd: 'badge-red',
}

const today = () => new Date().toISOString().split('T')[0]

export default function BusinessPage() {
  const [activeTab, setActiveTab] = useState<Tab>('inkomen')
  const [loading, setLoading] = useState(false)

  // Income state
  const [incomeItems, setIncomeItems] = useState<IncomeItem[]>([])
  const [incomeTotal, setIncomeTotal] = useState(0)
  const [incomeFilter, setIncomeFilter] = useState('')
  const [showAddIncome, setShowAddIncome] = useState(false)
  const [newIncome, setNewIncome] = useState({
    platform: 'FeetFinder',
    datum: today(),
    bedrag: '',
    beschrijving: '',
  })

  // Orders state
  const [orders, setOrders] = useState<OrderItem[]>([])
  const [orderFilter, setOrderFilter] = useState('')
  const [showAddOrder, setShowAddOrder] = useState(false)
  const [newOrder, setNewOrder] = useState({
    klant: '',
    platform: 'FeetFinder',
    beschrijving: '',
    prijs: '',
    datum: today(),
    status: 'Nieuw',
  })

  // Calculator state
  const [calcBase, setCalcBase] = useState('')
  const [calcQty, setCalcQty] = useState('1')
  const [calcDiscount, setCalcDiscount] = useState('0')
  const [calcResult, setCalcResult] = useState<{
    subtotal: number
    discount: number
    total: number
    per_item: number
  } | null>(null)

  const fetchIncome = async () => {
    try {
      const data = await getIncome(incomeFilter || undefined)
      setIncomeItems(data.items)
      setIncomeTotal(data.total)
    } catch (e) {}
  }

  const fetchOrders = async () => {
    try {
      const data = await getOrders(orderFilter || undefined)
      setOrders(data.items)
    } catch (e) {}
  }

  useEffect(() => { fetchIncome() }, [incomeFilter])
  useEffect(() => { fetchOrders() }, [orderFilter])

  // Income actions
  const handleAddIncome = async () => {
    if (!newIncome.bedrag || parseFloat(newIncome.bedrag) <= 0) {
      toast.error('Vul een geldig bedrag in')
      return
    }
    setLoading(true)
    try {
      await addIncome({
        ...newIncome,
        bedrag: parseFloat(newIncome.bedrag),
      })
      toast.success('Inkomen toegevoegd')
      setShowAddIncome(false)
      setNewIncome({ platform: 'FeetFinder', datum: today(), bedrag: '', beschrijving: '' })
      fetchIncome()
    } catch (e: any) {
      toast.error(e.message || 'Fout bij toevoegen')
    } finally {
      setLoading(false)
    }
  }

  const handleDeleteIncome = async (id: number) => {
    if (!confirm('Inkomen verwijderen?')) return
    try {
      await deleteIncome(id)
      toast.success('Verwijderd')
      fetchIncome()
    } catch (e: any) {
      toast.error(e.message || 'Fout')
    }
  }

  // Order actions
  const handleAddOrder = async () => {
    if (!newOrder.klant) {
      toast.error('Vul een klantnaam in')
      return
    }
    setLoading(true)
    try {
      await addOrder({
        ...newOrder,
        prijs: parseFloat(newOrder.prijs) || 0,
      })
      toast.success('Bestelling toegevoegd')
      setShowAddOrder(false)
      setNewOrder({ klant: '', platform: 'FeetFinder', beschrijving: '', prijs: '', datum: today(), status: 'Nieuw' })
      fetchOrders()
    } catch (e: any) {
      toast.error(e.message || 'Fout bij toevoegen')
    } finally {
      setLoading(false)
    }
  }

  const handleUpdateStatus = async (id: number, status: string) => {
    try {
      await updateOrderStatus(id, status)
      toast.success(`Status: ${status}`)
      fetchOrders()
    } catch (e: any) {
      toast.error(e.message || 'Fout')
    }
  }

  const handleDeleteOrder = async (id: number) => {
    if (!confirm('Bestelling verwijderen?')) return
    try {
      await deleteOrder(id)
      toast.success('Verwijderd')
      fetchOrders()
    } catch (e: any) {
      toast.error(e.message || 'Fout')
    }
  }

  // Calculator
  const handleCalculate = async () => {
    const base = parseFloat(calcBase)
    const qty = parseInt(calcQty)
    const discount = parseFloat(calcDiscount) || 0
    if (!base || base <= 0 || !qty || qty <= 0) {
      toast.error('Vul geldige waarden in')
      return
    }
    try {
      const result = await calculatePrice(base, qty, discount)
      setCalcResult(result)
    } catch (e: any) {
      toast.error(e.message || 'Fout bij berekening')
    }
  }

  // Chart data
  const byPlatform: Record<string, number> = {}
  incomeItems.forEach((item) => {
    byPlatform[item.platform] = (byPlatform[item.platform] || 0) + item.bedrag
  })
  const chartData = Object.entries(byPlatform).map(([name, value]) => ({ name, value: Math.round(value * 100) / 100 }))

  const tabs = [
    { id: 'inkomen' as Tab, icon: Euro, label: 'Inkomen' },
    { id: 'bestellingen' as Tab, icon: ShoppingBag, label: 'Bestellingen' },
    { id: 'calculator' as Tab, icon: Calculator, label: 'Prijscalculator' },
  ]

  return (
    <div className="max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex items-start justify-between mb-8">
        <div>
          <div className="flex items-center gap-3 mb-1">
            <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-blue-500 to-cyan-600 flex items-center justify-center">
              <BarChart3 className="w-4 h-4 text-white" />
            </div>
            <span className="text-sm font-medium text-purple-400 uppercase tracking-widest">Business</span>
          </div>
          <h1 className="text-3xl font-black gradient-text">Business Dashboard</h1>
        </div>
      </div>

      {/* Stats summary */}
      <div className="grid grid-cols-3 gap-4 mb-6">
        <div className="glass-card p-5">
          <div className="flex items-center gap-3 mb-2">
            <div className="w-9 h-9 bg-purple-500/20 rounded-xl flex items-center justify-center">
              <Euro className="w-4.5 h-4.5 text-purple-400" />
            </div>
            <span className="text-sm text-white/50">Totaal inkomen</span>
          </div>
          <div className="text-2xl font-bold text-white">€{incomeTotal.toFixed(2)}</div>
          <div className="text-xs text-white/30 mt-0.5">{incomeItems.length} transacties</div>
        </div>
        <div className="glass-card p-5">
          <div className="flex items-center gap-3 mb-2">
            <div className="w-9 h-9 bg-blue-500/20 rounded-xl flex items-center justify-center">
              <ShoppingBag className="w-4.5 h-4.5 text-blue-400" />
            </div>
            <span className="text-sm text-white/50">Bestellingen</span>
          </div>
          <div className="text-2xl font-bold text-white">{orders.length}</div>
          <div className="text-xs text-white/30 mt-0.5">
            {orders.filter((o) => o.status === 'Nieuw').length} nieuw
          </div>
        </div>
        <div className="glass-card p-5">
          <div className="flex items-center gap-3 mb-2">
            <div className="w-9 h-9 bg-green-500/20 rounded-xl flex items-center justify-center">
              <TrendingUp className="w-4.5 h-4.5 text-green-400" />
            </div>
            <span className="text-sm text-white/50">Gem. bestelling</span>
          </div>
          <div className="text-2xl font-bold text-white">
            €{orders.length > 0 ? (orders.reduce((s, o) => s + o.prijs, 0) / orders.length).toFixed(2) : '0.00'}
          </div>
          <div className="text-xs text-white/30 mt-0.5">per bestelling</div>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-2 mb-6">
        {tabs.map((tab) => {
          const Icon = tab.icon
          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-medium transition-all duration-200 ${
                activeTab === tab.id
                  ? 'bg-gradient-to-r from-purple-600/40 to-violet-600/30 text-purple-300 border border-purple-500/30'
                  : 'glass-button text-white/50 hover:text-white/80'
              }`}
            >
              <Icon className="w-4 h-4" />
              {tab.label}
            </button>
          )
        })}
      </div>

      <AnimatePresence mode="wait">
        {/* INKOMEN TAB */}
        {activeTab === 'inkomen' && (
          <motion.div key="inkomen" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}>
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              {/* Table */}
              <div className="lg:col-span-2">
                <div className="flex items-center justify-between mb-4">
                  <div className="flex items-center gap-2">
                    <select
                      value={incomeFilter}
                      onChange={(e) => setIncomeFilter(e.target.value)}
                      className="input-dark text-sm py-2"
                    >
                      <option value="" className="bg-[#1a1a2e]">Alle platforms</option>
                      {PLATFORMS.map((p) => (
                        <option key={p} value={p} className="bg-[#1a1a2e]">{p}</option>
                      ))}
                    </select>
                  </div>
                  <button
                    onClick={() => setShowAddIncome(true)}
                    className="btn-primary text-sm flex items-center gap-2"
                  >
                    <Plus className="w-4 h-4" /> Inkomen toevoegen
                  </button>
                </div>

                <div className="glass-card overflow-hidden">
                  {incomeItems.length === 0 ? (
                    <div className="p-10 text-center">
                      <Euro className="w-10 h-10 text-white/10 mx-auto mb-3" />
                      <p className="text-white/30 text-sm">Nog geen inkomen bijgehouden</p>
                    </div>
                  ) : (
                    <table className="data-table">
                      <thead>
                        <tr>
                          <th>Platform</th>
                          <th>Datum</th>
                          <th>Bedrag</th>
                          <th>Beschrijving</th>
                          <th></th>
                        </tr>
                      </thead>
                      <tbody>
                        {incomeItems.map((item) => (
                          <tr key={item.id}>
                            <td><span className="badge-purple text-xs">{item.platform}</span></td>
                            <td className="text-white/50 flex items-center gap-1.5 text-xs">
                              <Clock className="w-3 h-3" />{item.datum}
                            </td>
                            <td className="text-green-400 font-bold">€{item.bedrag.toFixed(2)}</td>
                            <td className="text-white/40 text-xs max-w-[150px] truncate">{item.beschrijving || '—'}</td>
                            <td>
                              <button
                                onClick={() => handleDeleteIncome(item.id)}
                                className="text-white/20 hover:text-red-400 transition-colors p-1.5 rounded-lg hover:bg-red-500/10"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  )}
                </div>
              </div>

              {/* Chart */}
              <div className="flex flex-col gap-4">
                <div className="glass-card p-5">
                  <h3 className="text-sm font-semibold text-white/60 mb-4">Inkomen per platform</h3>
                  {chartData.length > 0 ? (
                    <>
                      <ResponsiveContainer width="100%" height={180}>
                        <PieChart>
                          <Pie
                            data={chartData}
                            cx="50%"
                            cy="50%"
                            innerRadius={45}
                            outerRadius={75}
                            paddingAngle={3}
                            dataKey="value"
                          >
                            {chartData.map((_, i) => (
                              <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />
                            ))}
                          </Pie>
                          <Tooltip
                            formatter={(v: any) => [`€${v}`, 'Inkomen']}
                            contentStyle={{
                              background: 'rgba(15, 15, 30, 0.95)',
                              border: '1px solid rgba(168, 85, 247, 0.2)',
                              borderRadius: '10px',
                              color: '#f8fafc',
                            }}
                          />
                        </PieChart>
                      </ResponsiveContainer>
                      <div className="space-y-2 mt-2">
                        {chartData.map((item, i) => (
                          <div key={item.name} className="flex items-center justify-between text-xs">
                            <div className="flex items-center gap-2">
                              <div className="w-2 h-2 rounded-full" style={{ background: PIE_COLORS[i % PIE_COLORS.length] }} />
                              <span className="text-white/60">{item.name}</span>
                            </div>
                            <span className="text-white/80 font-medium">€{item.value}</span>
                          </div>
                        ))}
                      </div>
                    </>
                  ) : (
                    <div className="h-40 flex items-center justify-center">
                      <p className="text-white/20 text-xs">Geen data</p>
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* Add income modal */}
            <AnimatePresence>
              {showAddIncome && (
                <motion.div
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4"
                  onClick={() => setShowAddIncome(false)}
                >
                  <motion.div
                    initial={{ scale: 0.9, y: 20 }}
                    animate={{ scale: 1, y: 0 }}
                    exit={{ scale: 0.9, y: 20 }}
                    className="glass-card p-6 w-full max-w-md"
                    onClick={(e) => e.stopPropagation()}
                  >
                    <div className="flex items-center justify-between mb-5">
                      <h3 className="font-bold text-white">Inkomen toevoegen</h3>
                      <button onClick={() => setShowAddIncome(false)} className="text-white/30 hover:text-white">
                        <X className="w-5 h-5" />
                      </button>
                    </div>
                    <div className="space-y-4">
                      <div>
                        <label className="text-sm text-white/60 mb-1.5 block">Platform</label>
                        <select
                          value={newIncome.platform}
                          onChange={(e) => setNewIncome({ ...newIncome, platform: e.target.value })}
                          className="input-dark w-full"
                        >
                          {PLATFORMS.map((p) => <option key={p} value={p} className="bg-[#1a1a2e]">{p}</option>)}
                        </select>
                      </div>
                      <div>
                        <label className="text-sm text-white/60 mb-1.5 block">Bedrag (€)</label>
                        <input
                          type="number"
                          step="0.01"
                          min="0"
                          value={newIncome.bedrag}
                          onChange={(e) => setNewIncome({ ...newIncome, bedrag: e.target.value })}
                          placeholder="0.00"
                          className="input-dark w-full"
                        />
                      </div>
                      <div>
                        <label className="text-sm text-white/60 mb-1.5 block">Datum</label>
                        <input
                          type="date"
                          value={newIncome.datum}
                          onChange={(e) => setNewIncome({ ...newIncome, datum: e.target.value })}
                          className="input-dark w-full"
                        />
                      </div>
                      <div>
                        <label className="text-sm text-white/60 mb-1.5 block">Beschrijving (optioneel)</label>
                        <input
                          type="text"
                          value={newIncome.beschrijving}
                          onChange={(e) => setNewIncome({ ...newIncome, beschrijving: e.target.value })}
                          placeholder="Custom video, abonnement, etc."
                          className="input-dark w-full"
                        />
                      </div>
                    </div>
                    <button
                      onClick={handleAddIncome}
                      disabled={loading}
                      className="btn-primary w-full mt-5 flex items-center justify-center gap-2"
                    >
                      {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
                      Toevoegen
                    </button>
                  </motion.div>
                </motion.div>
              )}
            </AnimatePresence>
          </motion.div>
        )}

        {/* BESTELLINGEN TAB */}
        {activeTab === 'bestellingen' && (
          <motion.div key="bestellingen" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}>
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <select
                  value={orderFilter}
                  onChange={(e) => setOrderFilter(e.target.value)}
                  className="input-dark text-sm py-2"
                >
                  <option value="" className="bg-[#1a1a2e]">Alle statussen</option>
                  {ORDER_STATUSES.map((s) => (
                    <option key={s} value={s} className="bg-[#1a1a2e]">{s}</option>
                  ))}
                </select>
              </div>
              <button
                onClick={() => setShowAddOrder(true)}
                className="btn-primary text-sm flex items-center gap-2"
              >
                <Plus className="w-4 h-4" /> Bestelling toevoegen
              </button>
            </div>

            <div className="glass-card overflow-hidden">
              {orders.length === 0 ? (
                <div className="p-10 text-center">
                  <ShoppingBag className="w-10 h-10 text-white/10 mx-auto mb-3" />
                  <p className="text-white/30 text-sm">Nog geen bestellingen</p>
                </div>
              ) : (
                <table className="data-table">
                  <thead>
                    <tr>
                      <th>Klant</th>
                      <th>Platform</th>
                      <th>Prijs</th>
                      <th>Datum</th>
                      <th>Status</th>
                      <th>Acties</th>
                    </tr>
                  </thead>
                  <tbody>
                    {orders.map((order) => (
                      <tr key={order.id}>
                        <td>
                          <div className="font-medium text-white">{order.klant}</div>
                          {order.beschrijving && (
                            <div className="text-xs text-white/30 mt-0.5 max-w-[150px] truncate">{order.beschrijving}</div>
                          )}
                        </td>
                        <td><span className="badge-purple text-xs">{order.platform}</span></td>
                        <td className="text-green-400 font-bold">€{order.prijs.toFixed(2)}</td>
                        <td className="text-white/40 text-xs">{order.datum}</td>
                        <td>
                          <select
                            value={order.status}
                            onChange={(e) => handleUpdateStatus(order.id, e.target.value)}
                            className="bg-transparent text-xs border border-white/10 rounded-lg px-2 py-1 outline-none cursor-pointer text-white/70"
                          >
                            {ORDER_STATUSES.map((s) => (
                              <option key={s} value={s} className="bg-[#1a1a2e]">{s}</option>
                            ))}
                          </select>
                        </td>
                        <td>
                          <button
                            onClick={() => handleDeleteOrder(order.id)}
                            className="text-white/20 hover:text-red-400 transition-colors p-1.5 rounded-lg hover:bg-red-500/10"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>

            {/* Add order modal */}
            <AnimatePresence>
              {showAddOrder && (
                <motion.div
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4"
                  onClick={() => setShowAddOrder(false)}
                >
                  <motion.div
                    initial={{ scale: 0.9, y: 20 }}
                    animate={{ scale: 1, y: 0 }}
                    exit={{ scale: 0.9, y: 20 }}
                    className="glass-card p-6 w-full max-w-md"
                    onClick={(e) => e.stopPropagation()}
                  >
                    <div className="flex items-center justify-between mb-5">
                      <h3 className="font-bold text-white">Bestelling toevoegen</h3>
                      <button onClick={() => setShowAddOrder(false)} className="text-white/30 hover:text-white">
                        <X className="w-5 h-5" />
                      </button>
                    </div>
                    <div className="space-y-4">
                      <div>
                        <label className="text-sm text-white/60 mb-1.5 block">Klantnaam</label>
                        <input
                          type="text"
                          value={newOrder.klant}
                          onChange={(e) => setNewOrder({ ...newOrder, klant: e.target.value })}
                          placeholder="Gebruikersnaam klant"
                          className="input-dark w-full"
                        />
                      </div>
                      <div className="grid grid-cols-2 gap-3">
                        <div>
                          <label className="text-sm text-white/60 mb-1.5 block">Platform</label>
                          <select
                            value={newOrder.platform}
                            onChange={(e) => setNewOrder({ ...newOrder, platform: e.target.value })}
                            className="input-dark w-full"
                          >
                            {PLATFORMS.map((p) => <option key={p} value={p} className="bg-[#1a1a2e]">{p}</option>)}
                          </select>
                        </div>
                        <div>
                          <label className="text-sm text-white/60 mb-1.5 block">Prijs (€)</label>
                          <input
                            type="number"
                            step="0.01"
                            min="0"
                            value={newOrder.prijs}
                            onChange={(e) => setNewOrder({ ...newOrder, prijs: e.target.value })}
                            placeholder="0.00"
                            className="input-dark w-full"
                          />
                        </div>
                      </div>
                      <div>
                        <label className="text-sm text-white/60 mb-1.5 block">Beschrijving</label>
                        <input
                          type="text"
                          value={newOrder.beschrijving}
                          onChange={(e) => setNewOrder({ ...newOrder, beschrijving: e.target.value })}
                          placeholder="Wat heeft de klant besteld?"
                          className="input-dark w-full"
                        />
                      </div>
                      <div className="grid grid-cols-2 gap-3">
                        <div>
                          <label className="text-sm text-white/60 mb-1.5 block">Datum</label>
                          <input
                            type="date"
                            value={newOrder.datum}
                            onChange={(e) => setNewOrder({ ...newOrder, datum: e.target.value })}
                            className="input-dark w-full"
                          />
                        </div>
                        <div>
                          <label className="text-sm text-white/60 mb-1.5 block">Status</label>
                          <select
                            value={newOrder.status}
                            onChange={(e) => setNewOrder({ ...newOrder, status: e.target.value })}
                            className="input-dark w-full"
                          >
                            {ORDER_STATUSES.map((s) => <option key={s} value={s} className="bg-[#1a1a2e]">{s}</option>)}
                          </select>
                        </div>
                      </div>
                    </div>
                    <button
                      onClick={handleAddOrder}
                      disabled={loading}
                      className="btn-primary w-full mt-5 flex items-center justify-center gap-2"
                    >
                      {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
                      Toevoegen
                    </button>
                  </motion.div>
                </motion.div>
              )}
            </AnimatePresence>
          </motion.div>
        )}

        {/* CALCULATOR TAB */}
        {activeTab === 'calculator' && (
          <motion.div key="calculator" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}>
            <div className="max-w-lg">
              <div className="glass-card p-6">
                <h3 className="font-semibold text-white mb-5 flex items-center gap-2">
                  <Calculator className="w-4 h-4 text-purple-400" /> Prijscalculator
                </h3>
                <div className="space-y-4">
                  <div>
                    <label className="text-sm text-white/60 mb-1.5 block">Basisprijs (€)</label>
                    <input
                      type="number"
                      step="0.01"
                      min="0"
                      value={calcBase}
                      onChange={(e) => setCalcBase(e.target.value)}
                      placeholder="0.00"
                      className="input-dark w-full"
                    />
                  </div>
                  <div>
                    <label className="text-sm text-white/60 mb-1.5 block">Aantal</label>
                    <input
                      type="number"
                      min="1"
                      value={calcQty}
                      onChange={(e) => setCalcQty(e.target.value)}
                      className="input-dark w-full"
                    />
                  </div>
                  <div>
                    <label className="text-sm text-white/60 mb-1.5 block">Korting (%)</label>
                    <input
                      type="number"
                      min="0"
                      max="100"
                      value={calcDiscount}
                      onChange={(e) => setCalcDiscount(e.target.value)}
                      className="input-dark w-full"
                    />
                  </div>
                  <button
                    onClick={handleCalculate}
                    className="btn-primary w-full flex items-center justify-center gap-2"
                  >
                    <Calculator className="w-4 h-4" /> Berekenen
                  </button>
                </div>

                {calcResult && (
                  <motion.div
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="mt-6 space-y-3"
                  >
                    <div className="h-px bg-white/[0.06]" />
                    {[
                      { label: 'Subtotaal', value: calcResult.subtotal },
                      { label: 'Korting', value: -calcResult.discount, negative: true },
                    ].map((row) => (
                      <div key={row.label} className="flex justify-between text-sm">
                        <span className="text-white/50">{row.label}</span>
                        <span className={row.negative && row.value !== 0 ? 'text-red-400' : 'text-white/70'}>
                          {row.negative && calcResult.discount > 0 ? '-' : ''}€{Math.abs(row.value).toFixed(2)}
                        </span>
                      </div>
                    ))}
                    <div className="h-px bg-white/[0.06]" />
                    <div className="flex justify-between">
                      <span className="font-semibold text-white">Totaal</span>
                      <span className="font-bold text-lg text-green-400">€{calcResult.total.toFixed(2)}</span>
                    </div>
                    {parseInt(calcQty) > 1 && (
                      <div className="flex justify-between text-sm">
                        <span className="text-white/40">Per item</span>
                        <span className="text-purple-400">€{calcResult.per_item.toFixed(2)}</span>
                      </div>
                    )}
                  </motion.div>
                )}
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}
