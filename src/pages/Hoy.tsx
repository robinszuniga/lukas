import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { Settings, List, ChevronRight, CheckCircle2, Target, CreditCard, PiggyBank, BellRing, TrendingUp } from 'lucide-react'
import { Header } from '@/components/layout/Header'
import { BudgetBar } from '@/components/budgets/BudgetBar'
import { ReminderButton, ReminderDialog, type ReminderState } from '@/components/reminders/ReminderDialog'
import { useTransactions } from '@/hooks/useTransactions'
import { useInstallments } from '@/hooks/useInstallments'
import { useRecurring } from '@/hooks/useRecurring'
import { useCards, useDebts, useGoals } from '@/hooks/useLists'
import { useReminders } from '@/hooks/useReminders'
import { useInsights } from '@/hooks/useInsights'
import { useBudgetLines } from '@/hooks/useBudgetLines'
import { usePaymentActions } from '@/hooks/usePaymentActions'
import { usePrefs } from '@/hooks/usePrefs'
import { formatCOP } from '@/lib/currency'
import { currentMonth, daysInMonth, daysUntil, daysUntilBilling, formatDate, monthName } from '@/lib/dates'
import { daysToNextPayday } from '@/lib/paydays'
import { compareTotals, projectBalance, type Comparison } from '@/lib/insights'
import { dueLabel, kindLabel } from '@/lib/reminders'
import { iconButton } from '@/components/ui/styles'
import { CATEGORY_ICONS } from '@/types'
import type { Category, Debt, ReminderKind } from '@/types'

interface PendingItem {
  kind: ReminderKind
  id: number
  name: string
  amount: number
  icon: string
  /** 'YYYY-MM-DD' */
  dueDate: string
  daysLeft: number
  /** Se descuenta del saldo libre (cuotas y fijos sí; deudas no) */
  counts: boolean
  debt?: Debt
}

/** Variación frente al mismo tramo del mes anterior. */
function Delta({ comparison, upIsGood, prevLabel }: { comparison: Comparison | null; upIsGood: boolean; prevLabel: string }) {
  if (!comparison || comparison.pct === null) return null
  const { pct, direction } = comparison
  if (direction === 'same') {
    return <p className="text-[11px] text-gray-400">Sin cambio<span className="sr-only"> frente a {prevLabel}</span></p>
  }
  const good = direction === 'up' ? upIsGood : !upIsGood
  return (
    <p className={`text-[11px] ${good ? 'text-accent-green' : 'text-accent-yellow'}`}>
      <span aria-hidden="true">{direction === 'up' ? '▲' : '▼'} {Math.abs(pct)}%</span>
      <span className="sr-only">{Math.abs(pct)} por ciento {direction === 'up' ? 'más' : 'menos'} que en {prevLabel}</span>
    </p>
  )
}

export function Hoy() {
  const { summary, transactions, loading } = useTransactions()
  const { installments } = useInstallments()
  const { pending: pendingRecurring } = useRecurring()
  const { debts } = useDebts()
  const { cards } = useCards()
  const { goals } = useGoals()
  const reminders = useReminders()
  const insights = useInsights()
  const budget = useBudgetLines()
  const actions = usePaymentActions()
  const prefs = usePrefs()
  const [reminderTarget, setReminderTarget] = useState<PendingItem | null>(null)

  const now = new Date()
  const month = currentMonth(now)
  const todayDay = now.getDate()
  const endOfMonth = `${month}-${String(daysInMonth(month)).padStart(2, '0')}`

  // Pendientes del mes: fijos sin pagar, cuotas que vencen este mes y deudas con recordatorio activo
  const pendingItems: PendingItem[] = useMemo(() => {
    const items: PendingItem[] = []

    for (const r of pendingRecurring) {
      const day = Math.min(r.day, daysInMonth(month))
      items.push({
        kind: 'recurring', id: r.id, name: r.name, amount: r.amount,
        icon: CATEGORY_ICONS[r.category as Category] ?? '🔁',
        dueDate: `${month}-${String(day).padStart(2, '0')}`,
        daysLeft: day - todayDay,
        counts: true,
      })
    }

    for (const i of installments) {
      if (i.paid_months >= i.total_months || !i.next_due_date || i.next_due_date > endOfMonth) continue
      items.push({
        kind: 'installment', id: i.id, name: i.name, amount: i.monthly_amount,
        icon: '📋', dueDate: i.next_due_date, daysLeft: daysUntil(i.next_due_date), counts: true,
      })
    }

    for (const d of debts) {
      if (d.paid === 1 || !d.due_date || !reminders.isActive('debt', d.id)) continue
      items.push({
        kind: 'debt', id: d.id, name: d.person, amount: d.amount,
        icon: d.type === 'owed_to_me' ? '🤝' : '💸',
        dueDate: d.due_date, daysLeft: daysUntil(d.due_date), counts: false, debt: d,
      })
    }

    return items.sort((a, b) => a.daysLeft - b.daysLeft)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pendingRecurring, installments, debts, reminders.active, month, todayDay, endOfMonth])

  const pendingTotal = pendingItems.filter((p) => p.counts).reduce((s, p) => s + p.amount, 0)
  const income = summary?.income ?? 0
  const expenses = summary?.expenses ?? 0
  const balance = income - expenses
  const free = balance - pendingTotal

  const days = daysToNextPayday(prefs.paydays, now)
  const perDay = days > 0 ? Math.floor(Math.max(free, 0) / days) : Math.max(free, 0)

  // Comparación con el mismo tramo del mes anterior y proyección
  const prevLabel = monthName(insights.previousMonth)
  const incomeDelta = compareTotals(insights.current.income, insights.previous.income)
  const expenseDelta = compareTotals(insights.current.expenses, insights.previous.expenses)
  const hasPrevious = insights.previous.income > 0 || insights.previous.expenses > 0

  const projection = projectBalance({
    hasIncome: income > 0,
    free,
    daysToPayday: days,
    windowSpend: insights.stats.total,
    windowCount: insights.stats.count,
    historyDays: insights.historyDays,
  })

  const reminderState = (item: PendingItem): ReminderState => {
    const setting = reminders.settingFor(item.kind, item.id)
    return {
      enabled: setting ? setting.enabled === 1 : prefs.remindersEnabled,
      active: reminders.isActive(item.kind, item.id),
      snoozed: reminders.isSnoozed(item.kind, item.id),
    }
  }

  const pay = (item: PendingItem) => {
    if (item.kind === 'recurring') return actions.postRecurring(item)
    if (item.kind === 'installment') return actions.payInstallment(item)
    if (item.debt) return actions.toggleDebt(item.debt)
  }

  const sortedCards = [...cards]
    .filter((c) => c.billing_day)
    .sort((a, b) => daysUntilBilling(a.billing_day!) - daysUntilBilling(b.billing_day!))

  const activeGoals = goals.filter((g) => g.saved_amount < g.target_amount)
  const recent = transactions.slice(0, 4)
  const activeCount = pendingItems.filter((p) => reminders.isActive(p.kind, p.id)).length
  const budgetPreview = budget.lines.slice(0, 3)

  return (
    <div className="px-4 pt-4">
      <Header
        title="Hoy"
        right={
          <>
            <Link to="/historial" className={iconButton} aria-label="Historial de movimientos">
              <List size={20} aria-hidden="true" />
            </Link>
            <Link to="/ajustes" className={iconButton} aria-label="Ajustes">
              <Settings size={20} aria-hidden="true" />
            </Link>
          </>
        }
      />

      {/* ─── Número principal ─── */}
      <section aria-labelledby="hoy-libre" className="bg-gradient-to-br from-bg-card to-bg-elevated border border-bg-border rounded-2xl p-5 mb-4">
        <div className="flex items-center justify-between gap-2 mb-1">
          <h2 id="hoy-libre" className="text-xs text-gray-400 uppercase tracking-wide">Libre hasta tu pago</h2>
          {days >= 0 && (
            <span className="text-[11px] text-indigo-200 bg-accent-indigo/20 px-2 py-0.5 rounded-full whitespace-nowrap">
              {days === 0 ? '¡Hoy es día de pago!' : `en ${days} día${days === 1 ? '' : 's'}`}
            </span>
          )}
        </div>
        {loading ? (
          <div className="h-10 w-48 bg-bg-elevated rounded animate-pulse my-1" aria-hidden="true" />
        ) : (
          <p className={`text-4xl font-bold tracking-tight ${free >= 0 ? 'text-accent-cyan' : 'text-rose-400'}`}>
            {formatCOP(free)}
          </p>
        )}
        <p className="text-xs text-gray-400 mt-1">
          {income === 0
            ? 'Registra tu ingreso del mes para ver cuánto te queda'
            : free < 0
              ? `Te faltan ${formatCOP(Math.abs(free))} para cubrir lo pendiente`
              : days > 0
                ? `Puedes gastar ~${formatCOP(perDay)} por día · ya descontados ${formatCOP(pendingTotal)} pendientes`
                : pendingTotal > 0
                  ? `Ya descontados ${formatCOP(pendingTotal)} de pendientes`
                  : 'Sin pendientes este mes'}
        </p>

        <dl className="grid grid-cols-3 gap-2 mt-4 pt-4 border-t border-bg-border">
          <div className="min-w-0">
            <dt className="text-[11px] text-gray-400">Ingresos</dt>
            <dd className="text-sm font-semibold text-accent-green truncate">{formatCOP(income)}</dd>
            <Delta comparison={incomeDelta} upIsGood prevLabel={prevLabel} />
          </div>
          <div className="min-w-0">
            <dt className="text-[11px] text-gray-400">Gastos</dt>
            <dd className="text-sm font-semibold text-white truncate">{formatCOP(expenses)}</dd>
            <Delta comparison={expenseDelta} upIsGood={false} prevLabel={prevLabel} />
          </div>
          <div className="min-w-0">
            <dt className="text-[11px] text-gray-400">Pendiente</dt>
            <dd className="text-sm font-semibold text-accent-yellow truncate">{formatCOP(pendingTotal)}</dd>
          </div>
        </dl>
        {!insights.loading && (
          <p className="text-[11px] text-gray-400 mt-2">
            {hasPrevious
              ? `Las flechas comparan con ${prevLabel} hasta el día ${insights.day}.`
              : `Aún no hay movimientos de ${prevLabel} para comparar.`}
          </p>
        )}

        <div className="mt-3 pt-3 border-t border-bg-border">
          <h3 className="text-[11px] text-gray-400 uppercase tracking-wide flex items-center gap-1">
            <TrendingUp size={11} aria-hidden="true" /> Proyección al día de pago
          </h3>
          {insights.loading || loading ? (
            <div className="h-5 w-32 bg-bg-elevated rounded animate-pulse mt-1" aria-hidden="true" />
          ) : projection.status === 'ok' ? (
            <>
              <p className={`text-lg font-semibold ${projection.projected >= 0 ? 'text-gray-100' : 'text-rose-400'}`}>
                {formatCOP(projection.projected)}
              </p>
              <details className="text-xs text-gray-400 mt-0.5">
                <summary className="cursor-pointer py-1 text-gray-200 w-fit">¿Cómo se calcula?</summary>
                <p className="mt-1">
                  Tu saldo libre de hoy ({formatCOP(free)}) menos tu gasto diario promedio de los últimos {projection.windowDays} días
                  ({formatCOP(projection.avgDaily)} al día, sin contar pagos fijos) por los {projection.daysToPayday} día{projection.daysToPayday === 1 ? '' : 's'} que
                  faltan para tu pago. Es una estimación y cambia cada vez que registras un movimiento.
                </p>
              </details>
            </>
          ) : (
            <p className="text-xs text-gray-400 mt-1">{projection.reason}</p>
          )}
        </div>
      </section>

      {/* ─── Pendientes y recordatorios ─── */}
      <section aria-labelledby="hoy-pendientes" className="bg-bg-card border border-bg-border rounded-2xl p-4 mb-4">
        <div className="flex items-center justify-between gap-2 mb-2">
          <h2 id="hoy-pendientes" className="text-sm font-medium text-gray-100">Pendientes del mes</h2>
          <Link to="/pagos" className="text-xs text-gray-400 flex items-center gap-0.5 py-1">
            Ver todo <ChevronRight size={12} aria-hidden="true" />
          </Link>
        </div>
        {activeCount > 0 && (
          <p role="status" className="text-xs text-accent-yellow flex items-center gap-1.5 mb-1">
            <BellRing size={12} aria-hidden="true" />
            {activeCount === 1 ? '1 recordatorio activo' : `${activeCount} recordatorios activos`}
          </p>
        )}
        {pendingItems.length === 0 ? (
          <p className="text-sm text-gray-400 flex items-center gap-2 py-1">
            <CheckCircle2 size={16} className="text-accent-green" aria-hidden="true" /> Nada pendiente. ¡Bien!
          </p>
        ) : (
          <ul className="divide-y divide-bg-border">
            {pendingItems.map((item) => {
              const state = reminderState(item)
              const overdue = item.daysLeft < 0
              return (
                <li key={`${item.kind}-${item.id}`} className="py-2.5">
                  <div className="flex items-center gap-3">
                    <span className="text-lg w-7 text-center shrink-0" aria-hidden="true">{item.icon}</span>
                    <p className="text-sm text-gray-100 truncate flex-1 min-w-0">{item.name}</p>
                    <span className="text-sm font-medium text-white shrink-0">{formatCOP(item.amount)}</span>
                  </div>
                  <div className="flex items-center justify-between gap-2 pl-10">
                    <p className={`text-xs min-w-0 truncate ${overdue ? 'text-rose-400' : state.active ? 'text-accent-yellow' : 'text-gray-400'}`}>
                      {item.debt ? (item.debt.type === 'owed_to_me' ? 'Me debe' : 'Le debo') : kindLabel(item.kind)}
                      {' · '}{dueLabel(item.daysLeft)}
                      {state.snoozed ? ' · pospuesto' : ''}
                    </p>
                    <div className="flex items-center gap-1 shrink-0">
                      <ReminderButton name={item.name} state={state} onClick={() => setReminderTarget(item)} />
                      <button
                        type="button"
                        onClick={() => pay(item)}
                        aria-label={item.kind === 'debt' ? `Marcar como saldada la deuda de ${item.name}` : `Pagar ${item.name}`}
                        className="text-xs font-medium text-accent-green border border-accent-green/40 bg-accent-green/10 active:bg-accent-green/20 px-3 py-2 rounded-lg"
                      >
                        {item.kind === 'debt' ? 'Saldar' : 'Pagar'}
                      </button>
                    </div>
                  </div>
                </li>
              )
            })}
          </ul>
        )}
        {pendingItems.some((p) => !p.counts) && (
          <p className="text-[11px] text-gray-400 mt-1">Las deudas aparecen como recordatorio; no se descuentan del saldo libre.</p>
        )}
      </section>

      {/* ─── Presupuestos ─── */}
      <section aria-labelledby="hoy-presupuestos" className="bg-bg-card border border-bg-border rounded-2xl p-4 mb-4">
        <div className="flex items-center justify-between gap-2 mb-2">
          <h2 id="hoy-presupuestos" className="text-sm font-medium text-gray-100 flex items-center gap-1.5">
            <PiggyBank size={14} className="text-gray-400" aria-hidden="true" /> Presupuestos
          </h2>
          <Link to="/presupuestos" className="text-xs text-gray-400 flex items-center gap-0.5 py-1">
            {budget.lines.length > 0 ? 'Ver todo' : 'Crear'} <ChevronRight size={12} aria-hidden="true" />
          </Link>
        </div>
        {budget.lines.length === 0 ? (
          <p className="text-xs text-gray-400">
            Pon un límite mensual por categoría y Lukas te avisa cuando te acerques.
          </p>
        ) : (
          <>
            {(budget.totals.over > 0 || budget.totals.near > 0) && (
              <p role="status" className="text-xs mb-2">
                {budget.totals.over > 0 && <span className="text-rose-400">{budget.totals.over} superado{budget.totals.over === 1 ? '' : 's'}</span>}
                {budget.totals.over > 0 && budget.totals.near > 0 && <span className="text-gray-400"> · </span>}
                {budget.totals.near > 0 && <span className="text-accent-yellow">{budget.totals.near} cerca del límite</span>}
              </p>
            )}
            <ul className="space-y-3">
              {budgetPreview.map((line) => (
                <li key={line.category}><BudgetBar line={line} compact /></li>
              ))}
            </ul>
            {budget.lines.length > budgetPreview.length && (
              <p className="text-[11px] text-gray-400 mt-2">y {budget.lines.length - budgetPreview.length} más</p>
            )}
          </>
        )}
      </section>

      {/* ─── Tarjetas ─── */}
      {sortedCards.length > 0 && (
        <section aria-labelledby="hoy-tarjetas" className="bg-bg-card border border-bg-border rounded-2xl p-4 mb-4">
          <div className="flex items-center justify-between gap-2 mb-2">
            <h2 id="hoy-tarjetas" className="text-sm font-medium text-gray-100 flex items-center gap-1.5">
              <CreditCard size={14} className="text-gray-400" aria-hidden="true" /> Tarjetas
            </h2>
            <Link to="/tarjetas" className="text-xs text-gray-400 flex items-center gap-0.5 py-1">
              Ver todo <ChevronRight size={12} aria-hidden="true" />
            </Link>
          </div>
          <ul className="space-y-2">
            {sortedCards.map((c) => {
              const d = daysUntilBilling(c.billing_day!)
              return (
                <li key={c.id} className="flex items-center gap-3 min-w-0">
                  <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ background: c.color }} aria-hidden="true" />
                  <span className="text-sm text-gray-200 flex-1 truncate min-w-0">{c.bank_name}</span>
                  <span className={`text-[11px] shrink-0 ${d <= 5 ? 'text-rose-400' : 'text-gray-400'}`}>vence en {d} d</span>
                  <span className="text-sm font-medium text-white shrink-0">{formatCOP(c.current_balance)}</span>
                </li>
              )
            })}
          </ul>
        </section>
      )}

      {/* ─── Metas ─── */}
      {activeGoals.length > 0 && (
        <section aria-labelledby="hoy-metas" className="bg-bg-card border border-bg-border rounded-2xl p-4 mb-4">
          <div className="flex items-center justify-between gap-2 mb-2">
            <h2 id="hoy-metas" className="text-sm font-medium text-gray-100 flex items-center gap-1.5">
              <Target size={14} className="text-gray-400" aria-hidden="true" /> Metas
            </h2>
            <Link to="/metas" className="text-xs text-gray-400 flex items-center gap-0.5 py-1">
              Ver todo <ChevronRight size={12} aria-hidden="true" />
            </Link>
          </div>
          <ul className="space-y-2.5">
            {activeGoals.map((g) => {
              const pct = Math.min(100, Math.round((g.saved_amount / g.target_amount) * 100))
              return (
                <li key={g.id}>
                  <div className="flex items-center justify-between text-sm mb-1 gap-2">
                    <span className="text-gray-200 truncate min-w-0"><span aria-hidden="true">{g.emoji} </span>{g.name}</span>
                    <span className="text-gray-400 text-xs shrink-0">{pct}%</span>
                  </div>
                  <div
                    role="progressbar"
                    aria-label={`Avance de la meta ${g.name}`}
                    aria-valuemin={0}
                    aria-valuemax={100}
                    aria-valuenow={pct}
                    className="h-1.5 bg-bg-elevated rounded-full overflow-hidden"
                  >
                    <div className="h-full bg-gradient-to-r from-accent-indigo to-accent-cyan" style={{ width: `${pct}%` }} />
                  </div>
                </li>
              )
            })}
          </ul>
        </section>
      )}

      {/* ─── Últimos movimientos ─── */}
      <section aria-labelledby="hoy-movimientos" className="bg-bg-card border border-bg-border rounded-2xl p-4 mb-4">
        <div className="flex items-center justify-between gap-2 mb-2">
          <h2 id="hoy-movimientos" className="text-sm font-medium text-gray-100">Últimos movimientos</h2>
          <Link to="/historial" className="text-xs text-gray-400 flex items-center gap-0.5 py-1">
            Ver todo <ChevronRight size={12} aria-hidden="true" />
          </Link>
        </div>
        {recent.length === 0 ? (
          <p className="text-sm text-gray-400 py-1">Aún no hay movimientos este mes.</p>
        ) : (
          <ul className="divide-y divide-bg-border">
            {recent.map((tx) => (
              <li key={tx.id} className="flex items-center gap-3 py-2">
                <span className="text-lg w-7 text-center shrink-0" aria-hidden="true">{CATEGORY_ICONS[tx.category] ?? '📦'}</span>
                <div className="flex-1 min-w-0">
                  <p className="text-sm text-gray-100 truncate">{tx.description || tx.category}</p>
                  <p className="text-[11px] text-gray-400 truncate">{formatDate(tx.date)}{tx.payment_method ? ` · ${tx.payment_method}` : ''}</p>
                </div>
                <span className={`text-sm font-medium shrink-0 ${tx.type === 'income' ? 'text-accent-green' : 'text-gray-100'}`}>
                  <span className="sr-only">{tx.type === 'income' ? 'Ingreso de ' : 'Gasto de '}</span>
                  <span aria-hidden="true">{tx.type === 'income' ? '+' : '−'}</span>{formatCOP(tx.amount)}
                </span>
              </li>
            ))}
          </ul>
        )}
      </section>

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
