/**
 * Privacidad del modo "Con IA".
 *
 * Qué sale del dispositivo hacia Google Gemini:
 *  - SIEMPRE: el texto que la persona escribe, la fecha de hoy, la lista de categorías
 *    y el nombre de la moneda.
 *  - SOLO al hacer una pregunta sobre sus finanzas (y si lo permite en Ajustes):
 *    un resumen con totales del mes, saldos de cuentas, deudas, cuotas, pagos fijos,
 *    metas y tarjetas (sin números de tarjeta).
 *  - NUNCA: el historial completo de movimientos, ni la API Key a un destino distinto de Google.
 */

const QUESTION_STARTS = [
  'cuanto', 'cuánto', 'cuanta', 'cuánta', 'cuantos', 'cuántos', 'cuantas', 'cuántas',
  'como ', 'cómo', 'que ', 'qué', 'cual', 'cuál', 'cuando', 'cuándo', 'donde', 'dónde',
  'en que', 'en qué', 'a que', 'a qué', 'por que', 'por qué', 'para que', 'para qué',
  'me conviene', 'conviene', 'puedo', 'podria', 'podría', 'deberia', 'debería', 'debo ',
  'me alcanza', 'alcanza', 'dame un consejo', 'aconsej', 'recomi', 'sugier',
  'resume', 'resumen', 'analiza', 'explica', 'muestrame', 'muéstrame', 'dime',
]

const QUESTION_ANYWHERE = [
  'a que abono', 'a qué abono', 'a que le meto', 'a qué le meto', 'como distribuyo', 'cómo distribuyo',
  'que me recomiendas', 'qué me recomiendas', 'que hago con', 'qué hago con',
]

/**
 * ¿El mensaje parece una pregunta sobre las finanzas (y no un registro)?
 * Solo decide si se adjunta el resumen en el primer envío; si se equivoca,
 * el modelo puede pedir el contexto y se hace un segundo envío.
 */
export function looksLikeQuestion(text: string): boolean {
  const t = text.trim().toLowerCase()
  if (!t) return false
  if (t.includes('?') || t.includes('¿')) return true
  if (QUESTION_STARTS.some((q) => t.startsWith(q))) return true
  return QUESTION_ANYWHERE.some((q) => t.includes(q))
}

/**
 * Quita secretos de un mensaje antes de mostrarlo o registrarlo:
 * la API Key exacta, cualquier clave con forma de Google (AIza…) y parámetros `key=`.
 */
export function redactSecrets(message: string, apiKey?: string | null): string {
  let out = String(message ?? '')
  if (apiKey && apiKey.length >= 6) out = out.split(apiKey).join('[clave oculta]')
  out = out.replace(/AIza[0-9A-Za-z_-]{10,}/g, '[clave oculta]')
  out = out.replace(/([?&]key=)[^&\s"']+/gi, '$1[clave oculta]')
  out = out.replace(/(x-goog-api-key["']?\s*[:=]\s*["']?)[^\s"',}]+/gi, '$1[clave oculta]')
  return out
}

/** Textos de la interfaz: qué se comparte en cada caso. */
export const SHARED_ALWAYS =
  'El texto que escribes, la fecha de hoy, la lista de categorías y tu moneda.'

export const SHARED_ON_QUESTIONS =
  'Un resumen: totales del mes y por categoría, saldos de tus cuentas, deudas (con el nombre que les pusiste), cuotas, pagos fijos, metas y tarjetas (sin números de tarjeta).'

export const NEVER_SHARED =
  'Tu historial completo de movimientos no se envía. Tu API Key solo se usa para conectarte con Google y no se muestra ni se guarda en ningún otro lugar.'
