import { useState } from 'react'
import { X } from 'lucide-react'
import { parseCOP } from '@/lib/currency'
import type { Goal } from '@/types'

const EMOJIS = ['🎯', '✈️', '🏍️', '💻', '🏠', '📱', '🎓', '💍', '🌴', '🎸', '🚗', '💰']

interface Props {
  initial?: Goal
  onSave: (data: Omit<Goal, 'id' | 'created_at'>) => void
  onClose: () => void
}

export function GoalForm({ initial, onSave, onClose }: Props) {
  const [name, setName] = useState(initial?.name ?? '')
  const [targetAmount, setTargetAmount] = useState(initial ? String(initial.target_amount) : '')
  const [savedAmount, setSavedAmount] = useState(initial ? String(initial.saved_amount) : '')
  const [deadline, setDeadline] = useState(initial?.deadline ?? '')
  const [emoji, setEmoji] = useState(initial?.emoji ?? '🎯')

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    const target = parseCOP(targetAmount)
    if (!name || target <= 0) return
    onSave({ name, target_amount: target, saved_amount: parseCOP(savedAmount) || 0, deadline: deadline || null, emoji })
  }

  const inputClass = 'w-full bg-bg-elevated border border-bg-border rounded-lg px-3 py-2.5 text-sm text-white placeholder-gray-600 outline-none focus:border-accent-indigo/50 transition-colors'

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-end sm:items-center justify-center z-[60]">
      <div className="bg-bg-card border border-bg-border rounded-t-2xl sm:rounded-2xl w-full sm:max-w-md max-h-[85dvh] flex flex-col">
        <div className="flex items-center justify-between px-5 py-4 border-b border-bg-border shrink-0">
          <h2 className="font-semibold text-white text-sm">{initial ? 'Editar meta' : 'Nueva meta'}</h2>
          <button onClick={onClose} className="text-gray-500 hover:text-white"><X size={18} /></button>
        </div>

        <form id="goal-form" onSubmit={handleSubmit} className="overflow-y-auto flex-1 px-5 py-4 space-y-3">
          <div>
            <label className="text-xs text-gray-500 mb-2 block">Emoji</label>
            <div className="flex flex-wrap gap-2">
              {EMOJIS.map((e) => (
                <button key={e} type="button" onClick={() => setEmoji(e)}
                  className={`text-xl p-2 rounded-lg transition-colors ${emoji === e ? 'bg-accent-indigo/20 border border-accent-indigo/50' : 'bg-bg-elevated hover:bg-bg-border'}`}
                >
                  {e}
                </button>
              ))}
            </div>
          </div>

          <div>
            <label className="text-xs text-gray-500 mb-1 block">Nombre</label>
            <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Ej: Viaje a Cartagena" className={inputClass} required />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs text-gray-500 block mb-1">Meta total</label>
              <input value={targetAmount} onChange={(e) => setTargetAmount(e.target.value)} placeholder="3000000" inputMode="numeric" className={inputClass} required />
            </div>
            <div>
              <label className="text-xs text-gray-500 block mb-1">Ya tengo</label>
              <input value={savedAmount} onChange={(e) => setSavedAmount(e.target.value)} placeholder="0" inputMode="numeric" className={inputClass} />
            </div>
          </div>

          <div>
            <label className="text-xs text-gray-500 block mb-1">Fecha límite (opcional)</label>
            <input type="date" value={deadline} onChange={(e) => setDeadline(e.target.value)} className={inputClass} />
          </div>
        </form>

        <div
          className="px-5 pt-3 border-t border-bg-border shrink-0 flex gap-2"
          style={{ paddingBottom: 'max(1.5rem, env(safe-area-inset-bottom, 0px))' }}
        >
          <button type="button" onClick={onClose} className="flex-1 py-2.5 bg-bg-elevated border border-bg-border text-gray-400 text-sm rounded-xl">Cancelar</button>
          <button type="submit" form="goal-form" className="flex-1 py-2.5 bg-accent-indigo hover:bg-accent-indigo/80 text-white text-sm font-medium rounded-xl transition-colors">{initial ? 'Guardar' : 'Crear meta'}</button>
        </div>
      </div>
    </div>
  )
}
