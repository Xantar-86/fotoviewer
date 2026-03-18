'use client'

import { useState, useCallback, useRef } from 'react'
import { useDropzone } from 'react-dropzone'
import { motion, AnimatePresence } from 'framer-motion'
import toast from 'react-hot-toast'
import {
  Upload,
  ImageIcon,
  Sliders,
  Type,
  Crop,
  Maximize2,
  Shield,
  Download,
  RotateCcw,
  CheckCircle,
  Loader2,
  Eye,
  Layers,
} from 'lucide-react'
import {
  enhanceImage,
  addTextWatermark,
  resizeImage,
  cropImage,
  blurArea,
  stripExif,
  base64ToObjectUrl,
  getPlatforms,
} from '@/lib/api'
import { useEffect } from 'react'

type Tool = 'enhance' | 'watermark' | 'resize' | 'crop' | 'blur' | 'exif'

interface EnhanceSettings {
  brightness: number
  contrast: number
  color: number
  sharpness: number
}

interface WatermarkSettings {
  text: string
  position: string
  opacity: number
  fontSize: number
  color: string
}

interface CropSettings {
  top: number
  right: number
  bottom: number
  left: number
}

interface BlurSettings {
  x: number
  y: number
  width: number
  height: number
  strength: number
}

const POSITIONS = ['top-left', 'top-right', 'bottom-left', 'bottom-right', 'center']

export default function EditorPage() {
  const [file, setFile] = useState<File | null>(null)
  const [originalUrl, setOriginalUrl] = useState<string | null>(null)
  const [processedUrl, setProcessedUrl] = useState<string | null>(null)
  const [processedBase64, setProcessedBase64] = useState<string | null>(null)
  const [activeTool, setActiveTool] = useState<Tool>('enhance')
  const [loading, setLoading] = useState(false)
  const [platforms, setPlatforms] = useState<string[]>([])
  const [showOriginal, setShowOriginal] = useState(false)

  const [enhance, setEnhance] = useState<EnhanceSettings>({
    brightness: 1.0,
    contrast: 1.0,
    color: 1.0,
    sharpness: 1.0,
  })

  const [watermark, setWatermark] = useState<WatermarkSettings>({
    text: '© FeetBusiness',
    position: 'bottom-right',
    opacity: 180,
    fontSize: 36,
    color: '#ffffff',
  })

  const [crop, setCrop] = useState<CropSettings>({ top: 0, right: 0, bottom: 0, left: 0 })
  const [blur, setBlur] = useState<BlurSettings>({ x: 0, y: 0, width: 100, height: 100, strength: 15 })
  const [selectedPlatform, setSelectedPlatform] = useState('FeetFinder')

  useEffect(() => {
    getPlatforms().then((d) => setPlatforms(d.platforms)).catch(() => {})
  }, [])

  const onDrop = useCallback((accepted: File[]) => {
    if (accepted[0]) {
      const f = accepted[0]
      setFile(f)
      setOriginalUrl(URL.createObjectURL(f))
      setProcessedUrl(null)
      setProcessedBase64(null)
      toast.success(`${f.name} geladen`)
    }
  }, [])

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: { 'image/*': [] },
    multiple: false,
  })

  const getWorkingFile = (): File => {
    if (processedBase64) {
      const binary = atob(processedBase64)
      const bytes = new Uint8Array(binary.length)
      for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i)
      return new File([bytes], file!.name, { type: 'image/jpeg' })
    }
    return file!
  }

  const applyEnhance = async () => {
    if (!file) return
    setLoading(true)
    try {
      const f = getWorkingFile()
      const res = await enhanceImage(f, enhance.brightness, enhance.contrast, enhance.color, enhance.sharpness)
      setProcessedBase64(res.image)
      setProcessedUrl(base64ToObjectUrl(res.image))
      toast.success('Verbetering toegepast')
    } catch (e: any) {
      toast.error(e.message || 'Fout bij verbeteren')
    } finally {
      setLoading(false)
    }
  }

  const applyWatermark = async () => {
    if (!file) return
    setLoading(true)
    try {
      const f = getWorkingFile()
      const res = await addTextWatermark(f, watermark.text, watermark.position, watermark.opacity, watermark.fontSize, watermark.color)
      setProcessedBase64(res.image)
      setProcessedUrl(base64ToObjectUrl(res.image))
      toast.success('Watermerk toegevoegd')
    } catch (e: any) {
      toast.error(e.message || 'Fout bij watermerk')
    } finally {
      setLoading(false)
    }
  }

  const applyResize = async () => {
    if (!file) return
    setLoading(true)
    try {
      const f = getWorkingFile()
      const res = await resizeImage(f, selectedPlatform)
      setProcessedBase64(res.image)
      setProcessedUrl(base64ToObjectUrl(res.image))
      toast.success(`Formaat aangepast voor ${selectedPlatform} (${res.width}x${res.height})`)
    } catch (e: any) {
      toast.error(e.message || 'Fout bij formaat aanpassen')
    } finally {
      setLoading(false)
    }
  }

  const applyCrop = async () => {
    if (!file) return
    setLoading(true)
    try {
      const f = getWorkingFile()
      const res = await cropImage(f, crop.top, crop.right, crop.bottom, crop.left)
      setProcessedBase64(res.image)
      setProcessedUrl(base64ToObjectUrl(res.image))
      toast.success('Bijgesneden')
    } catch (e: any) {
      toast.error(e.message || 'Fout bij bijsnijden')
    } finally {
      setLoading(false)
    }
  }

  const applyBlur = async () => {
    if (!file) return
    setLoading(true)
    try {
      const f = getWorkingFile()
      const res = await blurArea(f, blur.x, blur.y, blur.width, blur.height, blur.strength)
      setProcessedBase64(res.image)
      setProcessedUrl(base64ToObjectUrl(res.image))
      toast.success('Vervaging toegepast')
    } catch (e: any) {
      toast.error(e.message || 'Fout bij vervagen')
    } finally {
      setLoading(false)
    }
  }

  const applyStripExif = async () => {
    if (!file) return
    setLoading(true)
    try {
      const f = getWorkingFile()
      const blob = await stripExif(f)
      const url = URL.createObjectURL(blob)
      const reader = new FileReader()
      reader.onload = (e) => {
        const b64 = (e.target?.result as string).split(',')[1]
        setProcessedBase64(b64)
        setProcessedUrl(url)
        toast.success('EXIF data verwijderd — privacy beschermd')
      }
      reader.readAsDataURL(blob)
    } catch (e: any) {
      toast.error(e.message || 'Fout bij EXIF verwijderen')
    } finally {
      setLoading(false)
    }
  }

  const downloadImage = () => {
    if (!processedUrl) return
    const a = document.createElement('a')
    a.href = processedUrl
    a.download = `bewerkt_${file?.name || 'foto.jpg'}`
    a.click()
    toast.success('Foto gedownload')
  }

  const resetProcessed = () => {
    setProcessedUrl(null)
    setProcessedBase64(null)
    toast('Bewerkingen teruggedraaid', { icon: '↩️' })
  }

  const tools = [
    { id: 'enhance' as Tool, icon: Sliders, label: 'Verbeteren' },
    { id: 'watermark' as Tool, icon: Type, label: 'Watermerk' },
    { id: 'resize' as Tool, icon: Maximize2, label: 'Formaat' },
    { id: 'crop' as Tool, icon: Crop, label: 'Bijsnijden' },
    { id: 'blur' as Tool, icon: Eye, label: 'Vervagen' },
    { id: 'exif' as Tool, icon: Shield, label: 'EXIF' },
  ]

  const Slider = ({
    label, value, min, max, step, onChange
  }: { label: string; value: number; min: number; max: number; step: number; onChange: (v: number) => void }) => (
    <div className="mb-4">
      <div className="flex justify-between items-center mb-2">
        <label className="text-sm text-white/60">{label}</label>
        <span className="text-sm font-mono text-purple-400">{value.toFixed(2)}</span>
      </div>
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(e) => onChange(parseFloat(e.target.value))}
        className="w-full"
      />
    </div>
  )

  return (
    <div className="max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex items-start justify-between mb-6">
        <div>
          <div className="flex items-center gap-3 mb-1">
            <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-purple-500 to-violet-600 flex items-center justify-center">
              <ImageIcon className="w-4 h-4 text-white" />
            </div>
            <span className="text-xs font-medium text-purple-400 uppercase tracking-widest">Foto Editor</span>
          </div>
          <h1 className="text-2xl md:text-3xl font-black gradient-text">Professionele Editor</h1>
        </div>
        {processedUrl && (
          <div className="flex gap-2 flex-shrink-0">
            <button onClick={resetProcessed} className="btn-secondary flex items-center gap-1.5 text-xs md:text-sm px-2.5 md:px-4">
              <RotateCcw className="w-3.5 h-3.5 md:w-4 md:h-4" />
              <span className="hidden sm:inline">Terugzetten</span>
            </button>
            <button onClick={downloadImage} className="btn-primary flex items-center gap-1.5 text-xs md:text-sm px-2.5 md:px-4">
              <Download className="w-3.5 h-3.5 md:w-4 md:h-4" />
              <span className="hidden sm:inline">Downloaden</span>
            </button>
          </div>
        )}
      </div>

      {/* On mobile: image on top, tools below. On desktop: tools left, image right */}
      <div className="flex flex-col-reverse md:flex-row gap-4 md:gap-6">
        {/* Tools panel */}
        <div className="w-full md:w-72 md:flex-shrink-0 flex flex-col gap-4">
          {/* Tool selector */}
          <div className="glass-card p-2 grid grid-cols-6 md:grid-cols-3 gap-1.5">
            {tools.map((t) => {
              const Icon = t.icon
              return (
                <button
                  key={t.id}
                  onClick={() => setActiveTool(t.id)}
                  className={`flex flex-col items-center gap-1.5 p-2.5 rounded-xl text-xs font-medium transition-all duration-200 ${
                    activeTool === t.id
                      ? 'bg-gradient-to-br from-purple-600/40 to-violet-600/30 text-purple-300 border border-purple-500/30'
                      : 'text-white/40 hover:text-white/70 hover:bg-white/[0.05]'
                  }`}
                >
                  <Icon className="w-4 h-4" />
                  {t.label}
                </button>
              )
            })}
          </div>

          {/* Tool settings */}
          <div className="glass-card p-5">
            <AnimatePresence mode="wait">
              {activeTool === 'enhance' && (
                <motion.div key="enhance" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
                  <h3 className="font-semibold text-white mb-4 flex items-center gap-2">
                    <Sliders className="w-4 h-4 text-purple-400" /> Beeldverbetering
                  </h3>
                  <Slider label="Helderheid" value={enhance.brightness} min={0.1} max={3} step={0.05} onChange={(v) => setEnhance({ ...enhance, brightness: v })} />
                  <Slider label="Contrast" value={enhance.contrast} min={0.1} max={3} step={0.05} onChange={(v) => setEnhance({ ...enhance, contrast: v })} />
                  <Slider label="Kleurverzadiging" value={enhance.color} min={0} max={3} step={0.05} onChange={(v) => setEnhance({ ...enhance, color: v })} />
                  <Slider label="Scherpte" value={enhance.sharpness} min={0} max={5} step={0.1} onChange={(v) => setEnhance({ ...enhance, sharpness: v })} />
                  <button onClick={applyEnhance} disabled={!file || loading} className="btn-primary w-full mt-2 flex items-center justify-center gap-2 text-sm">
                    {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckCircle className="w-4 h-4" />}
                    Toepassen
                  </button>
                </motion.div>
              )}

              {activeTool === 'watermark' && (
                <motion.div key="watermark" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
                  <h3 className="font-semibold text-white mb-4 flex items-center gap-2">
                    <Type className="w-4 h-4 text-purple-400" /> Tekstwatermerk
                  </h3>
                  <div className="mb-3">
                    <label className="text-sm text-white/60 mb-1.5 block">Tekst</label>
                    <input
                      className="input-dark w-full text-sm"
                      value={watermark.text}
                      onChange={(e) => setWatermark({ ...watermark, text: e.target.value })}
                    />
                  </div>
                  <div className="mb-3">
                    <label className="text-sm text-white/60 mb-1.5 block">Positie</label>
                    <select
                      className="input-dark w-full text-sm"
                      value={watermark.position}
                      onChange={(e) => setWatermark({ ...watermark, position: e.target.value })}
                    >
                      {POSITIONS.map((p) => (
                        <option key={p} value={p} className="bg-[#1a1a2e]">{p}</option>
                      ))}
                    </select>
                  </div>
                  <div className="mb-3">
                    <label className="text-sm text-white/60 mb-1.5 block">Kleur</label>
                    <div className="flex items-center gap-2">
                      <input
                        type="color"
                        value={watermark.color}
                        onChange={(e) => setWatermark({ ...watermark, color: e.target.value })}
                        className="w-10 h-10 rounded-lg cursor-pointer bg-transparent border border-white/10"
                      />
                      <span className="text-sm text-white/50 font-mono">{watermark.color}</span>
                    </div>
                  </div>
                  <Slider label="Dekking" value={watermark.opacity} min={20} max={255} step={5} onChange={(v) => setWatermark({ ...watermark, opacity: Math.round(v) })} />
                  <Slider label="Lettergrootte" value={watermark.fontSize} min={12} max={120} step={2} onChange={(v) => setWatermark({ ...watermark, fontSize: Math.round(v) })} />
                  <button onClick={applyWatermark} disabled={!file || loading} className="btn-primary w-full mt-2 flex items-center justify-center gap-2 text-sm">
                    {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckCircle className="w-4 h-4" />}
                    Toepassen
                  </button>
                </motion.div>
              )}

              {activeTool === 'resize' && (
                <motion.div key="resize" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
                  <h3 className="font-semibold text-white mb-4 flex items-center gap-2">
                    <Maximize2 className="w-4 h-4 text-purple-400" /> Platform Formaat
                  </h3>
                  <div className="mb-4">
                    <label className="text-sm text-white/60 mb-1.5 block">Platform</label>
                    <select
                      className="input-dark w-full text-sm"
                      value={selectedPlatform}
                      onChange={(e) => setSelectedPlatform(e.target.value)}
                    >
                      {(platforms.length > 0 ? platforms : ['FeetFinder', 'OnlyFans', 'Instagram_Post', 'Instagram_Story', 'Twitter', 'Fansly']).map((p) => (
                        <option key={p} value={p} className="bg-[#1a1a2e]">{p.replace('_', ' ')}</option>
                      ))}
                    </select>
                  </div>
                  <button onClick={applyResize} disabled={!file || loading} className="btn-primary w-full flex items-center justify-center gap-2 text-sm">
                    {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Maximize2 className="w-4 h-4" />}
                    Formaat aanpassen
                  </button>
                </motion.div>
              )}

              {activeTool === 'crop' && (
                <motion.div key="crop" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
                  <h3 className="font-semibold text-white mb-4 flex items-center gap-2">
                    <Crop className="w-4 h-4 text-purple-400" /> Bijsnijden
                  </h3>
                  <p className="text-xs text-white/30 mb-4">Pixels verwijderen van elke rand</p>
                  {(['top', 'right', 'bottom', 'left'] as const).map((side) => (
                    <div key={side} className="mb-3">
                      <div className="flex justify-between items-center mb-1.5">
                        <label className="text-sm text-white/60 capitalize">{side === 'top' ? 'Boven' : side === 'right' ? 'Rechts' : side === 'bottom' ? 'Onder' : 'Links'}</label>
                        <span className="text-sm font-mono text-purple-400">{crop[side]}px</span>
                      </div>
                      <input
                        type="range"
                        min={0}
                        max={500}
                        value={crop[side]}
                        onChange={(e) => setCrop({ ...crop, [side]: parseInt(e.target.value) })}
                        className="w-full"
                      />
                    </div>
                  ))}
                  <button onClick={applyCrop} disabled={!file || loading} className="btn-primary w-full mt-2 flex items-center justify-center gap-2 text-sm">
                    {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Crop className="w-4 h-4" />}
                    Bijsnijden
                  </button>
                </motion.div>
              )}

              {activeTool === 'blur' && (
                <motion.div key="blur" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
                  <h3 className="font-semibold text-white mb-4 flex items-center gap-2">
                    <Eye className="w-4 h-4 text-purple-400" /> Gebied Vervagen
                  </h3>
                  <p className="text-xs text-white/30 mb-4">Vervaag een specifiek rechthoekig gebied</p>
                  {[
                    { key: 'x', label: 'X positie' },
                    { key: 'y', label: 'Y positie' },
                    { key: 'width', label: 'Breedte' },
                    { key: 'height', label: 'Hoogte' },
                    { key: 'strength', label: 'Sterkte' },
                  ].map(({ key, label }) => (
                    <div key={key} className="mb-3">
                      <div className="flex justify-between items-center mb-1.5">
                        <label className="text-sm text-white/60">{label}</label>
                        <span className="text-sm font-mono text-purple-400">{blur[key as keyof BlurSettings]}</span>
                      </div>
                      <input
                        type="range"
                        min={0}
                        max={key === 'strength' ? 50 : 2000}
                        value={blur[key as keyof BlurSettings]}
                        onChange={(e) => setBlur({ ...blur, [key]: parseInt(e.target.value) })}
                        className="w-full"
                      />
                    </div>
                  ))}
                  <button onClick={applyBlur} disabled={!file || loading} className="btn-primary w-full mt-2 flex items-center justify-center gap-2 text-sm">
                    {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Eye className="w-4 h-4" />}
                    Vervaging toepassen
                  </button>
                </motion.div>
              )}

              {activeTool === 'exif' && (
                <motion.div key="exif" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
                  <h3 className="font-semibold text-white mb-4 flex items-center gap-2">
                    <Shield className="w-4 h-4 text-purple-400" /> EXIF Verwijderen
                  </h3>
                  <div className="bg-purple-500/10 border border-purple-500/20 rounded-xl p-4 mb-4">
                    <p className="text-sm text-purple-300 font-semibold mb-2">Privacy bescherming</p>
                    <ul className="text-xs text-white/50 space-y-1.5">
                      {[
                        'GPS locatiedata verwijderen',
                        'Camera model anonimiseren',
                        'Opname datum verbergen',
                        'Persoonlijke metadata wissen',
                      ].map((item) => (
                        <li key={item} className="flex items-center gap-1.5">
                          <CheckCircle className="w-3 h-3 text-purple-400" /> {item}
                        </li>
                      ))}
                    </ul>
                  </div>
                  <button onClick={applyStripExif} disabled={!file || loading} className="btn-primary w-full flex items-center justify-center gap-2 text-sm">
                    {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Shield className="w-4 h-4" />}
                    EXIF verwijderen
                  </button>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </div>

        {/* Image preview */}
        <div className="flex-1 min-w-0">
          {!file ? (
            <div
              {...getRootProps()}
              className={`glass-card h-96 flex flex-col items-center justify-center cursor-pointer transition-all duration-200 ${
                isDragActive
                  ? 'border-purple-500/50 bg-purple-500/5'
                  : 'border-dashed hover:border-purple-500/30'
              }`}
            >
              <input {...getInputProps()} />
              <motion.div
                animate={{ y: isDragActive ? -8 : 0 }}
                className="text-center"
              >
                <div className="w-16 h-16 bg-purple-500/10 rounded-2xl flex items-center justify-center mx-auto mb-4">
                  <Upload className="w-8 h-8 text-purple-400" />
                </div>
                <p className="text-lg font-semibold text-white/70 mb-2">
                  {isDragActive ? 'Laat los om te uploaden' : "Sleep foto's hierheen"}
                </p>
                <p className="text-sm text-white/30">of klik om te bladeren</p>
                <p className="text-xs text-white/20 mt-2">JPEG, PNG, WebP, HEIC ondersteund</p>
              </motion.div>
            </div>
          ) : (
            <div className="glass-card overflow-hidden">
              {/* Preview header */}
              <div className="flex items-center justify-between p-4 border-b border-white/[0.06]">
                <div className="flex items-center gap-3">
                  <div className="w-2 h-2 rounded-full bg-green-400" />
                  <span className="text-sm font-medium text-white/70">{file.name}</span>
                  {processedUrl && (
                    <span className="badge-green text-[10px]">Bewerkt</span>
                  )}
                </div>
                <div className="flex items-center gap-2">
                  {processedUrl && (
                    <button
                      onMouseEnter={() => setShowOriginal(true)}
                      onMouseLeave={() => setShowOriginal(false)}
                      className="btn-secondary text-xs px-3 py-1.5 flex items-center gap-1.5"
                    >
                      <Layers className="w-3.5 h-3.5" />
                      Origineel bekijken
                    </button>
                  )}
                  <button
                    {...getRootProps()}
                    className="btn-secondary text-xs px-3 py-1.5"
                    onClick={(e) => e.stopPropagation()}
                  >
                    <input {...getInputProps()} />
                    Andere foto
                  </button>
                </div>
              </div>

              {/* Image display */}
              <div className="relative p-4">
                <div className="relative rounded-xl overflow-hidden bg-black/20" style={{ minHeight: '200px' }}>
                  <img
                    src={showOriginal ? originalUrl! : (processedUrl || originalUrl!)}
                    alt="Preview"
                    className="w-full h-auto max-h-[50vh] md:max-h-[600px] object-contain"
                  />
                  {showOriginal && (
                    <div className="absolute top-3 left-3 badge-yellow text-xs">Origineel</div>
                  )}
                  {processedUrl && !showOriginal && (
                    <div className="absolute top-3 left-3 badge-green text-xs">Bewerkt</div>
                  )}
                  {loading && (
                    <div className="absolute inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center rounded-xl">
                      <div className="text-center">
                        <Loader2 className="w-8 h-8 animate-spin text-purple-400 mx-auto mb-2" />
                        <p className="text-white/70 text-sm">Verwerken...</p>
                      </div>
                    </div>
                  )}
                </div>
              </div>

              {/* Action bar */}
              {processedUrl && (
                <div className="flex items-center justify-between px-4 pb-4 pt-0">
                  <p className="text-xs text-white/30">Klik Downloaden om de bewerkte foto op te slaan</p>
                  <button onClick={downloadImage} className="btn-primary text-sm flex items-center gap-2">
                    <Download className="w-4 h-4" /> Downloaden
                  </button>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
