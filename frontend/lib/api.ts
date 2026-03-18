import axios from 'axios'

export const api = axios.create({
  baseURL: '',
  timeout: 60000,
})

// ─── Image Processing ────────────────────────────────────────────────────────

export async function stripExif(file: File): Promise<Blob> {
  const form = new FormData()
  form.append('file', file)
  const res = await api.post('/api/images/strip-exif', form, { responseType: 'blob' })
  return res.data
}

export async function enhanceImage(
  file: File,
  brightness = 1.0,
  contrast = 1.0,
  color = 1.0,
  sharpness = 1.0
): Promise<{ image: string; filename: string }> {
  const form = new FormData()
  form.append('file', file)
  form.append('brightness', String(brightness))
  form.append('contrast', String(contrast))
  form.append('color', String(color))
  form.append('sharpness', String(sharpness))
  const res = await api.post('/api/images/enhance', form)
  return res.data
}

export async function addTextWatermark(
  file: File,
  text: string,
  position: string,
  opacity: number,
  fontSize: number,
  color: string
): Promise<{ image: string }> {
  const form = new FormData()
  form.append('file', file)
  form.append('text', text)
  form.append('position', position)
  form.append('opacity', String(opacity))
  form.append('font_size', String(fontSize))
  form.append('color', color)
  const res = await api.post('/api/images/watermark-text', form)
  return res.data
}

export async function resizeImage(
  file: File,
  platform: string
): Promise<{ image: string; width: number; height: number }> {
  const form = new FormData()
  form.append('file', file)
  form.append('platform', platform)
  const res = await api.post('/api/images/resize', form)
  return res.data
}

export async function cropImage(
  file: File,
  top: number,
  right: number,
  bottom: number,
  left: number
): Promise<{ image: string }> {
  const form = new FormData()
  form.append('file', file)
  form.append('top', String(top))
  form.append('right', String(right))
  form.append('bottom', String(bottom))
  form.append('left', String(left))
  const res = await api.post('/api/images/crop', form)
  return res.data
}

export async function blurArea(
  file: File,
  x: number,
  y: number,
  width: number,
  height: number,
  strength: number
): Promise<{ image: string }> {
  const form = new FormData()
  form.append('file', file)
  form.append('x', String(x))
  form.append('y', String(y))
  form.append('width', String(width))
  form.append('height', String(height))
  form.append('strength', String(strength))
  const res = await api.post('/api/images/blur', form)
  return res.data
}

export async function getPlatforms(): Promise<{
  platforms: string[]
  presets: Record<string, { w: number; h: number; mode: string; description: string }>
}> {
  const res = await api.get('/api/images/platforms')
  return res.data
}

export async function processFullPipeline(
  file: File,
  options: Record<string, unknown>
): Promise<{ image: string; size: number }> {
  const form = new FormData()
  form.append('file', file)
  form.append('options', JSON.stringify(options))
  const res = await api.post('/api/images/process', form)
  return res.data
}

// ─── AI ──────────────────────────────────────────────────────────────────────

export async function analyzePhoto(
  file: File,
  apiKey: string
): Promise<{
  beschrijving: string
  hashtags: string[]
  stemming: string
  tips: string[]
}> {
  const form = new FormData()
  form.append('file', file)
  form.append('api_key', apiKey)
  const res = await api.post('/api/ai/analyze', form)
  return res.data
}

export async function generateTitles(
  file: File,
  apiKey: string
): Promise<{ titles: string[] }> {
  const form = new FormData()
  form.append('file', file)
  form.append('api_key', apiKey)
  const res = await api.post('/api/ai/titles', form)
  return res.data
}

export async function generateSessionIdeas(
  platform: string,
  theme: string,
  apiKey: string
): Promise<{ ideas: Array<{ titel: string; beschrijving: string; props: string; locatie: string; tip: string }> }> {
  const res = await api.post('/api/ai/session-ideas', { platform, theme, api_key: apiKey })
  return res.data
}

export async function generateReplyTemplates(
  scenario: string,
  apiKey: string
): Promise<{ templates: Array<{ naam: string; bericht: string; toon: string }> }> {
  const res = await api.post('/api/ai/reply-templates', { scenario, api_key: apiKey })
  return res.data
}

export async function faceBlur(
  file: File,
  apiKey: string
): Promise<{ image: string | null; facesDetected: number; message: string }> {
  const form = new FormData()
  form.append('file', file)
  form.append('api_key', apiKey)
  const res = await api.post('/api/ai/face-blur', form)
  return res.data
}

export async function promptEdit(
  file: File,
  apiKey: string,
  prompt: string
): Promise<{ image: string; uitleg: string; params: Record<string, unknown> }> {
  const form = new FormData()
  form.append('file', file)
  form.append('api_key', apiKey)
  form.append('prompt', prompt)
  const res = await api.post('/api/ai/prompt-edit', form)
  return res.data
}

export async function smartEnhancePhoto(
  file: File,
  apiKey: string
): Promise<{ image: string; uitleg: string; params: { brightness: number; saturation: number; sharpness: number } }> {
  const form = new FormData()
  form.append('file', file)
  form.append('api_key', apiKey)
  const res = await api.post('/api/ai/smart-enhance', form)
  return res.data
}

export async function removeBackground(
  file: File,
  removeBgApiKey: string,
  bgColor = ''
): Promise<{ image: string; format: string }> {
  const form = new FormData()
  form.append('file', file)
  form.append('api_key', removeBgApiKey)
  form.append('bg_color', bgColor)
  const res = await api.post('/api/ai/remove-background', form)
  return res.data
}

// ─── Business ────────────────────────────────────────────────────────────────

export interface IncomeItem {
  id: number
  platform: string
  datum: string
  bedrag: number
  beschrijving: string
}

export interface OrderItem {
  id: number
  klant: string
  platform: string
  beschrijving: string
  prijs: number
  status: string
  datum: string
}

export async function getIncome(platform?: string): Promise<{ items: IncomeItem[]; total: number }> {
  const res = await api.get('/api/business/income', { params: platform ? { platform } : {} })
  return res.data
}

export async function addIncome(data: {
  platform: string
  datum: string
  bedrag: number
  beschrijving?: string
}): Promise<{ id: number; message: string }> {
  const res = await api.post('/api/business/income', data)
  return res.data
}

export async function deleteIncome(id: number): Promise<void> {
  await api.delete(`/api/business/income/${id}`)
}

export async function getOrders(status?: string): Promise<{ items: OrderItem[] }> {
  const res = await api.get('/api/business/orders', { params: status ? { status } : {} })
  return res.data
}

export async function addOrder(data: {
  klant: string
  platform: string
  beschrijving?: string
  prijs: number
  datum: string
  status?: string
}): Promise<{ id: number; message: string }> {
  const res = await api.post('/api/business/orders', data)
  return res.data
}

export async function updateOrderStatus(id: number, status: string): Promise<void> {
  await api.put(`/api/business/orders/${id}`, null, { params: { status } })
}

export async function deleteOrder(id: number): Promise<void> {
  await api.delete(`/api/business/orders/${id}`)
}

export async function calculatePrice(
  basePrice: number,
  quantity: number,
  discountPercent = 0
): Promise<{ subtotal: number; discount: number; total: number; per_item: number }> {
  const res = await api.post('/api/business/calculate-price', {
    base_price: basePrice,
    quantity,
    discount_percent: discountPercent,
  })
  return res.data
}

export function base64ToObjectUrl(base64: string, mimeType = 'image/jpeg'): string {
  const binary = atob(base64)
  const bytes = new Uint8Array(binary.length)
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i)
  }
  const blob = new Blob([bytes], { type: mimeType })
  return URL.createObjectURL(blob)
}
