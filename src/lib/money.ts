import { storageGet, storageSet } from './storage'

/**
 * Moneda y formato de importes.
 *
 * Los importes se guardan como números simples, sin moneda. Cambiar la moneda
 * NO convierte ni altera lo guardado: solo cambia el símbolo, los separadores
 * y si se aceptan centavos al escribir.
 */

export interface CurrencyInfo {
  code: string
  label: string
  locale: string
  /** Decimales que se muestran y se aceptan al escribir */
  decimals: 0 | 2
}

export const CURRENCIES: CurrencyInfo[] = [
  { code: 'COP', label: 'Peso colombiano', locale: 'es-CO', decimals: 0 },
  { code: 'USD', label: 'Dólar estadounidense', locale: 'es-US', decimals: 2 },
  { code: 'EUR', label: 'Euro', locale: 'es-ES', decimals: 2 },
  { code: 'MXN', label: 'Peso mexicano', locale: 'es-MX', decimals: 2 },
  { code: 'PEN', label: 'Sol peruano', locale: 'es-PE', decimals: 2 },
  { code: 'CLP', label: 'Peso chileno', locale: 'es-CL', decimals: 0 },
  { code: 'ARS', label: 'Peso argentino', locale: 'es-AR', decimals: 2 },
]

/** Predeterminada: la misma que usaba la app antes de tener esta preferencia */
export const DEFAULT_CURRENCY = 'COP'
export const CURRENCY_KEY = 'lukas_currency'

/** Importe máximo aceptado al escribir (evita errores de dedo con ceros de más) */
export const MAX_AMOUNT = 999_999_999_999

export function isCurrencyCode(code: unknown): code is string {
  return typeof code === 'string' && CURRENCIES.some((c) => c.code === code)
}

export function currencyInfo(code?: string): CurrencyInfo {
  const wanted = code ?? getCurrencyCode()
  return CURRENCIES.find((c) => c.code === wanted) ?? CURRENCIES[0]
}

export function getCurrencyCode(): string {
  const saved = storageGet(CURRENCY_KEY)
  return isCurrencyCode(saved) ? saved : DEFAULT_CURRENCY
}

export function setCurrencyCode(code: string): void {
  if (!isCurrencyCode(code)) throw new Error(`Moneda no soportada: ${code}`)
  storageSet(CURRENCY_KEY, code)
}

const formatters = new Map<string, Intl.NumberFormat>()

function formatterFor(info: CurrencyInfo): Intl.NumberFormat {
  let f = formatters.get(info.code)
  if (!f) {
    f = new Intl.NumberFormat(info.locale, {
      style: 'currency',
      currency: info.code,
      minimumFractionDigits: info.decimals,
      maximumFractionDigits: info.decimals,
    })
    formatters.set(info.code, f)
  }
  return f
}

/** Importe con símbolo y separadores de la moneda elegida. */
export function formatMoney(amount: number, code?: string): string {
  if (typeof amount !== 'number' || !Number.isFinite(amount)) return '—'
  return formatterFor(currencyInfo(code)).format(amount)
}

/** Símbolo de la moneda elegida ("$", "€", "S/"…), para mostrarlo junto a un campo de monto. */
export function currencySymbol(code?: string): string {
  const part = formatterFor(currencyInfo(code)).formatToParts(0).find((p) => p.type === 'currency')
  return part?.value ?? '$'
}

/** Redondea a los decimales de la moneda (0 o 2). */
export function roundMoney(amount: number, code?: string): number {
  const factor = 10 ** currencyInfo(code).decimals
  return Math.round((amount + Number.EPSILON) * factor) / factor
}

/** Texto para precargar un campo de monto: número simple, sin símbolo ni miles. */
export function toInputAmount(amount: number | null | undefined, code?: string): string {
  if (amount === null || amount === undefined || !Number.isFinite(amount)) return ''
  const info = currencyInfo(code)
  const rounded = roundMoney(amount, info.code)
  return Number.isInteger(rounded) ? String(rounded) : rounded.toFixed(info.decimals)
}

/** Importe como texto plano para exportar (CSV): punto decimal, sin miles. */
export function plainAmount(amount: number, code?: string): string {
  const info = currencyInfo(code)
  return roundMoney(amount, info.code).toFixed(info.decimals)
}

const INT = /^\d+$/
const GROUPED = /^\d{1,3}(?:([.,])\d{3})(?:\1\d{3})*$/
const DECIMAL = /^(\d+|\d{1,3}(?:([.,])\d{3})(?:\2\d{3})*)([.,])(\d{1,2})$/

/**
 * Convierte lo que escribió la persona en un número, o null si no es un monto válido.
 *
 * - Acepta símbolo de moneda y espacios: "$ 12.000".
 * - Separadores de miles con punto o coma, solo en grupos de 3: "1.234.567", "1,234,567".
 * - Monedas con centavos: el último separador seguido de 1 o 2 dígitos es el decimal
 *   ("1.234,50", "1,234.50", "12.5").
 * - Monedas sin centavos: "12.5" o "12,50" se RECHAZAN (antes se leían como 125 o 1250).
 *   Solo se tolera una parte decimal en ceros ("12000,00").
 * - Rechaza negativos, letras, cero y montos absurdamente grandes.
 */
export function parseMoney(text: string | number | null | undefined, code?: string): number | null {
  if (text === null || text === undefined) return null
  const info = currencyInfo(code)

  if (typeof text === 'number') {
    if (!Number.isFinite(text) || text <= 0 || text > MAX_AMOUNT) return null
    return roundMoney(text, info.code)
  }

  const raw = String(text).trim()
  if (!raw) return null
  // Quita espacios (incluido el espacio duro de Intl) y símbolos o códigos de moneda conocidos.
  // Cualquier otra letra o signo ("12k", "-500", "1e5", "12 mil") se rechaza: no adivinamos.
  const s = raw
    .replace(/\s/g, '')
    .replace(/US\$|S\/|\$|€|COP|USD|EUR|MXN|PEN|CLP|ARS/gi, '')
  if (!/^[\d.,]+$/.test(s) || !/\d/.test(s)) return null

  let value: number | null = null

  if (INT.test(s)) {
    value = Number(s)
  } else if (GROUPED.test(s)) {
    value = Number(s.replace(/[.,]/g, ''))
  } else {
    const m = s.match(DECIMAL)
    if (m) {
      const [, intPart, groupSep, decSep, decPart] = m
      // El separador de miles y el decimal no pueden ser el mismo: "1.234.56" es inválido
      if (groupSep && groupSep === decSep) return null
      const integer = Number(intPart.replace(/[.,]/g, ''))
      if (info.decimals === 0) {
        // Sin centavos: solo se acepta una parte decimal en ceros
        if (!/^0+$/.test(decPart)) return null
        value = integer
      } else {
        value = Number(`${integer}.${decPart}`)
      }
    }
  }

  if (value === null || !Number.isFinite(value) || value <= 0 || value > MAX_AMOUNT) return null
  return roundMoney(value, info.code)
}

/** Mensaje de ayuda cuando un monto no se pudo leer. */
export function amountErrorMessage(code?: string): string {
  const info = currencyInfo(code)
  return info.decimals === 0
    ? 'Monto inválido. Escribe solo números, por ejemplo 45000 o 45.000.'
    : 'Monto inválido. Escribe un número, por ejemplo 45.50 o 1.234,50.'
}

/** Da formato de miles mientras se escribe (solo monedas sin centavos). */
export function formatWhileTyping(raw: string, code?: string): string {
  const info = currencyInfo(code)
  if (info.decimals > 0) {
    // Con centavos no reformateamos: se deja lo que la persona escribe (dígitos y un separador)
    return raw.replace(/[^\d.,]/g, '').slice(0, 18)
  }
  const digits = raw.replace(/[^0-9]/g, '').slice(0, 12)
  if (!digits) return ''
  return Number(digits).toLocaleString(info.locale)
}
