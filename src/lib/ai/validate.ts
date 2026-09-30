import { CATEGORIES } from '@/types'
import type { ParsedTransaction, Category, TransactionType } from '@/types'

/**
 * Extrae el primer objeto JSON de un string usando emparejamiento de llaves.
 * Más robusto que la regex greedy /\{[\s\S]*\}/.
 */
export function extractJSON(text: string): unknown {
  // Intento 1: parse directo (Gemini cumplió la instrucción)
  try {
    return JSON.parse(text.trim())
  } catch { /* sigue */ }

  // Intento 2: emparejamiento de llaves para extraer primer objeto
  const start = text.indexOf('{')
  if (start === -1) throw new Error('Gemini no devolvió JSON — intenta reformular el mensaje')

  let depth = 0
  for (let i = start; i < text.length; i++) {
    if (text[i] === '{') depth++
    else if (text[i] === '}') {
      depth--
      if (depth === 0) {
        try {
          return JSON.parse(text.slice(start, i + 1))
        } catch {
          throw new Error('JSON malformado en la respuesta de Gemini')
        }
      }
    }
  }

  throw new Error('JSON incompleto en la respuesta de Gemini')
}

/**
 * Valida y normaliza el objeto parseado antes de persistirlo.
 * Nunca lanza si hay un fallback razonable — prefiere datos seguros sobre rechazar.
 */
export function validateParsed(raw: unknown): ParsedTransaction {
  if (!raw || typeof raw !== 'object') {
    throw new Error('Respuesta de IA vacía o malformada')
  }

  const p = raw as Record<string, unknown>

  // ── amount ─────────────────────────────────────────────────────────────────
  // Acepta: 45000, "45000", "45.000", "$ 45,000"
  const rawAmount = String(p.amount ?? '').replace(/[^0-9]/g, '')
  const amount = parseInt(rawAmount, 10)
  if (!amount || amount <= 0) {
    throw new Error(`Monto inválido: "${p.amount}" — escribe el valor en números`)
  }

  // ── type ───────────────────────────────────────────────────────────────────
  const rawType = String(p.type ?? '').trim().toLowerCase()
  const TYPE_MAP: Record<string, TransactionType> = {
    income: 'income', ingreso: 'income', entrada: 'income',
    expense: 'expense', gasto: 'expense', salida: 'expense', egreso: 'expense',
  }
  const type: TransactionType = TYPE_MAP[rawType]
  if (!type) {
    throw new Error(`Tipo inválido: "${p.type}" — no pude identificar si es ingreso o gasto`)
  }

  // ── category ───────────────────────────────────────────────────────────────
  // Búsqueda case-insensitive con fallback a 'Otro'
  const rawCat = String(p.category ?? '').trim()
  const category: Category =
    CATEGORIES.find(c => c.toLowerCase() === rawCat.toLowerCase()) ?? 'Otro'

  // ── date ───────────────────────────────────────────────────────────────────
  const todayISO = new Date().toISOString().split('T')[0]
  const date = /^\d{4}-\d{2}-\d{2}$/.test(String(p.date ?? ''))
    ? String(p.date)
    : todayISO

  // ── optional fields ────────────────────────────────────────────────────────
  const description = typeof p.description === 'string' && p.description.trim()
    ? p.description.trim()
    : category   // fallback: usa la categoría como descripción mínima

  const payment_method = typeof p.payment_method === 'string' && p.payment_method !== 'null'
    ? p.payment_method.trim()
    : null

  return { amount, type, category, description, payment_method, date }
}

// ── Respuesta de dos modos (v1.1) ─────────────────────────────────────────────

export type AIResult =
  | { action: 'register'; transactions: ParsedTransaction[] }
  | { action: 'answer'; text: string }

/**
 * Valida la respuesta de dos modos del asistente.
 * Retrocompatible: si Gemini devuelve un objeto de transacción suelto
 * (formato v1.0), lo envuelve como register de 1 elemento.
 */
export function validateAIResponse(raw: unknown): AIResult {
  if (!raw || typeof raw !== 'object') {
    throw new Error('Respuesta de IA vacía o malformada')
  }
  const r = raw as Record<string, unknown>

  if (r.action === 'answer') {
    const text = typeof r.text === 'string' ? r.text.trim() : ''
    if (!text) throw new Error('La IA no devolvió respuesta — intenta reformular')
    return { action: 'answer', text }
  }

  if (r.action === 'register') {
    const arr = Array.isArray(r.transactions) ? r.transactions : []
    const transactions = arr.map((t) => validateParsed(t))
    if (transactions.length === 0) throw new Error('No identifiqué ninguna transacción — intenta ser más específico')
    return { action: 'register', transactions }
  }

  // Retrocompatibilidad: objeto de transacción directo (formato v1.0)
  if ('amount' in r && 'type' in r) {
    return { action: 'register', transactions: [validateParsed(raw)] }
  }

  throw new Error('Respuesta de IA en formato desconocido — intenta de nuevo')
}

/**
 * Traduce errores crudos de GoogleGenerativeAI a mensajes legibles en español.
 * Evita mostrar JSON interno, URLs de la API o stack traces al usuario.
 */
export function friendlyAIError(err: unknown): string {
  const msg = String((err as any)?.message ?? err ?? '')

  if (msg.includes('429') || /quota|rate.?limit/i.test(msg))
    return 'Límite de solicitudes alcanzado — espera unos segundos e intenta de nuevo.'
  if (msg.includes('404') || /not found/i.test(msg))
    return 'Modelo de IA no disponible. Verifica tu API Key en Ajustes.'
  if (msg.includes('403') || /api.?key|invalid.*key|unauthorized/i.test(msg))
    return 'API Key inválida o sin permisos. Ve a Ajustes y verifica tu clave de Gemini.'
  if (msg.includes('400'))
    return 'Solicitud inválida — intenta reformular el mensaje.'
  if (/fetch|network|connect/i.test(msg))
    return 'Sin conexión a internet — verifica tu red e intenta de nuevo.'
  if (/abort|cancel/i.test(msg))
    return 'Solicitud cancelada.'
  if (msg === 'timeout')
    return 'Gemini no respondió en 15s — verifica tu conexión e intenta de nuevo.'
  // Mensaje genérico corto para no exponer JSON crudo
  return msg.length > 120
    ? 'Error al contactar Gemini — intenta de nuevo en unos segundos.'
    : msg
}
