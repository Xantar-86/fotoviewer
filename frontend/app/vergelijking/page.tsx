'use client'

import { useState, useCallback } from 'react'
import { useDropzone } from 'react-dropzone'
import { motion, AnimatePresence } from 'framer-motion'
import { Columns, Upload, Download, ImageIcon, X } from 'lucide-react'
import toast from 'react-hot-toast'
import BeforeAfterSlider from '@/components/BeforeAfterSlider'

export default function VergelijkingPage() {
  const [beforeUrl, setBeforeUrl] = useState<string | null>(null)
  const [afterUrl, setAfterUrl] = useState<string | null>(null)
  const [beforeName, setBeforeName] = useState('')
  const [afterName, setAfterName] = useState('')

  const onDropBefore = useCallback((accepted: File[]) => {
    if (accepted[0]) {
      if (beforeUrl) URL.revokeObjectURL(beforeUrl)
      setBeforeUrl(URL.createObjectURL(accepted[0]))
      setBeforeName(accepted[0].name)
      toast.success(`Voor-foto geladen: ${accepted[0].name}`)
    }
  }, [beforeUrl])

  const onDropAfter = useCallback((accepted: File[]) => {
    if (accepted[0]) {
      if (afterUrl) URL.revokeObjectURL(afterUrl)
      setAfterUrl(URL.createObjectURL(accepted[0]))
      setAfterName(accepted[0].name)
      toast.success(`Na-foto geladen: ${accepted[0].name}`)
    }
  }, [afterUrl])

  const {
    getRootProps: getBeforeProps,
    getInputProps: getBeforeInputProps,
    isDragActive: isBeforeDrag,
  } = useDropzone({ onDrop: onDropBefore, accept: { 'image/*': [] }, multiple: false })

  const {
    getRootProps: getAfterProps,
    getInputProps: getAfterInputProps,
    isDragActive: isAfterDrag,
  } = useDropzone({ onDrop: onDropAfter, accept: { 'image/*': [] }, multiple: false })

  const clearBefore = () => {
    if (beforeUrl) URL.revokeObjectURL(beforeUrl)
    setBeforeUrl(null)
    setBeforeName('')
  }

  const clearAfter = () => {
    if (afterUrl) URL.revokeObjectURL(afterUrl)
    setAfterUrl(null)
    setAfterName('')
  }

  const downloadComparison = () => {
    toast('Gebruik een screenshot-tool (bv. Windows + Shift + S) om de vergelijking op te slaan.', {
      icon: '📸',
      duration: 5000,
    })
  }

  const bothLoaded = !!beforeUrl && !!afterUrl

  return (
    <div className="max-w-5xl mx-auto">
      {/* Header */}
      <div className="flex items-start justify-between mb-6">
        <div>
          <div className="flex items-center gap-3 mb-1">
            <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-purple-500 to-violet-600 flex items-center justify-center">
              <Columns className="w-4 h-4 text-white" />
            </div>
            <span className="text-xs font-medium text-purple-400 uppercase tracking-widest">Vergelijking</span>
          </div>
          <h1 className="text-2xl md:text-3xl font-black gradient-text">Voor/Na Vergelijking</h1>
          <p className="text-sm text-white/40 mt-1">Upload twee foto's en vergelijk ze met de interactieve slider</p>
        </div>
        {bothLoaded && (
          <button
            onClick={downloadComparison}
            className="btn-primary flex items-center gap-2 text-sm flex-shrink-0"
          >
            <Download className="w-4 h-4" />
            <span className="hidden sm:inline">Opslaan</span>
          </button>
        )}
      </div>

      {/* Upload zones */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
        {/* Voor dropzone */}
        <div className="flex flex-col gap-2">
          <div className="flex items-center justify-between">
            <span className="text-sm font-semibold text-white/70 flex items-center gap-2">
              <span className="px-2 py-0.5 rounded-md bg-purple-500/20 text-purple-300 text-xs font-bold">VOOR</span>
              Originele foto
            </span>
            {beforeUrl && (
              <button onClick={clearBefore} className="text-white/30 hover:text-white/60 transition-colors">
                <X className="w-4 h-4" />
              </button>
            )}
          </div>
          {beforeUrl ? (
            <div className="relative glass-card overflow-hidden rounded-2xl">
              <img
                src={beforeUrl}
                alt="Voor"
                className="w-full h-48 object-cover"
              />
              <div className="absolute bottom-0 inset-x-0 bg-gradient-to-t from-black/60 to-transparent p-3">
                <p className="text-xs text-white/70 truncate">{beforeName}</p>
              </div>
              <div
                {...getBeforeProps()}
                className="absolute inset-0 opacity-0 hover:opacity-100 transition-opacity bg-black/50 flex items-center justify-center cursor-pointer rounded-2xl"
              >
                <input {...getBeforeInputProps()} />
                <p className="text-sm text-white font-medium">Andere foto</p>
              </div>
            </div>
          ) : (
            <div
              {...getBeforeProps()}
              className={`glass-card h-48 flex flex-col items-center justify-center cursor-pointer rounded-2xl transition-all duration-200 ${
                isBeforeDrag
                  ? 'border-purple-500/50 bg-purple-500/5'
                  : 'border-dashed hover:border-purple-500/30'
              }`}
            >
              <input {...getBeforeInputProps()} />
              <motion.div animate={{ y: isBeforeDrag ? -6 : 0 }} className="text-center">
                <div className="w-12 h-12 bg-purple-500/10 rounded-xl flex items-center justify-center mx-auto mb-3">
                  <Upload className="w-6 h-6 text-purple-400" />
                </div>
                <p className="text-sm font-semibold text-white/60 mb-1">
                  {isBeforeDrag ? 'Laat los' : 'Sleep of klik'}
                </p>
                <p className="text-xs text-white/30">Voor-foto uploaden</p>
              </motion.div>
            </div>
          )}
        </div>

        {/* Na dropzone */}
        <div className="flex flex-col gap-2">
          <div className="flex items-center justify-between">
            <span className="text-sm font-semibold text-white/70 flex items-center gap-2">
              <span className="px-2 py-0.5 rounded-md bg-violet-500/20 text-violet-300 text-xs font-bold">NA</span>
              Bewerkte foto
            </span>
            {afterUrl && (
              <button onClick={clearAfter} className="text-white/30 hover:text-white/60 transition-colors">
                <X className="w-4 h-4" />
              </button>
            )}
          </div>
          {afterUrl ? (
            <div className="relative glass-card overflow-hidden rounded-2xl">
              <img
                src={afterUrl}
                alt="Na"
                className="w-full h-48 object-cover"
              />
              <div className="absolute bottom-0 inset-x-0 bg-gradient-to-t from-black/60 to-transparent p-3">
                <p className="text-xs text-white/70 truncate">{afterName}</p>
              </div>
              <div
                {...getAfterProps()}
                className="absolute inset-0 opacity-0 hover:opacity-100 transition-opacity bg-black/50 flex items-center justify-center cursor-pointer rounded-2xl"
              >
                <input {...getAfterInputProps()} />
                <p className="text-sm text-white font-medium">Andere foto</p>
              </div>
            </div>
          ) : (
            <div
              {...getAfterProps()}
              className={`glass-card h-48 flex flex-col items-center justify-center cursor-pointer rounded-2xl transition-all duration-200 ${
                isAfterDrag
                  ? 'border-violet-500/50 bg-violet-500/5'
                  : 'border-dashed hover:border-violet-500/30'
              }`}
            >
              <input {...getAfterInputProps()} />
              <motion.div animate={{ y: isAfterDrag ? -6 : 0 }} className="text-center">
                <div className="w-12 h-12 bg-violet-500/10 rounded-xl flex items-center justify-center mx-auto mb-3">
                  <Upload className="w-6 h-6 text-violet-400" />
                </div>
                <p className="text-sm font-semibold text-white/60 mb-1">
                  {isAfterDrag ? 'Laat los' : 'Sleep of klik'}
                </p>
                <p className="text-xs text-white/30">Na-foto uploaden</p>
              </motion.div>
            </div>
          )}
        </div>
      </div>

      {/* Slider section */}
      <AnimatePresence>
        {!bothLoaded && (
          <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            className="glass-card p-8 flex flex-col items-center justify-center text-center rounded-2xl"
          >
            <div className="w-14 h-14 bg-purple-500/10 rounded-2xl flex items-center justify-center mx-auto mb-4">
              <ImageIcon className="w-7 h-7 text-purple-400/50" />
            </div>
            <p className="text-white/40 font-medium mb-1">Upload beide foto's om de vergelijking te starten</p>
            <p className="text-xs text-white/20">
              {!beforeUrl && !afterUrl
                ? 'Voor- en na-foto ontbreken nog'
                : !beforeUrl
                ? 'Voor-foto ontbreekt nog'
                : 'Na-foto ontbreekt nog'}
            </p>
          </motion.div>
        )}

        {bothLoaded && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            transition={{ type: 'spring', bounce: 0.25 }}
          >
            <div className="flex items-center justify-between mb-3">
              <h2 className="text-sm font-semibold text-white/60">Interactieve vergelijking</h2>
              <p className="text-xs text-white/30">Sleep de lijn om te vergelijken</p>
            </div>
            <BeforeAfterSlider before={beforeUrl} after={afterUrl} />
            <div className="mt-4 glass-card p-4 rounded-xl flex items-start gap-3">
              <Download className="w-4 h-4 text-purple-400 flex-shrink-0 mt-0.5" />
              <p className="text-xs text-white/40 leading-relaxed">
                Om de vergelijking op te slaan, gebruik een screenshot-tool zoals{' '}
                <span className="text-purple-300">Windows + Shift + S</span> (Windows) of{' '}
                <span className="text-purple-300">Cmd + Shift + 4</span> (Mac).
              </p>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}
