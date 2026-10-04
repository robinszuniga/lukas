import { useState } from 'react'
import { Trash2, Pencil } from 'lucide-react'
import { formatCOP } from '@/lib/currency'
import { formatDate } from '@/lib/dates'
import { CATEGORY_ICONS } from '@/types'
import type { Transaction, Category } from '@/types'
import { EditTransactionModal } from './EditTransactionModal'
import { iconButton } from '@/components/ui/styles'

interface Props {
  transactions: Transaction[]
  /** Recibe el movimiento completo: quien lo llama muestra qué se va a eliminar */
  onDelete: (tx: Transaction) => void
  onUpdate: (id: number, data: Partial<Transaction>) => Promise<void>
}

export function TransactionList({ transactions, onDelete, onUpdate }: Props) {
  const [editing, setEditing] = useState<Transaction | null>(null)

  if (transactions.length === 0) {
    return (
      <div className="text-center py-16 text-gray-400">
        <p className="text-4xl mb-3" aria-hidden="true">📭</p>
        <p className="text-sm">No hay movimientos con estos filtros</p>
      </div>
    )
  }

  return (
    <>
      <ul className="space-y-2">
        {transactions.map((tx) => {
          const name = tx.description || tx.category
          const isIncome = tx.type === 'income'
          return (
            <li key={tx.id} className="bg-bg-card border border-bg-border rounded-xl pl-3 pr-1.5 py-2.5">
              <div className="flex items-start gap-3">
                <div className="w-8 h-8 mt-0.5 rounded-lg bg-bg-elevated flex items-center justify-center text-base shrink-0" aria-hidden="true">
                  {CATEGORY_ICONS[tx.category as Category] ?? '📦'}
                </div>

                <div className="flex-1 min-w-0">
                  <div className="flex items-baseline justify-between gap-2 pr-1.5">
                    <p className="text-sm text-gray-100 truncate min-w-0">{name}</p>
                    <p className={`shrink-0 text-sm font-semibold ${isIncome ? 'text-accent-green' : 'text-gray-100'}`}>
                      <span className="sr-only">{isIncome ? 'Ingreso de ' : 'Gasto de '}</span>
                      <span aria-hidden="true">{isIncome ? '+' : '−'}</span>{formatCOP(tx.amount)}
                    </p>
                  </div>
                  <div className="flex items-center justify-between gap-2">
                    <p className="text-xs text-gray-400 truncate min-w-0">
                      {tx.category}
                      {tx.payment_method ? ` · ${tx.payment_method}` : ''}
                      {` · ${formatDate(tx.date)}`}
                    </p>
                    <div className="flex items-center shrink-0">
                      <button type="button" onClick={() => setEditing(tx)} className={iconButton} aria-label={`Editar movimiento: ${name}`}>
                        <Pencil size={14} aria-hidden="true" />
                      </button>
                      <button type="button" onClick={() => onDelete(tx)} className={`${iconButton} hover:text-rose-400`} aria-label={`Eliminar movimiento: ${name}`}>
                        <Trash2 size={14} aria-hidden="true" />
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            </li>
          )
        })}
      </ul>

      {editing && (
        <EditTransactionModal
          transaction={editing}
          onSave={(data) => onUpdate(editing.id, data)}
          onClose={() => setEditing(null)}
        />
      )}
    </>
  )
}
