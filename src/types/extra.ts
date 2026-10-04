/** Tipos añadidos en la versión 2.1 (recordatorios, deshacer pagos, eliminación segura). */

export type ReminderKind = 'installment' | 'debt' | 'recurring'

/** Configuración de recordatorio de un registro. Si no existe fila, aplica el valor general. */
export interface ReminderSetting {
  id: number
  kind: ReminderKind
  item_id: number
  /** 1 = avisar · 0 = silenciado */
  enabled: number
  /** Días de anticipación. null = usar el valor general de Ajustes */
  days_before: number | null
  /** 'YYYY-MM-DD': no avisar hasta ese día (pospuesto) */
  snoozed_until: string | null
}

/**
 * Bitácora de pagos marcados desde la app. Guarda lo necesario para deshacer:
 * el movimiento creado (pagos fijos) o la fila de pago (cuotas) y el valor anterior.
 */
export interface PaymentLogEntry {
  id: number
  kind: 'recurring' | 'installment'
  item_id: number
  /** 'YYYY-MM' del mes pagado (pagos fijos) */
  period: string | null
  transaction_id: number | null
  installment_payment_id: number | null
  /** Valor previo: `last_posted` (fijos) o `next_due_date` (cuotas) */
  prev_value: string | null
  amount: number
  paid_at: string
}

export type EntityKind =
  | 'transaction' | 'installment' | 'goal' | 'card' | 'debt' | 'account' | 'recurring'

/** Copia exacta de lo eliminado, para poder restaurarlo con "Deshacer". */
export interface DeletedSnapshot {
  kind: EntityKind
  /** Filas en orden de inserción (primero el registro, luego lo que depende de él) */
  rows: { table: string; row: Record<string, unknown> }[]
}

/** Totales de un rango de fechas */
export interface RangeTotals {
  income: number
  expenses: number
}

/** Datos para proyectar el gasto diario */
export interface SpendStats {
  /** Suma de gastos del día a día en el rango (sin los generados por pagos fijos) */
  total: number
  /** Cantidad de gastos en el rango */
  count: number
  /** Fecha del primer gasto registrado en toda la historia, o null */
  firstExpenseDate: string | null
}
