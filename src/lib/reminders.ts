import type { Debt, Installment, Recurring, ReminderKind, ReminderSetting } from '@/types'
import { addMonths, currentMonth, daysInMonth, daysUntil, parseISODate, today as todayStr } from './dates'

/**
 * Recordatorios de cuotas, deudas y pagos fijos. Funciones puras.
 *
 * Un recordatorio está "activo" cuando faltan N días o menos para el vencimiento
 * (o ya venció), el registro sigue sin pagarse y no está pospuesto.
 */

export interface DueItem {
  kind: ReminderKind
  id: number
  title: string
  amount: number
  /** 'YYYY-MM-DD' */
  dueDate: string
  /** Días que faltan (negativo = vencido) */
  daysLeft: number
  /** Solo deudas: true si es plata que me deben */
  owedToMe?: boolean
}

export interface ReminderDefaults {
  enabled: boolean
  daysBefore: number
}

export interface ActiveReminder extends DueItem {
  /** Anticipación aplicada a este registro */
  daysBefore: number
}

export function reminderKey(kind: ReminderKind, id: number): string {
  return `${kind}:${id}`
}

/** Fecha del día `day` dentro del mes 'YYYY-MM', ajustada si el mes es más corto. */
function dayInMonth(month: string, day: number): string {
  const d = Math.min(Math.max(day, 1), daysInMonth(month))
  return `${month}-${String(d).padStart(2, '0')}`
}

/** Próximo vencimiento de un pago fijo: el de este mes si no se ha pagado; si no, el del siguiente. */
export function nextRecurringDue(rec: Recurring, now: Date = new Date()): string {
  const month = currentMonth(now)
  if (rec.last_posted !== month) return dayInMonth(month, rec.day)
  const next = addMonths(`${month}-01`, 1).slice(0, 7)
  return dayInMonth(next, rec.day)
}

/** Todo lo que tiene fecha de vencimiento y sigue sin pagar, ordenado por urgencia. */
export function collectDueItems(
  data: { installments: Installment[]; debts: Debt[]; recurring: Recurring[] },
  now: Date = new Date(),
): DueItem[] {
  const items: DueItem[] = []

  for (const i of data.installments) {
    if (i.paid_months >= i.total_months || !i.next_due_date) continue
    items.push({
      kind: 'installment', id: i.id, title: i.name, amount: i.monthly_amount,
      dueDate: i.next_due_date, daysLeft: daysUntil(i.next_due_date, now),
    })
  }

  for (const d of data.debts) {
    if (d.paid === 1 || !d.due_date) continue
    items.push({
      kind: 'debt', id: d.id, title: d.person, amount: d.amount,
      dueDate: d.due_date, daysLeft: daysUntil(d.due_date, now), owedToMe: d.type === 'owed_to_me',
    })
  }

  for (const r of data.recurring) {
    const due = nextRecurringDue(r, now)
    items.push({
      kind: 'recurring', id: r.id, title: r.name, amount: r.amount,
      dueDate: due, daysLeft: daysUntil(due, now),
    })
  }

  return items.sort((a, b) => a.daysLeft - b.daysLeft)
}

/** ¿Está pospuesto hoy? (vuelve a avisar a partir de `snoozed_until`) */
export function isSnoozed(setting: ReminderSetting | undefined, now: Date = new Date()): boolean {
  if (!setting?.snoozed_until) return false
  return parseISODate(setting.snoozed_until).getTime() > parseISODate(todayStr(now)).getTime()
}

export function activeReminders(
  items: DueItem[],
  settings: ReminderSetting[],
  defaults: ReminderDefaults,
  now: Date = new Date(),
): ActiveReminder[] {
  const byKey = new Map(settings.map((s) => [reminderKey(s.kind, s.item_id), s]))
  const out: ActiveReminder[] = []

  for (const item of items) {
    const setting = byKey.get(reminderKey(item.kind, item.id))
    const enabled = setting ? setting.enabled === 1 : defaults.enabled
    if (!enabled) continue
    if (isSnoozed(setting, now)) continue
    const daysBefore = setting?.days_before ?? defaults.daysBefore
    if (item.daysLeft <= daysBefore) out.push({ ...item, daysBefore })
  }
  return out
}

/** "vence hoy", "vence en 3 días", "venció hace 2 días" */
export function dueLabel(daysLeft: number): string {
  if (daysLeft === 0) return 'vence hoy'
  if (daysLeft === 1) return 'vence mañana'
  if (daysLeft > 1) return `vence en ${daysLeft} días`
  if (daysLeft === -1) return 'venció ayer'
  return `venció hace ${Math.abs(daysLeft)} días`
}

export function kindLabel(kind: ReminderKind): string {
  if (kind === 'installment') return 'Cuota'
  if (kind === 'debt') return 'Deuda'
  return 'Pago fijo'
}
