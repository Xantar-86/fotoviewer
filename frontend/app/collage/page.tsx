'use client'

import { useState, useCallback, useRef } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { useDropzone } from 'react-dropzone'
import { Grid2X2, Download, RotateCcw, Upload, X, ImageIcon } from 'lucide-react'
import toast from 'react-hot-toast'

// ─── Types ────────────────────────────────────────────────────────────────────

type LayoutId = '2h' | '2v' | '3t' | '3s' | '4'
type FormatId = 'square' | 'portrait' | 'landscape'

interface LayoutOption {
  id: LayoutId
  label: string
  slots: number
  preview: React.ReactNode
}

interface FormatOption {
  id: FormatId
  label: string
  width: number
  height: number
}

// ─── Cover crop helper ────────────────────────────────────────────────────────

function drawCover(
  ctx: CanvasRenderingContext2D,
  img: HTMLImageElement,
  dx: number,
  dy: number,
  dw: number,
  dh: number
) {
  const scale = Math.max(dw / img.naturalWidth, dh / img.naturalHeight)
  const sw = dw / scale
  const sh = dh / scale
  const sx = (img.naturalWidth - sw) / 2
  const sy = (img.naturalHeight - sh) / 2
  ctx.drawImage(img, sx, sy, sw, sh, dx, dy, dw, dh)
}

// ─── Layout preview components ────────────────────────────────────────────────

function Preview2H() {
  return (
    <div className="flex gap-0.5 w-full h-full">
      <div className="flex-1 bg-purple-400/40 rounded-sm" />
      <div className="flex-1 bg-purple-400/25 rounded-sm" />
    </div>
  )
}

function Preview2V() {
  return (
    <div className="flex flex-col gap-0.5 w-full h-full">
      <div className="flex-1 bg-purple-400/40 rounded-sm" />
      <div className="flex-1 bg-purple-400/25 rounded-sm" />
    </div>
  )
}

function Preview3T() {
  return (
    <div className="flex flex-col gap-0.5 w-full h-full">
      <div className="flex gap-0.5 flex-1">
        <div className="flex-1 bg-purple-400/40 rounded-sm" />
        <div className="flex-1 bg-purple-400/25 rounded-sm" />
      </div>
      <div className="flex-1 bg-purple-400/30 rounded-sm" />
    </div>
  )
}

function Preview3S() {
  return (
    <div className="flex gap-0.5 w-full h-full">
      <div className="flex-1 bg-purple-400/40 rounded-sm" />
      <div className="flex flex-col gap-0.5 flex-1">
        <div className="flex-1 bg-purple-400/25 rounded-sm" />
        <div className="flex-1 bg-purple-400/30 rounded-sm" />
      </div>
    </div>
  )
}

function Preview4() {
  return (
    <div className="flex flex-col gap-0.5 w-full h-full">
      <div className="flex gap-0.5 flex-1">
        <div className="flex-1 bg-purple-400/40 rounded-sm" />
        <div className="flex-1 bg-purple-400/25 rounded-sm" />
      </div>
      <div className="flex gap-0.5 flex-1">
        <div className="flex-1 bg-purple-400/30 rounded-sm" />
        <div className="flex-1 bg-purple-400/20 rounded-sm" />
      </div>
    </div>
  )
}

// ─── Layout & format definitions ──────────────────────────────────────────────

const LAYOUTS: LayoutOption[] = [
  { id: '2h', label: '2 foto\'s naast elkaar', slots: 2, preview: <Preview2H /> },
  { id: '2v', label: '2 foto\'s boven elkaar', slots: 2, preview: <Preview2V /> },
  { id: '3t', label: '2 boven, 1 breed onder', slots: 3, preview: <Preview3T /> },
  { id: '3s', label: '1 links, 2 rechts gestapeld', slots: 3, preview: <Preview3S /> },
  { id: '4',  label: '2×2 raster', slots: 4, preview: <Preview4 /> },
]

const FORMATS: FormatOption[] = [
  { id: 'square',    label: 'Vierkant 1080×1080',  width: 1080, height: 1080 },
  { id: 'portrait',  label: 'Portret 1080×1350',   width: 1080, height: 1350 },
  { id: 'landscape', label: 'Liggend 1920×1080',   width: 1920, height: 1080 },
]

// ─── Single dropzone slot ─────────────────────────────────────────────────────

interface SlotProps {
  index: number
  preview: string | null
  onDrop: (file: File, index: number) => void
  onRemove: (index: number) => void
}

function PhotoSlot({ index, preview, onDrop, onRemove }: SlotProps) {
  const label = ['A', 'B', 'C', 'D'][index]

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    accept: { 'image/*': [] },
    multiple: false,
    onDrop: (accepted) => {
      if (accepted[0]) onDrop(accepted[0], index)
    },
  })

  return (
    <div className="relative">
      {preview ? (
        <div className="relative rounded-xl overflow-hidden border border-purple-500/30 aspect-square">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={preview}
            alt={`Foto ${label}`}
            className="w-full h-full object-cover"
          />
          <div className="absolute inset-0 bg-black/20" />
          <button
            onClick={() => onRemove(index)}
            className="absolute top-2 right-2 w-7 h-7 rounded-full bg-black/60 border border-white/20 flex items-center justify-center text-white/80 hover:text-white hover:bg-red-500/70 transition-all duration-200"
          >
            <X className="w-3.5 h-3.5" />
          </button>
          <div className="absolute bottom-2 left-2 w-6 h-6 rounded-md bg-purple-600/80 flex items-center justify-center">
            <span className="text-xs font-bold text-white">{label}</span>
          </div>
        </div>
      ) : (
        <div
          {...getRootProps()}
          className={`
            aspect-square rounded-xl border-2 border-dashed flex flex-col items-center justify-center cursor-pointer
            transition-all duration-200 select-none
            ${isDragActive
              ? 'border-purple-400 bg-purple-500/20'
              : 'border-white/15 bg-white/[0.03] hover:border-purple-500/50 hover:bg-purple-500/10'
            }
          `}
        >
          <input {...getInputProps()} />
          <div className="w-8 h-8 rounded-lg bg-purple-500/20 flex items-center justify-center mb-2">
            <span className="text-base font-bold text-purple-400">{label}</span>
          </div>
          <Upload className="w-4 h-4 text-white/30 mb-1" />
          <p className="text-xs text-white/30 text-center px-2 leading-tight">
            {isDragActive ? 'Loslaten...' : 'Sleep of klik'}
          </p>
        </div>
      )}
    </div>
  )
}

// ─── Main page ────────────────────────────────────────────────────────────────

export default function CollagePage() {
  const [selectedLayout, setSelectedLayout] = useState<LayoutId>('2h')
  const [images, setImages] = useState<(string | null)[]>([null, null, null, null])
  const [files, setFiles] = useState<(File | null)[]>([null, null, null, null])
  const [gap, setGap] = useState(4)
  const [bgColor, setBgColor] = useState('#000000')
  const [format, setFormat] = useState<FormatId>('square')
  const [generating, setGenerating] = useState(false)
  const [resultUrl, setResultUrl] = useState<string | null>(null)
  const downloadRef = useRef<HTMLAnchorElement>(null)

  const currentLayout = LAYOUTS.find(l => l.id === selectedLayout)!
  const currentFormat = FORMATS.find(f => f.id === format)!
  const requiredSlots = currentLayout.slots
  const filledSlots = images.slice(0, requiredSlots).filter(Boolean).length
  const allFilled = filledSlots === requiredSlots

  // When layout changes, keep existing images but reset result
  const handleLayoutChange = (id: LayoutId) => {
    setSelectedLayout(id)
    setResultUrl(null)
  }

  const handleDrop = useCallback((file: File, index: number) => {
    const url = URL.createObjectURL(file)
    setImages(prev => {
      const next = [...prev]
      // Revoke old object URL to free memory
      if (next[index]) URL.revokeObjectURL(next[index]!)
      next[index] = url
      return next
    })
    setFiles(prev => {
      const next = [...prev]
      next[index] = file
      return next
    })
    setResultUrl(null)
  }, [])

  const handleRemove = useCallback((index: number) => {
    setImages(prev => {
      const next = [...prev]
      if (next[index]) URL.revokeObjectURL(next[index]!)
      next[index] = null
      return next
    })
    setFiles(prev => {
      const next = [...prev]
      next[index] = null
      return next
    })
    setResultUrl(null)
  }, [])

  const loadImage = (src: string): Promise<HTMLImageElement> =>
    new Promise((resolve, reject) => {
      const img = new window.Image()
      img.onload = () => resolve(img)
      img.onerror = reject
      img.src = src
    })

  const generateCollage = async () => {
    setGenerating(true)
    try {
      const { width, height } = currentFormat
      const canvas = document.createElement('canvas')
      canvas.width = width
      canvas.height = height
      const ctx = canvas.getContext('2d')!

      // Fill background
      ctx.fillStyle = bgColor
      ctx.fillRect(0, 0, width, height)

      const g = gap // shorthand
      const srcs = images.slice(0, requiredSlots) as string[]
      const imgs = await Promise.all(srcs.map(loadImage))

      // Draw based on layout
      if (selectedLayout === '2h') {
        // A | B — side by side
        const w = (width - g) / 2
        drawCover(ctx, imgs[0], 0,     0, w, height)
        drawCover(ctx, imgs[1], w + g, 0, w, height)

      } else if (selectedLayout === '2v') {
        // A / B — stacked
        const h = (height - g) / 2
        drawCover(ctx, imgs[0], 0, 0,     width, h)
        drawCover(ctx, imgs[1], 0, h + g, width, h)

      } else if (selectedLayout === '3t') {
        // [A|B] / [C] — two top, one bottom full width
        const topH = (height - g) / 2
        const botH = height - topH - g
        const topW = (width - g) / 2
        drawCover(ctx, imgs[0], 0,        0, topW, topH)
        drawCover(ctx, imgs[1], topW + g, 0, topW, topH)
        drawCover(ctx, imgs[2], 0,        topH + g, width, botH)

      } else if (selectedLayout === '3s') {
        // [A] | [B/C] — left full height, right two stacked
        const leftW = (width - g) / 2
        const rightW = width - leftW - g
        const rightH = (height - g) / 2
        drawCover(ctx, imgs[0], 0,          0, leftW, height)
        drawCover(ctx, imgs[1], leftW + g,  0,            rightW, rightH)
        drawCover(ctx, imgs[2], leftW + g,  rightH + g,   rightW, rightH)

      } else if (selectedLayout === '4') {
        // 2×2
        const w = (width - g) / 2
        const h = (height - g) / 2
        drawCover(ctx, imgs[0], 0,     0,     w, h)
        drawCover(ctx, imgs[1], w + g, 0,     w, h)
        drawCover(ctx, imgs[2], 0,     h + g, w, h)
        drawCover(ctx, imgs[3], w + g, h + g, w, h)
      }

      canvas.toBlob((blob) => {
        if (!blob) {
          toast.error('Collage genereren mislukt')
          setGenerating(false)
          return
        }
        const url = URL.createObjectURL(blob)
        setResultUrl(url)
        setGenerating(false)
        toast.success('Collage klaar!')
      }, 'image/jpeg', 0.92)

    } catch {
      toast.error('Fout bij het laden van afbeeldingen')
      setGenerating(false)
    }
  }

  const handleDownload = () => {
    if (!resultUrl) return
    const a = downloadRef.current!
    a.href = resultUrl
    a.download = `collage-${Date.now()}.jpg`
    a.click()
  }

  const handleReset = () => {
    images.forEach(u => u && URL.revokeObjectURL(u))
    if (resultUrl) URL.revokeObjectURL(resultUrl)
    setImages([null, null, null, null])
    setFiles([null, null, null, null])
    setResultUrl(null)
  }

  return (
    <div className="min-h-screen p-4 md:p-8 space-y-6">
      {/* Header */}
      <motion.div
        initial={{ opacity: 0, y: -16 }}
        animate={{ opacity: 1, y: 0 }}
        className="flex items-center gap-4"
      >
        <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-purple-500 to-violet-600 flex items-center justify-center shadow-lg flex-shrink-0">
          <Grid2X2 className="w-6 h-6 text-white" />
        </div>
        <div>
          <h1 className="text-2xl md:text-3xl font-bold gradient-text">Collage Maker</h1>
          <p className="text-sm text-white/40 mt-0.5">Combineer 2–4 foto's in één grid</p>
        </div>
      </motion.div>

      <div className="grid grid-cols-1 xl:grid-cols-[1fr_380px] gap-6">
        {/* ── Left column ── */}
        <div className="space-y-5">

          {/* Layout selector */}
          <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.05 }}
            className="glass-card p-5"
          >
            <h2 className="text-sm font-semibold text-white/70 uppercase tracking-wider mb-4">
              Indeling kiezen
            </h2>
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-3">
              {LAYOUTS.map(layout => (
                <button
                  key={layout.id}
                  onClick={() => handleLayoutChange(layout.id)}
                  className={`
                    glass-button flex flex-col items-center gap-2 p-3 rounded-xl border transition-all duration-200
                    ${selectedLayout === layout.id
                      ? 'border-purple-500/60 bg-purple-500/20 text-purple-300'
                      : 'border-white/10 hover:border-purple-500/30 hover:bg-purple-500/10 text-white/50'
                    }
                  `}
                >
                  <div className="w-full aspect-square max-w-[52px] mx-auto">
                    {layout.preview}
                  </div>
                  <span className="text-[10px] font-medium text-center leading-tight line-clamp-2">
                    {layout.label}
                  </span>
                </button>
              ))}
            </div>
          </motion.div>

          {/* Photo slots */}
          <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
            className="glass-card p-5"
          >
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-sm font-semibold text-white/70 uppercase tracking-wider">
                Foto's uploaden
              </h2>
              <span className="text-xs text-purple-400 bg-purple-500/20 px-2.5 py-1 rounded-full">
                {filledSlots}/{requiredSlots} gevuld
              </span>
            </div>
            <div className={`grid gap-3 ${
              requiredSlots === 2 ? 'grid-cols-2' :
              requiredSlots === 3 ? 'grid-cols-3' :
              'grid-cols-2 sm:grid-cols-4'
            }`}>
              {Array.from({ length: requiredSlots }).map((_, i) => (
                <PhotoSlot
                  key={i}
                  index={i}
                  preview={images[i]}
                  onDrop={handleDrop}
                  onRemove={handleRemove}
                />
              ))}
            </div>
          </motion.div>

          {/* Settings */}
          <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.15 }}
            className="glass-card p-5"
          >
            <h2 className="text-sm font-semibold text-white/70 uppercase tracking-wider mb-4">
              Instellingen
            </h2>
            <div className="space-y-5">
              {/* Gap slider */}
              <div>
                <div className="flex items-center justify-between mb-2">
                  <label className="text-sm text-white/60">Ruimte tussen foto's</label>
                  <span className="text-sm font-mono text-purple-400">{gap}px</span>
                </div>
                <input
                  type="range"
                  min={0}
                  max={20}
                  value={gap}
                  onChange={e => setGap(Number(e.target.value))}
                  className="w-full h-1.5 rounded-full bg-white/10 appearance-none cursor-pointer accent-purple-500"
                />
                <div className="flex justify-between text-[10px] text-white/20 mt-1">
                  <span>0px</span>
                  <span>20px</span>
                </div>
              </div>

              {/* Background color */}
              <div className="flex items-center justify-between">
                <label className="text-sm text-white/60">Achtergrondkleur</label>
                <div className="flex items-center gap-2">
                  <span className="text-xs font-mono text-white/40">{bgColor}</span>
                  <div className="relative">
                    <input
                      type="color"
                      value={bgColor}
                      onChange={e => setBgColor(e.target.value)}
                      className="w-9 h-9 rounded-lg border border-white/20 bg-transparent cursor-pointer p-0.5"
                    />
                  </div>
                </div>
              </div>

              {/* Output format */}
              <div>
                <label className="text-sm text-white/60 block mb-2">Output formaat</label>
                <select
                  value={format}
                  onChange={e => setFormat(e.target.value as FormatId)}
                  className="input-dark w-full rounded-xl text-sm"
                >
                  {FORMATS.map(f => (
                    <option key={f.id} value={f.id}>{f.label}</option>
                  ))}
                </select>
              </div>
            </div>
          </motion.div>

          {/* Generate button */}
          <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 }}
          >
            <button
              onClick={generateCollage}
              disabled={!allFilled || generating}
              className="btn-primary w-full flex items-center justify-center gap-2 py-3.5 rounded-xl font-semibold text-sm disabled:opacity-40 disabled:cursor-not-allowed transition-all duration-200"
            >
              {generating ? (
                <>
                  <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  Bezig met genereren…
                </>
              ) : (
                <>
                  <Grid2X2 className="w-4 h-4" />
                  Collage Maken
                </>
              )}
            </button>
            {!allFilled && (
              <p className="text-center text-xs text-white/30 mt-2">
                Vul alle {requiredSlots} slots in om verder te gaan
              </p>
            )}
          </motion.div>
        </div>

        {/* ── Right column: result ── */}
        <div className="space-y-4">
          <motion.div
            initial={{ opacity: 0, x: 16 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: 0.1 }}
            className="glass-card p-5 sticky top-6"
          >
            <h2 className="text-sm font-semibold text-white/70 uppercase tracking-wider mb-4">
              Resultaat
            </h2>

            <AnimatePresence mode="wait">
              {resultUrl ? (
                <motion.div
                  key="result"
                  initial={{ opacity: 0, scale: 0.97 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.97 }}
                  className="space-y-4"
                >
                  <div className="rounded-xl overflow-hidden border border-purple-500/20">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={resultUrl}
                      alt="Collage resultaat"
                      className="w-full h-auto block"
                    />
                  </div>
                  <div className="flex gap-2">
                    <button
                      onClick={handleDownload}
                      className="btn-primary flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl text-sm font-semibold"
                    >
                      <Download className="w-4 h-4" />
                      Collage Downloaden
                    </button>
                    <button
                      onClick={handleReset}
                      className="glass-button flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl text-sm font-medium text-white/60 hover:text-white border border-white/10 hover:border-white/20 transition-all duration-200"
                    >
                      <RotateCcw className="w-4 h-4" />
                      Opnieuw
                    </button>
                  </div>
                </motion.div>
              ) : (
                <motion.div
                  key="empty"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  className="flex flex-col items-center justify-center py-16 text-center"
                >
                  <div className="w-16 h-16 rounded-2xl bg-purple-500/10 border border-purple-500/20 flex items-center justify-center mb-4">
                    <ImageIcon className="w-8 h-8 text-purple-500/40" />
                  </div>
                  <p className="text-sm text-white/30 leading-relaxed">
                    Upload foto's en klik op<br />
                    <span className="text-purple-400/70">&quot;Collage Maken&quot;</span> om te beginnen
                  </p>
                </motion.div>
              )}
            </AnimatePresence>
          </motion.div>
        </div>
      </div>

      {/* Hidden download anchor */}
      {/* eslint-disable-next-line jsx-a11y/anchor-has-content */}
      <a ref={downloadRef} className="hidden" />
    </div>
  )
}
