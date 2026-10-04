/**
 * Cálculos del resumen "Hoy": comparación con el mes anterior y proyección
 * hasta el próximo pago. Funciones puras, sin acceso a datos.
 */

export interface Comparison {
  current: number
  previous: number
  /** current − previous */
  delta: number
  /** Variación en porcentaje (redondeada). null si el anterior es 0. */
  pct: number | null
  direction: 'up' | 'down' | 'same'
}

/**
 * Compara dos totales. Devuelve null cuando no hay con qué comparar
 * (el periodo anterior no tiene datos), para no mostrar un porcentaje inventado.
 */
export function compareTotals(current: number, previous: number): Comparison | null {
  if (!Number.isFinite(current) || !Number.isFinite(previous)) return null
  if (previous <= 0) return null
  const delta = current - previous
  const pct = Math.round((delta / previous) * 100)
  return {
    current,
    previous,
    delta,
    pct,
    direction: pct > 0 ? 'up' : pct < 0 ? 'down' : 'same',
  }
}

/** Ventana de días que se promedia para la proyección. */
export const PROJECTION_WINDOW_DAYS = 14
/** Mínimo de días de historial de gastos para atreverse a proyectar. */
export const PROJECTION_MIN_HISTORY_DAYS = 7
/** Mínimo de gastos dentro de la ventana. */
export const PROJECTION_MIN_SAMPLES = 3

export interface ProjectionInput {
  /** Hay ingresos registrados este mes */
  hasIncome: boolean
  /** Saldo libre actual: ingresos − gastos − pendientes del mes */
  free: number
  /** Días hasta el próximo pago (0 = hoy, -1 = sin días configurados) */
  daysToPayday: number
  /** Suma de gastos del día a día en la ventana (sin pagos fijos) */
  windowSpend: number
  /** Cantidad de gastos en la ventana */
  windowCount: number
  /** Días transcurridos desde el primer gasto registrado (incluye hoy). 0 si no hay gastos. */
  historyDays: number
}

export type Projection =
  | {
      status: 'ok'
      /** Saldo estimado al llegar el día de pago */
      projected: number
      /** Gasto diario promedio usado */
      avgDaily: number
      /** Días realmente promediados */
      windowDays: number
      daysToPayday: number
    }
  | { status: 'insufficient'; reason: string }

export function projectBalance(input: ProjectionInput): Projection {
  if (input.daysToPayday < 0) {
    return { status: 'insufficient', reason: 'Configura tus días de pago en Ajustes para ver una proyección.' }
  }
  if (!input.hasIncome) {
    return { status: 'insufficient', reason: 'Registra tu ingreso del mes para ver una proyección.' }
  }
  if (input.historyDays < PROJECTION_MIN_HISTORY_DAYS || input.windowCount < PROJECTION_MIN_SAMPLES) {
    return {
      status: 'insufficient',
      reason: `Aún no hay datos suficientes para proyectar: se necesitan al menos ${PROJECTION_MIN_HISTORY_DAYS} días con gastos registrados.`,
    }
  }

  const windowDays = Math.max(1, Math.min(PROJECTION_WINDOW_DAYS, input.historyDays))
  const avgDaily = Math.max(0, input.windowSpend) / windowDays
  const projected = input.free - avgDaily * input.daysToPayday

  return {
    status: 'ok',
    projected: Math.round(projected),
    avgDaily: Math.round(avgDaily),
    windowDays,
    daysToPayday: input.daysToPayday,
  }
}
