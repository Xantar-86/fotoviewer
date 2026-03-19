'use client'

import { useState, useCallback } from 'react'
import { useDropzone } from 'react-dropzone'
import { motion, AnimatePresence } from 'framer-motion'
import toast from 'react-hot-toast'
import {
  Layers,
  X,
  Download,
  CheckCircle,
  Loader2,
  ImageIcon,
  AlertCircle,
  ChevronDown,
  ChevronUp,
} from 'lucide-react'
import {
  stripExif,
  enhanceImage,
  addTextWatermark,
  resizeImage,
} from '@/lib/api'

// ─── Types ────────────────────────────────────────────────────────────────────

interface ResultItem {
  name: string
  dataUrl: string
  error?: string
}

interface Ops {
  watermark: boolean
  resize: boolean
  exif: boolean
  enhance: boolean
}

// ─── Helper ───────────────────────────────────────────────────────────────────

function base64ToFile(b64: string, name: string): File {
  const byteStr = atob(b64)
  const ab = new ArrayBuffer(byteStr.length)
  const ia = new Uint8Array(ab)
  for (let i = 0; i < byteStr.length; i++) ia[i] = byteStr.charCodeAt(i)
  return new File([ab], name, { type: 'image/jpeg' })
}

function fileToDataUrl(file: File | Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(reader.result as string)
    reader.onerror = reject
    reader.readAsDataURL(file)
  })
}

// ─── Slider component ─────────────────────────────────────────────────────────

function RangeSlider({
  label,
  value,
  min,
  max,
  step,
  onChange,
}: {
  label: string
  value: number
  min: number
  max: number
  step: number
  onChange: (v: number) => void
}) {
  return (
    <div className="flex flex-col gap-1">
      <div className="flex justify-between items-center">
        <label className="text-xs text-white/60">{label}</label>
        <span className="text-xs font-mono text-purple-300">{value.toFixed(2)}</span>
      </div>
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(e) => onChange(parseFloat(e.target.value))}
        className="w-full accent-purple-500 h-1.5 rounded-full cursor-pointer"
      />
    </div>
  )
}

// ─── Main page ────────────────────────────────────────────────────────────────

export default function BulkPage() {
  // Files
  const [files, setFiles] = useState<File[]>([])
  const [previews, setPreviews] = useState<Record<string, string>>({})

  // Operations
  const [ops, setOps] = useState<Ops>({ watermark: false, resize: false, exif: false, enhance: false })

  // Watermark settings
  const [wmText, setWmText] = useState('© FeetBusiness')
  const [wmPosition, setWmPosition] = useState('bottom-right')
  const [wmOpacity, setWmOpacity] = useState(80)
  const [wmColor, setWmColor] = useState('#ffffff')
  const [wmFontSize, setWmFontSize] = useState(36)

  // Resize settings
  const [platform, setPlatform] = useState('FeetFinder')

  // Enhance settings
  const [brightness, setBrightness] = useState(1.0)
  const [contrast, setContrast] = useState(1.0)
  const [saturation, setSaturation] = useState(1.0)
  const [sharpness, setSharpness] = useState(1.0)

  // Processing state
  const [processing, setProcessing] = useState(false)
  const [progress, setProgress] = useState(0)
  const [progressTotal, setProgressTotal] = useState(0)

  // Results
  const [results, setResults] = useState<ResultItem[]>([])

  // Expanded sections
  const [expandedOps, setExpandedOps] = useState<Record<string, boolean>>({})

  // ─── Dropzone ───────────────────────────────────────────────────────────────

  const onDrop = useCallback((accepted: File[]) => {
    const newFiles = [...files, ...accepted].slice(0, 20)
    setFiles(newFiles)

    // Generate previews
    accepted.forEach((f) => {
      const url = URL.createObjectURL(f)
      setPreviews((prev) => ({ ...prev, [f.name + f.size]: url }))
    })

    if (accepted.length > 0) {
      toast.success(`${accepted.length} foto${accepted.length > 1 ? "'s" : ''} toegevoegd`)
    }
  }, [files])

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    multiple: true,
    accept: { 'image/*': [] },
    maxFiles: 20,
    onDropRejected: () => toast.error('Maximaal 20 foto\'s toegestaan'),
  })

  const removeFile = (index: number) => {
    setFiles((prev) => prev.filter((_, i) => i !== index))
  }

  // ─── Toggle ops ─────────────────────────────────────────────────────────────

  const toggleOp = (op: keyof Ops) => {
    setOps((prev) => ({ ...prev, [op]: !prev[op] }))
    setExpandedOps((prev) => ({ ...prev, [op]: !ops[op] }))
  }

  // ─── Processing ─────────────────────────────────────────────────────────────

  const processAll = async () => {
    if (files.length === 0 || !Object.values(ops).some(Boolean)) return

    setProcessing(true)
    setProgress(0)
    setProgressTotal(files.length)
    setResults([])

    const newResults: ResultItem[] = []

    for (let i = 0; i < files.length; i++) {
      const file = files[i]
      setProgress(i + 1)

      try {
        let current: File | Blob = file

        if (ops.exif) {
          const blob = await stripExif(current as File)
          current = new File([blob], file.name, { type: 'image/jpeg' })
        }

        if (ops.enhance) {
          const res = await enhanceImage(current as File, brightness, contrast, saturation, sharpness)
          current = base64ToFile(res.image, file.name)
        }

        if (ops.watermark) {
          const res = await addTextWatermark(
            current as File,
            wmText,
            wmPosition,
            wmOpacity / 100,
            wmFontSize,
            wmColor
          )
          current = base64ToFile(res.image, file.name)
        }

        if (ops.resize) {
          const res = await resizeImage(current as File, platform)
          current = base64ToFile(res.image, file.name)
        }

        const dataUrl = await fileToDataUrl(current)
        newResults.push({ name: file.name, dataUrl })
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : 'Onbekende fout'
        newResults.push({ name: file.name, dataUrl: '', error: msg })
        toast.error(`Fout bij ${file.name}: ${msg}`)
      }
    }

    setResults(newResults)
    setProcessing(false)

    const succeeded = newResults.filter((r) => !r.error).length
    if (succeeded > 0) {
      toast.success(`${succeeded} foto${succeeded > 1 ? "'s" : ''} verwerkt!`)
    }
  }

  // ─── Download helpers ────────────────────────────────────────────────────────

  const downloadOne = (result: ResultItem) => {
    const a = document.createElement('a')
    a.href = result.dataUrl
    a.download = `verwerkt_${result.name}`
    a.click()
  }

  const downloadAll = () => {
    const successes = results.filter((r) => !r.error)
    successes.forEach((r) => downloadOne(r))
  }

  // ─── Derived ────────────────────────────────────────────────────────────────

  const anyOpSelected = Object.values(ops).some(Boolean)
  const canProcess = files.length > 0 && anyOpSelected && !processing

  // ─── Render ─────────────────────────────────────────────────────────────────

  return (
    <div className="min-h-screen p-4 md:p-8 md:pl-72">
      {/* Header */}
      <motion.div
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        className="mb-8"
      >
        <div className="flex items-center gap-3 mb-2">
          <div className="w-10 h-10 rounded-xl bg-purple-500/20 border border-purple-500/30 flex items-center justify-center">
            <Layers className="w-5 h-5 text-purple-400" />
          </div>
          <h1 className="text-3xl font-bold gradient-text">Bulk Verwerking</h1>
        </div>
        <p className="text-white/50 ml-13 pl-1">Meerdere foto's tegelijk verwerken</p>
      </motion.div>

      <div className="max-w-5xl space-y-6">

        {/* ── Step 1: Upload ── */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.05 }}
          className="glass-card p-6"
        >
          <div className="flex items-center gap-2 mb-4">
            <span className="w-6 h-6 rounded-full bg-purple-500/30 border border-purple-500/40 flex items-center justify-center text-xs font-bold text-purple-300">1</span>
            <h2 className="text-base font-semibold text-white">Foto's uploaden</h2>
            {files.length > 0 && (
              <span className="ml-auto text-xs px-2.5 py-1 rounded-full bg-purple-500/20 border border-purple-500/30 text-purple-300 font-medium">
                {files.length} foto{files.length > 1 ? "'s" : ''} geselecteerd
              </span>
            )}
          </div>

          {/* Dropzone */}
          <div
            {...getRootProps()}
            className={`relative border-2 border-dashed rounded-xl p-8 text-center cursor-pointer transition-all duration-200 ${
              isDragActive
                ? 'border-purple-400 bg-purple-500/10'
                : 'border-white/10 hover:border-purple-500/40 hover:bg-purple-500/5'
            }`}
          >
            <input {...getInputProps()} />
            <div className="flex flex-col items-center gap-3">
              <div className="w-14 h-14 rounded-2xl bg-purple-500/10 border border-purple-500/20 flex items-center justify-center">
                <ImageIcon className="w-7 h-7 text-purple-400" />
              </div>
              {isDragActive ? (
                <p className="text-purple-300 font-medium">Laat los om te uploaden…</p>
              ) : (
                <>
                  <p className="text-white/70 font-medium">Sleep foto's hierheen of klik om te selecteren</p>
                  <p className="text-white/30 text-sm">Maximaal 20 foto's • JPG, PNG, WebP</p>
                </>
              )}
            </div>
          </div>

          {/* Thumbnails grid */}
          <AnimatePresence>
            {files.length > 0 && (
              <motion.div
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: 'auto' }}
                exit={{ opacity: 0, height: 0 }}
                className="mt-4 grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3"
              >
                {files.map((file, idx) => {
                  const key = file.name + file.size
                  return (
                    <motion.div
                      key={key}
                      initial={{ opacity: 0, scale: 0.8 }}
                      animate={{ opacity: 1, scale: 1 }}
                      exit={{ opacity: 0, scale: 0.8 }}
                      transition={{ delay: idx * 0.03 }}
                      className="relative group rounded-xl overflow-hidden bg-white/5 border border-white/10"
                    >
                      {previews[key] ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img
                          src={previews[key]}
                          alt={file.name}
                          className="w-full aspect-square object-cover"
                        />
                      ) : (
                        <div className="w-full aspect-square flex items-center justify-center">
                          <ImageIcon className="w-8 h-8 text-white/20" />
                        </div>
                      )}
                      <div className="px-2 py-1.5 bg-black/40">
                        <p className="text-[10px] text-white/50 truncate">{file.name}</p>
                      </div>
                      <button
                        onClick={(e) => { e.stopPropagation(); removeFile(idx) }}
                        className="absolute top-1.5 right-1.5 w-6 h-6 rounded-full bg-black/60 border border-white/20 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity hover:bg-red-500/80"
                      >
                        <X className="w-3 h-3 text-white" />
                      </button>
                    </motion.div>
                  )
                })}
              </motion.div>
            )}
          </AnimatePresence>
        </motion.div>

        {/* ── Step 2: Operations ── */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="glass-card p-6"
        >
          <div className="flex items-center gap-2 mb-4">
            <span className="w-6 h-6 rounded-full bg-purple-500/30 border border-purple-500/40 flex items-center justify-center text-xs font-bold text-purple-300">2</span>
            <h2 className="text-base font-semibold text-white">Bewerkingen kiezen</h2>
          </div>

          <div className="space-y-3">

            {/* EXIF — no sub-options */}
            <OpToggle
              checked={ops.exif}
              onChange={() => toggleOp('exif')}
              label="EXIF verwijderen"
              description="Verwijdert metadata, locatie en camera-info"
              hasOptions={false}
            />

            {/* Enhance */}
            <OpToggle
              checked={ops.enhance}
              onChange={() => toggleOp('enhance')}
              label="Verbeteren"
              description="Helderheid, contrast, verzadiging en scherpte"
              hasOptions
              expanded={expandedOps.enhance && ops.enhance}
              onToggleExpand={() => setExpandedOps((p) => ({ ...p, enhance: !p.enhance }))}
            >
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2">
                <RangeSlider label="Helderheid" value={brightness} min={0.5} max={1.5} step={0.05} onChange={setBrightness} />
                <RangeSlider label="Contrast" value={contrast} min={0.5} max={1.5} step={0.05} onChange={setContrast} />
                <RangeSlider label="Verzadiging" value={saturation} min={0.5} max={1.5} step={0.05} onChange={setSaturation} />
                <RangeSlider label="Scherpte" value={sharpness} min={0.5} max={1.5} step={0.05} onChange={setSharpness} />
              </div>
            </OpToggle>

            {/* Watermark */}
            <OpToggle
              checked={ops.watermark}
              onChange={() => toggleOp('watermark')}
              label="Watermerk toevoegen"
              description="Tekst-watermerk op elke foto"
              hasOptions
              expanded={expandedOps.watermark && ops.watermark}
              onToggleExpand={() => setExpandedOps((p) => ({ ...p, watermark: !p.watermark }))}
            >
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2">
                <div className="flex flex-col gap-1 sm:col-span-2">
                  <label className="text-xs text-white/60">Tekst</label>
                  <input
                    type="text"
                    value={wmText}
                    onChange={(e) => setWmText(e.target.value)}
                    className="input-dark text-sm"
                    placeholder="© FeetBusiness"
                  />
                </div>
                <div className="flex flex-col gap-1">
                  <label className="text-xs text-white/60">Positie</label>
                  <select
                    value={wmPosition}
                    onChange={(e) => setWmPosition(e.target.value)}
                    className="input-dark text-sm"
                  >
                    {['center', 'bottom-right', 'bottom-left', 'top-right', 'top-left'].map((p) => (
                      <option key={p} value={p}>{p}</option>
                    ))}
                  </select>
                </div>
                <div className="flex flex-col gap-1">
                  <label className="text-xs text-white/60">Kleur</label>
                  <div className="flex gap-2 items-center">
                    <input
                      type="color"
                      value={wmColor}
                      onChange={(e) => setWmColor(e.target.value)}
                      className="w-10 h-9 rounded-lg border border-white/10 bg-transparent cursor-pointer"
                    />
                    <input
                      type="text"
                      value={wmColor}
                      onChange={(e) => setWmColor(e.target.value)}
                      className="input-dark text-sm flex-1 font-mono"
                    />
                  </div>
                </div>
                <div className="flex flex-col gap-1">
                  <div className="flex justify-between">
                    <label className="text-xs text-white/60">Doorzichtigheid</label>
                    <span className="text-xs font-mono text-purple-300">{wmOpacity}%</span>
                  </div>
                  <input
                    type="range"
                    min={0}
                    max={100}
                    value={wmOpacity}
                    onChange={(e) => setWmOpacity(parseInt(e.target.value))}
                    className="w-full accent-purple-500 h-1.5 rounded-full cursor-pointer"
                  />
                </div>
                <div className="flex flex-col gap-1">
                  <div className="flex justify-between">
                    <label className="text-xs text-white/60">Lettergrootte</label>
                    <span className="text-xs font-mono text-purple-300">{wmFontSize}px</span>
                  </div>
                  <input
                    type="range"
                    min={12}
                    max={120}
                    value={wmFontSize}
                    onChange={(e) => setWmFontSize(parseInt(e.target.value))}
                    className="w-full accent-purple-500 h-1.5 rounded-full cursor-pointer"
                  />
                </div>
              </div>
            </OpToggle>

            {/* Resize */}
            <OpToggle
              checked={ops.resize}
              onChange={() => toggleOp('resize')}
              label="Formaat aanpassen"
              description="Optimaliseer voor een specifiek platform"
              hasOptions
              expanded={expandedOps.resize && ops.resize}
              onToggleExpand={() => setExpandedOps((p) => ({ ...p, resize: !p.resize }))}
            >
              <div className="pt-2">
                <div className="flex flex-col gap-1">
                  <label className="text-xs text-white/60">Platform</label>
                  <select
                    value={platform}
                    onChange={(e) => setPlatform(e.target.value)}
                    className="input-dark text-sm max-w-xs"
                  >
                    {['FeetFinder', 'OnlyFans', 'Fansly', 'Instagram Square', 'Instagram Story'].map((p) => (
                      <option key={p} value={p}>{p}</option>
                    ))}
                  </select>
                </div>
              </div>
            </OpToggle>

          </div>
        </motion.div>

        {/* ── Step 3: Process button + progress ── */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.15 }}
          className="glass-card p-6"
        >
          <div className="flex items-center gap-2 mb-4">
            <span className="w-6 h-6 rounded-full bg-purple-500/30 border border-purple-500/40 flex items-center justify-center text-xs font-bold text-purple-300">3</span>
            <h2 className="text-base font-semibold text-white">Verwerken</h2>
          </div>

          {processing ? (
            <div className="space-y-3">
              <div className="flex items-center gap-3">
                <Loader2 className="w-5 h-5 text-purple-400 animate-spin flex-shrink-0" />
                <span className="text-white/70 text-sm">
                  Verwerking {progress} van {progressTotal}…
                </span>
              </div>
              <div className="w-full h-2 rounded-full bg-white/5 overflow-hidden">
                <motion.div
                  className="h-full bg-gradient-to-r from-purple-500 to-violet-500 rounded-full"
                  animate={{ width: `${(progress / progressTotal) * 100}%` }}
                  transition={{ duration: 0.3 }}
                />
              </div>
              <p className="text-xs text-white/30">Even geduld, de foto's worden één voor één verwerkt…</p>
            </div>
          ) : (
            <div className="space-y-3">
              {!anyOpSelected && files.length > 0 && (
                <div className="flex items-center gap-2 text-amber-400/80 text-sm">
                  <AlertCircle className="w-4 h-4 flex-shrink-0" />
                  <span>Selecteer minstens één bewerking</span>
                </div>
              )}
              {files.length === 0 && (
                <div className="flex items-center gap-2 text-white/30 text-sm">
                  <AlertCircle className="w-4 h-4 flex-shrink-0" />
                  <span>Upload eerst foto's</span>
                </div>
              )}
              <button
                onClick={processAll}
                disabled={!canProcess}
                className="btn-primary disabled:opacity-40 disabled:cursor-not-allowed flex items-center gap-2"
              >
                <Layers className="w-4 h-4" />
                Verwerk {files.length > 0 ? `${files.length} foto${files.length > 1 ? "'s" : ''}` : 'foto\'s'}
              </button>
            </div>
          )}
        </motion.div>

        {/* ── Step 4: Results ── */}
        <AnimatePresence>
          {results.length > 0 && (
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 20 }}
              className="glass-card p-6"
            >
              <div className="flex items-center gap-2 mb-4">
                <span className="w-6 h-6 rounded-full bg-green-500/30 border border-green-500/40 flex items-center justify-center text-xs font-bold text-green-300">4</span>
                <h2 className="text-base font-semibold text-white">Resultaten</h2>
                <span className="ml-auto text-xs px-2.5 py-1 rounded-full bg-green-500/15 border border-green-500/25 text-green-300 font-medium">
                  {results.filter((r) => !r.error).length} verwerkt
                </span>
              </div>

              {/* Download all */}
              {results.filter((r) => !r.error).length > 1 && (
                <button
                  onClick={downloadAll}
                  className="glass-button flex items-center gap-2 mb-5 text-sm"
                >
                  <Download className="w-4 h-4" />
                  Alles downloaden ({results.filter((r) => !r.error).length} foto's)
                </button>
              )}

              {/* Results grid */}
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4">
                {results.map((result, idx) => (
                  <motion.div
                    key={result.name + idx}
                    initial={{ opacity: 0, scale: 0.85 }}
                    animate={{ opacity: 1, scale: 1 }}
                    transition={{ delay: idx * 0.04 }}
                    className={`rounded-xl overflow-hidden border ${
                      result.error
                        ? 'border-red-500/30 bg-red-500/5'
                        : 'border-green-500/20 bg-white/5'
                    }`}
                  >
                    {result.error ? (
                      <div className="aspect-square flex flex-col items-center justify-center gap-2 p-3">
                        <AlertCircle className="w-8 h-8 text-red-400" />
                        <p className="text-[10px] text-red-300/80 text-center leading-tight">{result.error}</p>
                      </div>
                    ) : (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={result.dataUrl}
                        alt={result.name}
                        className="w-full aspect-square object-cover"
                      />
                    )}

                    <div className="px-2 py-2 bg-black/30 flex items-center gap-1.5">
                      {result.error ? (
                        <AlertCircle className="w-3 h-3 text-red-400 flex-shrink-0" />
                      ) : (
                        <CheckCircle className="w-3 h-3 text-green-400 flex-shrink-0" />
                      )}
                      <p className="text-[10px] text-white/50 truncate flex-1">{result.name}</p>
                      {!result.error && (
                        <button
                          onClick={() => downloadOne(result)}
                          className="ml-auto w-6 h-6 flex items-center justify-center rounded-lg bg-purple-500/20 hover:bg-purple-500/40 border border-purple-500/30 transition-colors flex-shrink-0"
                          title="Downloaden"
                        >
                          <Download className="w-3 h-3 text-purple-300" />
                        </button>
                      )}
                    </div>
                  </motion.div>
                ))}
              </div>
            </motion.div>
          )}
        </AnimatePresence>

      </div>
    </div>
  )
}

// ─── OpToggle sub-component ───────────────────────────────────────────────────

function OpToggle({
  checked,
  onChange,
  label,
  description,
  hasOptions,
  expanded,
  onToggleExpand,
  children,
}: {
  checked: boolean
  onChange: () => void
  label: string
  description: string
  hasOptions: boolean
  expanded?: boolean
  onToggleExpand?: () => void
  children?: React.ReactNode
}) {
  return (
    <div className={`rounded-xl border transition-colors duration-200 ${
      checked
        ? 'border-purple-500/30 bg-purple-500/5'
        : 'border-white/8 bg-white/[0.02]'
    }`}>
      <div className="flex items-center gap-3 p-4">
        {/* Custom checkbox */}
        <button
          onClick={onChange}
          className={`w-5 h-5 rounded-md border-2 flex items-center justify-center flex-shrink-0 transition-all duration-150 ${
            checked
              ? 'bg-purple-500 border-purple-500'
              : 'border-white/20 bg-transparent hover:border-purple-400'
          }`}
        >
          {checked && (
            <svg className="w-3 h-3 text-white" fill="none" viewBox="0 0 12 12">
              <path d="M2 6l3 3 5-5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          )}
        </button>

        <div className="flex-1 min-w-0 cursor-pointer" onClick={onChange}>
          <div className="text-sm font-semibold text-white leading-tight">{label}</div>
          <div className="text-xs text-white/40 mt-0.5">{description}</div>
        </div>

        {hasOptions && checked && onToggleExpand && (
          <button
            onClick={(e) => { e.stopPropagation(); onToggleExpand() }}
            className="w-7 h-7 flex items-center justify-center rounded-lg bg-white/5 hover:bg-white/10 border border-white/10 transition-colors flex-shrink-0"
          >
            {expanded ? <ChevronUp className="w-3.5 h-3.5 text-white/50" /> : <ChevronDown className="w-3.5 h-3.5 text-white/50" />}
          </button>
        )}
      </div>

      <AnimatePresence>
        {hasOptions && checked && expanded && children && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="overflow-hidden"
          >
            <div className="px-4 pb-4 border-t border-white/8">
              {children}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}
