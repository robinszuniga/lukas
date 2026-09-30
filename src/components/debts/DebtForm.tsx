import { useState } from 'react'
import { X } from 'lucide-react'
import { parseCOP } from '@/lib/currency'
import type { Debt, DebtType } from '@/types'

interface Props {
  initial?: Debt
  onSave: (data: Omit<Debt, 'id' | 'created_at' | 'paid'>) => void
  onClose: () => void
}

export function DebtForm({ initial, onSave, onClose }: Props) {
  const [type, setType] = useState<DebtType>(initial?.type ?? 'owed_to_me')
  const [person, setPerson] = useState(initial?.person ?? '')
  const [amount, setAmount] = useState(initial ? String(initial.amount) : '')
  const [description, setDescription] = useState(initial?.description ?? '')
  const [dueDate, setDueDate] = useState(initial?.due_date ?? '')

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    const val = parseCOP(amount)
    if (!person.trim() || val <= 0) return
    onSave({
      person: person.trim(),
      amount: val,
      type,
      description: description.trim() || null,
      due_date: dueDate || null,
    })
  }

  const inputClass = 'w-full bg-bg-elevated border border-bg-border rounded-lg px-3 py-2.5 text-sm text-white placeholder-gray-600 outline-none focus:border-accent-indigo/50 transition-colors'

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-end sm:items-center justify-center z-[60]">
      <div className="bg-bg-card border border-bg-border rounded-t-2xl sm:rounded-2xl w-full sm:max-w-md max-h-[85dvh] flex flex-col">
        <div className="flex items-center justify-between px-5 py-4 border-b border-bg-border shrink-0">
          <h2 className="font-semibold text-white text-sm">{initial ? 'Editar deuda' : 'Nueva deuda'}</h2>
          <button onClick={onClose} className="text-gray-500 hover:text-white"><X size={18} /></button>
        </div>

        <form id="debt-form" onSubmit={handleSubmit} className="overflow-y-auto flex-1 px-5 py-4 space-y-3">
          {/* Dirección de la deuda */}
          <div className="grid grid-cols-2 gap-2">
            <button
              type="button"
              onClick={() => setType('owed_to_me')}
              className={`py-2.5 rounded-lg text-sm font-medium transition-colors border ${
                type === 'owed_to_me'
                  ? 'bg-accent-green/20 border-accent-green/50 text-accent-green'
                  : 'bg-bg-elevated border-bg-border text-gray-500 hover:text-gray-300'
              }`}
            >
              ↙ Me deben
            </button>
            <button
              type="button"
              onClick={() => setType('i_owe')}
              className={`py-2.5 rounded-lg text-sm font-medium transition-colors border ${
                type === 'i_owe'
                  ? 'bg-accent-red/20 border-accent-red/50 text-accent-red'
                  : 'bg-bg-elevated border-bg-border text-gray-500 hover:text-gray-300'
              }`}
            >
              ↗ Yo debo
            </button>
          </div>

          <div>
            <label className="text-xs text-gray-500 mb-1 block">
              {type === 'owed_to_me' ? '¿Quién te debe?' : '¿A quién le debes?'}
            </label>
            <input value={person} onChange={(e) => setPerson(e.target.value)} placeholder="Ej: Carlos, Mamá, Trabajo…" className={inputClass} required />
          </div>

          <div>
            <label className="text-xs text-gray-500 block mb-1">Monto</label>
            <input value={amount} onChange={(e) => setAmount(e.target.value)} placeholder="80000" inputMode="numeric" className={inputClass} required />
          </div>

          <div>
            <label className="text-xs text-gray-500 block mb-1">Motivo (opcional)</label>
            <input value={description} onChange={(e) => setDescription(e.target.value)} placeholder="Ej: Préstamo para el almuerzo" className={inputClass} />
          </div>

          <div>
            <label className="text-xs text-gray-500 block mb-1">Fecha límite (opcional)</label>
            <input type="date" value={dueDate} onChange={(e) => setDueDate(e.target.value)} className={inputClass} />
          </div>
        </form>

        <div
          className="px-5 pt-3 border-t border-bg-border shrink-0 flex gap-2"
          style={{ paddingBottom: 'max(1.5rem, env(safe-area-inset-bottom, 0px))' }}
        >
          <button type="button" onClick={onClose} className="flex-1 py-2.5 bg-bg-elevated border border-bg-border text-gray-400 text-sm rounded-xl">Cancelar</button>
          <button type="submit" form="debt-form" className="flex-1 py-2.5 bg-accent-indigo hover:bg-accent-indigo/80 text-white text-sm font-medium rounded-xl transition-colors">Guardar</button>
        </div>
      </div>
    </div>
  )
}
