'use client'

import { useState, useCallback, useEffect } from 'react'
import { useDropzone } from 'react-dropzone'
import { motion, AnimatePresence } from 'framer-motion'
import toast from 'react-hot-toast'
import {
  FileText,
  Sparkles,
  Copy,
  Check,
  Key,
  Upload,
  X,
  Loader2,
  Wand2,
} from 'lucide-react'
import { generateCaption, CaptionResult } from '@/lib/api'
import axios from 'axios'

const PLATFORMS = ['FeetFinder', 'OnlyFans', 'Fansly', 'Instagram', 'Patreon'] as const
type Platform = (typeof PLATFORMS)[number]

const TOONS = [
  { value: 'sensueel', label: 'Sensueel' },
  { value: 'speels', label: 'Speels' },
  { value: 'professioneel', label: 'Professioneel' },
  { value: 'mysterieus', label: 'Mysterieus' },
  { value: 'lief', label: 'Lief' },
] as const
type Toon = (typeof TOONS)[number]['value']

function getErrorMsg(e: unknown, fallback: string): string {
  const err = e as { response?: { data?: { error?: string }; status?: number } }
  if (err?.response?.status === 401) return 'Ongeldige API sleutel. Controleer je instellingen.'
  if (err?.response?.status === 429) return 'Te veel verzoeken. Probeer het straks opnieuw.'
  return err?.response?.data?.error || fallback
}

export default function CaptionPage() {
  const [apiKey, setApiKey] = useState('')
  const [platform, setPlatform] = useState<Platform>('FeetFinder')
  const [toon, setToon] = useState<Toon>('sensueel')
  const [theme, setTheme] = useState('')
  const [file, setFile] = useState<File | null>(null)
  const [preview, setPreview] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [analyzing, setAnalyzing] = useState(false)
  const [suggestedHashtags, setSuggestedHashtags] = useState<string[]>([])
  const [captions, setCaptions] = useState<CaptionResult[]>([])
  const [copied, setCopied] = useState<string | null>(null)

  useEffect(() => {
    const stored = localStorage.getItem('anthropic_api_key')
    if (stored) setApiKey(stored)
  }, [])

  const analyzeFile = useCallback(async (f: File, currentPlatform: string) => {
    const key = apiKey || localStorage.getItem('anthropic_api_key') || ''
    if (!key) {
      toast.error('Voeg eerst je Anthropic API sleutel toe in Instellingen')
      return
    }
    setAnalyzing(true)
    setSuggestedHashtags([])
    setTheme('')
    try {
      const form = new FormData()
      form.append('file', f)
      form.append('api_key', key)
      form.append('platform', currentPlatform)
      const res = await axios.post('/api/ai/caption-analyze', form)
      if (res.data.beschrijving) {
        setTheme(res.data.beschrijving)
        toast.success('Foto geanalyseerd voor ' + currentPlatform + '!')
      }
      if (res.data.hashtags?.length) {
        setSuggestedHashtags(res.data.hashtags)
      }
    } catch (e: any) {
      const msg = e?.response?.data?.error || e?.message || 'Analyse mislukt'
      toast.error('AI analyse mislukt: ' + msg)
    } finally {
      setAnalyzing(false)
    }
  }, [apiKey])

  const onDrop = useCallback((accepted: File[]) => {
    const f = accepted[0]
    if (!f) return
    setFile(f)
    setPreview(URL.createObjectURL(f))
    analyzeFile(f, platform)
  }, [platform, analyzeFile])

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: { 'image/*': [] },
    maxFiles: 1,
    maxSize: 10 * 1024 * 1024,
  })

  function removeFile() {
    if (preview) URL.revokeObjectURL(preview)
    setFile(null)
    setPreview(null)
    setSuggestedHashtags([])
  }

  async function handleGenerate() {
    if (!apiKey || !theme.trim()) return
    setLoading(true)
    setCaptions([])
    try {
      const result = await generateCaption(platform, theme.trim(), toon, apiKey, file ?? undefined)
      setCaptions(result.captions)
      if (result.captions.length === 0) {
        toast.error('Geen captions gegenereerd. Probeer opnieuw.')
      } else {
        toast.success(`${result.captions.length} captions gegenereerd!`)
      }
    } catch (e) {
      toast.error(getErrorMsg(e, 'Fout bij genereren van captions'))
    } finally {
      setLoading(false)
    }
  }

  function copyCaption(caption: CaptionResult, id: string) {
    const hashtags = caption.hashtags.map(h => `#${h}`).join(' ')
    const text = `${caption.tekst}\n\n${hashtags}`
    navigator.clipboard.writeText(text).then(() => {
      setCopied(id)
      toast.success('Caption gekopieerd!')
      setTimeout(() => setCopied(null), 2000)
    })
  }

  const canGenerate = !!apiKey && !!theme.trim() && !loading

  return (
    <div className="min-h-screen p-4 md:p-8">
      <div className="max-w-5xl mx-auto">

        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: -16 }}
          animate={{ opacity: 1, y: 0 }}
          className="mb-8"
        >
          <div className="flex items-center gap-3 mb-2">
            <div className="w-10 h-10 rounded-xl bg-purple-500/20 flex items-center justify-center">
              <FileText className="w-5 h-5 text-purple-400" />
            </div>
            <h1 className="text-3xl font-bold gradient-text">Caption Generator</h1>
          </div>
          <p className="text-white/50 text-sm">
            Genereer platformspecifieke post captions met AI in het Nederlands
          </p>
        </motion.div>

        {/* API key warning */}
        <AnimatePresence>
          {!apiKey && (
            <motion.div
              initial={{ opacity: 0, y: -8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              className="mb-6 glass-card border border-yellow-500/20 bg-yellow-500/5 p-4 rounded-xl flex items-center gap-3"
            >
              <Key className="w-4 h-4 text-yellow-400 flex-shrink-0" />
              <p className="text-sm text-yellow-300/80">
                Geen Anthropic API sleutel gevonden.{' '}
                <a href="/settings" className="underline text-yellow-300 hover:text-yellow-200 transition-colors">
                  Voeg je sleutel toe in Instellingen
                </a>
              </p>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Form */}
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.05 }}
          className="glass-card p-6 rounded-2xl mb-6"
        >
          <div className="space-y-6">

            {/* Platform selector */}
            <div>
              <label className="block text-sm font-medium text-white/70 mb-2">Platform</label>
              <select
                value={platform}
                onChange={e => setPlatform(e.target.value as Platform)}
                className="input-dark w-full md:w-56 rounded-xl px-3 py-2.5 text-sm"
              >
                {PLATFORMS.map(p => (
                  <option key={p} value={p}>{p}</option>
                ))}
              </select>
            </div>

            {/* Toon selector */}
            <div>
              <label className="block text-sm font-medium text-white/70 mb-2">Toon</label>
              <div className="flex flex-wrap gap-2">
                {TOONS.map(t => (
                  <button
                    key={t.value}
                    type="button"
                    onClick={() => setToon(t.value)}
                    className={[
                      'px-4 py-2 rounded-xl text-sm font-medium transition-all duration-200',
                      toon === t.value
                        ? 'bg-purple-500/30 text-purple-200 border border-purple-500/40'
                        : 'bg-white/[0.04] text-white/50 border border-white/[0.06] hover:bg-white/[0.08] hover:text-white/70',
                    ].join(' ')}
                  >
                    {t.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Theme textarea */}
            <div>
              <label className="block text-sm font-medium text-white/70 mb-2 flex items-center gap-2">
                Content beschrijving <span className="text-purple-400">*</span>
                {analyzing && (
                  <span className="flex items-center gap-1 text-xs text-purple-400 font-normal">
                    <Loader2 className="w-3 h-3 animate-spin" /> AI analyseert foto...
                  </span>
                )}
                {!analyzing && theme && file && (
                  <span className="flex items-center gap-1 text-xs text-green-400 font-normal">
                    <Wand2 className="w-3 h-3" /> Automatisch ingevuld
                  </span>
                )}
              </label>
              <textarea
                value={theme}
                onChange={e => setTheme(e.target.value)}
                placeholder={analyzing ? 'AI beschrijft je foto...' : 'Beschrijf je foto of content...'}
                rows={3}
                disabled={analyzing}
                className="input-dark w-full rounded-xl px-3 py-2.5 text-sm resize-none disabled:opacity-60"
              />
            </div>

            {/* Photo upload dropzone */}
            <div>
              <label className="block text-sm font-medium text-white/70 mb-2">
                Foto voor AI-analyse{' '}
                <span className="text-white/30 font-normal">(optioneel)</span>
              </label>
              {preview ? (
                <div className="flex items-center gap-4 flex-wrap">
                  <div className="relative inline-block">
                    <img
                      src={preview}
                      alt="Preview"
                      className="h-24 w-24 object-cover rounded-xl border border-white/10"
                    />
                    {analyzing && (
                      <div className="absolute inset-0 rounded-xl bg-black/50 flex items-center justify-center">
                        <Loader2 className="w-5 h-5 text-purple-400 animate-spin" />
                      </div>
                    )}
                    <button
                      type="button"
                      onClick={removeFile}
                      className="absolute -top-2 -right-2 w-5 h-5 bg-red-500/80 hover:bg-red-500 rounded-full flex items-center justify-center transition-colors"
                    >
                      <X className="w-3 h-3 text-white" />
                    </button>
                    <p className="mt-1.5 text-[11px] text-white/40 truncate max-w-[6rem]">{file?.name}</p>
                  </div>
                  <button
                    type="button"
                    onClick={() => file && analyzeFile(file, platform)}
                    disabled={analyzing || !file}
                    className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium bg-purple-600/30 text-purple-300 border border-purple-500/30 hover:bg-purple-600/40 disabled:opacity-40 disabled:cursor-not-allowed transition-all"
                  >
                    {analyzing ? (
                      <><Loader2 className="w-4 h-4 animate-spin" /> Analyseren...</>
                    ) : (
                      <><Wand2 className="w-4 h-4" /> Analyseer foto met AI</>
                    )}
                  </button>
                </div>
              ) : (
                <div
                  {...getRootProps()}
                  className={[
                    'border border-dashed rounded-xl px-4 py-5 flex flex-col items-center gap-2 cursor-pointer transition-all duration-200',
                    isDragActive
                      ? 'border-purple-400/60 bg-purple-500/10'
                      : 'border-white/10 bg-white/[0.02] hover:border-purple-500/30 hover:bg-purple-500/5',
                  ].join(' ')}
                >
                  <input {...getInputProps()} />
                  <Upload className="w-5 h-5 text-white/30" />
                  <p className="text-xs text-white/40 text-center">
                    {isDragActive
                      ? 'Laat foto los...'
                      : 'Voeg foto toe voor AI-analyse (optioneel)'}
                  </p>
                  <p className="text-[10px] text-white/25">JPG, PNG, WEBP — max 10 MB</p>
                </div>
              )}
            </div>

            {/* Hashtag suggesties */}
            <AnimatePresence>
              {suggestedHashtags.length > 0 && (
                <motion.div
                  initial={{ opacity: 0, y: -8 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0 }}
                >
                  <label className="block text-sm font-medium text-white/70 mb-2 flex items-center gap-2">
                    <Sparkles className="w-3.5 h-3.5 text-purple-400" />
                    Hashtag suggesties
                    <span className="text-white/30 font-normal text-xs">— klik om toe te voegen aan beschrijving</span>
                  </label>
                  <div className="flex flex-wrap gap-1.5">
                    {suggestedHashtags.map((tag) => (
                      <button
                        key={tag}
                        type="button"
                        onClick={() => setTheme(prev => prev ? `${prev} #${tag}` : `#${tag}`)}
                        className="text-[11px] font-medium px-2.5 py-1 rounded-full bg-purple-500/10 text-purple-300/70 border border-purple-500/20 hover:bg-purple-500/25 hover:text-purple-200 transition-all"
                      >
                        #{tag}
                      </button>
                    ))}
                  </div>
                </motion.div>
              )}
            </AnimatePresence>

            {/* Generate button */}
            <div className="pt-1">
              <button
                type="button"
                onClick={handleGenerate}
                disabled={!canGenerate}
                className="btn-primary flex items-center gap-2 px-6 py-3 disabled:opacity-40 disabled:cursor-not-allowed"
              >
                {loading ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    AI genereert captions...
                  </>
                ) : (
                  <>
                    <Sparkles className="w-4 h-4" />
                    Genereer Captions
                  </>
                )}
              </button>
            </div>
          </div>
        </motion.div>

        {/* Results */}
        <AnimatePresence>
          {captions.length > 0 && (
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 20 }}
              transition={{ duration: 0.3 }}
            >
              <h2 className="text-lg font-semibold text-white/80 mb-4">
                Gegenereerde Captions
              </h2>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                {captions.map((caption, index) => {
                  const cardId = `caption-${index}`
                  const isCopied = copied === cardId
                  return (
                    <motion.div
                      key={index}
                      initial={{ opacity: 0, y: 12 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: index * 0.07 }}
                      className="glass-card p-5 rounded-2xl flex flex-col gap-4"
                    >
                      {/* Caption number */}
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-semibold text-purple-400 uppercase tracking-wider">
                          Caption {index + 1}
                        </span>
                        <button
                          type="button"
                          onClick={() => copyCaption(caption, cardId)}
                          className={[
                            'glass-button flex items-center gap-1.5 px-3 py-1.5 text-xs rounded-lg transition-all duration-200',
                            isCopied
                              ? 'text-green-400 border-green-500/30 bg-green-500/10'
                              : 'text-white/60 hover:text-white/90',
                          ].join(' ')}
                        >
                          {isCopied ? (
                            <>
                              <Check className="w-3.5 h-3.5" />
                              Gekopieerd
                            </>
                          ) : (
                            <>
                              <Copy className="w-3.5 h-3.5" />
                              Kopieer
                            </>
                          )}
                        </button>
                      </div>

                      {/* Caption text */}
                      <p className="text-sm text-white/80 leading-relaxed flex-1 whitespace-pre-wrap">
                        {caption.tekst}
                      </p>

                      {/* Hashtags */}
                      {caption.hashtags.length > 0 && (
                        <div className="flex flex-wrap gap-1.5">
                          {caption.hashtags.map((tag, i) => (
                            <span
                              key={i}
                              className="text-[11px] font-medium px-2 py-0.5 rounded-full bg-purple-500/15 text-purple-300 border border-purple-500/20"
                            >
                              #{tag}
                            </span>
                          ))}
                        </div>
                      )}

                      {/* Alles kopiëren (tekst + hashtags) */}
                      <button
                        type="button"
                        onClick={() => copyCaption(caption, cardId)}
                        className="text-[11px] text-white/30 hover:text-purple-400 transition-colors text-left"
                      >
                        Alles kopiëren (tekst + hashtags)
                      </button>
                    </motion.div>
                  )
                })}
              </div>
            </motion.div>
          )}
        </AnimatePresence>

      </div>
    </div>
  )
}
