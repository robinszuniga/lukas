import { useState } from 'react'
import { Plus } from 'lucide-react'
import { Header } from '@/components/layout/Header'
import { InstallmentCard } from '@/components/installments/InstallmentCard'
import { InstallmentForm } from '@/components/installments/InstallmentForm'
import { DebtCard } from '@/components/debts/DebtCard'
import { DebtForm } from '@/components/debts/DebtForm'
import { RecurringCard } from '@/components/recurring/RecurringCard'
import { RecurringForm } from '@/components/recurring/RecurringForm'
import { ReminderDialog, type ReminderState } from '@/components/reminders/ReminderDialog'
import { useInstallments } from '@/hooks/useInstallments'
import { useRecurring } from '@/hooks/useRecurring'
import { useDebts, useLastPayments } from '@/hooks/useLists'
import { useReminders } from '@/hooks/useReminders'
import { usePrefs } from '@/hooks/usePrefs'
import { useDeleteWithUndo } from '@/hooks/useDeleteWithUndo'
import { usePaymentActions } from '@/hooks/usePaymentActions'
import { formatCOP } from '@/lib/currency'
import { formatDate } from '@/lib/dates'
import { nextRecurringDue } from '@/lib/reminders'
import { tabClass } from '@/components/ui/styles'
import type { Debt, Installment, Recurring, ReminderKind } from '@/types'

type Tab = 'installments' | 'debts' | 'recurring'

interface ReminderTarget {
  kind: ReminderKind
  id: number
  name: string
  dueDate: string | null
}

export function Pagos() {
  const [tab, setTab] = useState<Tab>('installments')
  const [showForm, setShowForm] = useState(false)
  const [editingInstallment, setEditingInstallment] = useState<Installment | null>(null)
  const [editingDebt, setEditingDebt] = useState<Debt | null>(null)
  const [editingRecurring, setEditingRecurring] = useState<Recurring | null>(null)
  const [reminderTarget, setReminderTarget] = useState<ReminderTarget | null>(null)

  const { installments, loading, createInstallment, updateInstallment, updateInstallmentAmount } = useInstallments()
  const { debts, loading: debtsLoading, createDebt, updateDebt } = useDebts()
  const { recurring, pending: pendingRecurring, loading: recLoading, createRecurring, updateRecurring } = useRecurring()
  const { lastPayment } = useLastPayments()
  const reminders = useReminders()
  const prefs = usePrefs()
  const confirmDelete = useDeleteWithUndo()

  const active = installments.filter((i) => i.paid_months < i.total_months)
  const completed = installments.filter((i) => i.paid_months >= i.total_months)
  const totalMonthly = active.reduce((sum, i) => sum + i.monthly_amount, 0)

  const pendingDebts = debts.filter((d) => d.paid === 0)
  const paidDebts = debts.filter((d) => d.paid === 1)
  const totalOwedToMe = pendingDebts.filter((d) => d.type === 'owed_to_me').reduce((s, d) => s + d.amount, 0)
  const totalIOwe = pendingDebts.filter((d) => d.type === 'i_owe').reduce((s, d) => s + d.amount, 0)
  const totalRecurring = recurring.reduce((s, r) => s + r.amount, 0)

  const reminderState = (kind: ReminderKind, id: number): ReminderState => {
    const setting = reminders.settingFor(kind, id)
    return {
      enabled: setting ? setting.enabled === 1 : prefs.remindersEnabled,
      active: reminders.isActive(kind, id),
      snoozed: reminders.isSnoozed(kind, id),
    }
  }

  // Marcar pagado y deshacer: misma lógica que en la pantalla Hoy
  const {
    payInstallment: handlePayInstallment,
    undoInstallment: handleUndoInstallment,
    postRecurring: handlePostRecurring,
    undoRecurring: handleUndoRecurring,
    toggleDebt: handleToggleDebt,
  } = usePaymentActions()

  // ── Eliminar con confirmación y deshacer ──────────────────────────────────
  const deleteInstallment = (inst: Installment) => confirmDelete({
    kind: 'installment',
    id: inst.id,
    title: '¿Eliminar esta cuota?',
    details: [
      { label: 'Cuota', value: inst.name },
      { label: 'Avance', value: `${inst.paid_months} de ${inst.total_months} cuotas` },
      { label: 'Mensual', value: formatCOP(inst.monthly_amount) },
    ],
    note: 'También se elimina su historial de pagos. Podrás deshacerlo justo después.',
    doneMessage: `Cuota ${inst.name} eliminada`,
  })

  const deleteDebt = (debt: Debt) => confirmDelete({
    kind: 'debt',
    id: debt.id,
    title: '¿Eliminar esta deuda?',
    details: [
      { label: debt.type === 'owed_to_me' ? 'Me debe' : 'Le debo a', value: debt.person },
      { label: 'Monto', value: formatCOP(debt.amount) },
      ...(debt.due_date ? [{ label: 'Fecha límite', value: formatDate(debt.due_date) }] : []),
    ],
    doneMessage: `Deuda de ${debt.person} eliminada`,
  })

  const deleteRecurring = (item: Recurring) => confirmDelete({
    kind: 'recurring',
    id: item.id,
    title: '¿Eliminar este pago fijo?',
    details: [
      { label: 'Pago fijo', value: item.name },
      { label: 'Monto mensual', value: formatCOP(item.amount) },
      { label: 'Día', value: `Cada día ${item.day}` },
    ],
    note: 'Los gastos que ya registró en el historial no se eliminan. Podrás deshacerlo justo después.',
    doneMessage: `Pago fijo ${item.name} eliminado`,
  })

  const TITLES: Record<Tab, [string, string, string]> = {
    installments: ['Cuotas', 'Seguimiento de pagos mensuales', 'Nueva cuota'],
    debts: ['Deudas', 'Me deben y yo debo', 'Nueva deuda'],
    recurring: ['Pagos fijos', 'Arriendo, gym, suscripciones…', 'Nuevo pago fijo'],
  }

  const renderInstallment = (inst: Installment) => (
    <InstallmentCard
      key={inst.id}
      installment={inst}
      lastPayment={lastPayment('installment', inst.id)}
      reminder={reminderState('installment', inst.id)}
      onPay={handlePayInstallment}
      onUndoPay={handleUndoInstallment}
      onEdit={setEditingInstallment}
      onDelete={deleteInstallment}
      onUpdateAmount={updateInstallmentAmount}
      onReminder={(i) => setReminderTarget({ kind: 'installment', id: i.id, name: i.name, dueDate: i.next_due_date })}
    />
  )

  const renderDebt = (debt: Debt) => (
    <DebtCard
      key={debt.id}
      debt={debt}
      reminder={reminderState('debt', debt.id)}
      onTogglePaid={handleToggleDebt}
      onEdit={setEditingDebt}
      onDelete={deleteDebt}
      onReminder={(d) => setReminderTarget({ kind: 'debt', id: d.id, name: d.person, dueDate: d.due_date })}
    />
  )

  return (
    <div className="px-4 pt-4">
      <Header
        title={TITLES[tab][0]}
        subtitle={TITLES[tab][1]}
        showMonth={false}
        right={
          <button
            type="button"
            onClick={() => setShowForm(true)}
            aria-label={TITLES[tab][2]}
            className="inline-flex items-center gap-1.5 bg-indigo-600 hover:bg-indigo-500 text-white text-sm px-3 py-2 rounded-lg transition-colors"
          >
            <Plus size={16} aria-hidden="true" />
            <span className="hidden sm:inline">{TITLES[tab][2]}</span>
          </button>
        }
      />

      <div role="group" aria-label="Tipo de pago" className="flex gap-1 mb-4 bg-bg-card border border-bg-border rounded-xl p-1 w-fit max-w-full">
        <button type="button" aria-pressed={tab === 'installments'} onClick={() => setTab('installments')} className={tabClass(tab === 'installments')}>
          Cuotas
        </button>
        <button type="button" aria-pressed={tab === 'debts'} onClick={() => setTab('debts')} className={tabClass(tab === 'debts')}>
          Deudas
          {pendingDebts.length > 0 && (
            <span className="ml-1.5 text-xs bg-bg-elevated text-gray-200 px-1.5 py-0.5 rounded-full">
              {pendingDebts.length}<span className="sr-only"> pendientes</span>
            </span>
          )}
        </button>
        <button type="button" aria-pressed={tab === 'recurring'} onClick={() => setTab('recurring')} className={tabClass(tab === 'recurring')}>
          Fijos
          {pendingRecurring.length > 0 && (
            <span className="ml-1.5 text-xs bg-accent-yellow/20 text-accent-yellow px-1.5 py-0.5 rounded-full">
              {pendingRecurring.length}<span className="sr-only"> pendientes este mes</span>
            </span>
          )}
        </button>
      </div>

      {/* ─── Cuotas ─── */}
      {tab === 'installments' && (
        <section aria-label="Cuotas">
          {active.length > 0 && (
            <p className="text-xs text-gray-400 mb-4">
              Compromiso mensual: <span className="text-accent-yellow font-medium">{formatCOP(totalMonthly)}</span>
            </p>
          )}

          {loading ? (
            <div className="space-y-4" aria-hidden="true">
              {[1, 2].map((i) => <div key={i} className="h-40 bg-bg-card border border-bg-border rounded-xl animate-pulse" />)}
            </div>
          ) : (
            <>
              {installments.length === 0 && (
                <div className="text-center py-16 text-gray-400">
                  <p className="text-4xl mb-3" aria-hidden="true">📋</p>
                  <p className="text-sm">Sin cuotas registradas</p>
                </div>
              )}
              {active.length > 0 && <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mb-6">{active.map(renderInstallment)}</div>}
              {completed.length > 0 && (
                <>
                  <h2 className="text-xs text-gray-400 mb-3">Completadas</h2>
                  <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">{completed.map(renderInstallment)}</div>
                </>
              )}
            </>
          )}
        </section>
      )}

      {/* ─── Deudas ─── */}
      {tab === 'debts' && (
        <section aria-label="Deudas">
          {pendingDebts.length > 0 && (
            <div className="flex flex-wrap gap-x-4 gap-y-1 mb-4 text-sm">
              <span className="text-gray-400">Me deben: <span className="text-accent-green font-medium">{formatCOP(totalOwedToMe)}</span></span>
              <span className="text-gray-400">Yo debo: <span className="text-rose-400 font-medium">{formatCOP(totalIOwe)}</span></span>
            </div>
          )}

          {debtsLoading ? (
            <div className="space-y-2" aria-hidden="true">
              {[1, 2, 3].map((i) => <div key={i} className="h-20 bg-bg-card border border-bg-border rounded-xl animate-pulse" />)}
            </div>
          ) : debts.length === 0 ? (
            <div className="text-center py-16 text-gray-400">
              <p className="text-4xl mb-3" aria-hidden="true">🤝</p>
              <p className="text-sm">Anota lo que te deben y lo que debes</p>
            </div>
          ) : (
            <div className="space-y-2">
              {pendingDebts.map(renderDebt)}
              {paidDebts.length > 0 && (
                <>
                  <h2 className="text-xs text-gray-400 pt-3 pb-1">Saldadas</h2>
                  {paidDebts.map(renderDebt)}
                </>
              )}
            </div>
          )}
        </section>
      )}

      {/* ─── Fijos ─── */}
      {tab === 'recurring' && (
        <section aria-label="Pagos fijos">
          {recurring.length > 0 && (
            <p className="text-xs text-gray-400 mb-4">
              Total fijo mensual: <span className="text-accent-yellow font-medium">{formatCOP(totalRecurring)}</span>
              {pendingRecurring.length > 0 && (
                <span className="ml-2 text-accent-yellow">· {pendingRecurring.length} pendiente{pendingRecurring.length === 1 ? '' : 's'} este mes</span>
              )}
            </p>
          )}

          {recLoading ? (
            <div className="space-y-2" aria-hidden="true">
              {[1, 2, 3].map((i) => <div key={i} className="h-20 bg-bg-card border border-bg-border rounded-xl animate-pulse" />)}
            </div>
          ) : recurring.length === 0 ? (
            <div className="text-center py-16 text-gray-400">
              <p className="text-4xl mb-3" aria-hidden="true">🔁</p>
              <p className="text-sm">Registra tus pagos fijos del mes</p>
              <p className="text-xs mt-1">Arriendo, gym, Netflix, plan del celular…</p>
            </div>
          ) : (
            <div className="space-y-2">
              {recurring.map((item) => (
                <RecurringCard
                  key={item.id}
                  item={item}
                  lastPayment={lastPayment('recurring', item.id)}
                  reminder={reminderState('recurring', item.id)}
                  onPost={handlePostRecurring}
                  onUndo={handleUndoRecurring}
                  onEdit={setEditingRecurring}
                  onDelete={deleteRecurring}
                  onReminder={(r) => setReminderTarget({ kind: 'recurring', id: r.id, name: r.name, dueDate: nextRecurringDue(r) })}
                />
              ))}
            </div>
          )}
        </section>
      )}

      {/* Formularios de creación */}
      {showForm && tab === 'installments' && (
        <InstallmentForm onSave={async (data) => { await createInstallment(data); setShowForm(false) }} onClose={() => setShowForm(false)} />
      )}
      {showForm && tab === 'debts' && (
        <DebtForm onSave={async (data) => { await createDebt(data); setShowForm(false) }} onClose={() => setShowForm(false)} />
      )}
      {showForm && tab === 'recurring' && (
        <RecurringForm onSave={async (data) => { await createRecurring(data); setShowForm(false) }} onClose={() => setShowForm(false)} />
      )}

      {/* Formularios de edición */}
      {editingInstallment && (
        <InstallmentForm
          initial={editingInstallment}
          onSave={async (data) => { await updateInstallment(editingInstallment.id, data); setEditingInstallment(null) }}
          onClose={() => setEditingInstallment(null)}
        />
      )}
      {editingDebt && (
        <DebtForm
          initial={editingDebt}
          onSave={async (data) => { await updateDebt(editingDebt.id, data); setEditingDebt(null) }}
          onClose={() => setEditingDebt(null)}
        />
      )}
      {editingRecurring && (
        <RecurringForm
          initial={editingRecurring}
          onSave={async (data) => { await updateRecurring(editingRecurring.id, data); setEditingRecurring(null) }}
          onClose={() => setEditingRecurring(null)}
        />
      )}

      {reminderTarget && (
        <ReminderDialog
          kind={reminderTarget.kind}
          name={reminderTarget.name}
          dueDate={reminderTarget.dueDate}
          setting={reminders.settingFor(reminderTarget.kind, reminderTarget.id)}
          defaults={{ enabled: prefs.remindersEnabled, daysBefore: prefs.reminderDays }}
          onSave={(patch) => reminders.setReminder(reminderTarget.kind, reminderTarget.id, patch)}
          onClose={() => setReminderTarget(null)}
        />
      )}
    </div>
  )
}
