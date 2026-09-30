import { Trash2, CheckCircle2, CalendarDays, Pencil } from 'lucide-react'
import { formatCOP } from '@/lib/currency'
import { currentMonth } from '@/lib/dates'
import { CATEGORY_ICONS } from '@/types'
import type { Recurring, Category } from '@/types'

interface Props {
  item: Recurring
  onPost: (id: number) => void
  onEdit: (item: Recurring) => void
  onDelete: (id: number) => void
}

export function RecurringCard({ item, onPost, onEdit, onDelete }: Props) {
  const postedThisMonth = item.last_posted === currentMonth()
  const dayOfMonth = new Date().getDate()
  const isDue = !postedThisMonth && dayOfMonth >= item.day

  return (
    <div className={`bg-bg-card border rounded-xl px-4 py-3 flex items-center gap-3 min-w-0 ${
      isDue ? 'border-accent-yellow/30' : 'border-bg-border'
    }`}>
      <div className="shrink-0 w-9 h-9 rounded-lg bg-bg-elevated flex items-center justify-center text-base">
        {CATEGORY_ICONS[item.category as Category] ?? '📦'}
      </div>

      <div className="flex-1 min-w-0">
        <p className="text-sm text-gray-200 truncate">{item.name}</p>
        <p className="text-xs text-gray-600 flex items-center gap-1">
          <CalendarDays size={10} />
          Cada día {item.day}
          {item.payment_method ? ` · ${item.payment_method}` : ''}
        </p>
      </div>

      <div className="shrink-0 flex flex-col items-end gap-1">
        <span className="text-sm font-semibold text-gray-200">{formatCOP(item.amount)}</span>
        <div className="flex items-center gap-1">
          {postedThisMonth ? (
            <span className="text-xs text-accent-green flex items-center gap-1">
              <CheckCircle2 size={11} /> Pagado
            </span>
          ) : (
            <button
              onClick={() => onPost(item.id)}
              className={`text-xs px-2.5 py-1 rounded-lg border transition-colors ${
                isDue
                  ? 'bg-accent-yellow/10 border-accent-yellow/30 text-accent-yellow hover:bg-accent-yellow/20'
                  : 'bg-accent-indigo/10 border-accent-indigo/30 text-accent-indigo hover:bg-accent-indigo/20'
              }`}
            >
              Registrar
            </button>
          )}
          <button onClick={() => onEdit(item)} className="text-gray-600 hover:text-accent-indigo p-1 rounded transition-colors" title="Editar">
            <Pencil size={12} />
          </button>
          <button onClick={() => onDelete(item.id)} className="text-gray-600 hover:text-accent-red p-1 rounded transition-colors" title="Eliminar">
            <Trash2 size={12} />
          </button>
        </div>
      </div>
    </div>
  )
}
