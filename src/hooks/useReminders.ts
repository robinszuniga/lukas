import { useMemo } from 'react'
import type { Debt, Installment, Recurring, ReminderKind, ReminderSetting } from '@/types'
import { db } from '@/lib/db'
import { addDays, today } from '@/lib/dates'
import { activeReminders, collectDueItems, isSnoozed, reminderKey } from '@/lib/reminders'
import { usePrefs } from './usePrefs'
import { useDbQuery } from './useDbQuery'

interface Loaded {
  installments: Installment[]
  debts: Debt[]
  recurring: Recurring[]
  settings: ReminderSetting[]
}

const EMPTY: Loaded = { installments: [], debts: [], recurring: [], settings: [] }

/** Recordatorios: qué vence pronto, qué está pospuesto y cómo cambiar la configuración. */
export function useReminders() {
  const prefs = usePrefs()
  const { data, loading } = useDbQuery(async (): Promise<Loaded> => {
    const [installments, debts, recurring, settings] = await Promise.all([
      db.listInstallments(), db.listDebts(), db.listRecurring(), db.listReminders(),
    ])
    return { installments, debts, recurring, settings }
  }, EMPTY)

  const computed = useMemo(() => {
    const now = new Date()
    const dueItems = collectDueItems(data, now)
    const active = activeReminders(dueItems, data.settings, { enabled: prefs.remindersEnabled, daysBefore: prefs.reminderDays }, now)
    const byKey = new Map(data.settings.map((s) => [reminderKey(s.kind, s.item_id), s]))
    return { dueItems, active, byKey, now }
  }, [data, prefs.remindersEnabled, prefs.reminderDays])

  return {
    loading,
    /** Todo lo que tiene vencimiento y sigue sin pagar */
    dueItems: computed.dueItems,
    /** Lo que hay que avisar hoy */
    active: computed.active,
    isActive: (kind: ReminderKind, id: number) => computed.active.some((r) => r.kind === kind && r.id === id),
    settingFor: (kind: ReminderKind, id: number) => computed.byKey.get(reminderKey(kind, id)),
    isSnoozed: (kind: ReminderKind, id: number) => isSnoozed(computed.byKey.get(reminderKey(kind, id)), computed.now),
    /** Pospone el aviso `days` días a partir de hoy */
    snooze: (kind: ReminderKind, id: number, days: number) =>
      db.setReminder(kind, id, { snoozed_until: addDays(today(), days) }),
    clearSnooze: (kind: ReminderKind, id: number) => db.setReminder(kind, id, { snoozed_until: null }),
    setReminder: (
      kind: ReminderKind,
      id: number,
      patch: Partial<Pick<ReminderSetting, 'enabled' | 'days_before' | 'snoozed_until'>>,
    ) => db.setReminder(kind, id, patch),
  }
}
