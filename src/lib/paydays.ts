export const PAYDAYS_KEY = 'lukas_paydays'

/** Lee los días de pago configurados (por defecto quincena: 15 y 30) */
export function getPaydays(): number[] {
  let raw = '15,30'
  try { raw = localStorage.getItem(PAYDAYS_KEY) ?? raw } catch { /* sin storage */ }
  return raw.split(',').map((s) => parseInt(s.trim())).filter((n) => n >= 1 && n <= 31)
}

export function setPaydays(days: number[]): void {
  const clean = days.filter((n) => n >= 1 && n <= 31)
  localStorage.setItem(PAYDAYS_KEY, clean.join(','))
}

/** Días que faltan hasta el próximo día de pago (0 = hoy). -1 si no hay días configurados. */
export function daysToNextPayday(paydays: number[] = getPaydays()): number {
  if (paydays.length === 0) return -1
  const now = new Date()
  const today = now.getDate()
  const lastDayOfMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate()

  // Días de pago de este mes, ajustados si el mes es más corto (30 → 28 en febrero)
  const candidates = paydays.map((d) => Math.min(d, lastDayOfMonth))
  const upcoming = candidates.filter((d) => d >= today)
  if (upcoming.length > 0) return Math.min(...upcoming) - today

  // El próximo pago es el primer día de pago del mes siguiente
  const nextMonthLast = new Date(now.getFullYear(), now.getMonth() + 2, 0).getDate()
  const firstNext = Math.min(...paydays.map((d) => Math.min(d, nextMonthLast)))
  return lastDayOfMonth - today + firstNext
}
