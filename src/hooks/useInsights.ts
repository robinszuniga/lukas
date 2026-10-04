import type { RangeTotals, SpendStats } from '@/types'
import { db } from '@/lib/db'
import { addDays, currentMonth, daysInMonth, daysUntil, previousMonth, today } from '@/lib/dates'
import { PROJECTION_WINDOW_DAYS } from '@/lib/insights'
import { useDbQuery } from './useDbQuery'

interface Loaded {
  /** Totales del mes anterior hasta el mismo día del mes */
  previous: RangeTotals
  /** Totales de este mes hasta hoy */
  current: RangeTotals
  stats: SpendStats
  /** Días desde el primer gasto registrado (incluye hoy). 0 si no hay gastos. */
  historyDays: number
  /** Día del mes hasta el que se compara */
  day: number
  previousMonth: string
}

const ZERO: RangeTotals = { income: 0, expenses: 0 }
const EMPTY: Loaded = {
  previous: ZERO, current: ZERO,
  stats: { total: 0, count: 0, firstExpenseDate: null },
  historyDays: 0, day: 1, previousMonth: previousMonth(currentMonth()),
}

/** Datos para la comparación con el mes anterior y la proyección de "Hoy". */
export function useInsights() {
  const { data, loading } = useDbQuery(async (): Promise<Loaded> => {
    const now = new Date()
    const todayStr = today(now)
    const month = currentMonth(now)
    const prev = previousMonth(month)
    const day = now.getDate()
    // Mismo tramo del mes anterior (si ese mes es más corto, hasta su último día)
    const prevDay = Math.min(day, daysInMonth(prev))
    const prevEnd = `${prev}-${String(prevDay).padStart(2, '0')}`

    const [previous, current, stats] = await Promise.all([
      db.getRangeTotals(`${prev}-01`, prevEnd),
      db.getRangeTotals(`${month}-01`, todayStr),
      db.getSpendStats(addDays(todayStr, -(PROJECTION_WINDOW_DAYS - 1)), todayStr),
    ])

    const historyDays = stats.firstExpenseDate
      ? Math.max(0, -daysUntil(stats.firstExpenseDate, now)) + 1
      : 0

    return { previous, current, stats, historyDays, day, previousMonth: prev }
  }, EMPTY)

  return { ...data, loading }
}
