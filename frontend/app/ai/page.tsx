'use client'

import { useState, useCallback, useEffect } from 'react'
import { useDropzone } from 'react-dropzone'
import { motion, AnimatePresence } from 'framer-motion'
import toast from 'react-hot-toast'
import {
  Sparkles,
  Upload,
  Hash,
  FileText,
  Lightbulb,
  MessageSquare,
  Loader2,
  Copy,
  CheckCircle,
  Key,
  RefreshCw,
  Wand2,
  Image as ImageIcon,
  ScanFace,
  PenLine,
  Download,
} from 'lucide-react'
import {
  analyzePhoto,
  generateTitles,
  generateSessionIdeas,
  generateReplyTemplates,
  smartEnhancePhoto,
  removeBackground,
  faceBlur,
  promptEdit,
  generateBackground,
} from '@/lib/api'

type Tab = 'analyze' | 'titles' | 'ideas' | 'replies' | 'edit'

const PLATFORMS = ['FeetFinder', 'OnlyFans', 'Fansly', 'Instagram', 'Patreon']
const THEMES = ['elegant', 'speels', 'sensueel', 'romantisch', 'artistiek', 'sportief', 'zomers', 'luxe']
const SCENARIOS = [
  'Prijsvraag',
  'Custom verzoek',
  'Abonnement vragen',
  'Afwijzing',
  'Dankwoord',
  'Onbeleefde klant',
  'Korting vragen',
  'Tip ontvangen',
]

function useCopyToClipboard() {
  const [copied, setCopied] = useState<string | null>(null)
  const copy = (text: string, id: string) => {
    navigator.clipboard.writeText(text).then(() => {
      setCopied(id)
      toast.success('Gekopieerd naar klembord')
      setTimeout(() => setCopied(null), 2000)
    })
  }
  return { copied, copy }
}

function getErrorMsg(e: any, fallback: string): string {
  const status = e?.response?.status
  if (status === 401) return 'Ongeldige API sleutel — controleer je sleutel bij Instellingen'
  if (status === 429) return 'Te veel verzoeken — wacht even en probeer opnieuw'
  return e?.response?.data?.error || e?.message || fallback
}

export default function AIPage() {
  const [apiKey, setApiKey] = useState('')
  const [activeTab, setActiveTab] = useState<Tab>('analyze')
  const [file, setFile] = useState<File | null>(null)
  const [previewUrl, setPreviewUrl] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const { copied, copy } = useCopyToClipboard()

  // Analyze state
  const [analysis, setAnalysis] = useState<{
    beschrijving: string
    hashtags: string[]
    stemming: string
    tips: string[]
  } | null>(null)

  // Titles state
  const [titles, setTitles] = useState<string[]>([])

  // Session ideas state
  const [platform, setPlatform] = useState('FeetFinder')
  const [theme, setTheme] = useState('elegant')
  const [ideas, setIdeas] = useState<Array<{ titel: string; beschrijving: string; props: string; locatie: string; tip: string }>>([])

  // Reply templates state
  const [scenario, setScenario] = useState('Prijsvraag')
  const [templates, setTemplates] = useState<Array<{ naam: string; bericht: string; toon: string }>>([])

  // Edit tab state
  const [removeBgKey, setRemoveBgKey] = useState('')
  const [smartEnhanceResult, setSmartEnhanceResult] = useState<{ image: string; uitleg: string; params: any } | null>(null)
  const [removeBgResult, setRemoveBgResult] = useState<{ image: string; format: string } | null>(null)
  const [faceBlurResult, setFaceBlurResult] = useState<{ image: string | null; facesDetected: number; message: string } | null>(null)
  const [promptEditResult, setPromptEditResult] = useState<{ image: string; uitleg: string } | null>(null)
  const [editPromptText, setEditPromptText] = useState('')
  const [bgColor, setBgColor] = useState('#ffffff')
  const [bgTransparent, setBgTransparent] = useState(false)
  const [editLoading, setEditLoading] = useState<'enhance' | 'removebg' | 'faceblur' | 'prompt' | 'genbg' | null>(null)
  const [stabilityKey, setStabilityKey] = useState('')
  const [genBgPrompt, setGenBgPrompt] = useState('')
  const [genBgResult, setGenBgResult] = useState<{ image: string; uitleg: string } | null>(null)

  // Load stored API key
  useEffect(() => {
    const stored = localStorage.getItem('anthropic_api_key')
    if (stored) setApiKey(stored.trim())
    const storedRemoveBgKey = localStorage.getItem('remove_bg_api_key') || ''
    if (storedRemoveBgKey) setRemoveBgKey(storedRemoveBgKey)
    const storedStabilityKey = localStorage.getItem('stability_api_key') || ''
    if (storedStabilityKey) setStabilityKey(storedStabilityKey)
  }, [])

  const saveApiKey = () => {
    const trimmed = apiKey.trim()
    setApiKey(trimmed)
    localStorage.setItem('anthropic_api_key', trimmed)
    toast.success('API sleutel opgeslagen')
  }

  const onDrop = useCallback((accepted: File[]) => {
    if (accepted[0]) {
      setFile(accepted[0])
      setPreviewUrl(URL.createObjectURL(accepted[0]))
      setAnalysis(null)
      setTitles([])
    }
  }, [])

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: { 'image/*': [] },
    multiple: false,
  })

  const handleAnalyze = async () => {
    if (!file || !apiKey) {
      toast.error(!file ? 'Selecteer eerst een foto' : 'Vul je API sleutel in')
      return
    }
    setLoading(true)
    try {
      const result = await analyzePhoto(file, apiKey)
      setAnalysis(result)
      toast.success('Analyse voltooid')
    } catch (e: any) {
      toast.error(getErrorMsg(e, 'Analyse mislukt'))
    } finally {
      setLoading(false)
    }
  }

  const handleGenerateTitles = async () => {
    if (!file || !apiKey) {
      toast.error(!file ? 'Selecteer eerst een foto' : 'Vul je API sleutel in')
      return
    }
    setLoading(true)
    try {
      const result = await generateTitles(file, apiKey)
      setTitles(result.titles)
      toast.success('Titels gegenereerd')
    } catch (e: any) {
      toast.error(getErrorMsg(e, 'Titels genereren mislukt'))
    } finally {
      setLoading(false)
    }
  }

  const handleGenerateIdeas = async () => {
    if (!apiKey) {
      toast.error('Vul je API sleutel in')
      return
    }
    setLoading(true)
    try {
      const result = await generateSessionIdeas(platform, theme, apiKey)
      setIdeas(result.ideas)
      toast.success('Ideeën gegenereerd')
    } catch (e: any) {
      toast.error(getErrorMsg(e, 'Ideeën genereren mislukt'))
    } finally {
      setLoading(false)
    }
  }

  const handleGenerateReplies = async () => {
    if (!apiKey) {
      toast.error('Vul je API sleutel in')
      return
    }
    setLoading(true)
    try {
      const result = await generateReplyTemplates(scenario, apiKey)
      setTemplates(result.templates)
      toast.success('Sjablonen gegenereerd')
    } catch (e: any) {
      toast.error(getErrorMsg(e, 'Sjablonen genereren mislukt'))
    } finally {
      setLoading(false)
    }
  }

  const handleSmartEnhance = async () => {
    if (!file || !apiKey) {
      toast.error(!file ? 'Selecteer eerst een foto' : 'Vul je Anthropic API sleutel in')
      return
    }
    setEditLoading('enhance')
    try {
      const result = await smartEnhancePhoto(file, apiKey)
      setSmartEnhanceResult(result)
      toast.success('Foto verbeterd met AI!')
    } catch (e: any) {
      toast.error(getErrorMsg(e, 'Verbeteren mislukt'))
    } finally {
      setEditLoading(null)
    }
  }

  const handleRemoveBackground = async () => {
    if (!file) { toast.error('Selecteer eerst een foto'); return }
    if (!removeBgKey) { toast.error('Vul je remove.bg API sleutel in bij Instellingen'); return }
    setEditLoading('removebg')
    try {
      const color = bgTransparent ? '' : bgColor
      const result = await removeBackground(file, removeBgKey, color)
      setRemoveBgResult(result)
      toast.success('Achtergrond verwijderd!')
    } catch (e: any) {
      toast.error(getErrorMsg(e, 'Verwijderen mislukt'))
    } finally {
      setEditLoading(null)
    }
  }

  const handleFaceBlur = async () => {
    if (!file || !apiKey) {
      toast.error(!file ? 'Selecteer eerst een foto' : 'Vul je Anthropic API sleutel in')
      return
    }
    setEditLoading('faceblur')
    setFaceBlurResult(null)
    try {
      const result = await faceBlur(file, apiKey)
      setFaceBlurResult(result)
      if (result.facesDetected === 0) toast('Geen gezichten gevonden in de foto', { icon: '🔍' })
      else toast.success(`${result.facesDetected} gezicht${result.facesDetected > 1 ? 'en' : ''} geblurd!`)
    } catch (e: any) {
      toast.error(getErrorMsg(e, 'Gezichtsdetectie mislukt'))
    } finally {
      setEditLoading(null)
    }
  }

  const handlePromptEdit = async () => {
    if (!file || !apiKey) {
      toast.error(!file ? 'Selecteer eerst een foto' : 'Vul je Anthropic API sleutel in')
      return
    }
    if (!editPromptText.trim()) {
      toast.error('Typ eerst een bewerkingsopdracht')
      return
    }
    setEditLoading('prompt')
    setPromptEditResult(null)
    try {
      const result = await promptEdit(file, apiKey, editPromptText, removeBgKey, stabilityKey)
      setPromptEditResult(result)
      toast.success('Foto bewerkt via AI!')
    } catch (e: any) {
      toast.error(getErrorMsg(e, 'Bewerking mislukt'))
    } finally {
      setEditLoading(null)
    }
  }

  const handleGenerateBackground = async () => {
    if (!file) { toast.error('Selecteer eerst een foto'); return }
    if (!stabilityKey) { toast.error('Vul je Stability AI sleutel in bij Instellingen'); return }
    if (!genBgPrompt.trim()) { toast.error('Typ een achtergrond omschrijving'); return }
    setEditLoading('genbg')
    setGenBgResult(null)
    try {
      const result = await generateBackground(file, stabilityKey, genBgPrompt)
      setGenBgResult(result)
      toast.success('AI achtergrond gegenereerd!')
    } catch (e: any) {
      toast.error(getErrorMsg(e, 'Genereren mislukt'))
    } finally {
      setEditLoading(null)
    }
  }

  const downloadResult = (b64: string, format: string, prefix: string) => {
    const link = document.createElement('a')
    link.href = `data:image/${format};base64,${b64}`
    link.download = `${prefix}_${Date.now()}.${format === 'jpeg' ? 'jpg' : 'png'}`
    link.click()
  }

  const tabs = [
    { id: 'analyze' as Tab, icon: Sparkles, label: "Foto's analyseren" },
    { id: 'titles' as Tab, icon: FileText, label: 'Titels genereren' },
    { id: 'ideas' as Tab, icon: Lightbulb, label: 'Sessie-ideeën' },
    { id: 'replies' as Tab, icon: MessageSquare, label: 'Antwoordsjablonen' },
    { id: 'edit' as Tab, icon: Wand2, label: 'AI Bewerken' },
  ]

  return (
    <div className="max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex items-start justify-between mb-8">
        <div>
          <div className="flex items-center gap-3 mb-1">
            <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-pink-500 to-purple-600 flex items-center justify-center">
              <Sparkles className="w-4 h-4 text-white" />
            </div>
            <span className="text-sm font-medium text-purple-400 uppercase tracking-widest">AI Studio</span>
          </div>
          <h1 className="text-3xl font-black gradient-text">Claude AI Assistent</h1>
          <p className="text-white/40 text-sm mt-1">Powered by Anthropic Claude</p>
        </div>
      </div>

      {/* API Key input */}
      <div className="glass-card p-5 mb-6">
        <div className="flex items-center gap-3 mb-3">
          <Key className="w-4 h-4 text-purple-400" />
          <h3 className="font-semibold text-white text-sm">Anthropic API Sleutel</h3>
          <span className="badge-yellow text-[10px]">Vereist</span>
        </div>
        <div className="flex gap-3">
          <input
            type="password"
            value={apiKey}
            onChange={(e) => setApiKey(e.target.value)}
            placeholder="sk-ant-api03-..."
            className="input-dark flex-1 text-sm font-mono"
          />
          <button onClick={saveApiKey} disabled={!apiKey} className="btn-primary text-sm px-5">
            Opslaan
          </button>
        </div>
        <p className="text-xs text-white/25 mt-2">
          Sleutel wordt lokaal opgeslagen in je browser. Nooit gedeeld.
        </p>
      </div>

      {/* Tabs */}
      <div className="flex gap-2 mb-6 overflow-x-auto pb-1">
        {tabs.map((tab) => {
          const Icon = tab.icon
          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-medium transition-all duration-200 whitespace-nowrap flex-shrink-0 ${
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
        {/* ANALYZE TAB */}
        {activeTab === 'analyze' && (
          <motion.div key="analyze" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}>
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* Upload */}
              <div>
                <div
                  {...getRootProps()}
                  className={`glass-card h-64 flex flex-col items-center justify-center cursor-pointer transition-all duration-200 ${
                    isDragActive ? 'border-purple-500/50 bg-purple-500/5' : 'hover:border-purple-500/25'
                  }`}
                >
                  <input {...getInputProps()} />
                  {previewUrl ? (
                    <img src={previewUrl} alt="Preview" className="max-h-56 max-w-full rounded-lg object-contain" />
                  ) : (
                    <div className="text-center">
                      <Upload className="w-8 h-8 text-purple-400 mx-auto mb-3" />
                      <p className="text-white/50 text-sm">Sleep foto hierheen</p>
                      <p className="text-white/25 text-xs mt-1">of klik om te bladeren</p>
                    </div>
                  )}
                </div>
                {previewUrl && (
                  <p className="text-xs text-white/30 mt-2 text-center">{file?.name}</p>
                )}
                <button
                  onClick={handleAnalyze}
                  disabled={!file || !apiKey || loading}
                  className="btn-primary w-full mt-4 flex items-center justify-center gap-2"
                >
                  {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4" />}
                  Foto analyseren met AI
                </button>
              </div>

              {/* Results */}
              <div className="flex flex-col gap-4">
                {analysis ? (
                  <>
                    <div className="glass-card p-5">
                      <h4 className="text-sm font-semibold text-purple-300 mb-3 flex items-center gap-2">
                        <FileText className="w-3.5 h-3.5" /> Beschrijving
                      </h4>
                      <p className="text-sm text-white/70 leading-relaxed">{analysis.beschrijving}</p>
                      {analysis.stemming && (
                        <div className="mt-3 flex items-center gap-2">
                          <span className="text-xs text-white/30">Stemming:</span>
                          <span className="badge-purple text-xs">{analysis.stemming}</span>
                        </div>
                      )}
                    </div>

                    {analysis.hashtags.length > 0 && (
                      <div className="glass-card p-5">
                        <div className="flex items-center justify-between mb-3">
                          <h4 className="text-sm font-semibold text-purple-300 flex items-center gap-2">
                            <Hash className="w-3.5 h-3.5" /> Hashtags
                          </h4>
                          <button
                            onClick={() => copy(analysis.hashtags.join(' '), 'hashtags')}
                            className="text-xs text-white/30 hover:text-purple-400 transition-colors flex items-center gap-1"
                          >
                            {copied === 'hashtags' ? <CheckCircle className="w-3.5 h-3.5 text-green-400" /> : <Copy className="w-3.5 h-3.5" />}
                            Kopieer alles
                          </button>
                        </div>
                        <div className="flex flex-wrap gap-1.5">
                          {analysis.hashtags.map((tag, i) => (
                            <button
                              key={i}
                              onClick={() => copy(tag, `tag-${i}`)}
                              className="badge-purple text-xs cursor-pointer hover:bg-purple-500/30 transition-colors"
                            >
                              {tag}
                            </button>
                          ))}
                        </div>
                      </div>
                    )}

                    {analysis.tips.length > 0 && (
                      <div className="glass-card p-5">
                        <h4 className="text-sm font-semibold text-purple-300 mb-3 flex items-center gap-2">
                          <Lightbulb className="w-3.5 h-3.5" /> Marketing Tips
                        </h4>
                        <ul className="space-y-2">
                          {analysis.tips.map((tip, i) => (
                            <li key={i} className="flex items-start gap-2 text-sm text-white/60">
                              <span className="text-purple-400 font-bold mt-0.5">{i + 1}.</span>
                              {tip}
                            </li>
                          ))}
                        </ul>
                      </div>
                    )}
                  </>
                ) : (
                  <div className="glass-card h-full flex items-center justify-center p-10">
                    <div className="text-center">
                      <Sparkles className="w-12 h-12 text-purple-400/30 mx-auto mb-3" />
                      <p className="text-white/30 text-sm">Upload een foto en klik op analyseren</p>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </motion.div>
        )}

        {/* TITLES TAB */}
        {activeTab === 'titles' && (
          <motion.div key="titles" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}>
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <div>
                <div
                  {...getRootProps()}
                  className={`glass-card h-64 flex flex-col items-center justify-center cursor-pointer transition-all duration-200 ${
                    isDragActive ? 'border-purple-500/50 bg-purple-500/5' : 'hover:border-purple-500/25'
                  }`}
                >
                  <input {...getInputProps()} />
                  {previewUrl ? (
                    <img src={previewUrl} alt="Preview" className="max-h-56 max-w-full rounded-lg object-contain" />
                  ) : (
                    <div className="text-center">
                      <Upload className="w-8 h-8 text-purple-400 mx-auto mb-3" />
                      <p className="text-white/50 text-sm">Sleep foto hierheen</p>
                    </div>
                  )}
                </div>
                <button
                  onClick={handleGenerateTitles}
                  disabled={!file || !apiKey || loading}
                  className="btn-primary w-full mt-4 flex items-center justify-center gap-2"
                >
                  {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <FileText className="w-4 h-4" />}
                  5 Titels genereren
                </button>
              </div>

              <div>
                {titles.length > 0 ? (
                  <div className="flex flex-col gap-3">
                    {titles.map((title, i) => (
                      <motion.div
                        key={i}
                        initial={{ opacity: 0, x: 10 }}
                        animate={{ opacity: 1, x: 0 }}
                        transition={{ delay: i * 0.07 }}
                        className="glass-card p-4 flex items-center gap-3"
                      >
                        <div className="w-7 h-7 bg-purple-500/20 rounded-lg flex items-center justify-center flex-shrink-0">
                          <span className="text-xs font-bold text-purple-400">{i + 1}</span>
                        </div>
                        <p className="text-sm text-white/80 flex-1">{title}</p>
                        <button
                          onClick={() => copy(title, `title-${i}`)}
                          className="text-white/30 hover:text-purple-400 transition-colors flex-shrink-0"
                        >
                          {copied === `title-${i}` ? (
                            <CheckCircle className="w-4 h-4 text-green-400" />
                          ) : (
                            <Copy className="w-4 h-4" />
                          )}
                        </button>
                      </motion.div>
                    ))}
                    <button
                      onClick={handleGenerateTitles}
                      disabled={loading}
                      className="btn-secondary flex items-center justify-center gap-2 text-sm mt-1"
                    >
                      <RefreshCw className="w-3.5 h-3.5" /> Opnieuw genereren
                    </button>
                  </div>
                ) : (
                  <div className="glass-card h-full flex items-center justify-center p-10">
                    <div className="text-center">
                      <FileText className="w-12 h-12 text-purple-400/30 mx-auto mb-3" />
                      <p className="text-white/30 text-sm">Upload een foto en genereer titels</p>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </motion.div>
        )}

        {/* IDEAS TAB */}
        {activeTab === 'ideas' && (
          <motion.div key="ideas" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}>
            <div className="glass-card p-5 mb-6">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-sm text-white/60 mb-1.5 block">Platform</label>
                  <select
                    value={platform}
                    onChange={(e) => setPlatform(e.target.value)}
                    className="input-dark w-full text-sm"
                  >
                    {PLATFORMS.map((p) => (
                      <option key={p} value={p} className="bg-[#1a1a2e]">{p}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="text-sm text-white/60 mb-1.5 block">Thema</label>
                  <select
                    value={theme}
                    onChange={(e) => setTheme(e.target.value)}
                    className="input-dark w-full text-sm"
                  >
                    {THEMES.map((t) => (
                      <option key={t} value={t} className="bg-[#1a1a2e]">{t}</option>
                    ))}
                  </select>
                </div>
              </div>
              <button
                onClick={handleGenerateIdeas}
                disabled={!apiKey || loading}
                className="btn-primary mt-4 flex items-center gap-2 text-sm"
              >
                {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Lightbulb className="w-4 h-4" />}
                10 Sessie-ideeën genereren
              </button>
            </div>

            {ideas.length > 0 ? (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {ideas.map((idea, i) => (
                  <motion.div
                    key={i}
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: i * 0.05 }}
                    className="glass-card p-5"
                  >
                    <div className="flex items-start gap-3 mb-3">
                      <div className="w-7 h-7 bg-purple-500/20 rounded-lg flex items-center justify-center flex-shrink-0 mt-0.5">
                        <span className="text-xs font-bold text-purple-400">{i + 1}</span>
                      </div>
                      <h4 className="font-semibold text-white text-sm leading-tight">{idea.titel}</h4>
                    </div>
                    <p className="text-sm text-white/60 mb-3 leading-relaxed">{idea.beschrijving}</p>
                    <div className="grid grid-cols-2 gap-2 text-xs">
                      {idea.props && (
                        <div className="bg-white/[0.03] rounded-lg p-2">
                          <span className="text-white/30 block mb-0.5">Props</span>
                          <span className="text-white/60">{idea.props}</span>
                        </div>
                      )}
                      {idea.locatie && (
                        <div className="bg-white/[0.03] rounded-lg p-2">
                          <span className="text-white/30 block mb-0.5">Locatie</span>
                          <span className="text-white/60">{idea.locatie}</span>
                        </div>
                      )}
                    </div>
                    {idea.tip && (
                      <div className="mt-3 bg-purple-500/10 border border-purple-500/15 rounded-lg p-2.5">
                        <span className="text-xs text-purple-300">💡 {idea.tip}</span>
                      </div>
                    )}
                  </motion.div>
                ))}
              </div>
            ) : (
              <div className="glass-card p-12 flex items-center justify-center">
                <div className="text-center">
                  <Lightbulb className="w-12 h-12 text-purple-400/30 mx-auto mb-3" />
                  <p className="text-white/30 text-sm">Kies een platform en thema, dan genereer je sessie-ideeën</p>
                </div>
              </div>
            )}
          </motion.div>
        )}

        {/* REPLIES TAB */}
        {activeTab === 'replies' && (
          <motion.div key="replies" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}>
            <div className="glass-card p-5 mb-6">
              <div className="mb-4">
                <label className="text-sm text-white/60 mb-1.5 block">Scenario</label>
                <div className="flex flex-wrap gap-2">
                  {SCENARIOS.map((s) => (
                    <button
                      key={s}
                      onClick={() => setScenario(s)}
                      className={`text-sm px-3 py-1.5 rounded-lg transition-all duration-150 ${
                        scenario === s
                          ? 'bg-purple-600/40 text-purple-300 border border-purple-500/30'
                          : 'glass-button text-white/40 hover:text-white/70'
                      }`}
                    >
                      {s}
                    </button>
                  ))}
                </div>
              </div>
              <button
                onClick={handleGenerateReplies}
                disabled={!apiKey || loading}
                className="btn-primary flex items-center gap-2 text-sm"
              >
                {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <MessageSquare className="w-4 h-4" />}
                3 Sjablonen genereren voor: {scenario}
              </button>
            </div>

            {templates.length > 0 ? (
              <div className="flex flex-col gap-4">
                {templates.map((tmpl, i) => (
                  <motion.div
                    key={i}
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: i * 0.08 }}
                    className="glass-card p-5"
                  >
                    <div className="flex items-center justify-between mb-3">
                      <div className="flex items-center gap-2">
                        <div className="w-6 h-6 bg-purple-500/20 rounded-lg flex items-center justify-center">
                          <span className="text-xs font-bold text-purple-400">{i + 1}</span>
                        </div>
                        <span className="font-semibold text-white text-sm">{tmpl.naam}</span>
                        <span className="badge-blue text-xs">{tmpl.toon}</span>
                      </div>
                      <button
                        onClick={() => copy(tmpl.bericht, `tmpl-${i}`)}
                        className="btn-secondary text-xs px-3 py-1.5 flex items-center gap-1.5"
                      >
                        {copied === `tmpl-${i}` ? (
                          <><CheckCircle className="w-3 h-3 text-green-400" /> Gekopieerd</>
                        ) : (
                          <><Copy className="w-3 h-3" /> Kopieer</>
                        )}
                      </button>
                    </div>
                    <div className="bg-white/[0.03] rounded-xl p-4 border border-white/[0.06]">
                      <p className="text-sm text-white/70 leading-relaxed whitespace-pre-wrap">{tmpl.bericht}</p>
                    </div>
                  </motion.div>
                ))}
                <button
                  onClick={handleGenerateReplies}
                  disabled={loading}
                  className="btn-secondary flex items-center justify-center gap-2 text-sm"
                >
                  <RefreshCw className="w-3.5 h-3.5" /> Andere varianten genereren
                </button>
              </div>
            ) : (
              <div className="glass-card p-12 flex items-center justify-center">
                <div className="text-center">
                  <MessageSquare className="w-12 h-12 text-purple-400/30 mx-auto mb-3" />
                  <p className="text-white/30 text-sm">Kies een scenario en genereer antwoordsjablonen</p>
                </div>
              </div>
            )}
          </motion.div>
        )}
        {/* AI BEWERKEN TAB */}
        {activeTab === 'edit' && (
          <motion.div key="edit" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}>
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* Upload */}
              <div>
                <div
                  {...getRootProps()}
                  className={`glass-card h-64 flex flex-col items-center justify-center cursor-pointer transition-all duration-200 ${
                    isDragActive ? 'border-purple-500/50 bg-purple-500/5' : 'hover:border-purple-500/25'
                  }`}
                >
                  <input {...getInputProps()} />
                  {previewUrl ? (
                    <img src={previewUrl} alt="Preview" className="max-h-56 max-w-full rounded-lg object-contain" />
                  ) : (
                    <div className="text-center">
                      <Upload className="w-8 h-8 text-purple-400 mx-auto mb-3" />
                      <p className="text-white/50 text-sm">Sleep foto hierheen</p>
                      <p className="text-white/25 text-xs mt-1">of klik om te bladeren</p>
                    </div>
                  )}
                </div>
                {previewUrl && <p className="text-xs text-white/30 mt-2 text-center">{file?.name}</p>}

                {/* Smart Enhance */}
                <div className="glass-card p-5 mt-4">
                  <div className="flex items-center gap-2 mb-3">
                    <Wand2 className="w-4 h-4 text-purple-400" />
                    <h3 className="font-semibold text-white text-sm">Smart Auto-Verbeteren</h3>
                    <span className="badge-purple text-[10px]">Claude AI</span>
                  </div>
                  <p className="text-xs text-white/40 mb-4">Claude analyseert je foto en past automatisch de optimale helderheid, kleurverzadiging en scherpte toe.</p>
                  <button
                    onClick={handleSmartEnhance}
                    disabled={!file || !apiKey || editLoading !== null}
                    className="btn-primary w-full flex items-center justify-center gap-2 text-sm"
                  >
                    {editLoading === 'enhance' ? <Loader2 className="w-4 h-4 animate-spin" /> : <Wand2 className="w-4 h-4" />}
                    {editLoading === 'enhance' ? 'AI analyseert...' : 'Verbeteren met AI'}
                  </button>
                </div>

                {/* Face Blur */}
                <div className="glass-card p-5 mt-4">
                  <div className="flex items-center gap-2 mb-3">
                    <ScanFace className="w-4 h-4 text-orange-400" />
                    <h3 className="font-semibold text-white text-sm">Gezichten Blurren</h3>
                    <span className="badge text-[10px] bg-orange-500/20 text-orange-300 border border-orange-500/30">Claude AI</span>
                  </div>
                  <p className="text-xs text-white/40 mb-4">Claude detecteert automatisch alle gezichten en blurt ze voor privacy.</p>
                  <button
                    onClick={handleFaceBlur}
                    disabled={!file || !apiKey || editLoading !== null}
                    className="btn-primary w-full flex items-center justify-center gap-2 text-sm"
                    style={{ background: 'linear-gradient(135deg, #ea580c, #c2410c)' }}
                  >
                    {editLoading === 'faceblur' ? <Loader2 className="w-4 h-4 animate-spin" /> : <ScanFace className="w-4 h-4" />}
                    {editLoading === 'faceblur' ? 'Gezichten detecteren...' : 'Gezichten Automatisch Blurren'}
                  </button>
                </div>

                {/* Prompt Edit */}
                <div className="glass-card p-5 mt-4">
                  <div className="flex items-center gap-2 mb-3">
                    <PenLine className="w-4 h-4 text-pink-400" />
                    <h3 className="font-semibold text-white text-sm">Bewerken via Prompt</h3>
                    <span className="badge text-[10px] bg-pink-500/20 text-pink-300 border border-pink-500/30">Claude AI</span>
                  </div>
                  <p className="text-xs text-white/40 mb-3">
                    Typ een opdracht. Filters: &ldquo;warmer&rdquo;, &ldquo;vintage&rdquo;, &ldquo;zwart-wit&rdquo;. Achtergrond (fotorealistisch met Stability AI): &ldquo;strand&rdquo;, &ldquo;kerstsfeer&rdquo;, &ldquo;studio&rdquo;, &ldquo;bos&rdquo;.
                  </p>
                  <textarea
                    value={editPromptText}
                    onChange={(e) => setEditPromptText(e.target.value)}
                    placeholder="Bijv: maak warmer en levendiger, vintage filter, strand achtergrond, kerstsfeer..."
                    rows={3}
                    className="input-dark w-full text-sm resize-none mb-3"
                    onKeyDown={(e) => { if (e.key === 'Enter' && e.metaKey) handlePromptEdit() }}
                  />
                  <div className="flex gap-2 flex-wrap mb-3">
                    {['Warmer', 'Vintage', 'Levendig', 'Zwart-wit', 'Dramatisch', 'Zachter', 'Strand achtergrond', 'Kerstsfeer achtergrond', 'Studio achtergrond', 'Zonsondergang achtergrond', 'Bos achtergrond'].map((s) => (
                      <button
                        key={s}
                        onClick={() => setEditPromptText(s.toLowerCase())}
                        className="text-xs px-2.5 py-1 rounded-lg glass-button text-white/50 hover:text-white/80 transition-all"
                      >
                        {s}
                      </button>
                    ))}
                  </div>
                  <button
                    onClick={handlePromptEdit}
                    disabled={!file || !apiKey || !editPromptText.trim() || editLoading !== null}
                    className="btn-primary w-full flex items-center justify-center gap-2 text-sm"
                    style={{ background: 'linear-gradient(135deg, #db2777, #9333ea)' }}
                  >
                    {editLoading === 'prompt' ? <Loader2 className="w-4 h-4 animate-spin" /> : <PenLine className="w-4 h-4" />}
                    {editLoading === 'prompt' ? 'AI bewerkt foto...' : 'Foto Bewerken via AI'}
                  </button>
                </div>

                {/* Remove Background */}
                <div className="glass-card p-5 mt-4">
                  <div className="flex items-center gap-2 mb-3">
                    <ImageIcon className="w-4 h-4 text-green-400" />
                    <h3 className="font-semibold text-white text-sm">Achtergrond Verwijderen</h3>
                    <span className="badge-green text-[10px]">remove.bg</span>
                  </div>
                  {!removeBgKey ? (
                    <div className="bg-yellow-500/10 border border-yellow-500/20 rounded-xl p-3 mb-3">
                      <p className="text-xs text-yellow-300/80">
                        Vereist een remove.bg API sleutel. Voeg deze toe bij{' '}
                        <a href="/settings" className="text-yellow-400 underline">Instellingen</a>
                        . Gratis: 50 foto&apos;s/maand.
                      </p>
                    </div>
                  ) : (
                    <div className="mb-4">
                      <div className="flex items-center gap-3 mb-3">
                        <label className="text-xs text-white/60">Nieuwe achtergrond:</label>
                        <button
                          onClick={() => setBgTransparent(!bgTransparent)}
                          className={`text-xs px-3 py-1 rounded-lg transition-all ${bgTransparent ? 'bg-purple-600/40 text-purple-300 border border-purple-500/30' : 'glass-button text-white/50'}`}
                        >
                          Transparant
                        </button>
                        {!bgTransparent && (
                          <div className="flex items-center gap-2">
                            <input
                              type="color"
                              value={bgColor}
                              onChange={(e) => setBgColor(e.target.value)}
                              className="w-8 h-8 rounded-lg cursor-pointer border-0 bg-transparent"
                            />
                            <span className="text-xs text-white/40 font-mono">{bgColor}</span>
                          </div>
                        )}
                      </div>
                      <div className="flex gap-2 flex-wrap mb-1">
                        {['#ffffff', '#000000', '#f5e6d3', '#1a1a2e', '#e8d5b7', '#2d1b69'].map((c) => (
                          <button
                            key={c}
                            onClick={() => { setBgColor(c); setBgTransparent(false) }}
                            className="w-7 h-7 rounded-lg border-2 transition-all"
                            style={{ backgroundColor: c, borderColor: bgColor === c && !bgTransparent ? '#a855f7' : 'rgba(255,255,255,0.1)' }}
                          />
                        ))}
                      </div>
                    </div>
                  )}
                  <button
                    onClick={handleRemoveBackground}
                    disabled={!file || !removeBgKey || editLoading !== null}
                    className="btn-primary w-full flex items-center justify-center gap-2 text-sm"
                    style={{ background: removeBgKey ? undefined : 'rgba(255,255,255,0.05)' }}
                  >
                    {editLoading === 'removebg' ? <Loader2 className="w-4 h-4 animate-spin" /> : <ImageIcon className="w-4 h-4" />}
                    {editLoading === 'removebg' ? 'Achtergrond verwijderen...' : 'Achtergrond Verwijderen'}
                  </button>
                </div>

                {/* Generative AI Background */}
                <div className="glass-card p-5 mt-4">
                  <div className="flex items-center gap-2 mb-3">
                    <Sparkles className="w-4 h-4 text-violet-400" />
                    <h3 className="font-semibold text-white text-sm">AI Achtergrond Genereren</h3>
                    <span className="badge text-[10px] bg-violet-500/20 text-violet-300 border border-violet-500/30">Stability AI</span>
                  </div>
                  <p className="text-xs text-white/40 mb-3">
                    Vervang de achtergrond met een fotorealistische AI-scène. Bijv: &ldquo;tropisch strand&rdquo;, &ldquo;kerstsfeer&rdquo;, &ldquo;professionele studio&rdquo;.
                  </p>
                  {!stabilityKey && (
                    <div className="bg-yellow-500/10 border border-yellow-500/20 rounded-xl p-3 mb-3">
                      <p className="text-xs text-yellow-300/80">
                        Vereist een Stability AI sleutel. Voeg toe bij{' '}
                        <a href="/settings" className="text-yellow-400 underline">Instellingen</a>.
                      </p>
                    </div>
                  )}
                  <textarea
                    value={genBgPrompt}
                    onChange={(e) => setGenBgPrompt(e.target.value)}
                    placeholder="Beschrijf de gewenste achtergrond..."
                    rows={2}
                    className="input-dark w-full text-sm resize-none mb-3"
                  />
                  <div className="flex gap-1.5 flex-wrap mb-3">
                    {[
                      'Tropisch strand met golven',
                      'Kerstsfeer met sneeuw',
                      'Professionele fotostudio',
                      'Romantische zonsondergang',
                      'Mistig bos',
                      'Stad bij nacht',
                      'Bloemenweide',
                      'Luxe hotel lobby',
                    ].map((s) => (
                      <button
                        key={s}
                        onClick={() => setGenBgPrompt(s)}
                        className="text-xs px-2.5 py-1 rounded-lg glass-button text-white/50 hover:text-violet-300 transition-all"
                      >
                        {s}
                      </button>
                    ))}
                  </div>
                  <button
                    onClick={handleGenerateBackground}
                    disabled={!file || !stabilityKey || !genBgPrompt.trim() || editLoading !== null}
                    className="btn-primary w-full flex items-center justify-center gap-2 text-sm"
                    style={{ background: 'linear-gradient(135deg, #7c3aed, #4f46e5)' }}
                  >
                    {editLoading === 'genbg' ? <Loader2 className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4" />}
                    {editLoading === 'genbg' ? 'AI genereert achtergrond...' : 'Achtergrond Genereren met AI'}
                  </button>
                </div>
              </div>

              {/* Results */}
              <div className="flex flex-col gap-4">
                {/* Smart enhance result */}
                {smartEnhanceResult ? (
                  <div className="glass-card p-5">
                    <div className="flex items-center justify-between mb-3">
                      <h4 className="text-sm font-semibold text-purple-300 flex items-center gap-2">
                        <Wand2 className="w-3.5 h-3.5" /> Verbeterd Resultaat
                      </h4>
                      <button
                        onClick={() => downloadResult(smartEnhanceResult.image, 'jpeg', 'verbeterd')}
                        className="btn-secondary text-xs px-3 py-1.5 flex items-center gap-1.5"
                      >
                        <Copy className="w-3 h-3" /> Downloaden
                      </button>
                    </div>
                    <img
                      src={`data:image/jpeg;base64,${smartEnhanceResult.image}`}
                      alt="Verbeterd"
                      className="w-full rounded-xl object-contain max-h-64 mb-3"
                    />
                    {smartEnhanceResult.uitleg && (
                      <div className="bg-purple-500/10 border border-purple-500/15 rounded-xl p-3">
                        <p className="text-xs text-purple-300 leading-relaxed">💡 {smartEnhanceResult.uitleg}</p>
                      </div>
                    )}
                    <div className="flex gap-3 mt-3 text-xs text-white/30">
                      <span>☀️ Helderheid: {Math.round((smartEnhanceResult.params.brightness - 1) * 100 + 100)}%</span>
                      <span>🎨 Kleur: {Math.round((smartEnhanceResult.params.saturation - 1) * 100 + 100)}%</span>
                      <span>🔍 Scherpte: {smartEnhanceResult.params.sharpness.toFixed(1)}</span>
                    </div>
                  </div>
                ) : (
                  <div className="glass-card p-8 flex items-center justify-center">
                    <div className="text-center">
                      <Wand2 className="w-10 h-10 text-purple-400/20 mx-auto mb-3" />
                      <p className="text-white/25 text-sm">Upload een foto en klik op verbeteren</p>
                    </div>
                  </div>
                )}

                {/* Face blur result */}
                {faceBlurResult && (
                  <div className="glass-card p-5">
                    <div className="flex items-center justify-between mb-3">
                      <h4 className="text-sm font-semibold text-orange-300 flex items-center gap-2">
                        <ScanFace className="w-3.5 h-3.5" /> Gezichten Geblurd
                      </h4>
                      {faceBlurResult.image && (
                        <button
                          onClick={() => downloadResult(faceBlurResult.image!, 'jpeg', 'geblurd')}
                          className="btn-secondary text-xs px-3 py-1.5 flex items-center gap-1.5"
                        >
                          <Download className="w-3 h-3" /> Downloaden
                        </button>
                      )}
                    </div>
                    {faceBlurResult.image ? (
                      <>
                        <img
                          src={`data:image/jpeg;base64,${faceBlurResult.image}`}
                          alt="Geblurd"
                          className="w-full rounded-xl object-contain max-h-64 mb-3"
                        />
                        <div className="bg-orange-500/10 border border-orange-500/15 rounded-xl p-3">
                          <p className="text-xs text-orange-300">🎭 {faceBlurResult.message}</p>
                        </div>
                      </>
                    ) : (
                      <div className="bg-white/[0.03] rounded-xl p-4 text-center">
                        <p className="text-sm text-white/40">{faceBlurResult.message}</p>
                      </div>
                    )}
                  </div>
                )}

                {/* Prompt edit result */}
                {promptEditResult && (
                  <div className="glass-card p-5">
                    <div className="flex items-center justify-between mb-3">
                      <h4 className="text-sm font-semibold text-pink-300 flex items-center gap-2">
                        <PenLine className="w-3.5 h-3.5" /> Prompt Resultaat
                      </h4>
                      <button
                        onClick={() => downloadResult(promptEditResult.image, 'jpeg', 'prompt-edit')}
                        className="btn-secondary text-xs px-3 py-1.5 flex items-center gap-1.5"
                      >
                        <Download className="w-3 h-3" /> Downloaden
                      </button>
                    </div>
                    <img
                      src={`data:image/jpeg;base64,${promptEditResult.image}`}
                      alt="Prompt edit"
                      className="w-full rounded-xl object-contain max-h-64 mb-3"
                    />
                    {promptEditResult.uitleg && (
                      <div className="bg-pink-500/10 border border-pink-500/15 rounded-xl p-3">
                        <p className="text-xs text-pink-300 leading-relaxed">✏️ {promptEditResult.uitleg}</p>
                      </div>
                    )}
                  </div>
                )}

                {/* Remove background result */}
                {removeBgResult && (
                  <div className="glass-card p-5">
                    <div className="flex items-center justify-between mb-3">
                      <h4 className="text-sm font-semibold text-green-300 flex items-center gap-2">
                        <ImageIcon className="w-3.5 h-3.5" /> Achtergrond Verwijderd
                      </h4>
                      <button
                        onClick={() => downloadResult(removeBgResult.image, removeBgResult.format, 'geen-achtergrond')}
                        className="btn-secondary text-xs px-3 py-1.5 flex items-center gap-1.5"
                      >
                        <Copy className="w-3 h-3" /> Downloaden
                      </button>
                    </div>
                    <div
                      className="rounded-xl overflow-hidden max-h-64 flex items-center justify-center"
                      style={{
                        background: removeBgResult.format === 'png'
                          ? 'repeating-conic-gradient(#333 0% 25%, #222 0% 50%) 0 0 / 20px 20px'
                          : bgColor,
                      }}
                    >
                      <img
                        src={`data:image/${removeBgResult.format};base64,${removeBgResult.image}`}
                        alt="Achtergrond verwijderd"
                        className="max-w-full max-h-64 object-contain"
                      />
                    </div>
                  </div>
                )}

                {/* Generative background result */}
                {genBgResult && (
                  <div className="glass-card p-5">
                    <div className="flex items-center justify-between mb-3">
                      <h4 className="text-sm font-semibold text-violet-300 flex items-center gap-2">
                        <Sparkles className="w-3.5 h-3.5" /> AI Achtergrond
                      </h4>
                      <button
                        onClick={() => downloadResult(genBgResult.image, 'jpeg', 'ai-achtergrond')}
                        className="btn-secondary text-xs px-3 py-1.5 flex items-center gap-1.5"
                      >
                        <Download className="w-3 h-3" /> Downloaden
                      </button>
                    </div>
                    <img
                      src={`data:image/jpeg;base64,${genBgResult.image}`}
                      alt="AI achtergrond"
                      className="w-full rounded-xl object-contain max-h-64 mb-3"
                    />
                    {genBgResult.uitleg && (
                      <div className="bg-violet-500/10 border border-violet-500/15 rounded-xl p-3">
                        <p className="text-xs text-violet-300 leading-relaxed">✨ {genBgResult.uitleg}</p>
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}
