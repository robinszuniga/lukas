import { describe, expect, it } from 'vitest'
import type { Budget, Debt, Installment, Recurring, ReminderSetting } from '@/types'
import { addDays, addMonths, currentMonth, daysInMonth, daysUntil, previousMonth, today, toISODate } from './dates'
import { buildBudgetLines, budgetState, budgetTotals } from './budgets'
import { compareTotals, projectBalance } from './insights'
import { activeReminders, collectDueItems, dueLabel, isSnoozed, nextRecurringDue } from './reminders'
import { daysToNextPayday } from './paydays'

describe('fechas en hora local', () => {
  it('a las 11 p. m. "hoy" sigue siendo hoy (antes saltaba a mañana por usar UTC)', () => {
    const late = new Date(2026, 9, 4, 23, 30)
    expect(today(late)).toBe('2026-10-04')
    expect(currentMonth(late)).toBe('2026-10')
    const lastNight = new Date(2026, 9, 31, 23, 59)
    expect(currentMonth(lastNight)).toBe('2026-10')
  })

  it('calcula mes anterior, días del mes y sumas', () => {
    expect(previousMonth('2026-01')).toBe('2025-12')
    expect(previousMonth('2026-10')).toBe('2026-09')
    expect(daysInMonth('2026-02')).toBe(28)
    expect(daysInMonth('2028-02')).toBe(29)
    expect(addDays('2026-10-30', 3)).toBe('2026-11-02')
    expect(addDays('2026-10-04', -13)).toBe('2026-09-21')
    expect(toISODate(new Date(2026, 0, 5))).toBe('2026-01-05')
  })

  it('sumar un mes no se salta al siguiente cuando el día no existe', () => {
    expect(addMonths('2026-01-31', 1)).toBe('2026-02-28')
    expect(addMonths('2026-09-22', 1)).toBe('2026-10-22')
    expect(addMonths('2026-12-15', 1)).toBe('2027-01-15')
  })

  it('cuenta días hasta una fecha sin importar la hora', () => {
    const now = new Date(2026, 9, 4, 22, 0)
    expect(daysUntil('2026-10-04', now)).toBe(0)
    expect(daysUntil('2026-10-07', now)).toBe(3)
    expect(daysUntil('2026-09-22', now)).toBe(-12)
  })

  it('días hasta el próximo pago', () => {
    expect(daysToNextPayday([15, 30], new Date(2026, 9, 4))).toBe(11)
    expect(daysToNextPayday([15, 30], new Date(2026, 9, 15))).toBe(0)
    expect(daysToNextPayday([15, 30], new Date(2026, 9, 31))).toBe(15)
    expect(daysToNextPayday([], new Date(2026, 9, 4))).toBe(-1)
  })
})

describe('presupuestos', () => {
  const budgets: Budget[] = [
    { id: 1, category: 'Alimentación', monthly_limit: 1_000_000 },
    { id: 2, category: 'Transporte', monthly_limit: 200_000 },
    { id: 3, category: 'Salud', monthly_limit: 500_000 },
  ]

  it('clasifica dentro, cerca (80 %) y pasado del límite', () => {
    expect(budgetState(100, 1000)).toBe('ok')
    expect(budgetState(799, 1000)).toBe('ok')
    expect(budgetState(800, 1000)).toBe('near')
    expect(budgetState(1000, 1000)).toBe('near')
    expect(budgetState(1001, 1000)).toBe('over')
  })

  it('calcula gastado, restante y ordena primero lo urgente', () => {
    const lines = buildBudgetLines(budgets, [
      { category: 'Alimentación', total: 850_000 },
      { category: 'Transporte', total: 260_000 },
      { category: 'Ropa', total: 90_000 }, // sin presupuesto: se ignora
    ])
    expect(lines.map((l) => l.category)).toEqual(['Transporte', 'Alimentación', 'Salud'])
    expect(lines[0]).toMatchObject({ state: 'over', spent: 260_000, remaining: -60_000 })
    expect(lines[1]).toMatchObject({ state: 'near', remaining: 150_000 })
    expect(lines[2]).toMatchObject({ state: 'ok', spent: 0, remaining: 500_000 })

    const totals = budgetTotals(lines)
    expect(totals).toMatchObject({ limit: 1_700_000, spent: 1_110_000, remaining: 590_000, near: 1, over: 1 })
  })

  it('ignora límites en cero', () => {
    expect(buildBudgetLines([{ id: 9, category: 'Otro', monthly_limit: 0 }], [])).toEqual([])
  })
})

describe('comparación con el mes anterior', () => {
  it('calcula variación y dirección', () => {
    expect(compareTotals(1_200_000, 1_000_000)).toMatchObject({ pct: 20, direction: 'up', delta: 200_000 })
    expect(compareTotals(800_000, 1_000_000)).toMatchObject({ pct: -20, direction: 'down' })
    expect(compareTotals(1_000_000, 1_000_000)).toMatchObject({ pct: 0, direction: 'same' })
  })

  it('sin datos del periodo anterior no inventa un porcentaje', () => {
    expect(compareTotals(500_000, 0)).toBeNull()
    expect(compareTotals(0, 0)).toBeNull()
  })
})

describe('proyección hasta el próximo pago', () => {
  const base = { hasIncome: true, free: 1_000_000, daysToPayday: 10, windowSpend: 700_000, windowCount: 12, historyDays: 40 }

  it('resta el gasto diario promedio por los días que faltan', () => {
    const p = projectBalance(base)
    expect(p).toEqual({ status: 'ok', projected: 500_000, avgDaily: 50_000, windowDays: 14, daysToPayday: 10 })
  })

  it('con poco historial promedia solo los días que existen', () => {
    const p = projectBalance({ ...base, historyDays: 8, windowSpend: 400_000 })
    expect(p).toMatchObject({ status: 'ok', avgDaily: 50_000, windowDays: 8, projected: 500_000 })
  })

  it('el día de pago la proyección es el saldo libre', () => {
    expect(projectBalance({ ...base, daysToPayday: 0 })).toMatchObject({ status: 'ok', projected: 1_000_000 })
  })

  it.each([
    ['sin ingreso', { hasIncome: false }],
    ['sin días de pago', { daysToPayday: -1 }],
    ['menos de 7 días de historial', { historyDays: 3 }],
    ['menos de 3 gastos', { windowCount: 2 }],
    ['sin ningún gasto', { historyDays: 0, windowCount: 0, windowSpend: 0 }],
  ])('no proyecta %s', (_name, patch) => {
    const p = projectBalance({ ...base, ...patch })
    expect(p.status).toBe('insufficient')
    if (p.status === 'insufficient') expect(p.reason.length).toBeGreaterThan(10)
  })
})

describe('recordatorios', () => {
  const now = new Date(2026, 9, 4, 10, 0) // 4 de octubre de 2026

  const installments: Installment[] = [
    { id: 1, name: 'Préstamo', total_amount: 1000, total_months: 10, paid_months: 3, monthly_amount: 100, next_due_date: '2026-10-06', notes: null, created_at: '' },
    { id: 2, name: 'Terminada', total_amount: 1000, total_months: 10, paid_months: 10, monthly_amount: 100, next_due_date: '2026-10-05', notes: null, created_at: '' },
    { id: 3, name: 'Vencida', total_amount: 1000, total_months: 10, paid_months: 1, monthly_amount: 100, next_due_date: '2026-09-22', notes: null, created_at: '' },
  ]
  const debts: Debt[] = [
    { id: 1, person: 'Ana', amount: 500, type: 'i_owe', description: null, due_date: '2026-10-05', paid: 0, created_at: '' },
    { id: 2, person: 'Pagada', amount: 500, type: 'i_owe', description: null, due_date: '2026-10-05', paid: 1, created_at: '' },
    { id: 3, person: 'Sin fecha', amount: 500, type: 'owed_to_me', description: null, due_date: null, paid: 0, created_at: '' },
  ]
  const recurring: Recurring[] = [
    { id: 1, name: 'Arriendo', amount: 900, category: 'Servicios', payment_method: null, day: 20, last_posted: null, created_at: '' },
    { id: 2, name: 'Gym', amount: 80, category: 'Salud', payment_method: null, day: 2, last_posted: '2026-10', created_at: '' },
    { id: 3, name: 'Internet', amount: 90, category: 'Servicios', payment_method: null, day: 31, last_posted: '2026-09', created_at: '' },
  ]

  it('junta lo que vence y lo ordena por urgencia; ignora lo pagado o sin fecha', () => {
    const items = collectDueItems({ installments, debts, recurring }, now)
    expect(items.map((i) => `${i.kind}:${i.id}:${i.daysLeft}`)).toEqual([
      'installment:3:-12',
      'debt:1:1',
      'installment:1:2',
      'recurring:1:16',
      'recurring:3:27',
      'recurring:2:29',
    ])
  })

  it('un fijo ya pagado este mes vence el mes siguiente; el día se ajusta a meses cortos', () => {
    expect(nextRecurringDue(recurring[1], now)).toBe('2026-11-02')
    expect(nextRecurringDue(recurring[2], now)).toBe('2026-10-31')
    expect(nextRecurringDue({ ...recurring[2], last_posted: null }, new Date(2026, 1, 10))).toBe('2026-02-28')
  })

  it('avisa según la anticipación general, la propia de cada registro y lo pospuesto', () => {
    const items = collectDueItems({ installments, debts, recurring }, now)
    const defaults = { enabled: true, daysBefore: 3 }

    expect(activeReminders(items, [], defaults, now).map((r) => `${r.kind}:${r.id}`))
      .toEqual(['installment:3', 'debt:1', 'installment:1'])

    const settings: ReminderSetting[] = [
      { id: 1, kind: 'recurring', item_id: 1, enabled: 1, days_before: 20, snoozed_until: null }, // anticipación propia
      { id: 2, kind: 'debt', item_id: 1, enabled: 0, days_before: null, snoozed_until: null },      // silenciado
      { id: 3, kind: 'installment', item_id: 3, enabled: 1, days_before: null, snoozed_until: '2026-10-06' }, // pospuesto
    ]
    expect(activeReminders(items, settings, defaults, now).map((r) => `${r.kind}:${r.id}`))
      .toEqual(['installment:1', 'recurring:1'])

    // Al llegar la fecha, lo pospuesto vuelve a avisar
    const later = new Date(2026, 9, 6, 9, 0)
    expect(isSnoozed(settings[2], later)).toBe(false)
    expect(isSnoozed(settings[2], now)).toBe(true)
  })

  it('con los recordatorios apagados no avisa nada', () => {
    const items = collectDueItems({ installments, debts, recurring }, now)
    expect(activeReminders(items, [], { enabled: false, daysBefore: 3 }, now)).toEqual([])
  })

  it('describe el vencimiento en palabras', () => {
    expect(dueLabel(0)).toBe('vence hoy')
    expect(dueLabel(1)).toBe('vence mañana')
    expect(dueLabel(5)).toBe('vence en 5 días')
    expect(dueLabel(-1)).toBe('venció ayer')
    expect(dueLabel(-12)).toBe('venció hace 12 días')
  })
})
