import type { BackupData } from '@/types'
import { BACKUP_TABLES, SCHEMA_VERSION, TABLE_COLUMNS, type TableName } from './db/schema'

/**
 * Lectura y validación de respaldos. Función pura: no toca la base.
 *
 * Acepta los respaldos del Lukas anterior (`app: 'flux-finance'`, versión 1, sin
 * las secciones nuevas) y los de esta versión. Si algo no cuadra, se rechaza el
 * archivo completo con un mensaje claro: nunca se importa "a medias".
 */

export class BackupError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'BackupError'
  }
}

export interface BackupSummary {
  /** Cantidad de registros por tabla */
  counts: Record<TableName, number>
  exportedAt: string | null
  hasPreferences: boolean
  /** El respaldo viene de una versión más nueva de la app */
  fromNewerVersion: boolean
  /** Columnas desconocidas que se ignoraron (tabla.columna) */
  ignoredColumns: string[]
}

const TABLE_LABELS: Record<TableName, string> = {
  transactions: 'movimientos',
  installments: 'cuotas',
  installment_payments: 'pagos de cuotas',
  goals: 'metas',
  credit_cards: 'tarjetas',
  budgets: 'presupuestos',
  debts: 'deudas',
  accounts: 'cuentas',
  recurring: 'pagos fijos',
  payment_log: 'bitácora de pagos',
  reminders: 'recordatorios',
}

export function tableLabel(table: TableName): string {
  return TABLE_LABELS[table]
}

type Check = (row: Record<string, unknown>) => string | null

const isNum = (v: unknown) => typeof v === 'number' && Number.isFinite(v)
const isStr = (v: unknown) => typeof v === 'string' && v.length > 0
const isDate = (v: unknown) => typeof v === 'string' && /^\d{4}-\d{2}-\d{2}/.test(v)

function need(row: Record<string, unknown>, field: string, ok: (v: unknown) => boolean, what: string): string | null {
  return ok(row[field]) ? null : `"${field}" debe ser ${what}`
}

function first(...results: (string | null)[]): string | null {
  return results.find((r) => r !== null) ?? null
}

const ROW_CHECKS: Record<TableName, Check> = {
  transactions: (r) => first(
    need(r, 'amount', isNum, 'un número'),
    need(r, 'type', (v) => v === 'income' || v === 'expense', '"income" o "expense"'),
    need(r, 'category', isStr, 'un texto'),
    need(r, 'date', isDate, 'una fecha AAAA-MM-DD'),
  ),
  installments: (r) => first(
    need(r, 'name', isStr, 'un texto'),
    need(r, 'total_amount', isNum, 'un número'),
    need(r, 'total_months', isNum, 'un número'),
    need(r, 'monthly_amount', isNum, 'un número'),
  ),
  installment_payments: (r) => first(
    need(r, 'installment_id', isNum, 'un número'),
    need(r, 'paid_date', isDate, 'una fecha AAAA-MM-DD'),
    need(r, 'amount', isNum, 'un número'),
  ),
  goals: (r) => first(need(r, 'name', isStr, 'un texto'), need(r, 'target_amount', isNum, 'un número')),
  credit_cards: (r) => first(need(r, 'bank_name', isStr, 'un texto'), need(r, 'credit_limit', isNum, 'un número')),
  budgets: (r) => first(need(r, 'category', isStr, 'un texto'), need(r, 'monthly_limit', isNum, 'un número')),
  debts: (r) => first(
    need(r, 'person', isStr, 'un texto'),
    need(r, 'amount', isNum, 'un número'),
    need(r, 'type', (v) => v === 'owed_to_me' || v === 'i_owe', '"owed_to_me" o "i_owe"'),
  ),
  accounts: (r) => first(need(r, 'name', isStr, 'un texto'), need(r, 'balance', isNum, 'un número')),
  recurring: (r) => first(
    need(r, 'name', isStr, 'un texto'),
    need(r, 'amount', isNum, 'un número'),
    need(r, 'category', isStr, 'un texto'),
    need(r, 'day', isNum, 'un número'),
  ),
  payment_log: (r) => first(
    need(r, 'kind', (v) => v === 'recurring' || v === 'installment', '"recurring" o "installment"'),
    need(r, 'item_id', isNum, 'un número'),
    need(r, 'amount', isNum, 'un número'),
  ),
  reminders: (r) => first(
    need(r, 'kind', (v) => v === 'installment' || v === 'debt' || v === 'recurring', 'un tipo conocido'),
    need(r, 'item_id', isNum, 'un número'),
  ),
}

const NOT_A_BACKUP = 'El archivo no es un respaldo de Lukas.'

/** Texto del archivo → objeto. Lanza BackupError con un mensaje entendible. */
export function parseBackupText(text: string): unknown {
  try {
    return JSON.parse(text)
  } catch {
    throw new BackupError('El archivo no se puede leer: no es un respaldo de Lukas (JSON) o está dañado.')
  }
}

/**
 * Revisa y limpia un respaldo. Devuelve los datos listos para importar
 * (solo tablas y columnas conocidas) y un resumen para mostrar antes de confirmar.
 */
export function sanitizeBackup(raw: unknown): { data: BackupData; summary: BackupSummary } {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) throw new BackupError(NOT_A_BACKUP)
  const src = raw as Record<string, unknown>

  if (src.app !== 'lukas' && src.app !== 'flux-finance') throw new BackupError(NOT_A_BACKUP)
  if (!Array.isArray(src.transactions)) throw new BackupError(NOT_A_BACKUP)

  if (src.version !== undefined && src.version !== 1) {
    if (typeof src.version === 'number' && src.version > 1) {
      throw new BackupError(
        `Este respaldo usa un formato más nuevo (versión ${src.version}) que esta app todavía no sabe leer. Actualiza Lukas e inténtalo de nuevo.`
      )
    }
    throw new BackupError(NOT_A_BACKUP)
  }

  const ignored = new Set<string>()
  const counts = {} as Record<TableName, number>
  const out: Record<string, unknown> = {
    version: 1,
    app: src.app,
    exported_at: typeof src.exported_at === 'string' ? src.exported_at : new Date().toISOString(),
  }

  for (const table of BACKUP_TABLES) {
    const value = src[table]
    if (value === undefined || value === null) {
      // Respaldos viejos no traen todas las secciones
      out[table] = []
      counts[table] = 0
      continue
    }
    if (!Array.isArray(value)) {
      throw new BackupError(`La sección de ${TABLE_LABELS[table]} del respaldo está dañada. No se importó nada.`)
    }

    const allowed = TABLE_COLUMNS[table]
    const rows: Record<string, unknown>[] = []

    value.forEach((item, index) => {
      const where = `en ${TABLE_LABELS[table]} (registro ${index + 1})`
      if (!item || typeof item !== 'object' || Array.isArray(item)) {
        throw new BackupError(`El respaldo tiene un dato dañado ${where}. No se importó nada.`)
      }
      const row: Record<string, unknown> = {}
      for (const [col, val] of Object.entries(item as Record<string, unknown>)) {
        if (!allowed.includes(col)) { ignored.add(`${table}.${col}`); continue }
        if (val !== null && typeof val !== 'string' && typeof val !== 'number' && typeof val !== 'boolean') {
          throw new BackupError(`El respaldo tiene un dato dañado ${where}: "${col}" no es un valor simple. No se importó nada.`)
        }
        row[col] = typeof val === 'boolean' ? (val ? 1 : 0) : val
      }
      if (row.id !== undefined && !(typeof row.id === 'number' && Number.isInteger(row.id))) {
        throw new BackupError(`El respaldo tiene un dato dañado ${where}: el identificador no es válido. No se importó nada.`)
      }
      const problem = ROW_CHECKS[table](row)
      if (problem) {
        throw new BackupError(`El respaldo tiene un dato dañado ${where}: ${problem}. No se importó nada.`)
      }
      rows.push(row)
    })

    out[table] = rows
    counts[table] = rows.length
  }

  const hasPreferences = !!src.preferences && typeof src.preferences === 'object' && !Array.isArray(src.preferences)
  if (hasPreferences) out.preferences = src.preferences
  const schemaVersion = typeof src.schema_version === 'number' ? src.schema_version : 1
  out.schema_version = schemaVersion

  return {
    data: out as unknown as BackupData,
    summary: {
      counts,
      exportedAt: typeof src.exported_at === 'string' ? src.exported_at : null,
      hasPreferences,
      fromNewerVersion: schemaVersion > SCHEMA_VERSION,
      ignoredColumns: [...ignored].sort(),
    },
  }
}

const SINGULAR: Partial<Record<TableName, string>> = {
  transactions: 'movimiento',
  installments: 'cuota',
  debts: 'deuda',
  recurring: 'pago fijo',
  credit_cards: 'tarjeta',
  accounts: 'cuenta',
  goals: 'meta',
  budgets: 'presupuesto',
}

/** Resumen corto: "12 movimientos, 3 cuotas, 1 tarjeta…" (solo lo que tiene algo). */
export function describeCounts(counts: Partial<Record<string, number>>): string {
  const visible: TableName[] = ['transactions', 'installments', 'debts', 'recurring', 'credit_cards', 'accounts', 'goals', 'budgets']
  const parts = visible
    .filter((t) => (counts[t] ?? 0) > 0)
    .map((t) => `${counts[t]} ${counts[t] === 1 ? SINGULAR[t] : TABLE_LABELS[t]}`)
  return parts.length > 0 ? parts.join(', ') : 'sin registros'
}
