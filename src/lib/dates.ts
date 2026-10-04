/**
 * Fechas en hora LOCAL del dispositivo.
 * Antes se usaba toISOString() (UTC): después de las 7 p. m. en Colombia
 * "hoy" pasaba a ser mañana y los gastos caían en el día o mes equivocado.
 */

function pad(n: number): string {
  return String(n).padStart(2, '0')
}

/** Date → 'YYYY-MM-DD' en hora local */
export function toISODate(d: Date): string {
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
}

/** 'YYYY-MM-DD' → Date a medianoche local */
export function parseISODate(dateStr: string): Date {
  const [y, m, d] = dateStr.slice(0, 10).split('-').map(Number)
  return new Date(y, (m || 1) - 1, d || 1)
}

export function currentMonth(now: Date = new Date()): string {
  return toISODate(now).slice(0, 7)
}

export function today(now: Date = new Date()): string {
  return toISODate(now)
}

/** 'YYYY-MM' del mes anterior */
export function previousMonth(month: string): string {
  const [y, m] = month.split('-').map(Number)
  const d = new Date(y, m - 2, 1)
  return toISODate(d).slice(0, 7)
}

/** Cantidad de días de un mes 'YYYY-MM' */
export function daysInMonth(month: string): number {
  const [y, m] = month.split('-').map(Number)
  return new Date(y, m, 0).getDate()
}

/** Suma (o resta) días a una fecha 'YYYY-MM-DD' */
export function addDays(dateStr: string, days: number): string {
  const d = parseISODate(dateStr)
  d.setDate(d.getDate() + days)
  return toISODate(d)
}

/**
 * Suma meses a una fecha 'YYYY-MM-DD'. Si el día no existe en el mes destino
 * (31 de enero + 1 mes) se queda en el último día de ese mes, no salta al siguiente.
 */
export function addMonths(dateStr: string, months: number): string {
  const d = parseISODate(dateStr)
  const day = d.getDate()
  const target = new Date(d.getFullYear(), d.getMonth() + months, 1)
  const last = new Date(target.getFullYear(), target.getMonth() + 1, 0).getDate()
  target.setDate(Math.min(day, last))
  return toISODate(target)
}

/** Días desde hoy hasta la fecha (negativo si ya pasó) */
export function daysUntil(dateStr: string, now: Date = new Date()): number {
  const target = parseISODate(dateStr)
  const start = new Date(now.getFullYear(), now.getMonth(), now.getDate())
  return Math.round((target.getTime() - start.getTime()) / (1000 * 60 * 60 * 24))
}

export function daysUntilBilling(billingDay: number): number {
  const now = new Date()
  const year = now.getFullYear()
  const month = now.getMonth()
  let target = new Date(year, month, billingDay)
  if (target <= now) target = new Date(year, month + 1, billingDay)
  return Math.ceil((target.getTime() - now.getTime()) / (1000 * 60 * 60 * 24))
}

export function formatDate(dateStr: string): string {
  return parseISODate(dateStr).toLocaleDateString('es-CO', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  })
}

/** Fecha corta sin año: "4 oct" */
export function formatShortDate(dateStr: string): string {
  return parseISODate(dateStr).toLocaleDateString('es-CO', { day: 'numeric', month: 'short' })
}

export function monthLabel(monthStr: string): string {
  const [year, month] = monthStr.split('-').map(Number)
  return new Date(year, month - 1, 1).toLocaleDateString('es-CO', {
    month: 'long',
    year: 'numeric',
  })
}

/** Nombre del mes sin año: "septiembre" */
export function monthName(monthStr: string): string {
  const [year, month] = monthStr.split('-').map(Number)
  return new Date(year, month - 1, 1).toLocaleDateString('es-CO', { month: 'long' })
}
