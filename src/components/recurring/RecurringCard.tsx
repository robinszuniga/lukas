import { Trash2, CheckCircle2, CalendarDays, Pencil, Undo2 } from 'lucide-react'
import { formatCOP } from '@/lib/currency'
import { currentMonth } from '@/lib/dates'
import { CATEGORY_ICONS } from '@/types'
import type { Recurring, Category, PaymentLogEntry } from '@/types'
import { ReminderButton, type ReminderState } from '@/components/reminders/ReminderDialog'
import { iconButton } from '@/components/ui/styles'

interface Props {
  item: Recurring
  /** Último pago hecho desde la app (si es de este mes, se puede deshacer) */
  lastPayment?: PaymentLogEntry
  reminder: ReminderState
  onPost: (item: Recurring) => void
  onUndo: (item: Recurring) => void
  onEdit: (item: Recurring) => void
  onDelete: (item: Recurring) => void
  onReminder: (item: Recurring) => void
}

export function RecurringCard({ item, lastPayment, reminder, onPost, onUndo, onEdit, onDelete, onReminder }: Props) {
  const month = currentMonth()
  const postedThisMonth = item.last_posted === month
  const dayOfMonth = new Date().getDate()
  const isDue = !postedThisMonth && dayOfMonth >= item.day
  const canUndo = postedThisMonth && lastPayment?.period === month

  return (
    <article
      aria-label={`Pago fijo ${item.name}`}
      className={`bg-bg-card border rounded-xl px-4 pt-3 pb-1.5 ${isDue ? 'border-accent-yellow/40' : 'border-bg-border'}`}
    >
      <div className="flex items-center gap-3 min-w-0">
        <div className="shrink-0 w-9 h-9 rounded-lg bg-bg-elevated flex items-center justify-center text-base" aria-hidden="true">
          {CATEGORY_ICONS[item.category as Category] ?? '📦'}
        </div>

        <div className="flex-1 min-w-0">
          <h3 className="text-sm text-gray-100 truncate">{item.name}</h3>
          <p className="text-xs text-gray-400 flex items-center gap-1 min-w-0">
            <CalendarDays size={10} className="shrink-0" aria-hidden="true" />
            <span className="truncate">
              Cada día {item.day}
              {item.payment_method ? ` · ${item.payment_method}` : ''}
            </span>
          </p>
        </div>

        <span className="shrink-0 text-sm font-semibold text-gray-100">{formatCOP(item.amount)}</span>
      </div>

      <div className="flex items-center justify-between gap-2 mt-1">
        {postedThisMonth ? (
          <div className="flex items-center gap-3 min-w-0">
            <span className="text-xs text-accent-green flex items-center gap-1">
              <CheckCircle2 size={12} aria-hidden="true" /> Pagado este mes
            </span>
            {canUndo && (
              <button
                type="button"
                onClick={() => onUndo(item)}
                aria-label={`Deshacer el pago de ${item.name}`}
                className="inline-flex items-center gap-1 text-xs text-accent-cyan py-2"
              >
                <Undo2 size={12} aria-hidden="true" /> Deshacer
              </button>
            )}
          </div>
        ) : (
          <button
            type="button"
            onClick={() => onPost(item)}
            aria-label={`Pagar ${item.name}`}
            className={`text-xs font-medium px-3 py-2 rounded-lg border transition-colors ${
              isDue
                ? 'bg-accent-yellow/10 border-accent-yellow/40 text-accent-yellow hover:bg-accent-yellow/20'
                : 'bg-accent-green/10 border-accent-green/40 text-accent-green hover:bg-accent-green/20'
            }`}
          >
            {isDue ? 'Pagar (pendiente)' : 'Pagar'}
          </button>
        )}

        <div className="flex items-center shrink-0">
          <ReminderButton name={item.name} state={reminder} onClick={() => onReminder(item)} />
          <button type="button" onClick={() => onEdit(item)} className={iconButton} aria-label={`Editar pago fijo ${item.name}`}>
            <Pencil size={14} aria-hidden="true" />
          </button>
          <button type="button" onClick={() => onDelete(item)} className={`${iconButton} hover:text-rose-400`} aria-label={`Eliminar pago fijo ${item.name}`}>
            <Trash2 size={14} aria-hidden="true" />
          </button>
        </div>
      </div>
    </article>
  )
}
