import { GoogleGenerativeAI } from '@google/generative-ai'
import { buildAIPrompt } from './prompt'
import { extractJSON, validateAIResponse, friendlyAIError, type AIResult } from './validate'
import { today } from '@/lib/dates'

const AI_TIMEOUT_MS = 15_000

// Modelos en orden de preferencia — si el primero da 404 (deprecado) prueba el siguiente
const MODEL_FALLBACK = [
  'gemini-2.5-flash-lite',
  'gemini-2.5-flash',
  'gemini-2.0-flash-lite',
  'gemini-2.0-flash',
  'gemini-1.5-flash',
]

/**
 * Envía el mensaje a Gemini. `context` (resumen financiero) es opcional:
 * solo debe pasarse cuando la persona hace una pregunta sobre sus datos.
 * La API Key viaja en una cabecera hacia Google y no se registra en ningún lado.
 */
export async function askGemini(
  text: string,
  apiKey: string,
  signal?: AbortSignal,
  context?: string,
): Promise<AIResult> {
  if (!apiKey || !apiKey.trim()) {
    throw new Error('Falta la API Key de Gemini. Agrégala en Ajustes para usar el modo Con IA.')
  }

  const genAI = new GoogleGenerativeAI(apiKey)
  const prompt = buildAIPrompt(today(), context) + `\n\nMensaje del usuario: "${text}"`

  // Timeout propio + AbortSignal externo (botón cancelar)
  const controller = new AbortController()
  const timeoutId = setTimeout(() => controller.abort(), AI_TIMEOUT_MS)
  if (signal) signal.addEventListener('abort', () => controller.abort())

  let result: Awaited<ReturnType<ReturnType<typeof genAI.getGenerativeModel>['generateContent']>> | undefined
  let lastErr: unknown
  try {
    for (const modelName of MODEL_FALLBACK) {
      try {
        const model = genAI.getGenerativeModel({ model: modelName })
        result = await model.generateContent(
          { contents: [{ role: 'user', parts: [{ text: prompt }] }] },
          { signal: controller.signal }
        )
        break   // éxito — sale del loop
      } catch (err: unknown) {
        const msg = String((err as { message?: unknown } | null)?.message ?? '')
        if (msg.includes('404') || /not found|not supported/i.test(msg)) {
          lastErr = err
          continue   // modelo no disponible → prueba el siguiente
        }
        throw err   // rate limit, auth, abort → lanza sin probar otros
      }
    }
    if (!result) throw lastErr   // todos los modelos fallaron
  } catch (err: unknown) {
    throw new Error(friendlyAIError(err, apiKey))
  } finally {
    clearTimeout(timeoutId)
  }

  try {
    const raw = result.response.text().trim()
    const jsonObj = extractJSON(raw)        // extractor robusto, no regex greedy
    return validateAIResponse(jsonObj)      // { action: 'register' | 'answer' | 'needs_context' }
  } catch (err: unknown) {
    throw new Error(friendlyAIError(err, apiKey))
  }
}
