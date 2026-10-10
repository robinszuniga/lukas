import { beforeEach, describe, expect, it } from 'vitest'
import initSqlJs from 'sql.js'
import type { Database } from 'sql.js'
import { SqlDBService } from './sqlService'
import { SqlJsConn } from './conn'
import { BASE_SCHEMA, SCHEMA_VERSION, TABLE_COLUMNS } from './schema'
import { buildBudgetLines } from '@/lib/budgets'
import { addMonths, currentMonth, today } from '@/lib/dates'
import type { BackupData, Transaction } from '@/types'

/** Columnas que conoce el Lukas anterior: un respaldo nuevo no puede traer otras en estas tablas. */
const ORIGINAL_TABLES = ['transactions', 'installments', 'installment_payments', 'goals', 'credit_cards', 'budgets', 'debts', 'accounts', 'recurring'] as const

let SQL: Awaited<ReturnType<typeof initSqlJs>>
let raw: Database
let db: SqlDBService

async function open(existing?: Database) {
  SQL ??= await initSqlJs()
  raw = existing ?? new SQL.Database()
  db = new SqlDBService(new SqlJsConn(raw))
  await db.init()
}

function scalar(sql: string): unknown {
  return raw.exec(sql)[0]?.values?.[0]?.[0]
}

const expense = (over: Partial<Transaction> = {}) => ({
  amount: 100_000, type: 'expense' as const, category: 'Alimentación' as const,
  description: 'mercado', payment_method: null, date: today(), ...over,
})

beforeEach(async () => { await open() })

describe('migración', () => {
  it('una base del Lukas 2.0 conserva sus datos y solo recibe tablas nuevas', async () => {
    SQL ??= await initSqlJs()
    const old = new SQL.Database()
    old.exec(BASE_SCHEMA)
    old.run("INSERT INTO transactions (amount, type, category, description, date) VALUES (654321,'expense','Alimentación','mercado','2026-09-27')")
    old.run("INSERT INTO budgets (category, monthly_limit) VALUES ('Alimentación', 900000)")
    old.run("INSERT INTO recurring (name, amount, category, day, last_posted) VALUES ('Gasolina', 150000, 'Transporte', 28, '2026-09')")
    const before = JSON.stringify(old.exec('SELECT * FROM transactions UNION ALL SELECT id, monthly_limit, category, category, NULL, NULL, category, NULL FROM budgets'))
    expect(old.exec('PRAGMA user_version')[0].values[0][0]).toBe(0)

    await open(old)

    expect(scalar('PRAGMA user_version')).toBe(SCHEMA_VERSION)
    expect(JSON.stringify(raw.exec('SELECT * FROM transactions UNION ALL SELECT id, monthly_limit, category, category, NULL, NULL, category, NULL FROM budgets'))).toBe(before)
    expect((await db.listRecurring())[0]).toMatchObject({ name: 'Gasolina', last_posted: '2026-09' })
    expect(await db.listReminders()).toEqual([])
    expect(await db.listLastPayments()).toEqual([])

    // Las tablas originales no cambiaron de columnas
    for (const table of ORIGINAL_TABLES) {
      const cols = raw.exec(`PRAGMA table_info(${table})`)[0].values.map((v) => v[1])
      expect(cols).toEqual([...TABLE_COLUMNS[table]])
    }
  })

  it('volver a abrir no repite ni rompe nada', async () => {
    await db.createTransaction(expense())
    await db.init()
    await db.init()
    expect(scalar('PRAGMA user_version')).toBe(SCHEMA_VERSION)
    expect(await db.listTransactions()).toHaveLength(1)
  })
})

describe('presupuestos sobre movimientos reales', () => {
  const month = currentMonth()
  const lines = async () => buildBudgetLines(await db.listBudgets(), (await db.getTransactionSummary(month)).byCategory)

  it('excluye ingresos y refleja editar, cambiar de categoría y eliminar', async () => {
    await db.upsertBudget('Alimentación', 500_000)
    await db.upsertBudget('Transporte', 100_000)

    await db.createTransaction({ ...expense(), amount: 2_000_000, type: 'income', category: 'Alimentación', description: 'ingreso mal categorizado' })
    const a = await db.createTransaction(expense({ amount: 300_000 }))
    const b = await db.createTransaction(expense({ amount: 150_000 }))

    let l = await lines()
    expect(l.find((x) => x.category === 'Alimentación')).toMatchObject({ spent: 450_000, remaining: 50_000, state: 'near' })
    expect(l.find((x) => x.category === 'Transporte')).toMatchObject({ spent: 0, state: 'ok' })

    // Editar el monto
    await db.updateTransaction(a.id, { amount: 400_000 })
    l = await lines()
    expect(l.find((x) => x.category === 'Alimentación')).toMatchObject({ spent: 550_000, remaining: -50_000, state: 'over' })

    // Cambiar de categoría mueve el gasto de un presupuesto a otro
    await db.updateTransaction(b.id, { category: 'Transporte' })
    l = await lines()
    expect(l.find((x) => x.category === 'Alimentación')).toMatchObject({ spent: 400_000, state: 'near' })
    expect(l.find((x) => x.category === 'Transporte')).toMatchObject({ spent: 150_000, state: 'over' })

    // Eliminar y restaurar
    const snap = await db.deleteWithSnapshot('transaction', a.id)
    l = await lines()
    expect(l.find((x) => x.category === 'Alimentación')).toMatchObject({ spent: 0, state: 'ok' })
    await db.restoreSnapshot(snap)
    l = await lines()
    expect(l.find((x) => x.category === 'Alimentación')).toMatchObject({ spent: 400_000 })

    // Un gasto de otro mes no cuenta en este
    await db.updateTransaction(a.id, { date: addMonths(today(), -1) })
    l = await lines()
    expect(l.find((x) => x.category === 'Alimentación')).toMatchObject({ spent: 0 })
  })

  it('crear, editar y quitar un límite', async () => {
    await db.upsertBudget('Salud', 300_000)
    await db.upsertBudget('Salud', 450_000)
    expect(await db.listBudgets()).toEqual([expect.objectContaining({ category: 'Salud', monthly_limit: 450_000 })])
    await db.deleteBudget('Salud')
    expect(await db.listBudgets()).toEqual([])
  })
})

describe('totales y estadísticas', () => {
  it('suma por rango y deja fuera del gasto diario los pagos fijos', async () => {
    await db.createTransaction({ ...expense(), type: 'income', amount: 1_000_000 })
    await db.createTransaction(expense({ amount: 50_000 }))
    await db.createTransaction(expense({ amount: 30_000 }))
    const rec = await db.createRecurring({ name: 'Arriendo', amount: 900_000, category: 'Servicios', payment_method: null, day: 1 })
    await db.postRecurring(rec.id)

    expect(await db.getRangeTotals(today(), today())).toEqual({ income: 1_000_000, expenses: 980_000 })
    expect(await db.getRangeTotals('2000-01-01', '2000-01-31')).toEqual({ income: 0, expenses: 0 })

    const stats = await db.getSpendStats(today(), today())
    expect(stats).toEqual({ total: 80_000, count: 2, firstExpenseDate: today() })
  })

  it('sin datos devuelve ceros, no nulos', async () => {
    expect(await db.getSpendStats('2026-01-01', '2026-12-31')).toEqual({ total: 0, count: 0, firstExpenseDate: null })
  })
})

describe('marcar pagos y deshacer', () => {
  it('pago fijo: crea el movimiento y al deshacer queda exactamente como antes', async () => {
    const rec = await db.createRecurring({ name: 'Gasolina', amount: 150_000, category: 'Transporte', payment_method: 'Nequi', day: 28 })
    const posted = await db.postRecurring(rec.id)
    expect(posted.last_posted).toBe(currentMonth())
    const txs = await db.listTransactions()
    expect(txs).toHaveLength(1)
    expect(txs[0]).toMatchObject({ amount: 150_000, type: 'expense', category: 'Transporte', description: 'Gasolina', date: today() })
    expect((await db.listLastPayments())[0]).toMatchObject({ kind: 'recurring', item_id: rec.id, period: currentMonth(), transaction_id: txs[0].id })

    await expect(db.postRecurring(rec.id)).rejects.toThrow('ya fue registrado')

    const undone = await db.undoPostRecurring(rec.id)
    expect(undone.last_posted).toBeNull()
    expect(await db.listTransactions()).toEqual([])
    expect(await db.listLastPayments()).toEqual([])
    await expect(db.undoPostRecurring(rec.id)).rejects.toThrow('No hay un pago reciente')
  })

  it('pago fijo: deshacer restaura el mes anterior ya pagado', async () => {
    const rec = await db.createRecurring({ name: 'Gym', amount: 80_000, category: 'Salud', payment_method: null, day: 5 })
    raw.run("UPDATE recurring SET last_posted='2020-01' WHERE id=?", [rec.id])
    await db.postRecurring(rec.id)
    expect((await db.undoPostRecurring(rec.id)).last_posted).toBe('2020-01')
  })

  it('cuota: pagar avanza un mes y deshacer devuelve cuotas, fecha e historial', async () => {
    const inst = await db.createInstallment({ name: 'Crédito', total_amount: 1_200_000, total_months: 12, paid_months: 7, monthly_amount: 100_000, next_due_date: '2026-01-31', notes: null })
    const paid = await db.payInstallment(inst.id)
    expect(paid).toMatchObject({ paid_months: 8, next_due_date: '2026-02-28' })
    expect(await db.listInstallmentPayments(inst.id)).toHaveLength(1)

    const paidAgain = await db.payInstallment(inst.id)
    expect(paidAgain).toMatchObject({ paid_months: 9, next_due_date: '2026-03-28' })

    // Deshacer va del más reciente hacia atrás
    expect(await db.undoPayInstallment(inst.id)).toMatchObject({ paid_months: 8, next_due_date: '2026-02-28' })
    expect(await db.undoPayInstallment(inst.id)).toMatchObject({ paid_months: 7, next_due_date: '2026-01-31' })
    expect(await db.listInstallmentPayments(inst.id)).toEqual([])
    await expect(db.undoPayInstallment(inst.id)).rejects.toThrow('No hay un pago reciente')
  })

  it('no deja pagar una cuota ya completa', async () => {
    const inst = await db.createInstallment({ name: 'Lista', total_amount: 100, total_months: 2, paid_months: 2, monthly_amount: 50, next_due_date: null, notes: null })
    await expect(db.payInstallment(inst.id)).rejects.toThrow('completa')
  })

  it('deuda: marcar saldada y volver a pendiente', async () => {
    const debt = await db.createDebt({ person: 'Carlos', amount: 80_000, type: 'owed_to_me', description: null, due_date: null })
    expect((await db.toggleDebtPaid(debt.id)).paid).toBe(1)
    expect((await db.toggleDebtPaid(debt.id)).paid).toBe(0)
  })
})

describe('recordatorios', () => {
  it('crea y actualiza la configuración sin perder lo que no se toca', async () => {
    const r1 = await db.setReminder('debt', 7, { days_before: 5 })
    expect(r1).toMatchObject({ kind: 'debt', item_id: 7, enabled: 1, days_before: 5, snoozed_until: null })
    const r2 = await db.setReminder('debt', 7, { snoozed_until: '2026-10-10' })
    expect(r2).toMatchObject({ enabled: 1, days_before: 5, snoozed_until: '2026-10-10' })
    const r3 = await db.setReminder('debt', 7, { enabled: 0, snoozed_until: null })
    expect(r3).toMatchObject({ enabled: 0, days_before: 5, snoozed_until: null })
    expect(await db.listReminders()).toHaveLength(1)
  })
})

describe('eliminar con copia y deshacer', () => {
  it('restaura un movimiento con el mismo identificador y los mismos datos', async () => {
    const tx = await db.createTransaction(expense({ description: 'pescado', amount: 50_000, payment_method: 'Efectivo' }))
    const snap = await db.deleteWithSnapshot('transaction', tx.id)
    expect(await db.listTransactions()).toEqual([])
    await db.restoreSnapshot(snap)
    expect(await db.listTransactions()).toEqual([tx])
  })

  it('una cuota se va y vuelve con sus pagos, bitácora y recordatorio', async () => {
    const inst = await db.createInstallment({ name: 'Seguro', total_amount: 275_000, total_months: 11, paid_months: 5, monthly_amount: 25_000, next_due_date: '2026-10-12', notes: null })
    await db.payInstallment(inst.id)
    await db.setReminder('installment', inst.id, { days_before: 2 })
    const before = await db.exportBackup()

    const snap = await db.deleteWithSnapshot('installment', inst.id)
    expect(await db.listInstallments()).toEqual([])
    expect(scalar('SELECT COUNT(*) FROM installment_payments')).toBe(0)
    expect(scalar('SELECT COUNT(*) FROM payment_log')).toBe(0)
    expect(scalar('SELECT COUNT(*) FROM reminders')).toBe(0)

    await db.restoreSnapshot(snap)
    const after = await db.exportBackup()
    expect({ ...after, exported_at: '' }).toEqual({ ...before, exported_at: '' })
    // y el pago se puede seguir deshaciendo
    expect(await db.undoPayInstallment(inst.id)).toMatchObject({ paid_months: 5, next_due_date: '2026-10-12' })
  })

  it('funciona para todos los tipos de registro', async () => {
    const goal = await db.createGoal({ name: 'Viaje', target_amount: 1000, saved_amount: 10, deadline: null, emoji: '✈️' })
    const card = await db.createCard({ bank_name: 'Nu', last_four: '0000', credit_limit: 2_000_000, current_balance: 400_000, billing_day: 22, cutoff_day: null, color: '#8b5cf6' })
    const debt = await db.createDebt({ person: 'Ana', amount: 5, type: 'i_owe', description: null, due_date: '2026-10-09' })
    const acc = await db.createAccount({ name: 'Nequi', balance: 99, color: '#3b82f6' })
    const rec = await db.createRecurring({ name: 'Netflix', amount: 30, category: 'Entretenimiento', payment_method: null, day: 3 })
    const before = await db.exportBackup()

    const snaps = [
      await db.deleteWithSnapshot('goal', goal.id),
      await db.deleteWithSnapshot('card', card.id),
      await db.deleteWithSnapshot('debt', debt.id),
      await db.deleteWithSnapshot('account', acc.id),
      await db.deleteWithSnapshot('recurring', rec.id),
    ]
    const empty = await db.countRecords()
    expect(Object.values(empty).every((n) => n === 0)).toBe(true)

    for (const s of snaps) await db.restoreSnapshot(s)
    expect({ ...(await db.exportBackup()), exported_at: '' }).toEqual({ ...before, exported_at: '' })
  })

  it('avisa si el registro ya no existe', async () => {
    await expect(db.deleteWithSnapshot('transaction', 999)).rejects.toThrow('ya no existe')
  })

  it('deshacer un registro recién creado también revierte el saldo de la cuenta', async () => {
    const acc = await db.createAccount({ name: 'Nequi', balance: 500_000, color: '#3b82f6' })
    const tx = await db.createTransaction(expense({ amount: 120_000, payment_method: 'nequi' }))
    expect((await db.listAccounts())[0].balance).toBe(380_000)
    await db.undoCreateTransaction(tx.id)
    expect((await db.listAccounts()).find((a) => a.id === acc.id)?.balance).toBe(500_000)
    expect(await db.listTransactions()).toEqual([])
  })
})

describe('saldos de cuentas y tarjetas', () => {
  const balanceOf = async (id: number) => (await db.listAccounts()).find((a) => a.id === id)?.balance
  const debtOf = async (id: number) => (await db.listCards()).find((c) => c.id === id)?.current_balance

  it('descuenta aunque el nombre tenga mayúsculas con tilde o Ñ, o se escriba sin tildes', async () => {
    const sobre = await db.createAccount({ name: 'SOBRE ALIMENTACIÓN', balance: 300_000, color: '#fff' })
    await db.createTransaction(expense({ amount: 50_000, payment_method: 'SOBRE ALIMENTACIÓN' }))
    await db.createTransaction(expense({ amount: 20_000, payment_method: 'sobre alimentacion' }))
    expect(await balanceOf(sobre.id)).toBe(230_000)

    const napa = await db.createAccount({ name: 'Ñapa', balance: 10_000, color: '#fff' })
    await db.createTransaction(expense({ amount: 1_000, payment_method: 'ñapa' }))
    expect(await balanceOf(napa.id)).toBe(9_000)
  })

  it('sin cuenta con ese nombre guarda el gasto y no toca ningún saldo', async () => {
    const acc = await db.createAccount({ name: 'Sobre mercado', balance: 300_000, color: '#fff' })
    await db.createTransaction(expense({ payment_method: 'Sobre' }))
    expect(await balanceOf(acc.id)).toBe(300_000)
    expect(await db.listTransactions()).toHaveLength(1)
  })

  it('pago fijo: «Pagar» descuenta de la cuenta y «Deshacer» lo devuelve', async () => {
    const acc = await db.createAccount({ name: 'Sobre', balance: 300_000, color: '#fff' })
    const rec = await db.createRecurring({ name: 'Mercado', amount: 50_000, category: 'Alimentación', payment_method: 'sobre', day: 1 })
    await db.postRecurring(rec.id)
    expect(await balanceOf(acc.id)).toBe(250_000)
    await db.undoPostRecurring(rec.id)
    expect(await balanceOf(acc.id)).toBe(300_000)
  })

  it('pago fijo marcado antes de esta versión: deshacer no devuelve plata que nunca se descontó', async () => {
    const acc = await db.createAccount({ name: 'Sobre', balance: 300_000, color: '#fff' })
    const rec = await db.createRecurring({ name: 'Mercado', amount: 50_000, category: 'Alimentación', payment_method: 'Sobre', day: 1 })
    await db.postRecurring(rec.id)
    // Así quedaba con la versión anterior: gasto creado, saldo intacto y sin anotación
    raw.run('DELETE FROM balance_moves')
    raw.run('UPDATE accounts SET balance = 300000')
    await db.undoPostRecurring(rec.id)
    expect(await balanceOf(acc.id)).toBe(300_000)
  })

  it('tarjeta: un abono no deja la deuda bajo cero y deshacerlo devuelve solo lo que cambió', async () => {
    const card = await db.createCard({ bank_name: 'Nu', last_four: null, credit_limit: 1_000_000, current_balance: 30_000, billing_day: null, cutoff_day: null, color: '#000' })
    const tx = await db.createTransaction(expense({ type: 'income', amount: 50_000, payment_method: 'Nu' }))
    expect(await debtOf(card.id)).toBe(0)
    await db.undoCreateTransaction(tx.id)
    expect(await debtOf(card.id)).toBe(30_000)
  })

  it('editar: propone el ajuste neto y solo lo aplica si se pide', async () => {
    const sobre = await db.createAccount({ name: 'Sobre', balance: 300_000, color: '#fff' })
    const nequi = await db.createAccount({ name: 'Nequi', balance: 100_000, color: '#fff' })
    const tx = await db.createTransaction(expense({ amount: 50_000, payment_method: null }))

    // Solo cambiar la descripción no mueve saldos
    expect(await db.planBalanceUpdate(tx.id, { description: 'otra' })).toEqual({ moves: [], untracked: [] })

    // Elegir el sobre después de guardarlo
    expect(await db.planBalanceUpdate(tx.id, { payment_method: 'Sobre' })).toEqual({
      moves: [{ target: 'account', target_id: sobre.id, name: 'Sobre', delta: -50_000 }],
      untracked: [],
    })
    await db.updateTransaction(tx.id, { payment_method: 'Sobre' }, { adjustBalances: true })
    expect(await balanceOf(sobre.id)).toBe(250_000)

    // Subir el monto: solo la diferencia
    expect((await db.planBalanceUpdate(tx.id, { amount: 60_000 })).moves).toEqual([
      { target: 'account', target_id: sobre.id, name: 'Sobre', delta: -10_000 },
    ])
    await db.updateTransaction(tx.id, { amount: 60_000 }, { adjustBalances: true })
    expect(await balanceOf(sobre.id)).toBe(240_000)

    // Cambiar de cuenta: se devuelve a una y se descuenta de la otra
    expect((await db.planBalanceUpdate(tx.id, { payment_method: 'Nequi' })).moves).toEqual([
      { target: 'account', target_id: sobre.id, name: 'Sobre', delta: 60_000 },
      { target: 'account', target_id: nequi.id, name: 'Nequi', delta: -60_000 },
    ])

    // «Solo guardar»: el movimiento cambia, los saldos no, y lo anotado sigue siendo lo real
    await db.updateTransaction(tx.id, { payment_method: 'Nequi' })
    expect(await balanceOf(sobre.id)).toBe(240_000)
    expect(await balanceOf(nequi.id)).toBe(100_000)
    await db.undoCreateTransaction(tx.id)
    expect(await balanceOf(sobre.id)).toBe(300_000)
  })

  it('editar un movimiento de antes de esta versión avisa que no se sabe si ya se descontó', async () => {
    await db.createAccount({ name: 'Sobre', balance: 300_000, color: '#fff' })
    const tx = await db.createTransaction(expense({ amount: 50_000, payment_method: 'Sobre' }))
    raw.run('DELETE FROM balance_moves')
    const plan = await db.planBalanceUpdate(tx.id, { amount: 60_000 })
    expect(plan.untracked).toEqual(['Sobre'])
    expect(plan.moves.map((m) => m.delta)).toEqual([-60_000])
  })

  it('eliminar no toca saldos y restaurar trae de vuelta la anotación', async () => {
    const acc = await db.createAccount({ name: 'Sobre', balance: 300_000, color: '#fff' })
    const tx = await db.createTransaction(expense({ amount: 50_000, payment_method: 'Sobre' }))
    const snap = await db.deleteWithSnapshot('transaction', tx.id)
    expect(await balanceOf(acc.id)).toBe(250_000)
    expect(scalar('SELECT COUNT(*) FROM balance_moves')).toBe(0)
    await db.restoreSnapshot(snap)
    await db.undoCreateTransaction(tx.id)
    expect(await balanceOf(acc.id)).toBe(300_000)
  })
})

describe('respaldo: exportar e importar', () => {
  const v1Backup = (): BackupData => ({
    version: 1,
    app: 'flux-finance',
    exported_at: '2026-09-30T12:00:00.000Z',
    transactions: [
      { id: 4, amount: 100000, type: 'expense', category: 'Otro', description: 'Pago a un amigo', payment_method: 'Nequi', date: '2026-09-26', created_at: '2026-09-26 11:00:00' },
    ],
    installments: [
      { id: 3, name: 'Crédito de consumo', total_amount: 4800000, total_months: 48, paid_months: 7, monthly_amount: 100000, next_due_date: '2026-09-22', notes: null, created_at: '2026-02-01 10:00:00' },
    ],
    installment_payments: [{ id: 1, installment_id: 3, paid_date: '2026-08-22', amount: 100000 }],
    goals: [],
    credit_cards: [],
    budgets: [{ id: 1, category: 'Alimentación', monthly_limit: 900000 }],
    debts: [],
  })

  it('importa un respaldo del Lukas anterior (sin cuentas, fijos ni secciones nuevas)', async () => {
    await db.createTransaction(expense())
    await db.setReminder('debt', 1, { days_before: 1 })

    await db.importBackup(v1Backup())

    expect(await db.listTransactions()).toEqual([expect.objectContaining({ id: 4, description: 'Pago a un amigo', amount: 100000 })])
    expect(await db.listInstallments()).toEqual([expect.objectContaining({ id: 3, paid_months: 7 })])
    expect(await db.listBudgets()).toEqual([expect.objectContaining({ category: 'Alimentación', monthly_limit: 900000 })])
    expect(await db.listReminders()).toEqual([])
    expect(await db.listAccounts()).toEqual([])
  })

  it('si el archivo está dañado no importa nada y los datos actuales quedan intactos', async () => {
    const mine = await db.createTransaction(expense({ description: 'lo mío' }))
    const bad = v1Backup()
    ;(bad.installments[0] as unknown as Record<string, unknown>).monthly_amount = 'x'

    await expect(db.importBackup(bad)).rejects.toThrow('No se importó nada')
    await expect(db.importBackup({ app: 'otra' } as unknown as BackupData)).rejects.toThrow('no es un respaldo')
    expect(await db.listTransactions()).toEqual([mine])
  })

  it('exporta todo, vuelve a importarlo igual y sigue siendo legible por el Lukas anterior', async () => {
    await db.createAccount({ name: 'Nequi', balance: 500_000, color: '#3b82f6' })
    await db.createTransaction(expense({ payment_method: 'Nequi' }))
    await db.upsertBudget('Alimentación', 900_000)
    const rec = await db.createRecurring({ name: 'Arriendo', amount: 900_000, category: 'Servicios', payment_method: null, day: 1 })
    await db.postRecurring(rec.id)
    await db.setReminder('recurring', rec.id, { days_before: 2, snoozed_until: '2026-12-01' })

    const backup = await db.exportBackup()
    expect(backup).toMatchObject({ version: 1, app: 'flux-finance', schema_version: SCHEMA_VERSION })
    expect(backup.budgets).toHaveLength(1)
    expect(backup.payment_log).toHaveLength(1)
    expect(backup.reminders).toHaveLength(1)
    expect(backup.balance_moves).toHaveLength(1)

    // El importador viejo inserta columna por columna: no puede haber columnas nuevas en sus tablas
    for (const table of ORIGINAL_TABLES) {
      for (const row of (backup as unknown as Record<string, Record<string, unknown>[]>)[table]) {
        expect(Object.keys(row).every((c) => TABLE_COLUMNS[table].includes(c))).toBe(true)
      }
    }

    await open() // base nueva y vacía
    await db.importBackup(JSON.parse(JSON.stringify(backup)))
    expect({ ...(await db.exportBackup()), exported_at: '' }).toEqual({ ...backup, exported_at: '' })
  })
})
