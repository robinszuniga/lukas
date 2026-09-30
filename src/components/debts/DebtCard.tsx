import { Trash2, Check, Undo2, Calendar, ArrowDownLeft, ArrowUpRight, Pencil } from 'lucide-react'
import { formatCOP } from '@/lib/currency'
import { formatDate, daysUntil } from '@/lib/dates'
import type { Debt } from '@/types'

interface Props {
  debt: Debt
  onTogglePaid: (id: number) => void
  onEdit: (debt: Debt) => void
  onDelete: (id: number) => void
}

export function DebtCard({ debt, onTogglePaid, onEdit, onDelete }: Props) {
  const owedToMe = debt.type === 'owed_to_me'
  const isPaid = debt.paid === 1
  const days = debt.due_date && !isPaid ? daysUntil(debt.due_date) : null
  const isLate = days !== null && days < 0

  return (
    <div className={`bg-bg-card border rounded-xl p-4 transition-opacity ${
      isPaid ? 'border-bg-border opacity-50' : isLate ? 'border-accent-red/30' : 'border-bg-border'
    }`}>
      <div className="flex items-start gap-3 min-w-0">
        {/* Icono dirección */}
        <div className={`shrink-0 w-9 h-9 rounded-lg flex items-center justify-center ${
          owedToMe ? 'bg-accent-green/10' : 'bg-accent-red/10'
        }`}>
          {owedToMe
            ? <ArrowDownLeft size={16} className="text-accent-green" />
            : <ArrowUpRight size={16} className="text-accent-red" />
          }
        </div>

        {/* Persona + descripción */}
        <div className="flex-1 min-w-0">
          <p className={`text-sm font-medium truncate ${isPaid ? 'text-gray-500 line-through' : 'text-white'}`}>
            {debt.person}
          </p>
          <p className="text-xs text-gray-600 truncate">
            {owedToMe ? 'Me debe' : 'Le debo'}
            {debt.description ? ` · ${debt.description}` : ''}
          </p>
          {debt.due_date && !isPaid && (
            <p className={`text-xs flex items-center gap-1 mt-0.5 ${isLate ? 'text-accent-red' : 'text-gray-600'}`}>
              <Calendar size={10} />
              {isLate ? `Venció hace ${Math.abs(days!)}d` : `Para el ${formatDate(debt.due_date)}`}
            </p>
          )}
        </div>

        {/* Monto + acciones */}
        <div className="shrink-0 flex flex-col items-end gap-1.5">
          <span className={`text-sm font-semibold ${
            isPaid ? 'text-gray-600' : owedToMe ? 'text-accent-green' : 'text-accent-red'
          }`}>
            {formatCOP(debt.amount)}
          </span>
          <div className="flex items-center gap-0.5">
            <button
              onClick={() => onTogglePaid(debt.id)}
              className={`p-1.5 rounded transition-colors ${
                isPaid
                  ? 'text-gray-600 hover:text-accent-yellow'
                  : 'text-gray-600 hover:text-accent-green'
              }`}
              title={isPaid ? 'Marcar como pendiente' : 'Marcar como saldada'}
            >
              {isPaid ? <Undo2 size={13} /> : <Check size={13} />}
            </button>
            <button
              onClick={() => onEdit(debt)}
              className="text-gray-600 hover:text-accent-indigo p-1.5 rounded transition-colors"
              title="Editar"
            >
              <Pencil size={13} />
            </button>
            <button
              onClick={() => onDelete(debt.id)}
              className="text-gray-600 hover:text-accent-red p-1.5 rounded transition-colors"
              title="Eliminar"
            >
              <Trash2 size={13} />
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
