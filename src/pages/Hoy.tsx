import { useMemo } from 'react'
import { Link } from 'react-router-dom'
import { Settings, List, ChevronRight, CheckCircle2, Repeat, Clock, Target, CreditCard } from 'lucide-react'
import { Header } from '@/components/layout/Header'
import { useTransactions } from '@/hooks/useTransactions'
import { useInstallments } from '@/hooks/useInstallments'
import { useRecurring } from '@/hooks/useRecurring'
import { useCards } from '@/hooks/useCards'
import { useGoals } from '@/hooks/useGoals'
import { formatCOP } from '@/lib/currency'
import { daysUntil, daysUntilBilling, formatDate } from '@/lib/dates'
import { daysToNextPayday, getPaydays } from '@/lib/paydays'
import { CATEGORY_ICONS } from '@/types'
import type { Category } from '@/types'

type PendingItem =
  | { kind: 'recurring'; id: number; name: string; amount: number; when: string; overdue: boolean; sort: number; icon: string }
  | { kind: 'installment'; id: number; name: string; amount: number; when: string; overdue: boolean; sort: number; icon: string }

export function Hoy() {
  const { summary, transactions, loading, refresh: refreshTx } = useTransactions()
  const { installments, payInstallment } = useInstallments()
  const { pending: pendingRecurring, postRecurring } = useRecurring()
  const { cards } = useCards()
  const { goals } = useGoals()

  const now = new Date()
  const todayDay = now.getDate()
  const endOfMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0).toISOString().slice(0, 10)

  // Cuotas activas que vencen este mes (o ya vencidas) y no se han pagado
  const pendingInstallments = useMemo(
    () => installments.filter((i) => i.paid_months < i.total_months && i.next_due_date && i.next_due_date <= endOfMonth),
    [installments, endOfMonth]
  )

  const pendingItems: PendingItem[] = useMemo(() => {
    const rec: PendingItem[] = pendingRecurring.map((r) => ({
      kind: 'recurring', id: r.id, name: r.name, amount: r.amount,
      when: todayDay >= r.day ? `día ${r.day}` : `el ${r.day}`,
      overdue: todayDay >= r.day, sort: r.day,
      icon: CATEGORY_ICONS[r.category as Category] ?? '🔁',
    }))
    const inst: PendingItem[] = pendingInstallments.map((i) => {
      const d = daysUntil(i.next_due_date!)
      return {
        kind: 'installment', id: i.id, name: i.name, amount: i.monthly_amount,
        when: d < 0 ? `venció ${formatDate(i.next_due_date!)}` : d === 0 ? 'vence hoy' : `vence en ${d}d`,
        overdue: d <= 0, sort: new Date(i.next_due_date!).getDate(),
        icon: '📋',
      }
    })
    return [...rec, ...inst].sort((a, b) => Number(b.overdue) - Number(a.overdue) || a.sort - b.sort)
  }, [pendingRecurring, pendingInstallments, todayDay])

  const pendingTotal = pendingItems.reduce((s, p) => s + p.amount, 0)
  const income = summary?.income ?? 0
  const expenses = summary?.expenses ?? 0
  const balance = income - expenses
  const free = balance - pendingTotal

  const days = daysToNextPayday(getPaydays())
  const perDay = days > 0 ? Math.floor(Math.max(free, 0) / days) : Math.max(free, 0)

  const handlePay = async (item: PendingItem) => {
    if (item.kind === 'recurring') await postRecurring(item.id)
    else await payInstallment(item.id)
    refreshTx()
  }

  const sortedCards = [...cards]
    .filter((c) => c.billing_day)
    .sort((a, b) => daysUntilBilling(a.billing_day!) - daysUntilBilling(b.billing_day!))

  const activeGoals = goals.filter((g) => g.saved_amount < g.target_amount)
  const recent = transactions.slice(0, 4)

  return (
    <div className="px-4 pt-4">
      <Header
        title="Hoy"
        right={
          <>
            <Link to="/historial" className="p-2 rounded-lg text-gray-400 hover:text-white active:bg-bg-card" title="Historial">
              <List size={20} />
            </Link>
            <Link to="/ajustes" className="p-2 rounded-lg text-gray-400 hover:text-white active:bg-bg-card" title="Ajustes">
              <Settings size={20} />
            </Link>
          </>
        }
      />

      {/* ─── Número principal ─── */}
      <section className="bg-gradient-to-br from-bg-card to-bg-elevated border border-bg-border rounded-2xl p-5 mb-4">
        <div className="flex items-center justify-between mb-1">
          <p className="text-xs text-gray-400 uppercase tracking-wide">Libre hasta tu pago</p>
          {days >= 0 && (
            <span className="text-[11px] text-accent-indigo bg-accent-indigo/10 px-2 py-0.5 rounded-full">
              {days === 0 ? '¡Hoy es día de pago!' : `en ${days} día${days === 1 ? '' : 's'}`}
            </span>
          )}
        </div>
        {loading ? (
          <div className="h-10 w-48 bg-bg-elevated rounded animate-pulse my-1" />
        ) : (
          <p className={`text-4xl font-bold tracking-tight ${free >= 0 ? 'text-accent-cyan' : 'text-accent-red'}`}>
            {formatCOP(free)}
          </p>
        )}
        <p className="text-xs text-gray-500 mt-1">
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

        <div className="grid grid-cols-3 gap-2 mt-4 pt-4 border-t border-bg-border/60">
          <div>
            <p className="text-[11px] text-gray-500">Ingresos</p>
            <p className="text-sm font-semibold text-accent-green">{formatCOP(income)}</p>
          </div>
          <div>
            <p className="text-[11px] text-gray-500">Gastos</p>
            <p className="text-sm font-semibold text-white">{formatCOP(expenses)}</p>
          </div>
          <div>
            <p className="text-[11px] text-gray-500">Pendiente</p>
            <p className="text-sm font-semibold text-accent-yellow">{formatCOP(pendingTotal)}</p>
          </div>
        </div>
      </section>

      {/* ─── Pendientes ─── */}
      <section className="bg-bg-card border border-bg-border rounded-2xl p-4 mb-4">
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-sm font-medium text-gray-200">Pendientes del mes</h2>
          <Link to="/pagos" className="text-xs text-gray-500 flex items-center gap-0.5">
            Ver todo <ChevronRight size={12} />
          </Link>
        </div>
        {pendingItems.length === 0 ? (
          <p className="text-sm text-gray-500 flex items-center gap-2 py-1">
            <CheckCircle2 size={16} className="text-accent-green" /> Nada pendiente. ¡Bien!
          </p>
        ) : (
          <ul className="divide-y divide-bg-border/60">
            {pendingItems.map((item) => (
              <li key={`${item.kind}-${item.id}`} className="flex items-center gap-3 py-2.5">
                <span className="text-lg w-7 text-center shrink-0">{item.icon}</span>
                <div className="flex-1 min-w-0">
                  <p className="text-sm text-gray-200 truncate">{item.name}</p>
                  <p className={`text-[11px] flex items-center gap-1 ${item.overdue ? 'text-accent-red' : 'text-gray-500'}`}>
                    {item.kind === 'recurring' ? <Repeat size={10} /> : <Clock size={10} />}
                    {item.when}
                  </p>
                </div>
                <span className="text-sm font-medium text-white shrink-0">{formatCOP(item.amount)}</span>
                <button
                  onClick={() => handlePay(item)}
                  className="shrink-0 text-xs font-medium text-accent-green border border-accent-green/40 bg-accent-green/10 active:bg-accent-green/20 px-3 py-1.5 rounded-lg"
                >
                  Pagar
                </button>
              </li>
            ))}
          </ul>
        )}
      </section>

      {/* ─── Tarjetas ─── */}
      {sortedCards.length > 0 && (
        <Link to="/tarjetas" className="block bg-bg-card border border-bg-border rounded-2xl p-4 mb-4 active:bg-bg-elevated">
          <div className="flex items-center justify-between mb-2">
            <h2 className="text-sm font-medium text-gray-200 flex items-center gap-1.5"><CreditCard size={14} className="text-gray-500" /> Tarjetas</h2>
            <ChevronRight size={14} className="text-gray-600" />
          </div>
          <ul className="space-y-2">
            {sortedCards.map((c) => {
              const d = daysUntilBilling(c.billing_day!)
              return (
                <li key={c.id} className="flex items-center gap-3">
                  <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ background: c.color }} />
                  <span className="text-sm text-gray-300 flex-1 truncate">{c.bank_name}{c.last_four ? ` ····${c.last_four}` : ''}</span>
                  <span className={`text-[11px] ${d <= 5 ? 'text-accent-red' : 'text-gray-500'}`}>vence en {d}d</span>
                  <span className="text-sm font-medium text-white">{formatCOP(c.current_balance)}</span>
                </li>
              )
            })}
          </ul>
        </Link>
      )}

      {/* ─── Metas ─── */}
      {activeGoals.length > 0 && (
        <Link to="/metas" className="block bg-bg-card border border-bg-border rounded-2xl p-4 mb-4 active:bg-bg-elevated">
          <div className="flex items-center justify-between mb-2">
            <h2 className="text-sm font-medium text-gray-200 flex items-center gap-1.5"><Target size={14} className="text-gray-500" /> Metas</h2>
            <ChevronRight size={14} className="text-gray-600" />
          </div>
          <ul className="space-y-2.5">
            {activeGoals.map((g) => {
              const pct = Math.min(100, Math.round((g.saved_amount / g.target_amount) * 100))
              return (
                <li key={g.id}>
                  <div className="flex items-center justify-between text-sm mb-1">
                    <span className="text-gray-300 truncate">{g.emoji} {g.name}</span>
                    <span className="text-gray-500 text-xs">{pct}%</span>
                  </div>
                  <div className="h-1.5 bg-bg-elevated rounded-full overflow-hidden">
                    <div className="h-full bg-gradient-to-r from-accent-indigo to-accent-cyan" style={{ width: `${pct}%` }} />
                  </div>
                </li>
              )
            })}
          </ul>
        </Link>
      )}

      {/* ─── Últimos movimientos ─── */}
      <section className="bg-bg-card border border-bg-border rounded-2xl p-4 mb-4">
        <div className="flex items-center justify-between mb-2">
          <h2 className="text-sm font-medium text-gray-200">Últimos movimientos</h2>
          <Link to="/historial" className="text-xs text-gray-500 flex items-center gap-0.5">
            Ver todo <ChevronRight size={12} />
          </Link>
        </div>
        {recent.length === 0 ? (
          <p className="text-sm text-gray-500 py-1">Aún no hay movimientos este mes.</p>
        ) : (
          <ul className="divide-y divide-bg-border/60">
            {recent.map((tx) => (
              <li key={tx.id} className="flex items-center gap-3 py-2">
                <span className="text-lg w-7 text-center shrink-0">{CATEGORY_ICONS[tx.category] ?? '📦'}</span>
                <div className="flex-1 min-w-0">
                  <p className="text-sm text-gray-200 truncate">{tx.description || tx.category}</p>
                  <p className="text-[11px] text-gray-500">{formatDate(tx.date)}{tx.payment_method ? ` · ${tx.payment_method}` : ''}</p>
                </div>
                <span className={`text-sm font-medium ${tx.type === 'income' ? 'text-accent-green' : 'text-gray-200'}`}>
                  {tx.type === 'income' ? '+' : '-'}{formatCOP(tx.amount)}
                </span>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  )
}
