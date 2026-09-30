import { useState, useCallback } from 'react'
import { CheckCircle, Trash2, Calendar, Pencil, Check, X, ChevronDown, ChevronUp } from 'lucide-react'
import { formatCOP, parseCOP } from '@/lib/currency'
import { formatDate, daysUntil } from '@/lib/dates'
import { db } from '@/lib/db'
import type { Installment, InstallmentPayment } from '@/types'

interface Props {
  installment: Installment
  onPay: (id: number) => void
  onEdit: (inst: Installment) => void
  onDelete: (id: number) => void
  onUpdateAmount: (id: number, amount: number) => void
}

export function InstallmentCard({ installment: inst, onPay, onEdit, onDelete, onUpdateAmount }: Props) {
  const pct = (inst.paid_months / inst.total_months) * 100
  const done = inst.paid_months >= inst.total_months
  const days = inst.next_due_date ? daysUntil(inst.next_due_date) : null
  const isLate = days !== null && days < 0
  const isSoon = days !== null && days <= 7 && days >= 0

  // Inline edit del monto mensual
  const [editingAmount, setEditingAmount] = useState(false)
  const [amountValue, setAmountValue] = useState(String(inst.monthly_amount))

  const saveAmount = () => {
    const parsed = parseCOP(amountValue)
    if (parsed > 0) onUpdateAmount(inst.id, parsed)
    setEditingAmount(false)
  }

  // Historial de pagos (lazy load al expandir)
  const [showHistory, setShowHistory] = useState(false)
  const [history, setHistory] = useState<InstallmentPayment[]>([])
  const [historyLoading, setHistoryLoading] = useState(false)

  const loadHistory = useCallback(async () => {
    if (history.length > 0) return
    setHistoryLoading(true)
    try {
      const payments = await db.listInstallmentPayments(inst.id)
      setHistory(payments)
    } finally {
      setHistoryLoading(false)
    }
  }, [inst.id, history.length])

  const toggleHistory = () => {
    if (!showHistory) loadHistory()
    setShowHistory(p => !p)
  }

  return (
    <div className={`bg-bg-card border rounded-xl p-4 ${done ? 'border-accent-green/30' : isLate ? 'border-accent-red/30' : 'border-bg-border'}`}>
      {/* Header */}
      <div className="flex items-start justify-between gap-2 mb-3 min-w-0">
        <div className="min-w-0 flex-1">
          <h3 className="text-sm font-medium text-white truncate">{inst.name}</h3>
          {inst.notes && <p className="text-xs text-gray-600 mt-0.5 truncate">{inst.notes}</p>}
        </div>
        <div className="flex items-center gap-1 shrink-0">
          {!done && (
            <button
              onClick={() => onPay(inst.id)}
              className="text-xs bg-accent-green/10 hover:bg-accent-green/20 text-accent-green border border-accent-green/30 px-2.5 py-1 rounded-lg transition-colors whitespace-nowrap"
            >
              Pagar
            </button>
          )}
          <button onClick={() => onEdit(inst)} className="text-gray-600 hover:text-accent-indigo p-1 rounded transition-colors" title="Editar cuota">
            <Pencil size={13} />
          </button>
          <button onClick={() => onDelete(inst.id)} className="text-gray-600 hover:text-accent-red p-1 rounded transition-colors" title="Eliminar">
            <Trash2 size={14} />
          </button>
        </div>
      </div>

      {/* Barra de progreso */}
      <div className="mb-3">
        <div className="flex justify-between text-xs text-gray-500 mb-1">
          <span>{inst.paid_months} de {inst.total_months} cuotas</span>
          <span className={done ? 'text-accent-green' : ''}>{Math.round(pct)}%</span>
        </div>
        <div className="w-full bg-bg-elevated rounded-full h-2">
          <div
            className={`h-2 rounded-full transition-all ${done ? 'bg-accent-green' : 'bg-accent-indigo'}`}
            style={{ width: `${pct}%` }}
          />
        </div>
      </div>

      {/* Footer: monto editable + fecha */}
      <div className="flex flex-wrap items-center justify-between gap-1 text-xs text-gray-500">
        <div className="flex items-center gap-1.5 min-w-0">
          {editingAmount ? (
            <div className="flex items-center gap-1">
              <input
                value={amountValue}
                onChange={e => setAmountValue(e.target.value)}
                onKeyDown={e => { if (e.key === 'Enter') saveAmount(); if (e.key === 'Escape') setEditingAmount(false) }}
                inputMode="numeric"
                autoFocus
                className="w-28 bg-bg-elevated border border-accent-indigo/50 rounded-lg px-2 py-1 text-sm text-white outline-none"
              />
              <button onClick={saveAmount} className="text-accent-green p-0.5"><Check size={13} /></button>
              <button onClick={() => setEditingAmount(false)} className="text-gray-500 p-0.5"><X size={13} /></button>
            </div>
          ) : (
            <>
              <span className="text-gray-300 font-semibold text-sm">{formatCOP(inst.monthly_amount)}</span>
              <span>/mes</span>
              {!done && (
                <button
                  onClick={() => { setAmountValue(String(inst.monthly_amount)); setEditingAmount(true) }}
                  className="text-gray-600 hover:text-accent-cyan p-0.5 rounded transition-colors"
                  title="Editar monto mensual"
                >
                  <Pencil size={11} />
                </button>
              )}
              <span className="text-gray-600 truncate hidden sm:inline">Total: {formatCOP(inst.total_amount)}</span>
            </>
          )}
        </div>
        {inst.next_due_date && !done && (
          <div className={`flex items-center gap-1 shrink-0 ${isLate ? 'text-accent-red' : isSoon ? 'text-accent-yellow' : ''}`}>
            <Calendar size={11} />
            <span>
              {isLate
                ? `${Math.abs(days!)}d vencida`
                : isSoon
                ? `Vence en ${days}d`
                : formatDate(inst.next_due_date)
              }
            </span>
          </div>
        )}
        {done && (
          <div className="flex items-center gap-1 text-accent-green shrink-0">
            <CheckCircle size={11} /> Completada
          </div>
        )}
      </div>

      {/* Historial de pagos */}
      {inst.paid_months > 0 && (
        <div className="mt-3 pt-2 border-t border-bg-border">
          <button
            onClick={toggleHistory}
            className="flex items-center gap-1 text-xs text-gray-600 hover:text-gray-400 transition-colors"
          >
            {showHistory ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
            {showHistory ? 'Ocultar historial' : `Ver historial (${inst.paid_months} pago${inst.paid_months !== 1 ? 's' : ''})`}
          </button>

          {showHistory && (
            <div className="mt-2 space-y-1">
              {historyLoading ? (
                <div className="text-xs text-gray-600">Cargando…</div>
              ) : history.length === 0 ? (
                <div className="text-xs text-gray-600">Sin registros</div>
              ) : (
                history.map(p => (
                  <div key={p.id} className="flex justify-between text-xs text-gray-500">
                    <span>{formatDate(p.paid_date)}</span>
                    <span className="text-accent-green">{formatCOP(p.amount)}</span>
                  </div>
                ))
              )}
            </div>
          )}
        </div>
      )}
    </div>
  )
}
