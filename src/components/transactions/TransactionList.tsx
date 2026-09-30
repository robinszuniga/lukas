import { useState } from 'react'
import { Trash2, TrendingUp, TrendingDown, Pencil } from 'lucide-react'
import { formatCOP } from '@/lib/currency'
import { formatDate } from '@/lib/dates'
import { CATEGORY_ICONS } from '@/types'
import type { Transaction, Category } from '@/types'
import { EditTransactionModal } from './EditTransactionModal'

interface Props {
  transactions: Transaction[]
  onDelete: (id: number) => void
  onUpdate: (id: number, data: Partial<Transaction>) => Promise<void>
}

export function TransactionList({ transactions, onDelete, onUpdate }: Props) {
  const [editing, setEditing] = useState<Transaction | null>(null)

  if (transactions.length === 0) {
    return (
      <div className="text-center py-16 text-gray-600">
        <p className="text-4xl mb-3">📭</p>
        <p className="text-sm">Sin transacciones para mostrar</p>
      </div>
    )
  }

  return (
    <>
      <div className="space-y-2">
        {transactions.map((tx) => (
          <div
            key={tx.id}
            className="flex items-center gap-3 bg-bg-card border border-bg-border hover:border-bg-elevated rounded-xl px-4 py-3 group transition-colors"
          >
            <div className="w-8 h-8 rounded-lg bg-bg-elevated flex items-center justify-center text-base shrink-0">
              {CATEGORY_ICONS[tx.category as Category] ?? '📦'}
            </div>

            <div className="flex-1 min-w-0">
              <p className="text-sm text-gray-200 truncate">{tx.description || tx.category}</p>
              <div className="flex items-center gap-2 mt-0.5 flex-wrap">
                <span className="text-xs text-gray-600">{tx.category}</span>
                {tx.payment_method && (
                  <>
                    <span className="text-gray-700">·</span>
                    <span className="text-xs text-gray-600">{tx.payment_method}</span>
                  </>
                )}
                <span className="text-gray-700">·</span>
                <span className="text-xs text-gray-600">{formatDate(tx.date)}</span>
              </div>
            </div>

            <div className="flex items-center gap-1">
              <div className={`flex items-center gap-1 text-sm font-semibold ${
                tx.type === 'income' ? 'text-accent-green' : 'text-accent-red'
              }`}>
                {tx.type === 'income' ? <TrendingUp size={12} /> : <TrendingDown size={12} />}
                {tx.type === 'income' ? '+' : '-'}{formatCOP(tx.amount)}
              </div>

              {/* Botones: siempre visibles en móvil, solo en hover en desktop */}
              <div className="flex items-center gap-0.5 ml-2 md:opacity-0 md:group-hover:opacity-100 transition-opacity">
                <button
                  onClick={() => setEditing(tx)}
                  className="text-gray-600 hover:text-accent-indigo transition-colors p-1.5 rounded"
                  title="Editar"
                >
                  <Pencil size={13} />
                </button>
                <button
                  onClick={() => onDelete(tx.id)}
                  className="text-gray-600 hover:text-accent-red transition-colors p-1.5 rounded"
                  title="Eliminar"
                >
                  <Trash2 size={13} />
                </button>
              </div>
            </div>
          </div>
        ))}
      </div>

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
