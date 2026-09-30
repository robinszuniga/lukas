import { Check, X, Edit3 } from 'lucide-react'
import { formatCOP } from '@/lib/currency'
import { CATEGORY_ICONS } from '@/types'
import type { ParsedTransaction, Category } from '@/types'

interface Props {
  data: ParsedTransaction
  onConfirm: () => void
  onEdit: (field: keyof ParsedTransaction, value: any) => void
  onCancel: () => void
  loading: boolean
}

export function ConfirmTransaction({ data, onConfirm, onEdit, onCancel, loading }: Props) {
  const isIncome = data.type === 'income'

  return (
    <div className="bg-bg-elevated border border-bg-border rounded-xl p-4 mt-2">
      <p className="text-xs text-gray-500 mb-3 flex items-center gap-1">
        <Edit3 size={10} /> Revisa antes de guardar
      </p>

      <div className="grid grid-cols-2 gap-3 mb-4">
        <div>
          <label className="text-xs text-gray-600 block mb-1">Tipo</label>
          <select
            value={data.type}
            onChange={(e) => onEdit('type', e.target.value)}
            className="w-full bg-bg-card border border-bg-border rounded-lg px-2 py-1.5 text-sm text-white"
          >
            <option value="income">💚 Ingreso</option>
            <option value="expense">🔴 Gasto</option>
          </select>
        </div>
        <div>
          <label className="text-xs text-gray-600 block mb-1">Monto</label>
          <div className={`text-xl font-bold ${isIncome ? 'text-accent-green' : 'text-accent-red'}`}>
            {isIncome ? '+' : '-'}{formatCOP(data.amount)}
          </div>
        </div>
        <div>
          <label className="text-xs text-gray-600 block mb-1">Categoría</label>
          <select
            value={data.category}
            onChange={(e) => onEdit('category', e.target.value)}
            className="w-full bg-bg-card border border-bg-border rounded-lg px-2 py-1.5 text-sm text-white"
          >
            {(['Alimentación','Transporte','Entretenimiento','Educación','Ropa','Antojos','Salud','Servicios','Ahorro','Otro'] as Category[]).map((c) => (
              <option key={c} value={c}>{CATEGORY_ICONS[c]} {c}</option>
            ))}
          </select>
        </div>
        <div>
          <label className="text-xs text-gray-600 block mb-1">Método de pago</label>
          <input
            value={data.payment_method ?? ''}
            onChange={(e) => onEdit('payment_method', e.target.value || null)}
            placeholder="Efectivo, Nu, Bancolombia..."
            className="w-full bg-bg-card border border-bg-border rounded-lg px-2 py-1.5 text-sm text-white placeholder-gray-600"
          />
        </div>
        <div className="col-span-2">
          <label className="text-xs text-gray-600 block mb-1">Descripción</label>
          <input
            value={data.description ?? ''}
            onChange={(e) => onEdit('description', e.target.value)}
            className="w-full bg-bg-card border border-bg-border rounded-lg px-2 py-1.5 text-sm text-white"
          />
        </div>
        <div>
          <label className="text-xs text-gray-600 block mb-1">Fecha</label>
          <input
            type="date"
            value={data.date}
            onChange={(e) => onEdit('date', e.target.value)}
            className="w-full bg-bg-card border border-bg-border rounded-lg px-2 py-1.5 text-sm text-white"
          />
        </div>
      </div>

      <div className="flex gap-2">
        <button
          onClick={onConfirm}
          disabled={loading}
          className="flex-1 flex items-center justify-center gap-1.5 bg-accent-indigo hover:bg-accent-indigo/80 text-white text-sm font-medium py-2 rounded-lg transition-colors disabled:opacity-50"
        >
          <Check size={14} />
          {loading ? 'Guardando...' : 'Confirmar'}
        </button>
        <button
          onClick={onCancel}
          className="px-4 py-2 bg-bg-card hover:bg-bg-elevated border border-bg-border text-gray-400 text-sm rounded-lg transition-colors"
        >
          <X size={14} />
        </button>
      </div>
    </div>
  )
}
