'use client'

import { useState, useEffect } from 'react'
import { motion } from 'framer-motion'
import toast from 'react-hot-toast'
import {
  Settings,
  Key,
  Shield,
  Save,
  Eye,
  EyeOff,
  CheckCircle,
  AlertCircle,
  Server,
  Palette,
  Info,
  ExternalLink,
  Sparkles,
} from 'lucide-react'

export default function SettingsPage() {
  const [apiKey, setApiKey] = useState('')
  const [showKey, setShowKey] = useState(false)
  const [watermarkText, setWatermarkText] = useState('© FeetBusiness')
  const [removeBgKey, setRemoveBgKey] = useState('')
  const [stabilityKey, setStabilityKey] = useState('')

  useEffect(() => {
    const storedKey = localStorage.getItem('anthropic_api_key') || ''
    const storedWatermark = localStorage.getItem('default_watermark') || '© FeetBusiness'
    const storedRemoveBgKey = localStorage.getItem('remove_bg_api_key') || ''
    const storedStabilityKey = localStorage.getItem('stability_api_key') || ''
    setApiKey(storedKey)
    setWatermarkText(storedWatermark)
    setRemoveBgKey(storedRemoveBgKey)
    setStabilityKey(storedStabilityKey)
  }, [])

  const saveSettings = () => {
    localStorage.setItem('anthropic_api_key', apiKey)
    localStorage.setItem('default_watermark', watermarkText)
    localStorage.setItem('remove_bg_api_key', removeBgKey)
    localStorage.setItem('stability_api_key', stabilityKey)
    toast.success('Instellingen opgeslagen')
  }

  const clearAllData = () => {
    if (!confirm('Weet je zeker dat je alle lokale gegevens wilt wissen?')) return
    localStorage.clear()
    setApiKey('')
    setWatermarkText('© FeetBusiness')
    setRemoveBgKey('')
    setStabilityKey('')
    toast.success('Alle lokale gegevens gewist')
  }

  const sections = [
    {
      icon: Key,
      title: 'Anthropic API',
      description: 'Vereist voor de AI Studio functies',
      color: 'text-purple-400',
      iconBg: 'bg-purple-500/15',
    },
  ]

  return (
    <div className="max-w-3xl mx-auto">
      {/* Header */}
      <div className="flex items-center gap-3 mb-8">
        <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-gray-500 to-slate-600 flex items-center justify-center">
          <Settings className="w-4 h-4 text-white" />
        </div>
        <div>
          <span className="text-sm font-medium text-purple-400 uppercase tracking-widest block">Instellingen</span>
          <h1 className="text-3xl font-black gradient-text">Configuratie</h1>
        </div>
      </div>

      <div className="space-y-5">
        {/* API Key */}
        <motion.div
          initial={{ opacity: 0, y: 15 }}
          animate={{ opacity: 1, y: 0 }}
          className="glass-card p-6"
        >
          <div className="flex items-center gap-3 mb-5">
            <div className="w-9 h-9 bg-purple-500/15 rounded-xl flex items-center justify-center">
              <Key className="w-4.5 h-4.5 text-purple-400" />
            </div>
            <div>
              <h3 className="font-semibold text-white">Anthropic API Sleutel</h3>
              <p className="text-xs text-white/40">Vereist voor AI Studio functionaliteit</p>
            </div>
            {apiKey && (
              <span className="ml-auto badge-green text-xs flex items-center gap-1">
                <CheckCircle className="w-3 h-3" /> Geconfigureerd
              </span>
            )}
          </div>

          <div className="flex gap-2 mb-3">
            <div className="relative flex-1">
              <input
                type={showKey ? 'text' : 'password'}
                value={apiKey}
                onChange={(e) => setApiKey(e.target.value)}
                placeholder="sk-ant-api03-..."
                className="input-dark w-full font-mono text-sm pr-10"
              />
              <button
                onClick={() => setShowKey(!showKey)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-white/30 hover:text-white/60 transition-colors"
              >
                {showKey ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
          </div>

          <div className="bg-purple-500/8 border border-purple-500/15 rounded-xl p-3">
            <p className="text-xs text-white/40 leading-relaxed">
              Haal je API sleutel op via{' '}
              <a
                href="https://console.anthropic.com"
                target="_blank"
                rel="noopener noreferrer"
                className="text-purple-400 hover:text-purple-300 inline-flex items-center gap-0.5"
              >
                console.anthropic.com
                <ExternalLink className="w-3 h-3" />
              </a>
              . De sleutel wordt alleen lokaal in je browser opgeslagen en wordt nooit naar servers gestuurd.
            </p>
          </div>
        </motion.div>

        {/* remove.bg API Key */}
        <motion.div
          initial={{ opacity: 0, y: 15 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.05 }}
          className="glass-card p-6"
        >
          <div className="flex items-center gap-3 mb-5">
            <div className="w-9 h-9 bg-green-500/15 rounded-xl flex items-center justify-center">
              <Palette className="w-4.5 h-4.5 text-green-400" />
            </div>
            <div>
              <h3 className="font-semibold text-white">remove.bg API Sleutel</h3>
              <p className="text-xs text-white/40">Vereist voor achtergrond verwijderen in AI Studio</p>
            </div>
            {removeBgKey && (
              <span className="ml-auto badge-green text-xs flex items-center gap-1">
                <CheckCircle className="w-3 h-3" /> Geconfigureerd
              </span>
            )}
          </div>

          <div className="flex gap-2 mb-3">
            <div className="relative flex-1">
              <input
                type={showKey ? 'text' : 'password'}
                value={removeBgKey}
                onChange={(e) => setRemoveBgKey(e.target.value)}
                placeholder="Plak hier je remove.bg API sleutel"
                className="input-dark w-full font-mono text-sm"
              />
            </div>
          </div>

          <div className="bg-green-500/8 border border-green-500/15 rounded-xl p-3">
            <p className="text-xs text-white/40 leading-relaxed">
              Gratis account via{' '}
              <a
                href="https://www.remove.bg/dashboard#api-key"
                target="_blank"
                rel="noopener noreferrer"
                className="text-green-400 hover:text-green-300 inline-flex items-center gap-0.5"
              >
                remove.bg/dashboard
                <ExternalLink className="w-3 h-3" />
              </a>
              {' '}— 50 gratis verwijderingen per maand.
            </p>
          </div>
        </motion.div>

        {/* Stability AI API Key */}
        <motion.div
          initial={{ opacity: 0, y: 15 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="glass-card p-6"
        >
          <div className="flex items-center gap-3 mb-5">
            <div className="w-9 h-9 bg-violet-500/15 rounded-xl flex items-center justify-center">
              <Sparkles className="w-4.5 h-4.5 text-violet-400" />
            </div>
            <div>
              <h3 className="font-semibold text-white">Stability AI API Sleutel</h3>
              <p className="text-xs text-white/40">Vereist voor AI achtergrond genereren (generatieve AI)</p>
            </div>
            {stabilityKey && (
              <span className="ml-auto badge-green text-xs flex items-center gap-1">
                <CheckCircle className="w-3 h-3" /> Geconfigureerd
              </span>
            )}
          </div>

          <div className="flex gap-2 mb-3">
            <div className="relative flex-1">
              <input
                type={showKey ? 'text' : 'password'}
                value={stabilityKey}
                onChange={(e) => setStabilityKey(e.target.value)}
                placeholder="sk-..."
                className="input-dark w-full font-mono text-sm"
              />
            </div>
          </div>

          <div className="bg-violet-500/8 border border-violet-500/15 rounded-xl p-3">
            <p className="text-xs text-white/40 leading-relaxed">
              Haal je API sleutel op via{' '}
              <a
                href="https://platform.stability.ai/account/keys"
                target="_blank"
                rel="noopener noreferrer"
                className="text-violet-400 hover:text-violet-300 inline-flex items-center gap-0.5"
              >
                platform.stability.ai
                <ExternalLink className="w-3 h-3" />
              </a>
              {' '}— Gratis credits voor nieuwe accounts. Gebruikt voor fotorealistisch achtergrond vervangen.
            </p>
          </div>
        </motion.div>

        {/* API Status */}
        <motion.div
          initial={{ opacity: 0, y: 15 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="glass-card p-6"
        >
          <div className="flex items-center gap-3 mb-5">
            <div className="w-9 h-9 bg-green-500/15 rounded-xl flex items-center justify-center">
              <Server className="w-4.5 h-4.5 text-green-400" />
            </div>
            <div>
              <h3 className="font-semibold text-white">Backend Status</h3>
              <p className="text-xs text-white/40">Next.js API routes (ingebouwd)</p>
            </div>
            <span className="ml-auto badge-green text-xs flex items-center gap-1">
              <CheckCircle className="w-3 h-3" /> Actief
            </span>
          </div>

          <div className="space-y-2 text-sm">
            {[
              { route: '/api/images/*', label: 'Foto verwerking (sharp)' },
              { route: '/api/ai/*', label: 'AI Studio (Claude)' },
              { route: '/api/business/*', label: 'Business data (Supabase)' },
            ].map(({ route, label }) => (
              <div key={route} className="flex items-center justify-between bg-white/[0.02] rounded-xl px-3 py-2">
                <span className="text-white/50">{label}</span>
                <code className="text-xs text-purple-400/70 font-mono">{route}</code>
              </div>
            ))}
          </div>
        </motion.div>

        {/* Default watermark */}
        <motion.div
          initial={{ opacity: 0, y: 15 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.15 }}
          className="glass-card p-6"
        >
          <div className="flex items-center gap-3 mb-5">
            <div className="w-9 h-9 bg-pink-500/15 rounded-xl flex items-center justify-center">
              <Palette className="w-4.5 h-4.5 text-pink-400" />
            </div>
            <div>
              <h3 className="font-semibold text-white">Standaard Watermerk</h3>
              <p className="text-xs text-white/40">Vooraf ingevulde tekst in de editor</p>
            </div>
          </div>

          <input
            type="text"
            value={watermarkText}
            onChange={(e) => setWatermarkText(e.target.value)}
            placeholder="© FeetBusiness"
            className="input-dark w-full"
          />
        </motion.div>

        {/* Privacy */}
        <motion.div
          initial={{ opacity: 0, y: 15 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
          className="glass-card p-6"
        >
          <div className="flex items-center gap-3 mb-4">
            <div className="w-9 h-9 bg-green-500/15 rounded-xl flex items-center justify-center">
              <Shield className="w-4.5 h-4.5 text-green-400" />
            </div>
            <div>
              <h3 className="font-semibold text-white">Privacy & Beveiliging</h3>
              <p className="text-xs text-white/40">Informatie over gegevensopslag</p>
            </div>
          </div>

          <ul className="space-y-2.5 mb-4">
            {[
              'API sleutels worden alleen lokaal opgeslagen (localStorage)',
              'Foto\'s worden verwerkt via je eigen backend server',
              "Geen foto's worden permanent opgeslagen of gedeeld",
              'Alle verbindingen zijn direct tussen jouw browser en jouw server',
            ].map((item) => (
              <li key={item} className="flex items-start gap-2 text-sm text-white/50">
                <CheckCircle className="w-3.5 h-3.5 text-green-400 flex-shrink-0 mt-0.5" />
                {item}
              </li>
            ))}
          </ul>

          <button
            onClick={clearAllData}
            className="text-sm text-red-400/70 hover:text-red-400 transition-colors flex items-center gap-1.5"
          >
            <AlertCircle className="w-3.5 h-3.5" />
            Alle lokale gegevens wissen
          </button>
        </motion.div>

        {/* App info */}
        <motion.div
          initial={{ opacity: 0, y: 15 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.25 }}
          className="glass-card p-6"
        >
          <div className="flex items-center gap-3 mb-4">
            <div className="w-9 h-9 bg-white/5 rounded-xl flex items-center justify-center">
              <Info className="w-4.5 h-4.5 text-white/40" />
            </div>
            <h3 className="font-semibold text-white">Over FeetBusiness Studio</h3>
          </div>

          <div className="grid grid-cols-2 gap-3 text-sm">
            {[
              { label: 'Versie', value: '2.0.0' },
              { label: 'Framework', value: 'Next.js 15' },
              { label: 'Backend', value: 'FastAPI 0.115' },
              { label: 'AI Model', value: 'Claude Opus' },
            ].map(({ label, value }) => (
              <div key={label} className="bg-white/[0.02] rounded-xl p-3">
                <div className="text-xs text-white/30 mb-0.5">{label}</div>
                <div className="text-white/70 font-medium">{value}</div>
              </div>
            ))}
          </div>
        </motion.div>

        {/* Save button */}
        <motion.div
          initial={{ opacity: 0, y: 15 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3 }}
        >
          <button
            onClick={saveSettings}
            className="btn-primary w-full flex items-center justify-center gap-2"
          >
            <Save className="w-4 h-4" /> Instellingen opslaan
          </button>
        </motion.div>
      </div>
    </div>
  )
}
