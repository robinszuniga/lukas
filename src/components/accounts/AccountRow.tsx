import { useState } from 'react'
import { Trash2, Pencil, Check } from 'lucide-react'
import { formatCOP, parseCOP } from '@/lib/currency'
import type { Account } from '@/types'

interface Props {
  account: Account
  onUpdateBalance: (id: number, balance: number) => void
  onEdit: (account: Account) => void
  onDelete: (id: number) => void
}

export function AccountRow({ account, onUpdateBalance, onEdit, onDelete }: Props) {
  const [editing, setEditing] = useState(false)
  const [value, setValue] = useState(String(account.balance))

  const handleSave = () => {
    const v = parseCOP(value)
    if (v >= 0) onUpdateBalance(account.id, v)
    setEditing(false)
  }

  return (
    <div className="flex items-center gap-3 bg-bg-card border border-bg-border rounded-xl px-4 py-3 min-w-0">
      <span className="shrink-0 w-2.5 h-2.5 rounded-full" style={{ backgroundColor: account.color }} />
      <button
        onClick={() => onEdit(account)}
        className="text-sm text-gray-200 truncate flex-1 min-w-0 text-left hover:text-accent-indigo transition-colors"
        title="Editar cuenta"
      >
        {account.name}
      </button>

      {editing ? (
        <div className="flex items-center gap-1.5 shrink-0">
          <input
            value={value}
            onChange={(e) => setValue(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleSave()}
            inputMode="numeric"
            autoFocus
            className="w-28 bg-bg-elevated border border-bg-border rounded-lg px-2 py-1 text-sm text-white outline-none focus:border-accent-indigo/50"
          />
          <button onClick={handleSave} className="text-accent-green p-1"><Check size={14} /></button>
        </div>
      ) : (
        <div className="flex items-center gap-1 shrink-0">
          <span className={`text-sm font-semibold ${account.balance >= 0 ? 'text-accent-cyan' : 'text-accent-red'}`}>
            {formatCOP(account.balance)}
          </span>
          <button
            onClick={() => { setValue(String(account.balance)); setEditing(true) }}
            className="text-gray-600 hover:text-accent-cyan p-1.5 rounded transition-colors"
            title="Actualizar saldo"
          >
            <Pencil size={12} />
          </button>
          <button
            onClick={() => onDelete(account.id)}
            className="text-gray-600 hover:text-accent-red p-1.5 rounded transition-colors"
            title="Eliminar"
          >
            <Trash2 size={12} />
          </button>
        </div>
      )}
    </div>
  )
}
