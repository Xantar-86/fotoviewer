'use client'

import { useState, useCallback, useEffect, useRef } from 'react'
import { useDropzone } from 'react-dropzone'
import { motion, AnimatePresence } from 'framer-motion'
import toast from 'react-hot-toast'
import {
  Rocket,
  Upload,
  X,
  Loader2,
  Copy,
  Check,
  Download,
  Key,
  Sparkles,
  Image as ImageIcon,
} from 'lucide-react'
import { generatePostContent } from '@/lib/api'

// ─── Platform config ───────────────────────────────────────────────────────────

const PLATFORMS = [
  { id: 'FeetFinder', label: 'FeetFinder', color: 'pink', width: 1080, height: 1080 },
  { id: 'OnlyFans',   label: 'OnlyFans',   color: 'blue', width: 1080, height: 1350 },
  { id: 'Fansly',     label: 'Fansly',     color: 'purple', width: 1080, height: 1350 },
  { id: 'Instagram',  label: 'Instagram',  color: 'gradient', width: 1080, height: 1350 },
  { id: 'Reddit',     label: 'Reddit',     color: 'orange', width: 1080, height: 1080 },
  { id: 'Twitter',    label: 'Twitter',    color: 'sky', width: 1200, height: 675 },
  { id: 'Patreon',    label: 'Patreon',    color: 'red', width: 1080, height: 1080 },
] as const

type PlatformId = (typeof PLATFORMS)[number]['id']

const PLATFORM_COLORS: Record<string, string> = {
  pink:     'bg-pink-500/20 text-pink-300 border-pink-500/30 hover:bg-pink-500/30',
  blue:     'bg-blue-500/20 text-blue-300 border-blue-500/30 hover:bg-blue-500/30',
  purple:   'bg-purple-500/20 text-purple-300 border-purple-500/30 hover:bg-purple-500/30',
  gradient: 'bg-gradient-to-r from-pink-500/20 to-orange-500/20 text-orange-200 border-pink-500/30 hover:from-pink-500/30 hover:to-orange-500/30',
  orange:   'bg-orange-500/20 text-orange-300 border-orange-500/30 hover:bg-orange-500/30',
  sky:      'bg-sky-500/20 text-sky-300 border-sky-500/30 hover:bg-sky-500/30',
  red:      'bg-red-500/20 text-red-300 border-red-500/30 hover:bg-red-500/30',
}

const PLATFORM_BADGE_COLORS: Record<string, string> = {
  pink:     'bg-pink-500/20 text-pink-300 border-pink-500/30',
  blue:     'bg-blue-500/20 text-blue-300 border-blue-500/30',
  purple:   'bg-purple-500/20 text-purple-300 border-purple-500/30',
  gradient: 'bg-gradient-to-r from-pink-500/20 to-orange-500/20 text-orange-200 border-pink-500/30',
  orange:   'bg-orange-500/20 text-orange-300 border-orange-500/30',
  sky:      'bg-sky-500/20 text-sky-300 border-sky-500/30',
  red:      'bg-red-500/20 text-red-300 border-red-500/30',
}

// ─── Canvas resize (center crop to fill) ─────────────────────────────────────

function resizeToCanvas(img: HTMLImageElement, width: number, height: number): string {
  const canvas = document.createElement('canvas')
  canvas.width = width
  canvas.height = height
  const ctx = canvas.getContext('2d')!
  const scale = Math.max(width / img.naturalWidth, height / img.naturalHeight)
  const sw = width / scale
  const sh = height / scale
  const sx = (img.naturalWidth - sw) / 2
  const sy = (img.naturalHeight - sh) / 2
  ctx.drawImage(img, sx, sy, sw, sh, 0, 0, width, height)
  return canvas.toDataURL('image/jpeg', 0.92)
}

// ─── Types ────────────────────────────────────────────────────────────────────

interface PlatformResult {
  caption: string
  hashtags: string[]
  resizedDataUrl: string
}

// ─── Main component ───────────────────────────────────────────────────────────

export default function PostCreatorPage() {
  const [groqKey, setGroqKey] = useState('')
  const [apiKey, setApiKey] = useState('')
  const [file, setFile] = useState<File | null>(null)
  const [preview, setPreview] = useState<string | null>(null)
  const [selectedPlatforms, setSelectedPlatforms] = useState<Set<PlatformId>>(new Set())
  const [loading, setLoading] = useState(false)
  const [results, setResults] = useState<Record<string, PlatformResult> | null>(null)
  const [copied, setCopied] = useState<string | null>(null)
  const [captions, setCaptions] = useState<Record<string, string>>({})
  const imgRef = useRef<HTMLImageElement | null>(null)

  useEffect(() => {
    const gk = localStorage.getItem('groq_api_key') || ''
    const ak = localStorage.getItem('anthropic_api_key') || ''
    setGroqKey(gk)
    setApiKey(ak)
  }, [])

  const hasApiKey = !!groqKey || !!apiKey
  const canGenerate = !!file && selectedPlatforms.size > 0 && hasApiKey && !loading

  const onDrop = useCallback((accepted: File[]) => {
    const f = accepted[0]
    if (!f) return
    if (preview) URL.revokeObjectURL(preview)
    setFile(f)
    setPreview(URL.createObjectURL(f))
    setResults(null)
    setCaptions({})
  }, [preview])

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: { 'image/*': [] },
    maxFiles: 1,
    maxSize: 20 * 1024 * 1024,
  })

  function removeFile() {
    if (preview) URL.revokeObjectURL(preview)
    setFile(null)
    setPreview(null)
    setResults(null)
    setCaptions({})
  }

  function togglePlatform(pid: PlatformId) {
    setSelectedPlatforms(prev => {
      const next = new Set(prev)
      if (next.has(pid)) next.delete(pid)
      else next.add(pid)
      return next
    })
  }

  async function handleGenerate() {
    if (!canGenerate || !file) return
    setLoading(true)
    setResults(null)

    try {
      const platforms = Array.from(selectedPlatforms)
      const data = await generatePostContent(file, platforms, groqKey, apiKey)

      // Load image for canvas resizing
      const img = new window.Image()
      img.src = preview!
      await new Promise<void>((resolve, reject) => {
        img.onload = () => resolve()
        img.onerror = reject
      })
      imgRef.current = img

      // Build results with resized images
      const built: Record<string, PlatformResult> = {}
      const initialCaptions: Record<string, string> = {}

      for (const pid of platforms) {
        const aiResult = data.results[pid]
        if (!aiResult) continue

        const platConfig = PLATFORMS.find(p => p.id === pid)
        const resizedDataUrl = platConfig
          ? resizeToCanvas(img, platConfig.width, platConfig.height)
          : preview!

        built[pid] = {
          caption: aiResult.caption,
          hashtags: aiResult.hashtags,
          resizedDataUrl,
        }
        initialCaptions[pid] = aiResult.caption
      }

      setResults(built)
      setCaptions(initialCaptions)
      toast.success(`Generated content for ${platforms.length} platform${platforms.length > 1 ? 's' : ''}!`)
    } catch (e: any) {
      const msg = e?.response?.data?.error || e?.message || 'Generation failed'
      toast.error(msg)
    } finally {
      setLoading(false)
    }
  }

  function copyAll(pid: string) {
    if (!results?.[pid]) return
    const hashtags = results[pid].hashtags.map(h => `#${h}`).join(' ')
    const caption = captions[pid] || results[pid].caption
    const text = `${caption}\n\n${hashtags}`
    navigator.clipboard.writeText(text).then(() => {
      setCopied(pid)
      toast.success('Copied to clipboard!')
      setTimeout(() => setCopied(null), 2000)
    })
  }

  function downloadPhoto(pid: string) {
    if (!results?.[pid]) return
    const link = document.createElement('a')
    link.href = results[pid].resizedDataUrl
    link.download = `${pid.toLowerCase()}-post.jpg`
    link.click()
  }

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
              <Rocket className="w-5 h-5 text-purple-400" />
            </div>
            <h1 className="text-3xl font-bold gradient-text">Post Creator</h1>
          </div>
          <p className="text-white/50 text-sm">
            Generate platform-ready content in one click
          </p>
        </motion.div>

        {/* API key warning */}
        <AnimatePresence>
          {!hasApiKey && (
            <motion.div
              initial={{ opacity: 0, y: -8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              className="mb-6 glass-card border border-yellow-500/20 bg-yellow-500/5 p-4 rounded-xl flex items-center gap-3"
            >
              <Key className="w-4 h-4 text-yellow-400 flex-shrink-0" />
              <p className="text-sm text-yellow-300/80">
                No Groq API key found.{' '}
                <a href="/settings" className="underline text-yellow-300 hover:text-yellow-200 transition-colors">
                  Add your key in Settings
                </a>
                {' '}to use the Post Creator.
              </p>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Step 1: Upload photo */}
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.05 }}
          className="glass-card p-6 rounded-2xl mb-4"
        >
          <div className="flex items-center gap-2 mb-4">
            <span className="w-6 h-6 rounded-full bg-purple-500/30 text-purple-300 text-xs font-bold flex items-center justify-center">1</span>
            <h2 className="text-sm font-semibold text-white/70">Upload Photo</h2>
          </div>

          {preview ? (
            <div className="flex items-center gap-4 flex-wrap">
              <div className="relative inline-block">
                <img
                  src={preview}
                  alt="Preview"
                  className="h-28 w-28 object-cover rounded-xl border border-white/10"
                />
                <button
                  type="button"
                  onClick={removeFile}
                  className="absolute -top-2 -right-2 w-5 h-5 bg-red-500/80 hover:bg-red-500 rounded-full flex items-center justify-center transition-colors"
                >
                  <X className="w-3 h-3 text-white" />
                </button>
              </div>
              <div className="flex flex-col gap-1">
                <p className="text-sm font-medium text-white/70">{file?.name}</p>
                <p className="text-xs text-white/30">{file ? (file.size / 1024 / 1024).toFixed(2) + ' MB' : ''}</p>
                <button
                  type="button"
                  onClick={removeFile}
                  className="text-xs text-white/30 hover:text-red-400 transition-colors text-left mt-1"
                >
                  Remove photo
                </button>
              </div>
            </div>
          ) : (
            <div
              {...getRootProps()}
              className={[
                'border border-dashed rounded-xl px-6 py-10 flex flex-col items-center gap-3 cursor-pointer transition-all duration-200',
                isDragActive
                  ? 'border-purple-400/60 bg-purple-500/10'
                  : 'border-white/10 bg-white/[0.02] hover:border-purple-500/30 hover:bg-purple-500/5',
              ].join(' ')}
            >
              <input {...getInputProps()} />
              <div className="w-12 h-12 rounded-2xl bg-white/[0.05] flex items-center justify-center">
                <Upload className="w-6 h-6 text-white/30" />
              </div>
              <p className="text-sm text-white/50 text-center font-medium">
                {isDragActive ? 'Drop your photo here...' : 'Drag & drop a photo, or click to browse'}
              </p>
              <p className="text-xs text-white/25">JPG, PNG, WEBP — max 20 MB</p>
            </div>
          )}
        </motion.div>

        {/* Step 2: Select platforms */}
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="glass-card p-6 rounded-2xl mb-4"
        >
          <div className="flex items-center gap-2 mb-4">
            <span className="w-6 h-6 rounded-full bg-purple-500/30 text-purple-300 text-xs font-bold flex items-center justify-center">2</span>
            <h2 className="text-sm font-semibold text-white/70">Select Platforms</h2>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2">
            {PLATFORMS.map(platform => {
              const isSelected = selectedPlatforms.has(platform.id)
              const colorBase = PLATFORM_COLORS[platform.color]
              return (
                <button
                  key={platform.id}
                  type="button"
                  onClick={() => togglePlatform(platform.id)}
                  className={[
                    'relative px-4 py-3 rounded-xl text-sm font-medium border transition-all duration-200',
                    isSelected
                      ? colorBase
                      : 'bg-white/[0.03] text-white/40 border-white/[0.06] hover:bg-white/[0.07] hover:text-white/60',
                  ].join(' ')}
                >
                  {isSelected && (
                    <span className="absolute top-1.5 right-1.5 w-2 h-2 rounded-full bg-current opacity-80" />
                  )}
                  <span className="block text-center leading-tight">
                    {platform.label}
                  </span>
                  <span className="block text-center text-[10px] mt-0.5 opacity-60">
                    {platform.width}×{platform.height}
                  </span>
                </button>
              )
            })}
          </div>

          {selectedPlatforms.size > 0 && (
            <p className="mt-3 text-xs text-white/30">
              {selectedPlatforms.size} platform{selectedPlatforms.size > 1 ? 's' : ''} selected
            </p>
          )}
        </motion.div>

        {/* Generate button */}
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.15 }}
          className="mb-8"
        >
          <button
            type="button"
            onClick={handleGenerate}
            disabled={!canGenerate}
            className="btn-primary flex items-center gap-2 px-8 py-3 disabled:opacity-40 disabled:cursor-not-allowed w-full md:w-auto justify-center"
          >
            {loading ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                Generating for {selectedPlatforms.size} platform{selectedPlatforms.size > 1 ? 's' : ''}...
              </>
            ) : (
              <>
                <Sparkles className="w-4 h-4" />
                Generate for {selectedPlatforms.size || 0} platform{selectedPlatforms.size !== 1 ? 's' : ''}
              </>
            )}
          </button>
          {!file && <p className="text-xs text-white/25 mt-2">Upload a photo to get started</p>}
          {file && selectedPlatforms.size === 0 && <p className="text-xs text-white/25 mt-2">Select at least one platform</p>}
          {file && selectedPlatforms.size > 0 && !hasApiKey && <p className="text-xs text-yellow-400/60 mt-2">Add a Groq API key in Settings first</p>}
        </motion.div>

        {/* Results */}
        <AnimatePresence>
          {results && Object.keys(results).length > 0 && (
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 20 }}
              transition={{ duration: 0.3 }}
            >
              <h2 className="text-lg font-semibold text-white/80 mb-4 flex items-center gap-2">
                <Sparkles className="w-4 h-4 text-purple-400" />
                Generated Results
              </h2>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {Object.entries(results).map(([pid, result], index) => {
                  const platConfig = PLATFORMS.find(p => p.id === pid)
                  const isCopied = copied === pid
                  const badgeColor = platConfig ? PLATFORM_BADGE_COLORS[platConfig.color] : PLATFORM_BADGE_COLORS['purple']

                  return (
                    <motion.div
                      key={pid}
                      initial={{ opacity: 0, y: 12 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: index * 0.07 }}
                      className="glass-card p-5 rounded-2xl flex flex-col gap-4"
                    >
                      {/* Platform header */}
                      <div className="flex items-center justify-between">
                        <span className={[
                          'text-xs font-semibold px-2.5 py-1 rounded-full border',
                          badgeColor,
                        ].join(' ')}>
                          {pid}
                        </span>
                        {platConfig && (
                          <span className="text-[10px] text-white/25">
                            {platConfig.width}×{platConfig.height}px
                          </span>
                        )}
                      </div>

                      {/* Resized photo preview */}
                      <div className="flex items-start gap-3">
                        <div className="flex-shrink-0">
                          <img
                            src={result.resizedDataUrl}
                            alt={`${pid} preview`}
                            className="w-20 h-20 object-cover rounded-xl border border-white/10"
                          />
                          <button
                            type="button"
                            onClick={() => downloadPhoto(pid)}
                            className="mt-1.5 flex items-center gap-1 text-[10px] text-white/30 hover:text-purple-400 transition-colors w-full justify-center"
                          >
                            <Download className="w-3 h-3" />
                            Download
                          </button>
                        </div>

                        <div className="flex-1 min-w-0">
                          {/* Caption editable textarea */}
                          <label className="block text-[10px] font-medium text-white/40 mb-1 uppercase tracking-wider">
                            Caption
                          </label>
                          <textarea
                            value={captions[pid] ?? result.caption}
                            onChange={e => setCaptions(prev => ({ ...prev, [pid]: e.target.value }))}
                            rows={3}
                            className="input-dark w-full rounded-xl px-3 py-2 text-xs resize-none leading-relaxed"
                          />
                        </div>
                      </div>

                      {/* Hashtags */}
                      {result.hashtags.length > 0 && (
                        <div>
                          <label className="block text-[10px] font-medium text-white/40 mb-1.5 uppercase tracking-wider">
                            Hashtags
                          </label>
                          <div className="flex flex-wrap gap-1.5">
                            {result.hashtags.map((tag, i) => (
                              <button
                                key={i}
                                type="button"
                                onClick={() => {
                                  navigator.clipboard.writeText(`#${tag}`)
                                  toast.success(`#${tag} copied!`)
                                }}
                                className="text-[11px] font-medium px-2 py-0.5 rounded-full bg-purple-500/10 text-purple-300/80 border border-purple-500/20 hover:bg-purple-500/20 hover:text-purple-200 transition-all"
                                title="Click to copy"
                              >
                                #{tag}
                              </button>
                            ))}
                          </div>
                        </div>
                      )}

                      {/* Copy all button */}
                      <button
                        type="button"
                        onClick={() => copyAll(pid)}
                        className={[
                          'flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-medium transition-all duration-200 border w-full justify-center',
                          isCopied
                            ? 'bg-green-500/10 text-green-400 border-green-500/30'
                            : 'bg-white/[0.04] text-white/50 border-white/[0.06] hover:bg-white/[0.08] hover:text-white/70',
                        ].join(' ')}
                      >
                        {isCopied ? (
                          <><Check className="w-3.5 h-3.5" /> Copied!</>
                        ) : (
                          <><Copy className="w-3.5 h-3.5" /> Copy caption + hashtags</>
                        )}
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
