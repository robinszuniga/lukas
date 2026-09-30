import { useState } from 'react'
import { X, Save } from 'lucide-react'
import { CATEGORIES } from '@/types'
import type { Transaction, Category, TransactionType } from '@/types'
import { parseCOP } from '@/lib/currency'
import { today } from '@/lib/dates'

interface Props {
  /** Si viene, es edición; si no, es registro nuevo */
  transaction?: Transaction
  onSave: (data: Partial<Transaction>) => Promise<void>
  onClose: () => void
}

const inputClass =
  'w-full bg-bg-elevated border border-bg-border rounded-lg px-3 py-2 text-sm text-white placeholder-gray-600 outline-none focus:border-accent-indigo/50 transition-colors'

export function TransactionModal({ transaction: tx, onSave, onClose }: Props) {
  const isEdit = !!tx
  const [amount, setAmount] = useState(tx ? String(tx.amount) : '')
  const [type, setType] = useState<TransactionType>(tx?.type ?? 'expense')
  const [category, setCategory] = useState<Category>((tx?.category as Category) ?? 'Alimentación')
  const [description, setDescription] = useState(tx?.description ?? '')
  const [paymentMethod, setPaymentMethod] = useState(tx?.payment_method ?? '')
  const [date, setDate] = useState(tx?.date ?? today())
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  const handleSave = async () => {
    const parsed = parseCOP(amount)
    if (!parsed || parsed <= 0) { setError('El monto debe ser mayor a 0'); return }
    setSaving(true)
    setError('')
    try {
      await onSave({
        amount: parsed,
        type,
        category,
        description: description.trim() || category,
        payment_method: paymentMethod.trim() || null,
        date,
      })
      onClose()
    } catch (e: any) {
      setError(e.message)
      setSaving(false)
    }
  }

  return (
    <div className="fixed inset-0 z-[60] flex items-end sm:items-center justify-center bg-black/60 backdrop-blur-sm">
      <div className="bg-bg-card border border-bg-border rounded-t-2xl sm:rounded-2xl w-full sm:max-w-sm max-h-[85dvh] flex flex-col shadow-2xl">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-bg-border shrink-0">
          <h2 className="text-sm font-semibold text-white">{isEdit ? 'Editar transacción' : 'Registrar movimiento'}</h2>
          <button onClick={onClose} className="text-gray-600 hover:text-white transition-colors">
            <X size={16} />
          </button>
        </div>

        {/* Form scrollable */}
        <div className="overflow-y-auto flex-1 px-5 py-4 space-y-3">
          {/* Tipo */}
          <div className="grid grid-cols-2 gap-2">
            {(['expense', 'income'] as const).map((t) => (
              <button
                key={t}
                onClick={() => setType(t)}
                className={`py-2 rounded-lg text-sm font-medium transition-colors border ${
                  type === t
                    ? t === 'expense'
                      ? 'bg-accent-red/20 border-accent-red/50 text-accent-red'
                      : 'bg-accent-green/20 border-accent-green/50 text-accent-green'
                    : 'bg-bg-elevated border-bg-border text-gray-500 hover:text-gray-300'
                }`}
              >
                {t === 'expense' ? '↓ Gasto' : '↑ Ingreso'}
              </button>
            ))}
          </div>

          {/* Monto */}
          <div>
            <label className="text-xs text-gray-500 mb-1 block">Monto</label>
            <input
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              placeholder="45000"
              inputMode="numeric"
              autoFocus={!isEdit}
              className={inputClass}
            />
          </div>

          {/* Categoría */}
          <div>
            <label className="text-xs text-gray-500 mb-1 block">Categoría</label>
            <select
              value={category}
              onChange={(e) => setCategory(e.target.value as Category)}
              className={inputClass}
            >
              {CATEGORIES.map((c) => <option key={c} value={c}>{c}</option>)}
            </select>
          </div>

          {/* Descripción */}
          <div>
            <label className="text-xs text-gray-500 mb-1 block">Descripción (opcional)</label>
            <input
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Ej: Almuerzo en el trabajo"
              className={inputClass}
            />
          </div>

          {/* Método de pago */}
          <div>
            <label className="text-xs text-gray-500 mb-1 block">Método de pago (opcional)</label>
            <input
              value={paymentMethod}
              onChange={(e) => setPaymentMethod(e.target.value)}
              placeholder="Nequi, Bancolombia, Efectivo…"
              className={inputClass}
            />
          </div>

          {/* Fecha */}
          <div>
            <label className="text-xs text-gray-500 mb-1 block">Fecha</label>
            <input
              type="date"
              value={date}
              onChange={(e) => setDate(e.target.value)}
              className={inputClass}
            />
          </div>

          {error && (
            <p className="text-xs text-accent-red bg-accent-red/10 border border-accent-red/20 rounded-lg px-3 py-2">
              {error}
            </p>
          )}
        </div>

        {/* Footer fijo */}
        <div
          className="px-5 pt-3 border-t border-bg-border shrink-0 flex gap-2"
          style={{ paddingBottom: 'max(1.5rem, env(safe-area-inset-bottom, 0px))' }}
        >
          <button
            onClick={onClose}
            className="flex-1 py-2.5 rounded-xl text-sm text-gray-400 border border-bg-border hover:border-gray-600 transition-colors"
          >
            Cancelar
          </button>
          <button
            onClick={handleSave}
            disabled={saving}
            className="flex-1 py-2.5 rounded-xl text-sm font-medium bg-accent-indigo hover:bg-accent-indigo/80 disabled:opacity-50 text-white flex items-center justify-center gap-2 transition-colors"
          >
            <Save size={14} />
            {saving ? 'Guardando…' : isEdit ? 'Guardar' : 'Registrar'}
          </button>
        </div>
      </div>
    </div>
  )
}

// Alias retrocompatible
export { TransactionModal as EditTransactionModal }
