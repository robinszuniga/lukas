import { useState } from 'react'
import { X } from 'lucide-react'
import { parseCOP } from '@/lib/currency'
import { CATEGORIES } from '@/types'
import type { Category, Recurring } from '@/types'

interface Props {
  initial?: Recurring
  onSave: (data: Omit<Recurring, 'id' | 'created_at' | 'last_posted'>) => void
  onClose: () => void
}

export function RecurringForm({ initial, onSave, onClose }: Props) {
  const [name, setName] = useState(initial?.name ?? '')
  const [amount, setAmount] = useState(initial ? String(initial.amount) : '')
  const [category, setCategory] = useState<Category>((initial?.category as Category) ?? 'Servicios')
  const [paymentMethod, setPaymentMethod] = useState(initial?.payment_method ?? '')
  const [day, setDay] = useState(initial ? String(initial.day) : '1')

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    const val = parseCOP(amount)
    const d = parseInt(day)
    if (!name.trim() || val <= 0 || d < 1 || d > 31) return
    onSave({
      name: name.trim(),
      amount: val,
      category,
      payment_method: paymentMethod.trim() || null,
      day: d,
    })
  }

  const inputClass = 'w-full bg-bg-elevated border border-bg-border rounded-lg px-3 py-2.5 text-sm text-white placeholder-gray-600 outline-none focus:border-accent-indigo/50 transition-colors'

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-end sm:items-center justify-center z-[60]">
      <div className="bg-bg-card border border-bg-border rounded-t-2xl sm:rounded-2xl w-full sm:max-w-md max-h-[85dvh] flex flex-col">
        <div className="flex items-center justify-between px-5 py-4 border-b border-bg-border shrink-0">
          <h2 className="font-semibold text-white text-sm">{initial ? 'Editar pago fijo' : 'Nuevo pago fijo'}</h2>
          <button onClick={onClose} className="text-gray-500 hover:text-white"><X size={18} /></button>
        </div>

        <form id="recurring-form" onSubmit={handleSubmit} className="overflow-y-auto flex-1 px-5 py-4 space-y-3">
          <div>
            <label className="text-xs text-gray-500 mb-1 block">Nombre</label>
            <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Ej: Arriendo, Gym, Netflix" className={inputClass} required />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs text-gray-500 block mb-1">Monto mensual</label>
              <input value={amount} onChange={(e) => setAmount(e.target.value)} placeholder="500000" inputMode="numeric" className={inputClass} required />
            </div>
            <div>
              <label className="text-xs text-gray-500 block mb-1">Día del mes</label>
              <input type="number" value={day} onChange={(e) => setDay(e.target.value)} min={1} max={31} className={inputClass} required />
            </div>
          </div>

          <div>
            <label className="text-xs text-gray-500 block mb-1">Categoría</label>
            <select value={category} onChange={(e) => setCategory(e.target.value as Category)} className={inputClass}>
              {CATEGORIES.map((c) => <option key={c} value={c}>{c}</option>)}
            </select>
          </div>

          <div>
            <label className="text-xs text-gray-500 block mb-1">Método de pago (opcional)</label>
            <input value={paymentMethod} onChange={(e) => setPaymentMethod(e.target.value)} placeholder="Nequi, Bancolombia…" className={inputClass} />
          </div>

          {!initial && (
            <p className="text-xs text-gray-700">
              Cada mes te aparecerá como pendiente. Al tocar "Registrar" se crea el gasto automáticamente.
            </p>
          )}
        </form>

        <div
          className="px-5 pt-3 border-t border-bg-border shrink-0 flex gap-2"
          style={{ paddingBottom: 'max(1.5rem, env(safe-area-inset-bottom, 0px))' }}
        >
          <button type="button" onClick={onClose} className="flex-1 py-2.5 bg-bg-elevated border border-bg-border text-gray-400 text-sm rounded-xl">Cancelar</button>
          <button type="submit" form="recurring-form" className="flex-1 py-2.5 bg-accent-indigo hover:bg-accent-indigo/80 text-white text-sm font-medium rounded-xl transition-colors">Guardar</button>
        </div>
      </div>
    </div>
  )
}
