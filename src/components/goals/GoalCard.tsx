import { useId, useState } from 'react'
import { Trash2, Plus, Pencil } from 'lucide-react'
import { formatCOP } from '@/lib/currency'
import { amountErrorMessage, currencyInfo, parseMoney } from '@/lib/money'
import { formatDate } from '@/lib/dates'
import type { Goal } from '@/types'
import { iconButton } from '@/components/ui/styles'

interface Props {
  goal: Goal
  onAdd: (id: number, amount: number) => void
  onEdit: (goal: Goal) => void
  onDelete: (goal: Goal) => void
}

export function GoalCard({ goal, onAdd, onEdit, onDelete }: Props) {
  const [adding, setAdding] = useState(false)
  const [inputVal, setInputVal] = useState('')
  const [error, setError] = useState<string | null>(null)
  const inputId = useId()
  const pct = goal.target_amount > 0 ? Math.min((goal.saved_amount / goal.target_amount) * 100, 100) : 0
  const done = pct >= 100

  const handleAdd = () => {
    const amount = parseMoney(inputVal)
    if (amount === null) { setError(amountErrorMessage()); return }
    onAdd(goal.id, amount)
    setInputVal('')
    setError(null)
    setAdding(false)
  }

  return (
    <article aria-label={`Meta ${goal.name}`} className={`bg-bg-card border rounded-xl p-4 ${done ? 'border-accent-green/40' : 'border-bg-border'}`}>
      <div className="flex items-start gap-2 mb-3 min-w-0">
        <span className="text-2xl shrink-0" aria-hidden="true">{goal.emoji}</span>
        <div className="flex-1 min-w-0">
          <h3 className="text-sm font-medium text-white truncate">{goal.name}</h3>
          {goal.deadline && <p className="text-xs text-gray-400">Para el {formatDate(goal.deadline)}</p>}
        </div>
        <div className="flex items-center shrink-0">
          {!done && (
            <button
              type="button"
              onClick={() => setAdding(!adding)}
              aria-expanded={adding}
              aria-label={`Abonar a la meta ${goal.name}`}
              className={`${iconButton} !text-indigo-300 border border-accent-indigo/50 bg-accent-indigo/10`}
            >
              <Plus size={15} aria-hidden="true" />
            </button>
          )}
          <button type="button" onClick={() => onEdit(goal)} className={iconButton} aria-label={`Editar meta ${goal.name}`}>
            <Pencil size={14} aria-hidden="true" />
          </button>
          <button type="button" onClick={() => onDelete(goal)} className={`${iconButton} hover:text-rose-400`} aria-label={`Eliminar meta ${goal.name}`}>
            <Trash2 size={14} aria-hidden="true" />
          </button>
        </div>
      </div>

      <div className="mb-2">
        <div className="flex justify-between text-xs text-gray-400 mb-1">
          <span>{formatCOP(goal.saved_amount)} ahorrado</span>
          <span className={done ? 'text-accent-green font-medium' : ''}>{Math.round(pct)}%</span>
        </div>
        <div
          role="progressbar"
          aria-label={`Avance de la meta ${goal.name}`}
          aria-valuemin={0}
          aria-valuemax={100}
          aria-valuenow={Math.round(pct)}
          className="w-full bg-bg-elevated rounded-full h-2"
        >
          <div
            className={`h-2 rounded-full transition-all ${done ? 'bg-accent-green' : 'bg-gradient-to-r from-accent-indigo to-accent-cyan'}`}
            style={{ width: `${pct}%` }}
          />
        </div>
        <div className="flex justify-between text-xs text-gray-400 mt-1">
          <span>Meta: {formatCOP(goal.target_amount)}</span>
          {!done && <span>Faltan {formatCOP(goal.target_amount - goal.saved_amount)}</span>}
        </div>
      </div>

      {adding && (
        <div className="mt-3">
          <label htmlFor={inputId} className="sr-only">Monto a abonar a {goal.name}</label>
          <div className="flex gap-2">
            <input
              id={inputId}
              value={inputVal}
              onChange={(e) => { setInputVal(e.target.value); setError(null) }}
              onKeyDown={(e) => e.key === 'Enter' && handleAdd()}
              placeholder="Monto a abonar"
              inputMode={currencyInfo().decimals === 0 ? 'numeric' : 'decimal'}
              autoFocus
              aria-invalid={error ? true : undefined}
              className="flex-1 min-w-0 bg-bg-elevated border border-bg-field rounded-lg px-3 py-2 text-sm text-white placeholder-gray-450 outline-none focus:border-accent-indigo"
            />
            <button
              type="button"
              onClick={handleAdd}
              className="shrink-0 bg-indigo-600 hover:bg-indigo-500 text-white px-3 py-2 rounded-lg text-sm transition-colors"
            >
              Abonar
            </button>
          </div>
          {error && <p role="alert" className="text-xs text-rose-400 mt-1">{error}</p>}
        </div>
      )}
    </article>
  )
}
