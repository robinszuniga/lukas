import { useEffect, useState } from 'react'
import { CheckCircle, Trash2, Calendar, Pencil, Check, X, ChevronDown, ChevronUp, Undo2 } from 'lucide-react'
import { formatCOP } from '@/lib/currency'
import { parseMoney, toInputAmount, currencyInfo } from '@/lib/money'
import { formatDate, daysUntil } from '@/lib/dates'
import { db } from '@/lib/db'
import type { Installment, InstallmentPayment, PaymentLogEntry } from '@/types'
import { ReminderButton, type ReminderState } from '@/components/reminders/ReminderDialog'
import { iconButton } from '@/components/ui/styles'

interface Props {
  installment: Installment
  /** Último pago hecho desde la app (si existe, se puede deshacer) */
  lastPayment?: PaymentLogEntry
  reminder: ReminderState
  onPay: (inst: Installment) => void
  onUndoPay: (inst: Installment) => void
  onEdit: (inst: Installment) => void
  onDelete: (inst: Installment) => void
  onUpdateAmount: (id: number, amount: number) => void
  onReminder: (inst: Installment) => void
}

export function InstallmentCard({
  installment: inst, lastPayment, reminder, onPay, onUndoPay, onEdit, onDelete, onUpdateAmount, onReminder,
}: Props) {
  const pct = (inst.paid_months / inst.total_months) * 100
  const done = inst.paid_months >= inst.total_months
  const days = inst.next_due_date ? daysUntil(inst.next_due_date) : null
  const isLate = days !== null && days < 0
  const isSoon = days !== null && days <= 7 && days >= 0

  // Edición rápida del monto mensual
  const [editingAmount, setEditingAmount] = useState(false)
  const [amountValue, setAmountValue] = useState(toInputAmount(inst.monthly_amount))
  const [amountError, setAmountError] = useState(false)

  const saveAmount = () => {
    const parsed = parseMoney(amountValue)
    if (parsed === null) { setAmountError(true); return }
    onUpdateAmount(inst.id, parsed)
    setEditingAmount(false)
    setAmountError(false)
  }

  // Historial de pagos: se carga al expandir y se actualiza si cambia el número de cuotas pagadas
  const [showHistory, setShowHistory] = useState(false)
  const [history, setHistory] = useState<InstallmentPayment[] | null>(null)

  useEffect(() => {
    if (!showHistory) return
    let alive = true
    db.listInstallmentPayments(inst.id).then((rows) => { if (alive) setHistory(rows) })
    return () => { alive = false }
  }, [showHistory, inst.id, inst.paid_months])

  const historyId = `historial-cuota-${inst.id}`

  return (
    <article
      aria-label={`Cuota ${inst.name}`}
      className={`bg-bg-card border rounded-xl p-4 ${done ? 'border-accent-green/40' : isLate ? 'border-accent-red/40' : 'border-bg-border'}`}
    >
      <div className="flex items-start justify-between gap-2 mb-3 min-w-0">
        <div className="min-w-0 flex-1">
          <h3 className="text-sm font-medium text-white truncate">{inst.name}</h3>
          {inst.notes && <p className="text-xs text-gray-400 mt-0.5 truncate">{inst.notes}</p>}
        </div>
        {!done && (
          <button
            type="button"
            onClick={() => onPay(inst)}
            aria-label={`Pagar cuota de ${inst.name}`}
            className="shrink-0 text-xs font-medium bg-accent-green/10 hover:bg-accent-green/20 text-accent-green border border-accent-green/40 px-3 py-2 rounded-lg transition-colors"
          >
            Pagar
          </button>
        )}
      </div>

      <div className="mb-3">
        <div className="flex justify-between text-xs text-gray-400 mb-1">
          <span>{inst.paid_months} de {inst.total_months} cuotas</span>
          <span className={done ? 'text-accent-green' : ''}>{Math.round(pct)}%</span>
        </div>
        <div
          role="progressbar"
          aria-label={`Avance de ${inst.name}`}
          aria-valuemin={0}
          aria-valuemax={inst.total_months}
          aria-valuenow={inst.paid_months}
          aria-valuetext={`${inst.paid_months} de ${inst.total_months} cuotas pagadas`}
          className="w-full bg-bg-elevated rounded-full h-2"
        >
          <div
            className={`h-2 rounded-full transition-all ${done ? 'bg-accent-green' : 'bg-accent-indigo'}`}
            style={{ width: `${Math.min(pct, 100)}%` }}
          />
        </div>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1 text-xs text-gray-400">
        <div className="flex items-center gap-1.5 min-w-0">
          {editingAmount ? (
            <div className="flex items-center gap-1">
              <input
                value={amountValue}
                onChange={(e) => { setAmountValue(e.target.value); setAmountError(false) }}
                onKeyDown={(e) => { if (e.key === 'Enter') saveAmount(); if (e.key === 'Escape') setEditingAmount(false) }}
                inputMode={currencyInfo().decimals === 0 ? 'numeric' : 'decimal'}
                autoFocus
                aria-label={`Nuevo monto mensual de ${inst.name}`}
                aria-invalid={amountError || undefined}
                className={`w-28 bg-bg-elevated border rounded-lg px-2 py-1.5 text-sm text-white outline-none ${amountError ? 'border-accent-red' : 'border-accent-indigo'}`}
              />
              <button type="button" onClick={saveAmount} aria-label="Guardar monto" className={`${iconButton} text-accent-green`}><Check size={15} aria-hidden="true" /></button>
              <button type="button" onClick={() => { setEditingAmount(false); setAmountError(false) }} aria-label="Cancelar" className={iconButton}><X size={15} aria-hidden="true" /></button>
            </div>
          ) : (
            <>
              <span className="text-gray-100 font-semibold text-sm">{formatCOP(inst.monthly_amount)}</span>
              <span>/mes</span>
              {!done && (
                <button
                  type="button"
                  onClick={() => { setAmountValue(toInputAmount(inst.monthly_amount)); setEditingAmount(true) }}
                  className={`${iconButton} w-8 h-8`}
                  aria-label={`Cambiar monto mensual de ${inst.name}`}
                >
                  <Pencil size={12} aria-hidden="true" />
                </button>
              )}
            </>
          )}
        </div>
        {inst.next_due_date && !done && (
          <div className={`flex items-center gap-1 shrink-0 ${isLate ? 'text-rose-400' : isSoon ? 'text-accent-yellow' : ''}`}>
            <Calendar size={11} aria-hidden="true" />
            <span>
              {isLate
                ? `Venció hace ${Math.abs(days!)} día${Math.abs(days!) === 1 ? '' : 's'}`
                : isSoon
                ? (days === 0 ? 'Vence hoy' : `Vence en ${days} día${days === 1 ? '' : 's'}`)
                : formatDate(inst.next_due_date)
              }
            </span>
          </div>
        )}
        {done && (
          <div className="flex items-center gap-1 text-accent-green shrink-0">
            <CheckCircle size={11} aria-hidden="true" /> Completada
          </div>
        )}
      </div>
      {amountError && <p role="alert" className="text-xs text-rose-400 mt-1">Monto inválido</p>}

      <div className="mt-3 pt-2 border-t border-bg-border flex items-center justify-between gap-2">
        {inst.paid_months > 0 ? (
          <button
            type="button"
            onClick={() => setShowHistory((p) => !p)}
            aria-expanded={showHistory}
            aria-controls={historyId}
            className="flex items-center gap-1 text-xs text-gray-400 hover:text-gray-200 transition-colors py-2 min-w-0"
          >
            {showHistory ? <ChevronUp size={12} aria-hidden="true" /> : <ChevronDown size={12} aria-hidden="true" />}
            <span className="truncate">
              {showHistory ? 'Ocultar pagos' : `Ver pagos (${inst.paid_months})`}
            </span>
          </button>
        ) : <span className="text-xs text-gray-450">Sin pagos aún</span>}

        <div className="flex items-center shrink-0">
          {!done && <ReminderButton name={inst.name} state={reminder} onClick={() => onReminder(inst)} />}
          <button type="button" onClick={() => onEdit(inst)} className={iconButton} aria-label={`Editar cuota ${inst.name}`}>
            <Pencil size={14} aria-hidden="true" />
          </button>
          <button type="button" onClick={() => onDelete(inst)} className={`${iconButton} hover:text-rose-400`} aria-label={`Eliminar cuota ${inst.name}`}>
            <Trash2 size={14} aria-hidden="true" />
          </button>
        </div>
      </div>

      {showHistory && (
        <div id={historyId} className="mt-1 space-y-1">
          {history === null ? (
            <p className="text-xs text-gray-400">Cargando…</p>
          ) : history.length === 0 ? (
            <p className="text-xs text-gray-400">Sin registros de pago</p>
          ) : (
            <ul className="space-y-1">
              {history.map((p) => (
                <li key={p.id} className="flex justify-between text-xs text-gray-400">
                  <span>{formatDate(p.paid_date)}</span>
                  <span className="text-accent-green">{formatCOP(p.amount)}</span>
                </li>
              ))}
            </ul>
          )}
          {lastPayment && (
            <button
              type="button"
              onClick={() => onUndoPay(inst)}
              className="inline-flex items-center gap-1.5 text-xs text-accent-cyan py-2"
            >
              <Undo2 size={12} aria-hidden="true" /> Deshacer el último pago
            </button>
          )}
        </div>
      )}
    </article>
  )
}
