import { useId } from 'react'
import { Check, X, Edit3 } from 'lucide-react'
import { formatCOP } from '@/lib/currency'
import { CATEGORIES, CATEGORY_ICONS } from '@/types'
import type { ParsedTransaction } from '@/types'

interface Props {
  data: ParsedTransaction
  onConfirm: () => void
  onEdit: <K extends keyof ParsedTransaction>(field: K, value: ParsedTransaction[K]) => void
  onCancel: () => void
  loading: boolean
}

const fieldClass =
  'w-full min-w-0 bg-bg-card border border-bg-field rounded-lg px-2 py-2 text-sm text-white placeholder-gray-450 outline-none focus:border-accent-indigo'

export function ConfirmTransaction({ data, onConfirm, onEdit, onCancel, loading }: Props) {
  const isIncome = data.type === 'income'
  const id = useId()

  return (
    <div role="group" aria-label={`Movimiento por confirmar: ${data.description}`} className="bg-bg-elevated border border-bg-border rounded-xl p-4 mt-2">
      <p className="text-xs text-gray-400 mb-3 flex items-center gap-1">
        <Edit3 size={10} aria-hidden="true" /> Revisa antes de guardar
      </p>

      <div className="grid grid-cols-2 gap-3 mb-4">
        <div className="min-w-0">
          <label htmlFor={`${id}-tipo`} className="text-xs text-gray-400 block mb-1">Tipo</label>
          <select id={`${id}-tipo`} value={data.type} onChange={(e) => onEdit('type', e.target.value as ParsedTransaction['type'])} className={fieldClass}>
            <option value="income">Ingreso</option>
            <option value="expense">Gasto</option>
          </select>
        </div>
        <div className="min-w-0">
          <p className="text-xs text-gray-400 mb-1">Monto</p>
          <p className={`text-xl font-bold truncate ${isIncome ? 'text-accent-green' : 'text-rose-400'}`}>
            <span aria-hidden="true">{isIncome ? '+' : '−'}</span>{formatCOP(data.amount)}
          </p>
        </div>
        <div className="min-w-0">
          <label htmlFor={`${id}-cat`} className="text-xs text-gray-400 block mb-1">Categoría</label>
          <select id={`${id}-cat`} value={data.category} onChange={(e) => onEdit('category', e.target.value as ParsedTransaction['category'])} className={fieldClass}>
            {CATEGORIES.map((c) => (
              <option key={c} value={c}>{CATEGORY_ICONS[c]} {c}</option>
            ))}
          </select>
        </div>
        <div className="min-w-0">
          <label htmlFor={`${id}-metodo`} className="text-xs text-gray-400 block mb-1">Método de pago</label>
          <input
            id={`${id}-metodo`}
            value={data.payment_method ?? ''}
            onChange={(e) => onEdit('payment_method', e.target.value || null)}
            placeholder="Efectivo, Nu…"
            className={fieldClass}
          />
        </div>
        <div className="col-span-2 min-w-0">
          <label htmlFor={`${id}-desc`} className="text-xs text-gray-400 block mb-1">Descripción</label>
          <input id={`${id}-desc`} value={data.description ?? ''} onChange={(e) => onEdit('description', e.target.value)} className={fieldClass} />
        </div>
        <div className="col-span-2 sm:col-span-1 min-w-0">
          <label htmlFor={`${id}-fecha`} className="text-xs text-gray-400 block mb-1">Fecha</label>
          <input id={`${id}-fecha`} type="date" value={data.date} onChange={(e) => e.target.value && onEdit('date', e.target.value)} className={fieldClass} />
        </div>
      </div>

      <div className="flex gap-2">
        <button
          type="button"
          onClick={onConfirm}
          disabled={loading}
          className="flex-1 flex items-center justify-center gap-1.5 bg-indigo-600 hover:bg-indigo-500 text-white text-sm font-medium py-2.5 rounded-lg transition-colors disabled:opacity-60"
        >
          <Check size={14} aria-hidden="true" />
          {loading ? 'Guardando…' : 'Confirmar'}
        </button>
        <button
          type="button"
          onClick={onCancel}
          aria-label="Descartar este movimiento"
          className="w-11 inline-flex items-center justify-center bg-bg-card border border-bg-field text-gray-400 hover:text-white rounded-lg transition-colors"
        >
          <X size={14} aria-hidden="true" />
        </button>
      </div>
    </div>
  )
}
