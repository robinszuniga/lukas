import { useState } from 'react'
import { Trash2, Plus, Pencil } from 'lucide-react'
import { formatCOP, parseCOP } from '@/lib/currency'
import { formatDate } from '@/lib/dates'
import type { Goal } from '@/types'

interface Props {
  goal: Goal
  onAdd: (id: number, amount: number) => void
  onEdit: (goal: Goal) => void
  onDelete: (id: number) => void
}

export function GoalCard({ goal, onAdd, onEdit, onDelete }: Props) {
  const [adding, setAdding] = useState(false)
  const [inputVal, setInputVal] = useState('')
  const pct = Math.min((goal.saved_amount / goal.target_amount) * 100, 100)
  const done = pct >= 100

  const handleAdd = () => {
    const amount = parseCOP(inputVal)
    if (amount > 0) {
      onAdd(goal.id, amount)
      setInputVal('')
      setAdding(false)
    }
  }

  return (
    <div className={`bg-bg-card border rounded-xl p-4 ${done ? 'border-accent-green/30' : 'border-bg-border'}`}>
      {/* Header */}
      <div className="flex items-start gap-2 mb-3 min-w-0">
        <span className="text-2xl shrink-0">{goal.emoji}</span>
        <div className="flex-1 min-w-0">
          <h3 className="text-sm font-medium text-white truncate">{goal.name}</h3>
          {goal.deadline && (
            <p className="text-xs text-gray-600">Meta: {formatDate(goal.deadline)}</p>
          )}
        </div>
        <div className="flex items-center gap-1 shrink-0">
          {!done && (
            <button
              onClick={() => setAdding(!adding)}
              className="text-xs bg-accent-indigo/10 hover:bg-accent-indigo/20 text-accent-indigo border border-accent-indigo/30 px-2.5 py-1 rounded-lg transition-colors"
            >
              <Plus size={12} />
            </button>
          )}
          <button onClick={() => onEdit(goal)} className="text-gray-600 hover:text-accent-indigo p-1 rounded transition-colors" title="Editar">
            <Pencil size={13} />
          </button>
          <button onClick={() => onDelete(goal.id)} className="text-gray-600 hover:text-accent-red p-1 rounded transition-colors" title="Eliminar">
            <Trash2 size={14} />
          </button>
        </div>
      </div>

      {/* Barra */}
      <div className="mb-2">
        <div className="flex justify-between text-xs text-gray-500 mb-1">
          <span>{formatCOP(goal.saved_amount)} ahorrado</span>
          <span className={done ? 'text-accent-green font-medium' : ''}>{Math.round(pct)}%</span>
        </div>
        <div className="w-full bg-bg-elevated rounded-full h-2">
          <div
            className={`h-2 rounded-full transition-all ${done ? 'bg-accent-green' : 'bg-gradient-to-r from-accent-indigo to-accent-cyan'}`}
            style={{ width: `${pct}%` }}
          />
        </div>
        <div className="flex justify-between text-xs text-gray-600 mt-1">
          <span>Meta: {formatCOP(goal.target_amount)}</span>
          {!done && <span>Faltan {formatCOP(goal.target_amount - goal.saved_amount)}</span>}
        </div>
      </div>

      {/* Input abonar */}
      {adding && (
        <div className="flex gap-2 mt-3">
          <input
            value={inputVal}
            onChange={(e) => setInputVal(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleAdd()}
            placeholder="Monto a abonar"
            inputMode="numeric"
            autoFocus
            className="flex-1 min-w-0 bg-bg-elevated border border-bg-border rounded-lg px-3 py-2 text-sm text-white placeholder-gray-600 outline-none focus:border-accent-indigo/50"
          />
          <button
            onClick={handleAdd}
            className="shrink-0 bg-accent-indigo hover:bg-accent-indigo/80 text-white px-3 py-2 rounded-lg text-sm transition-colors"
          >
            Abonar
          </button>
        </div>
      )}
    </div>
  )
}
