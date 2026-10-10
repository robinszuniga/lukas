import type { SqlConn } from './conn'

/**
 * Esquema de la base y migraciones.
 *
 * Regla: las tablas que ya existían NO se alteran (ni columnas nuevas ni cambios de tipo),
 * porque el Lukas anterior importa los respaldos insertando columna por columna y
 * fallaría con una columna desconocida. Lo nuevo va siempre en tablas nuevas.
 */

/** Tablas originales (v1). Idénticas a las del Lukas anterior. */
export const BASE_SCHEMA = `
CREATE TABLE IF NOT EXISTS transactions (
  id            INTEGER PRIMARY KEY AUTOINCREMENT,
  amount        REAL NOT NULL,
  type          TEXT NOT NULL CHECK(type IN ('income','expense')),
  category      TEXT NOT NULL,
  description   TEXT,
  payment_method TEXT,
  date          TEXT NOT NULL,
  created_at    TEXT DEFAULT (datetime('now'))
);
CREATE TABLE IF NOT EXISTS installments (
  id              INTEGER PRIMARY KEY AUTOINCREMENT,
  name            TEXT NOT NULL,
  total_amount    REAL NOT NULL,
  total_months    INTEGER NOT NULL,
  paid_months     INTEGER NOT NULL DEFAULT 0,
  monthly_amount  REAL NOT NULL,
  next_due_date   TEXT,
  notes           TEXT,
  created_at      TEXT DEFAULT (datetime('now'))
);
CREATE TABLE IF NOT EXISTS installment_payments (
  id              INTEGER PRIMARY KEY AUTOINCREMENT,
  installment_id  INTEGER REFERENCES installments(id) ON DELETE CASCADE,
  paid_date       TEXT NOT NULL,
  amount          REAL NOT NULL
);
CREATE TABLE IF NOT EXISTS goals (
  id            INTEGER PRIMARY KEY AUTOINCREMENT,
  name          TEXT NOT NULL,
  target_amount REAL NOT NULL,
  saved_amount  REAL NOT NULL DEFAULT 0,
  deadline      TEXT,
  emoji         TEXT DEFAULT '🎯',
  created_at    TEXT DEFAULT (datetime('now'))
);
CREATE TABLE IF NOT EXISTS credit_cards (
  id              INTEGER PRIMARY KEY AUTOINCREMENT,
  bank_name       TEXT NOT NULL,
  last_four       TEXT,
  credit_limit    REAL NOT NULL,
  current_balance REAL NOT NULL DEFAULT 0,
  billing_day     INTEGER,
  cutoff_day      INTEGER,
  color           TEXT DEFAULT '#6366f1'
);
CREATE TABLE IF NOT EXISTS budgets (
  id            INTEGER PRIMARY KEY AUTOINCREMENT,
  category      TEXT NOT NULL UNIQUE,
  monthly_limit REAL NOT NULL
);
CREATE TABLE IF NOT EXISTS debts (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  person      TEXT NOT NULL,
  amount      REAL NOT NULL,
  type        TEXT NOT NULL CHECK(type IN ('owed_to_me','i_owe')),
  description TEXT,
  due_date    TEXT,
  paid        INTEGER NOT NULL DEFAULT 0,
  created_at  TEXT DEFAULT (datetime('now'))
);
CREATE TABLE IF NOT EXISTS accounts (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  name        TEXT NOT NULL,
  balance     REAL NOT NULL DEFAULT 0,
  color       TEXT DEFAULT '#6366f1',
  created_at  TEXT DEFAULT (datetime('now'))
);
CREATE TABLE IF NOT EXISTS recurring (
  id             INTEGER PRIMARY KEY AUTOINCREMENT,
  name           TEXT NOT NULL,
  amount         REAL NOT NULL,
  category       TEXT NOT NULL,
  payment_method TEXT,
  day            INTEGER NOT NULL,
  last_posted    TEXT,
  created_at     TEXT DEFAULT (datetime('now'))
);
`

/** v2 (Lukas 2.1): solo AGREGA tablas. */
const V2_SCHEMA = `
CREATE TABLE IF NOT EXISTS payment_log (
  id                     INTEGER PRIMARY KEY AUTOINCREMENT,
  kind                   TEXT NOT NULL CHECK(kind IN ('recurring','installment')),
  item_id                INTEGER NOT NULL,
  period                 TEXT,
  transaction_id         INTEGER,
  installment_payment_id INTEGER,
  prev_value             TEXT,
  amount                 REAL NOT NULL,
  paid_at                TEXT DEFAULT (datetime('now'))
);
CREATE TABLE IF NOT EXISTS reminders (
  id            INTEGER PRIMARY KEY AUTOINCREMENT,
  kind          TEXT NOT NULL CHECK(kind IN ('installment','debt','recurring')),
  item_id       INTEGER NOT NULL,
  enabled       INTEGER NOT NULL DEFAULT 1,
  days_before   INTEGER,
  snoozed_until TEXT,
  UNIQUE(kind, item_id)
);
`

/** v3 (Lukas 2.2): solo AGREGA una tabla. Qué saldo movió cada movimiento, para revertirlo exacto. */
const V3_SCHEMA = `
CREATE TABLE IF NOT EXISTS balance_moves (
  id             INTEGER PRIMARY KEY AUTOINCREMENT,
  transaction_id INTEGER NOT NULL,
  target         TEXT NOT NULL CHECK(target IN ('account','card')),
  target_id      INTEGER NOT NULL,
  delta          REAL NOT NULL,
  created_at     TEXT DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_balance_moves_tx ON balance_moves(transaction_id);
`

export const MIGRATIONS: { version: number; description: string; sql: string }[] = [
  { version: 2, description: 'Bitácora de pagos y recordatorios (tablas nuevas)', sql: V2_SCHEMA },
  { version: 3, description: 'Ajustes de saldo por movimiento (tabla nueva)', sql: V3_SCHEMA },
]

export const SCHEMA_VERSION = MIGRATIONS[MIGRATIONS.length - 1].version

/** Tablas del respaldo en orden de inserción (primero las que otras referencian). */
export const BACKUP_TABLES = [
  'transactions', 'installments', 'installment_payments',
  'goals', 'credit_cards', 'budgets', 'debts', 'accounts', 'recurring',
  'payment_log', 'reminders', 'balance_moves',
] as const

export type TableName = (typeof BACKUP_TABLES)[number]

/** Columnas conocidas de cada tabla. Al importar o restaurar se ignora cualquier otra. */
export const TABLE_COLUMNS: Record<TableName, readonly string[]> = {
  transactions: ['id', 'amount', 'type', 'category', 'description', 'payment_method', 'date', 'created_at'],
  installments: ['id', 'name', 'total_amount', 'total_months', 'paid_months', 'monthly_amount', 'next_due_date', 'notes', 'created_at'],
  installment_payments: ['id', 'installment_id', 'paid_date', 'amount'],
  goals: ['id', 'name', 'target_amount', 'saved_amount', 'deadline', 'emoji', 'created_at'],
  credit_cards: ['id', 'bank_name', 'last_four', 'credit_limit', 'current_balance', 'billing_day', 'cutoff_day', 'color'],
  budgets: ['id', 'category', 'monthly_limit'],
  debts: ['id', 'person', 'amount', 'type', 'description', 'due_date', 'paid', 'created_at'],
  accounts: ['id', 'name', 'balance', 'color', 'created_at'],
  recurring: ['id', 'name', 'amount', 'category', 'payment_method', 'day', 'last_posted', 'created_at'],
  payment_log: ['id', 'kind', 'item_id', 'period', 'transaction_id', 'installment_payment_id', 'prev_value', 'amount', 'paid_at'],
  reminders: ['id', 'kind', 'item_id', 'enabled', 'days_before', 'snoozed_until'],
  balance_moves: ['id', 'transaction_id', 'target', 'target_id', 'delta', 'created_at'],
}

export function isTableName(name: string): name is TableName {
  return (BACKUP_TABLES as readonly string[]).includes(name)
}

export async function getSchemaVersion(conn: SqlConn): Promise<number> {
  const r = await conn.query('PRAGMA user_version')
  const v = Number(r.values[0]?.user_version ?? 0)
  return Number.isFinite(v) ? v : 0
}

/**
 * Lleva la base a la versión actual sin tocar datos existentes.
 * - Una base del Lukas 2.0 (user_version 0, con sus tablas) solo recibe las tablas nuevas.
 * - Si la base fue creada por una versión más nueva, no se le hace nada.
 */
export async function runMigrations(conn: SqlConn): Promise<{ from: number; to: number }> {
  const from = await getSchemaVersion(conn)
  await conn.execute(BASE_SCHEMA)

  let version = from
  for (const m of MIGRATIONS) {
    if (version < m.version) {
      await conn.execute(m.sql)
      version = m.version
    }
  }
  if (version > from) await conn.execute(`PRAGMA user_version = ${version}`)
  return { from, to: version }
}
