import { Trash2, Check, Undo2, Calendar, ArrowDownLeft, ArrowUpRight, Pencil } from 'lucide-react'
import { formatCOP } from '@/lib/currency'
import { formatDate, daysUntil } from '@/lib/dates'
import type { Debt } from '@/types'
import { ReminderButton, type ReminderState } from '@/components/reminders/ReminderDialog'
import { iconButton } from '@/components/ui/styles'

interface Props {
  debt: Debt
  reminder: ReminderState
  onTogglePaid: (debt: Debt) => void
  onEdit: (debt: Debt) => void
  onDelete: (debt: Debt) => void
  onReminder: (debt: Debt) => void
}

export function DebtCard({ debt, reminder, onTogglePaid, onEdit, onDelete, onReminder }: Props) {
  const owedToMe = debt.type === 'owed_to_me'
  const isPaid = debt.paid === 1
  const days = debt.due_date && !isPaid ? daysUntil(debt.due_date) : null
  const isLate = days !== null && days < 0

  return (
    <article
      aria-label={`${owedToMe ? 'Me debe' : 'Le debo a'} ${debt.person}${isPaid ? ', saldada' : ''}`}
      className={`bg-bg-card border rounded-xl px-4 pt-3 pb-1.5 ${isLate ? 'border-accent-red/40' : 'border-bg-border'}`}
    >
      <div className={`flex items-start gap-3 min-w-0 ${isPaid ? 'opacity-70' : ''}`}>
        <div
          className={`shrink-0 w-9 h-9 rounded-lg flex items-center justify-center ${owedToMe ? 'bg-accent-green/10' : 'bg-accent-red/10'}`}
          aria-hidden="true"
        >
          {owedToMe
            ? <ArrowDownLeft size={16} className="text-accent-green" />
            : <ArrowUpRight size={16} className="text-rose-400" />
          }
        </div>

        <div className="flex-1 min-w-0">
          <h3 className={`text-sm font-medium truncate ${isPaid ? 'text-gray-400 line-through' : 'text-white'}`}>
            {debt.person}
          </h3>
          <p className="text-xs text-gray-400 truncate">
            {owedToMe ? 'Me debe' : 'Le debo'}
            {debt.description ? ` · ${debt.description}` : ''}
          </p>
          {debt.due_date && !isPaid && (
            <p className={`text-xs flex items-center gap-1 mt-0.5 ${isLate ? 'text-rose-400' : 'text-gray-400'}`}>
              <Calendar size={10} aria-hidden="true" />
              {isLate ? `Venció hace ${Math.abs(days!)} día${Math.abs(days!) === 1 ? '' : 's'}` : `Para el ${formatDate(debt.due_date)}`}
            </p>
          )}
        </div>

        <span className={`shrink-0 text-sm font-semibold ${isPaid ? 'text-gray-400' : owedToMe ? 'text-accent-green' : 'text-rose-400'}`}>
          {formatCOP(debt.amount)}
        </span>
      </div>

      <div className="flex items-center justify-between gap-2 mt-1">
        <button
          type="button"
          onClick={() => onTogglePaid(debt)}
          aria-label={isPaid ? `Volver a dejar pendiente la deuda de ${debt.person}` : `Marcar como saldada la deuda de ${debt.person}`}
          className={`inline-flex items-center gap-1.5 text-xs font-medium px-3 py-2 rounded-lg border transition-colors ${
            isPaid
              ? 'border-bg-field text-gray-200 hover:border-gray-400'
              : 'bg-accent-green/10 border-accent-green/40 text-accent-green hover:bg-accent-green/20'
          }`}
        >
          {isPaid ? <Undo2 size={12} aria-hidden="true" /> : <Check size={12} aria-hidden="true" />}
          {isPaid ? 'Dejar pendiente' : 'Marcar saldada'}
        </button>

        <div className="flex items-center shrink-0">
          {!isPaid && <ReminderButton name={debt.person} state={reminder} onClick={() => onReminder(debt)} />}
          <button type="button" onClick={() => onEdit(debt)} className={iconButton} aria-label={`Editar deuda de ${debt.person}`}>
            <Pencil size={14} aria-hidden="true" />
          </button>
          <button type="button" onClick={() => onDelete(debt)} className={`${iconButton} hover:text-rose-400`} aria-label={`Eliminar deuda de ${debt.person}`}>
            <Trash2 size={14} aria-hidden="true" />
          </button>
        </div>
      </div>
    </article>
  )
}
