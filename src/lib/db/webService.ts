import initSqlJs, { type Database } from 'sql.js'
import wasmUrl from 'sql.js/dist/sql-wasm.wasm?url'
import { GoogleGenerativeAI } from '@google/generative-ai'
import type { DBService, TransactionFilters } from './types'
import type {
  Transaction, Installment, Goal, CreditCard, Budget,
  TransactionSummary, Debt, BackupData,
  Account, Recurring,
} from '@/types'
import { buildAIPrompt } from '@/lib/ai/prompt'
import { extractJSON, validateAIResponse, friendlyAIError, type AIResult } from '@/lib/ai/validate'
import { loadDatabaseBytes, saveDatabaseBytes } from './idbStore'

const API_KEY_STORAGE = 'lukas_gemini_api_key'

const SCHEMA = `
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

const AI_TIMEOUT_MS = 15_000

/** Forma mínima de conexión que usa toda la lógica SQL (misma que Capacitor SQLite). */
interface SqlConn {
  query(sql: string, params?: unknown[]): Promise<{ values: Record<string, unknown>[] }>
  run(sql: string, params?: unknown[]): Promise<{ changes?: { lastId?: number } }>
  execute(sql: string): Promise<void>
}

/**
 * Adaptador sql.js → SqlConn. Persiste la base completa en IndexedDB
 * después de cada escritura (la base pesa pocos KB, exportarla es instantáneo).
 */
class SqlJsConn implements SqlConn {
  private batching = false
  constructor(private sql: Database) {}

  async query(sqlText: string, params: unknown[] = []) {
    const stmt = this.sql.prepare(sqlText)
    try {
      stmt.bind(params as never[])
      const values: Record<string, unknown>[] = []
      while (stmt.step()) values.push(stmt.getAsObject() as Record<string, unknown>)
      return { values }
    } finally {
      stmt.free()
    }
  }

  async run(sqlText: string, params: unknown[] = []) {
    this.sql.run(sqlText, params as never[])
    const r = this.sql.exec('SELECT last_insert_rowid() AS id')
    const lastId = Number(r[0]?.values?.[0]?.[0] ?? 0)
    if (!this.batching) await this.persist()
    return { changes: { lastId } }
  }

  async execute(sqlText: string) {
    this.sql.exec(sqlText)
    await this.persist()
  }

  /** Agrupa muchas escrituras (importar respaldo) en una sola transacción y un solo guardado. */
  async batch<T>(fn: () => Promise<T>): Promise<T> {
    this.batching = true
    this.sql.exec('BEGIN')
    try {
      const out = await fn()
      this.sql.exec('COMMIT')
      return out
    } catch (err) {
      this.sql.exec('ROLLBACK')
      throw err
    } finally {
      this.batching = false
      await this.persist()
    }
  }

  async persist() {
    await saveDatabaseBytes(this.sql.export())
  }
}

export class WebDBService implements DBService {
  private conn: SqlJsConn | null = null

  async init(): Promise<void> {
    const SQL = await initSqlJs({ locateFile: () => wasmUrl })
    const bytes = await loadDatabaseBytes()
    const database = bytes ? new SQL.Database(bytes) : new SQL.Database()
    this.conn = new SqlJsConn(database)
    // execute() procesa múltiples sentencias separadas por ';'
    await this.conn.execute(SCHEMA)
    // Pide al navegador que no borre los datos por falta de espacio
    try { await navigator.storage?.persist?.() } catch { /* opcional */ }
  }

  private get db(): SqlJsConn {
    if (!this.conn) throw new Error('DB no inicializada — llama init() primero')
    return this.conn
  }

  /** Extrae la primera fila y garantiza que sea un objeto (no null ni primitivo). */
  private row<T extends object>(result: unknown): T | undefined {
    const values = (result as Record<string, unknown> | null)?.values
    if (!Array.isArray(values) || values.length === 0) return undefined
    const item = values[0]
    if (item === null || typeof item !== 'object') return undefined
    return item as T
  }

  /** Extrae todas las filas filtrando entradas nulas o no-objeto. */
  private rows<T extends object>(result: unknown): T[] {
    const values = (result as Record<string, unknown> | null)?.values
    if (!Array.isArray(values)) return []
    return values.filter((v): v is T => v !== null && typeof v === 'object')
  }

  // ──────────────────────────────── TRANSACTIONS ────────────────────────────

  async listTransactions(filters?: TransactionFilters): Promise<Transaction[]> {
    let sql = 'SELECT * FROM transactions WHERE 1=1'
    const values: any[] = []
    if (filters?.month) { sql += " AND strftime('%Y-%m', date) = ?"; values.push(filters.month) }
    if (filters?.type) { sql += ' AND type = ?'; values.push(filters.type) }
    if (filters?.category) { sql += ' AND category = ?'; values.push(filters.category) }
    if (filters?.dateFrom) { sql += ' AND date >= ?'; values.push(filters.dateFrom) }
    if (filters?.dateTo) { sql += ' AND date <= ?'; values.push(filters.dateTo) }
    sql += ' ORDER BY date DESC, created_at DESC'
    return this.rows<Transaction>(await this.db.query(sql, values))
  }

  async createTransaction(data: Omit<Transaction, 'id' | 'created_at'>): Promise<Transaction> {
    const r = await this.db.run(
      'INSERT INTO transactions (amount, type, category, description, payment_method, date) VALUES (?,?,?,?,?,?)',
      [data.amount, data.type, data.category, data.description ?? null, data.payment_method ?? null, data.date]
    )
    await this.syncPaymentMethod(data.payment_method ?? null, data.amount, data.type)
    return this.row<Transaction>(await this.db.query(
      'SELECT * FROM transactions WHERE id = ?', [r.changes?.lastId]
    ))!
  }

  private async syncPaymentMethod(paymentMethod: string | null, amount: number, type: string) {
    if (!paymentMethod) return
    const norm = paymentMethod.trim().toLowerCase()

    const accR = await this.db.query(
      'SELECT * FROM accounts WHERE lower(trim(name)) = ?', [norm]
    )
    const account = this.row<Account>(accR)
    if (account) {
      const delta = type === 'expense' ? -amount : amount
      await this.db.run('UPDATE accounts SET balance = ? WHERE id = ?',
        [account.balance + delta, account.id])
    }

    const cardR = await this.db.query(
      'SELECT * FROM credit_cards WHERE lower(trim(bank_name)) = ?', [norm]
    )
    const card = this.row<CreditCard>(cardR)
    if (card) {
      const delta = type === 'expense' ? amount : -amount
      const newBal = Math.max(0, card.current_balance + delta)
      await this.db.run('UPDATE credit_cards SET current_balance = ? WHERE id = ?',
        [newBal, card.id])
    }
  }

  async updateTransaction(id: number, data: Partial<Transaction>): Promise<Transaction> {
    // Fetch first so undefined Partial fields don't overwrite existing values with NULL
    const existing = this.row<Transaction>(
      await this.db.query('SELECT * FROM transactions WHERE id=?', [id])
    )
    if (!existing) throw new Error(`Transacción ${id} no encontrada`)

    const merged = { ...existing, ...data }
    await this.db.run(
      'UPDATE transactions SET amount=?,type=?,category=?,description=?,payment_method=?,date=? WHERE id=?',
      [merged.amount, merged.type, merged.category,
       merged.description ?? null, merged.payment_method ?? null, merged.date, id]
    )
    return this.row<Transaction>(await this.db.query('SELECT * FROM transactions WHERE id=?', [id]))!
  }

  async deleteTransaction(id: number): Promise<void> {
    await this.db.run('DELETE FROM transactions WHERE id=?', [id])
  }

  async getTransactionSummary(month: string): Promise<TransactionSummary> {
    const rowR = await this.db.query(
      `SELECT
        COALESCE(SUM(CASE WHEN type='income' THEN amount ELSE 0 END),0) as total_income,
        COALESCE(SUM(CASE WHEN type='expense' THEN amount ELSE 0 END),0) as total_expenses
       FROM transactions WHERE strftime('%Y-%m', date) = ?`,
      [month]
    )
    const row = this.row<any>(rowR) ?? { total_income: 0, total_expenses: 0 }

    const catR = await this.db.query(
      `SELECT category, SUM(amount) as total FROM transactions
       WHERE type='expense' AND strftime('%Y-%m', date)=?
       GROUP BY category ORDER BY total DESC`,
      [month]
    )
    return {
      income: row.total_income,
      expenses: row.total_expenses,
      balance: row.total_income - row.total_expenses,
      byCategory: this.rows(catR),
    }
  }

  // ──────────────────────────────── INSTALLMENTS ────────────────────────────

  async listInstallments(): Promise<Installment[]> {
    return this.rows<Installment>(await this.db.query(
      'SELECT * FROM installments ORDER BY created_at DESC', []
    ))
  }

  async createInstallment(data: Omit<Installment, 'id' | 'created_at' | 'paid_months'> & { paid_months?: number }): Promise<Installment> {
    const r = await this.db.run(
      'INSERT INTO installments (name, total_amount, total_months, paid_months, monthly_amount, next_due_date, notes) VALUES (?,?,?,?,?,?,?)',
      [data.name, data.total_amount, data.total_months, data.paid_months ?? 0, data.monthly_amount, data.next_due_date ?? null, data.notes ?? null]
    )
    return this.row<Installment>(await this.db.query(
      'SELECT * FROM installments WHERE id=?', [r.changes?.lastId]
    ))!
  }

  async updateInstallment(id: number, data: Partial<Installment>): Promise<Installment> {
    const existing = this.row<Installment>(await this.db.query('SELECT * FROM installments WHERE id=?', [id]))
    if (!existing) throw new Error('Cuota no encontrada')
    const m = { ...existing, ...data }
    await this.db.run(
      'UPDATE installments SET name=?, total_amount=?, total_months=?, paid_months=?, monthly_amount=?, next_due_date=?, notes=? WHERE id=?',
      [m.name, m.total_amount, m.total_months, m.paid_months, m.monthly_amount, m.next_due_date ?? null, m.notes ?? null, id]
    )
    return this.row<Installment>(await this.db.query('SELECT * FROM installments WHERE id=?', [id]))!
  }

  async payInstallment(id: number): Promise<Installment> {
    const instR = await this.db.query('SELECT * FROM installments WHERE id=?', [id])
    const inst = this.row<Installment>(instR)
    if (!inst) throw new Error('Cuota no encontrada')

    const today = new Date().toISOString().split('T')[0]
    await this.db.run(
      'INSERT INTO installment_payments (installment_id, paid_date, amount) VALUES (?,?,?)',
      [id, today, inst.monthly_amount]
    )

    let nextDue: string | null = null
    if (inst.next_due_date) {
      const d = new Date(inst.next_due_date + 'T00:00:00')
      d.setMonth(d.getMonth() + 1)
      nextDue = d.toISOString().split('T')[0]
    }

    await this.db.run(
      'UPDATE installments SET paid_months=?, next_due_date=? WHERE id=?',
      [inst.paid_months + 1, nextDue, id]
    )
    return this.row<Installment>(await this.db.query('SELECT * FROM installments WHERE id=?', [id]))!
  }

  async deleteInstallment(id: number): Promise<void> {
    await this.db.run('DELETE FROM installments WHERE id=?', [id])
  }

  async listInstallmentPayments(installmentId: number): Promise<import('@/types').InstallmentPayment[]> {
    return this.rows<import('@/types').InstallmentPayment>(await this.db.query(
      'SELECT * FROM installment_payments WHERE installment_id = ? ORDER BY paid_date DESC LIMIT 12',
      [installmentId]
    ))
  }

  // ──────────────────────────────── GOALS ───────────────────────────────────

  async listGoals(): Promise<Goal[]> {
    return this.rows<Goal>(await this.db.query(
      'SELECT * FROM goals ORDER BY created_at DESC', []
    ))
  }

  async createGoal(data: Omit<Goal, 'id' | 'created_at'>): Promise<Goal> {
    const r = await this.db.run(
      'INSERT INTO goals (name, target_amount, saved_amount, deadline, emoji) VALUES (?,?,?,?,?)',
      [data.name, data.target_amount, data.saved_amount ?? 0, data.deadline ?? null, data.emoji ?? '🎯']
    )
    return this.row<Goal>(await this.db.query('SELECT * FROM goals WHERE id=?', [r.changes?.lastId]))!
  }

  async updateGoal(id: number, data: Partial<Goal>): Promise<Goal> {
    const existing = this.row<Goal>(await this.db.query('SELECT * FROM goals WHERE id=?', [id]))
    if (!existing) throw new Error('Meta no encontrada')
    const m = { ...existing, ...data }
    await this.db.run(
      'UPDATE goals SET name=?, target_amount=?, saved_amount=?, deadline=?, emoji=? WHERE id=?',
      [m.name, m.target_amount, m.saved_amount, m.deadline ?? null, m.emoji ?? '🎯', id]
    )
    return this.row<Goal>(await this.db.query('SELECT * FROM goals WHERE id=?', [id]))!
  }

  async addToGoal(id: number, amount: number): Promise<Goal> {
    await this.db.run(
      'UPDATE goals SET saved_amount = MIN(saved_amount + ?, target_amount) WHERE id=?',
      [amount, id]
    )
    return this.row<Goal>(await this.db.query('SELECT * FROM goals WHERE id=?', [id]))!
  }

  async deleteGoal(id: number): Promise<void> {
    await this.db.run('DELETE FROM goals WHERE id=?', [id])
  }

  // ──────────────────────────────── CARDS ───────────────────────────────────

  async listCards(): Promise<CreditCard[]> {
    return this.rows<CreditCard>(await this.db.query(
      'SELECT * FROM credit_cards ORDER BY bank_name', []
    ))
  }

  async createCard(data: Omit<CreditCard, 'id'>): Promise<CreditCard> {
    const r = await this.db.run(
      'INSERT INTO credit_cards (bank_name, last_four, credit_limit, current_balance, billing_day, cutoff_day, color) VALUES (?,?,?,?,?,?,?)',
      [data.bank_name, data.last_four ?? null, data.credit_limit, data.current_balance ?? 0,
       data.billing_day ?? null, data.cutoff_day ?? null, data.color ?? '#6366f1']
    )
    return this.row<CreditCard>(await this.db.query(
      'SELECT * FROM credit_cards WHERE id=?', [r.changes?.lastId]
    ))!
  }

  async updateCard(id: number, data: Partial<CreditCard>): Promise<CreditCard> {
    const existing = this.row<CreditCard>(
      await this.db.query('SELECT * FROM credit_cards WHERE id=?', [id])
    )
    if (!existing) throw new Error(`Tarjeta ${id} no encontrada`)

    const merged = { ...existing, ...data }
    await this.db.run(
      'UPDATE credit_cards SET bank_name=?,last_four=?,credit_limit=?,current_balance=?,billing_day=?,cutoff_day=?,color=? WHERE id=?',
      [merged.bank_name, merged.last_four ?? null, merged.credit_limit, merged.current_balance ?? 0,
       merged.billing_day ?? null, merged.cutoff_day ?? null, merged.color ?? '#6366f1', id]
    )
    return this.row<CreditCard>(await this.db.query('SELECT * FROM credit_cards WHERE id=?', [id]))!
  }

  async deleteCard(id: number): Promise<void> {
    await this.db.run('DELETE FROM credit_cards WHERE id=?', [id])
  }

  // ──────────────────────────────── BUDGETS ─────────────────────────────────

  async listBudgets(): Promise<Budget[]> {
    return this.rows<Budget>(await this.db.query(
      'SELECT * FROM budgets ORDER BY category', []
    ))
  }

  async upsertBudget(category: string, limit: number): Promise<Budget> {
    await this.db.run(
      'INSERT INTO budgets (category, monthly_limit) VALUES (?,?) ON CONFLICT(category) DO UPDATE SET monthly_limit=excluded.monthly_limit',
      [category, limit]
    )
    return this.row<Budget>(await this.db.query('SELECT * FROM budgets WHERE category=?', [category]))!
  }

  async deleteBudget(category: string): Promise<void> {
    await this.db.run('DELETE FROM budgets WHERE category=?', [category])
  }

  // ──────────────────────────────── DEBTS ───────────────────────────────────

  async listDebts(): Promise<Debt[]> {
    return this.rows<Debt>(await this.db.query(
      'SELECT * FROM debts ORDER BY paid ASC, created_at DESC', []
    ))
  }

  async createDebt(data: Omit<Debt, 'id' | 'created_at' | 'paid'>): Promise<Debt> {
    const r = await this.db.run(
      'INSERT INTO debts (person, amount, type, description, due_date) VALUES (?,?,?,?,?)',
      [data.person, data.amount, data.type, data.description ?? null, data.due_date ?? null]
    )
    return this.row<Debt>(await this.db.query('SELECT * FROM debts WHERE id=?', [r.changes?.lastId]))!
  }

  async updateDebt(id: number, data: Partial<Debt>): Promise<Debt> {
    const existing = this.row<Debt>(await this.db.query('SELECT * FROM debts WHERE id=?', [id]))
    if (!existing) throw new Error('Deuda no encontrada')
    const m = { ...existing, ...data }
    await this.db.run(
      'UPDATE debts SET person=?, amount=?, type=?, description=?, due_date=? WHERE id=?',
      [m.person, m.amount, m.type, m.description ?? null, m.due_date ?? null, id]
    )
    return this.row<Debt>(await this.db.query('SELECT * FROM debts WHERE id=?', [id]))!
  }

  async toggleDebtPaid(id: number): Promise<Debt> {
    await this.db.run('UPDATE debts SET paid = 1 - paid WHERE id=?', [id])
    return this.row<Debt>(await this.db.query('SELECT * FROM debts WHERE id=?', [id]))!
  }

  async deleteDebt(id: number): Promise<void> {
    await this.db.run('DELETE FROM debts WHERE id=?', [id])
  }

  // ──────────────────────────────── ACCOUNTS ────────────────────────────────

  async listAccounts(): Promise<Account[]> {
    return this.rows<Account>(await this.db.query('SELECT * FROM accounts ORDER BY balance DESC', []))
  }

  async createAccount(data: Omit<Account, 'id' | 'created_at'>): Promise<Account> {
    const r = await this.db.run(
      'INSERT INTO accounts (name, balance, color) VALUES (?,?,?)',
      [data.name, data.balance ?? 0, data.color ?? '#6366f1']
    )
    return this.row<Account>(await this.db.query('SELECT * FROM accounts WHERE id=?', [r.changes?.lastId]))!
  }

  async updateAccount(id: number, data: Partial<Account>): Promise<Account> {
    const existing = this.row<Account>(await this.db.query('SELECT * FROM accounts WHERE id=?', [id]))
    if (!existing) throw new Error('Cuenta no encontrada')
    const m = { ...existing, ...data }
    await this.db.run(
      'UPDATE accounts SET name=?, balance=?, color=? WHERE id=?',
      [m.name, m.balance, m.color ?? '#6366f1', id]
    )
    return this.row<Account>(await this.db.query('SELECT * FROM accounts WHERE id=?', [id]))!
  }

  async updateAccountBalance(id: number, balance: number): Promise<Account> {
    await this.db.run('UPDATE accounts SET balance=? WHERE id=?', [balance, id])
    return this.row<Account>(await this.db.query('SELECT * FROM accounts WHERE id=?', [id]))!
  }

  async deleteAccount(id: number): Promise<void> {
    await this.db.run('DELETE FROM accounts WHERE id=?', [id])
  }

  // ──────────────────────────────── RECURRING ───────────────────────────────

  async listRecurring(): Promise<Recurring[]> {
    return this.rows<Recurring>(await this.db.query('SELECT * FROM recurring ORDER BY day ASC', []))
  }

  async createRecurring(data: Omit<Recurring, 'id' | 'created_at' | 'last_posted'>): Promise<Recurring> {
    const r = await this.db.run(
      'INSERT INTO recurring (name, amount, category, payment_method, day) VALUES (?,?,?,?,?)',
      [data.name, data.amount, data.category, data.payment_method ?? null, data.day]
    )
    return this.row<Recurring>(await this.db.query('SELECT * FROM recurring WHERE id=?', [r.changes?.lastId]))!
  }

  async updateRecurring(id: number, data: Partial<Recurring>): Promise<Recurring> {
    const existing = this.row<Recurring>(await this.db.query('SELECT * FROM recurring WHERE id=?', [id]))
    if (!existing) throw new Error('Pago fijo no encontrado')
    const m = { ...existing, ...data }
    await this.db.run(
      'UPDATE recurring SET name=?, amount=?, category=?, payment_method=?, day=? WHERE id=?',
      [m.name, m.amount, m.category, m.payment_method ?? null, m.day, id]
    )
    return this.row<Recurring>(await this.db.query('SELECT * FROM recurring WHERE id=?', [id]))!
  }

  // Registra el pago del mes: crea la transacción y marca el mes
  async postRecurring(id: number): Promise<Recurring> {
    const rec = this.row<Recurring>(await this.db.query('SELECT * FROM recurring WHERE id=?', [id]))
    if (!rec) throw new Error('Pago recurrente no encontrado')

    const now = new Date()
    const month = now.toISOString().slice(0, 7)
    if (rec.last_posted === month) throw new Error('Este pago ya fue registrado este mes')

    const date = now.toISOString().slice(0, 10)
    await this.db.run(
      "INSERT INTO transactions (amount, type, category, description, payment_method, date) VALUES (?,'expense',?,?,?,?)",
      [rec.amount, rec.category, rec.name, rec.payment_method ?? null, date]
    )
    await this.db.run('UPDATE recurring SET last_posted=? WHERE id=?', [month, id])
    return this.row<Recurring>(await this.db.query('SELECT * FROM recurring WHERE id=?', [id]))!
  }

  async deleteRecurring(id: number): Promise<void> {
    await this.db.run('DELETE FROM recurring WHERE id=?', [id])
  }


  // ──────────────────────────────── BACKUP ──────────────────────────────────

  // Tablas del respaldo en orden de inserción (respeta FKs)
  private static readonly BACKUP_TABLES = [
    'transactions', 'installments', 'installment_payments',
    'goals', 'credit_cards', 'budgets', 'debts', 'accounts', 'recurring',
  ] as const

  async exportBackup(): Promise<BackupData> {
    // Se conserva app:'flux-finance' para que el Lukas viejo también pueda importarlo
    const data: Record<string, unknown> = {
      version: 1,
      app: 'flux-finance',
      exported_at: new Date().toISOString(),
    }
    for (const table of WebDBService.BACKUP_TABLES) {
      data[table] = this.rows(await this.db.query(`SELECT * FROM ${table}`, []))
    }
    return data as unknown as BackupData
  }

  async importBackup(data: BackupData): Promise<void> {
    if (!data || !['lukas', 'flux-finance'].includes(data.app) || !Array.isArray(data.transactions)) {
      throw new Error('Archivo de respaldo inválido')
    }

    await this.db.batch(async () => {
      // Borrar en orden inverso (hijos primero por las FKs)
      for (const table of [...WebDBService.BACKUP_TABLES].reverse()) {
        await this.db.run(`DELETE FROM ${table}`, [])
      }

      // Insertar conservando ids y columnas originales
      for (const table of WebDBService.BACKUP_TABLES) {
        const rows = (data as unknown as Record<string, Record<string, unknown>[]>)[table] ?? []
        for (const row of rows) {
          const cols = Object.keys(row)
          const placeholders = cols.map(() => '?').join(',')
          await this.db.run(
            `INSERT INTO ${table} (${cols.join(',')}) VALUES (${placeholders})`,
            cols.map((c) => row[c] as never)
          )
        }
      }
    })
  }

  // ──────────────────────────────── API KEY ─────────────────────────────────

  async getApiKey(): Promise<string | null> {
    try { return localStorage.getItem(API_KEY_STORAGE) } catch { return null }
  }

  async saveApiKey(key: string): Promise<void> {
    localStorage.setItem(API_KEY_STORAGE, key)
  }

  // ──────────────────────────────── AI ──────────────────────────────────────

  // Modelos en orden de preferencia — si el primero da 404 (deprecado) prueba el siguiente
  private static readonly MODEL_FALLBACK = [
    'gemini-2.5-flash-lite',
    'gemini-2.5-flash',
    'gemini-2.0-flash-lite',
    'gemini-2.0-flash',
    'gemini-1.5-flash',
  ]

  async parseWithAI(text: string, apiKey: string, signal?: AbortSignal, context?: string): Promise<AIResult> {
    const genAI = new GoogleGenerativeAI(apiKey)

    const today = new Date().toISOString().split('T')[0]
    const prompt = buildAIPrompt(today, context) + `\n\nMensaje del usuario: "${text}"`

    // Timeout propio + AbortSignal externo (botón cancelar)
    const controller = new AbortController()
    const timeoutId = setTimeout(() => controller.abort(), AI_TIMEOUT_MS)
    if (signal) signal.addEventListener('abort', () => controller.abort())

    let result: Awaited<ReturnType<ReturnType<typeof genAI.getGenerativeModel>['generateContent']>>
    let lastErr: unknown
    try {
      for (const modelName of WebDBService.MODEL_FALLBACK) {
        try {
          const model = genAI.getGenerativeModel({ model: modelName })
          result = await model.generateContent(
            { contents: [{ role: 'user', parts: [{ text: prompt }] }] },
            { signal: controller.signal }
          )
          break   // éxito — sale del loop
        } catch (err: any) {
          const msg = String(err?.message ?? '')
          if (msg.includes('404') || /not found|not supported/i.test(msg)) {
            lastErr = err
            continue   // modelo no disponible → prueba el siguiente
          }
          throw err   // rate limit, auth, abort → lanza sin probar otros
        }
      }
      if (!result!) throw lastErr   // todos los modelos fallaron
    } catch (err: any) {
      throw new Error(friendlyAIError(err))
    } finally {
      clearTimeout(timeoutId)
    }

    const raw = result.response.text().trim()
    const jsonObj = extractJSON(raw)        // extractor robusto, no regex greedy
    return validateAIResponse(jsonObj)      // { action: 'register'|'answer', ... }
  }
}
