import type { DBService, TransactionFilters } from './types'
import type {
  Transaction, Installment, Goal, CreditCard, Budget,
  TransactionSummary, Debt, BackupData,
  Account, Recurring,
  PaymentLogEntry, ReminderSetting, ReminderKind, EntityKind, DeletedSnapshot,
  RangeTotals, SpendStats,
} from '@/types'
import type { SqlConn } from './conn'
import { BACKUP_TABLES, SCHEMA_VERSION, TABLE_COLUMNS, isTableName, runMigrations } from './schema'
import { sanitizeBackup } from '@/lib/backupFormat'
import { askGemini } from '@/lib/ai/client'
import type { AIResult } from '@/lib/ai/validate'
import { addMonths, currentMonth, today } from '@/lib/dates'
import { storageGet, storageSet, storageRemove } from '@/lib/storage'

const API_KEY_STORAGE = 'lukas_gemini_api_key'

/** Tabla principal de cada tipo de registro que se puede eliminar y restaurar. */
const ENTITY_TABLE: Record<EntityKind, string> = {
  transaction: 'transactions',
  installment: 'installments',
  goal: 'goals',
  card: 'credit_cards',
  debt: 'debts',
  account: 'accounts',
  recurring: 'recurring',
}

/**
 * Toda la lógica de datos sobre SQLite. No sabe de navegador ni de IndexedDB:
 * recibe una conexión (`SqlConn`), lo que permite probarla en Node con sql.js.
 */
export class SqlDBService implements DBService {
  protected conn: SqlConn | null = null

  constructor(conn?: SqlConn) {
    if (conn) this.conn = conn
  }

  /** Crea las tablas que falten y aplica migraciones (solo agregan, nunca alteran). */
  async init(): Promise<void> {
    await runMigrations(this.db)
  }

  protected get db(): SqlConn {
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

  async deleteRecurring(id: number): Promise<void> {
    await this.db.run('DELETE FROM recurring WHERE id=?', [id])
  }


  // ──────────────────────────────── TOTALES Y ESTADÍSTICAS ─────────────────

  /** Ingresos y gastos entre dos fechas (ambas incluidas). */
  async getRangeTotals(dateFrom: string, dateTo: string): Promise<RangeTotals> {
    const r = this.row<{ income: number; expenses: number }>(await this.db.query(
      `SELECT
        COALESCE(SUM(CASE WHEN type='income' THEN amount ELSE 0 END),0) as income,
        COALESCE(SUM(CASE WHEN type='expense' THEN amount ELSE 0 END),0) as expenses
       FROM transactions WHERE date >= ? AND date <= ?`,
      [dateFrom, dateTo]
    ))
    return { income: Number(r?.income ?? 0), expenses: Number(r?.expenses ?? 0) }
  }

  /**
   * Gasto del día a día entre dos fechas, SIN los movimientos generados al marcar
   * un pago fijo (esos ya se descuentan aparte como pendientes del mes).
   */
  async getSpendStats(dateFrom: string, dateTo: string): Promise<SpendStats> {
    const r = this.row<{ total: number; count: number }>(await this.db.query(
      `SELECT COALESCE(SUM(amount),0) as total, COUNT(*) as count
       FROM transactions
       WHERE type='expense' AND date >= ? AND date <= ?
         AND id NOT IN (SELECT transaction_id FROM payment_log WHERE transaction_id IS NOT NULL)`,
      [dateFrom, dateTo]
    ))
    const first = this.row<{ first: string | null }>(await this.db.query(
      "SELECT MIN(date) as first FROM transactions WHERE type='expense'", []
    ))
    return {
      total: Number(r?.total ?? 0),
      count: Number(r?.count ?? 0),
      firstExpenseDate: first?.first ?? null,
    }
  }

  /** Deshace un registro recién creado: borra el movimiento y revierte el ajuste de saldo que hizo. */
  async undoCreateTransaction(id: number): Promise<void> {
    const tx = this.row<Transaction>(await this.db.query('SELECT * FROM transactions WHERE id=?', [id]))
    if (!tx) return
    await this.db.batch(async () => {
      // El ajuste inverso es el mismo cálculo con el tipo contrario
      await this.syncPaymentMethod(tx.payment_method, tx.amount, tx.type === 'expense' ? 'income' : 'expense')
      await this.db.run('DELETE FROM transactions WHERE id=?', [id])
    })
  }

  // ──────────────────────────────── PAGOS: MARCAR Y DESHACER ───────────────

  async payInstallment(id: number): Promise<Installment> {
    const inst = this.row<Installment>(await this.db.query('SELECT * FROM installments WHERE id=?', [id]))
    if (!inst) throw new Error('Cuota no encontrada')
    if (inst.paid_months >= inst.total_months) throw new Error('Esta cuota ya está completa')

    await this.db.batch(async () => {
      const pay = await this.db.run(
        'INSERT INTO installment_payments (installment_id, paid_date, amount) VALUES (?,?,?)',
        [id, today(), inst.monthly_amount]
      )
      const nextDue = inst.next_due_date ? addMonths(inst.next_due_date, 1) : null
      await this.db.run(
        'UPDATE installments SET paid_months=?, next_due_date=? WHERE id=?',
        [inst.paid_months + 1, nextDue, id]
      )
      // Bitácora: guarda la fecha anterior para poder deshacer exactamente
      await this.db.run(
        "INSERT INTO payment_log (kind, item_id, period, transaction_id, installment_payment_id, prev_value, amount) VALUES ('installment',?,?,?,?,?,?)",
        [id, null, null, pay.changes?.lastId ?? null, inst.next_due_date ?? null, inst.monthly_amount]
      )
    })
    return this.row<Installment>(await this.db.query('SELECT * FROM installments WHERE id=?', [id]))!
  }

  /** Deshace el último pago de una cuota hecho desde la app. */
  async undoPayInstallment(id: number): Promise<Installment> {
    const log = this.row<PaymentLogEntry>(await this.db.query(
      "SELECT * FROM payment_log WHERE kind='installment' AND item_id=? ORDER BY id DESC LIMIT 1", [id]
    ))
    if (!log) throw new Error('No hay un pago reciente que se pueda deshacer')
    const inst = this.row<Installment>(await this.db.query('SELECT * FROM installments WHERE id=?', [id]))
    if (!inst) throw new Error('Cuota no encontrada')

    await this.db.batch(async () => {
      if (log.installment_payment_id != null) {
        await this.db.run('DELETE FROM installment_payments WHERE id=?', [log.installment_payment_id])
      }
      await this.db.run(
        'UPDATE installments SET paid_months=?, next_due_date=? WHERE id=?',
        [Math.max(0, inst.paid_months - 1), log.prev_value ?? null, id]
      )
      await this.db.run('DELETE FROM payment_log WHERE id=?', [log.id])
    })
    return this.row<Installment>(await this.db.query('SELECT * FROM installments WHERE id=?', [id]))!
  }

  // Registra el pago del mes: crea el movimiento, marca el mes y deja bitácora
  async postRecurring(id: number): Promise<Recurring> {
    const rec = this.row<Recurring>(await this.db.query('SELECT * FROM recurring WHERE id=?', [id]))
    if (!rec) throw new Error('Pago recurrente no encontrado')

    const month = currentMonth()
    if (rec.last_posted === month) throw new Error('Este pago ya fue registrado este mes')

    await this.db.batch(async () => {
      const tx = await this.db.run(
        "INSERT INTO transactions (amount, type, category, description, payment_method, date) VALUES (?,'expense',?,?,?,?)",
        [rec.amount, rec.category, rec.name, rec.payment_method ?? null, today()]
      )
      await this.db.run('UPDATE recurring SET last_posted=? WHERE id=?', [month, id])
      await this.db.run(
        "INSERT INTO payment_log (kind, item_id, period, transaction_id, installment_payment_id, prev_value, amount) VALUES ('recurring',?,?,?,?,?,?)",
        [id, month, tx.changes?.lastId ?? null, null, rec.last_posted ?? null, rec.amount]
      )
    })
    return this.row<Recurring>(await this.db.query('SELECT * FROM recurring WHERE id=?', [id]))!
  }

  /** Deshace el último pago fijo marcado desde la app: borra su movimiento y lo deja pendiente. */
  async undoPostRecurring(id: number): Promise<Recurring> {
    const log = this.row<PaymentLogEntry>(await this.db.query(
      "SELECT * FROM payment_log WHERE kind='recurring' AND item_id=? ORDER BY id DESC LIMIT 1", [id]
    ))
    if (!log) throw new Error('No hay un pago reciente que se pueda deshacer')

    await this.db.batch(async () => {
      if (log.transaction_id != null) {
        await this.db.run('DELETE FROM transactions WHERE id=?', [log.transaction_id])
      }
      await this.db.run('UPDATE recurring SET last_posted=? WHERE id=?', [log.prev_value ?? null, id])
      await this.db.run('DELETE FROM payment_log WHERE id=?', [log.id])
    })
    const rec = this.row<Recurring>(await this.db.query('SELECT * FROM recurring WHERE id=?', [id]))
    if (!rec) throw new Error('Pago recurrente no encontrado')
    return rec
  }

  /** Último pago registrado en la bitácora por cada cuota o pago fijo. */
  async listLastPayments(): Promise<PaymentLogEntry[]> {
    return this.rows<PaymentLogEntry>(await this.db.query(
      'SELECT * FROM payment_log WHERE id IN (SELECT MAX(id) FROM payment_log GROUP BY kind, item_id)', []
    ))
  }

  // ──────────────────────────────── RECORDATORIOS ───────────────────────────

  async listReminders(): Promise<ReminderSetting[]> {
    return this.rows<ReminderSetting>(await this.db.query('SELECT * FROM reminders', []))
  }

  /** Crea o actualiza la configuración de recordatorio de un registro. */
  async setReminder(
    kind: ReminderKind,
    itemId: number,
    patch: Partial<Pick<ReminderSetting, 'enabled' | 'days_before' | 'snoozed_until'>>,
  ): Promise<ReminderSetting> {
    const existing = this.row<ReminderSetting>(await this.db.query(
      'SELECT * FROM reminders WHERE kind=? AND item_id=?', [kind, itemId]
    ))
    const merged = {
      enabled: existing?.enabled ?? 1,
      days_before: existing?.days_before ?? null,
      snoozed_until: existing?.snoozed_until ?? null,
    }
    if (patch.enabled !== undefined) merged.enabled = patch.enabled ? 1 : 0
    if (patch.days_before !== undefined) merged.days_before = patch.days_before
    if (patch.snoozed_until !== undefined) merged.snoozed_until = patch.snoozed_until

    if (existing) {
      await this.db.run(
        'UPDATE reminders SET enabled=?, days_before=?, snoozed_until=? WHERE id=?',
        [merged.enabled, merged.days_before, merged.snoozed_until, existing.id]
      )
    } else {
      await this.db.run(
        'INSERT INTO reminders (kind, item_id, enabled, days_before, snoozed_until) VALUES (?,?,?,?,?)',
        [kind, itemId, merged.enabled, merged.days_before, merged.snoozed_until]
      )
    }
    return this.row<ReminderSetting>(await this.db.query(
      'SELECT * FROM reminders WHERE kind=? AND item_id=?', [kind, itemId]
    ))!
  }

  // ──────────────────────────────── ELIMINAR Y RESTAURAR ────────────────────

  /**
   * Elimina un registro y todo lo que depende de él, y devuelve una copia exacta
   * para poder restaurarlo con "Deshacer".
   */
  async deleteWithSnapshot(kind: EntityKind, id: number): Promise<DeletedSnapshot> {
    const table = ENTITY_TABLE[kind]
    if (!table) throw new Error('Tipo de registro desconocido')

    const main = this.row<Record<string, unknown>>(await this.db.query(`SELECT * FROM ${table} WHERE id=?`, [id]))
    if (!main) throw new Error('El registro ya no existe')

    // Lo que cuelga del registro: [tabla, condición, parámetros]
    const dependents: [string, string, unknown[]][] = []
    if (kind === 'installment') dependents.push(['installment_payments', 'installment_id=?', [id]])
    if (kind === 'installment' || kind === 'recurring') dependents.push(['payment_log', 'kind=? AND item_id=?', [kind, id]])
    if (kind === 'installment' || kind === 'recurring' || kind === 'debt') dependents.push(['reminders', 'kind=? AND item_id=?', [kind, id]])

    const snapshot: DeletedSnapshot = { kind, rows: [{ table, row: main }] }
    for (const [depTable, where, params] of dependents) {
      const found = this.rows<Record<string, unknown>>(await this.db.query(`SELECT * FROM ${depTable} WHERE ${where}`, params))
      for (const row of found) snapshot.rows.push({ table: depTable, row })
    }

    await this.db.batch(async () => {
      for (const [depTable, where, params] of dependents) {
        await this.db.run(`DELETE FROM ${depTable} WHERE ${where}`, params)
      }
      await this.db.run(`DELETE FROM ${table} WHERE id=?`, [id])
    })
    return snapshot
  }

  /** Vuelve a insertar lo eliminado con sus identificadores originales. */
  async restoreSnapshot(snapshot: DeletedSnapshot): Promise<void> {
    await this.db.batch(async () => {
      for (const { table, row } of snapshot.rows) {
        if (!isTableName(table)) throw new Error('No se pudo restaurar el registro')
        const cols = Object.keys(row).filter((c) => TABLE_COLUMNS[table].includes(c))
        if (cols.length === 0) continue
        await this.db.run(
          `INSERT INTO ${table} (${cols.join(',')}) VALUES (${cols.map(() => '?').join(',')})`,
          cols.map((c) => row[c])
        )
      }
    })
  }

  // ──────────────────────────────── BACKUP ──────────────────────────────────

  async exportBackup(): Promise<BackupData> {
    // Se conserva app:'flux-finance' y version:1 para que el Lukas anterior también pueda importarlo
    // (ese ignora las secciones que no conoce: payment_log, reminders, preferences).
    const data: Record<string, unknown> = {
      version: 1,
      app: 'flux-finance',
      schema_version: SCHEMA_VERSION,
      exported_at: new Date().toISOString(),
    }
    for (const table of BACKUP_TABLES) {
      data[table] = this.rows(await this.db.query(`SELECT * FROM ${table}`, []))
    }
    return data as unknown as BackupData
  }

  /** Cantidad de registros por tabla (para mostrar qué se va a reemplazar al importar). */
  async countRecords(): Promise<Record<string, number>> {
    const counts: Record<string, number> = {}
    for (const table of BACKUP_TABLES) {
      const r = this.row<{ n: number }>(await this.db.query(`SELECT COUNT(*) as n FROM ${table}`, []))
      counts[table] = Number(r?.n ?? 0)
    }
    return counts
  }

  /**
   * REEMPLAZA todos los datos por los del respaldo. Valida antes de tocar nada y
   * trabaja en una sola transacción: si algo falla, los datos actuales quedan intactos.
   */
  async importBackup(data: BackupData): Promise<void> {
    const { data: clean } = sanitizeBackup(data)
    const tables = clean as unknown as Record<string, Record<string, unknown>[]>

    await this.db.batch(async () => {
      // Borrar en orden inverso (hijos primero)
      for (const table of [...BACKUP_TABLES].reverse()) {
        await this.db.run(`DELETE FROM ${table}`, [])
      }

      // Insertar conservando ids; solo columnas conocidas (sanitizeBackup ya filtró)
      for (const table of BACKUP_TABLES) {
        for (const row of tables[table] ?? []) {
          const cols = Object.keys(row).filter((c) => TABLE_COLUMNS[table].includes(c))
          if (cols.length === 0) continue
          await this.db.run(
            `INSERT INTO ${table} (${cols.join(',')}) VALUES (${cols.map(() => '?').join(',')})`,
            cols.map((c) => row[c])
          )
        }
      }
    })
  }

  // ──────────────────────────────── API KEY ─────────────────────────────────
  // Se guarda solo en este dispositivo y nunca viaja en los respaldos.

  async getApiKey(): Promise<string | null> {
    const key = storageGet(API_KEY_STORAGE)
    return key && key.trim() ? key : null
  }

  async saveApiKey(key: string): Promise<void> {
    const clean = key.trim()
    if (!clean) storageRemove(API_KEY_STORAGE)
    else storageSet(API_KEY_STORAGE, clean)
  }

  // ──────────────────────────────── AI ──────────────────────────────────────

  async parseWithAI(text: string, apiKey: string, signal?: AbortSignal, context?: string): Promise<AIResult> {
    return askGemini(text, apiKey, signal, context)
  }
}
