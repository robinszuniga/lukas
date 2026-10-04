import { useState } from 'react'
import { Trash2, Pencil, Check, X, RefreshCw } from 'lucide-react'
import { formatCOP } from '@/lib/currency'
import { currencyInfo, parseMoney, toInputAmount } from '@/lib/money'
import type { Account } from '@/types'
import { iconButton } from '@/components/ui/styles'

interface Props {
  account: Account
  onUpdateBalance: (id: number, balance: number) => void
  onEdit: (account: Account) => void
  onDelete: (account: Account) => void
}

export function AccountRow({ account, onUpdateBalance, onEdit, onDelete }: Props) {
  const [editing, setEditing] = useState(false)
  const [value, setValue] = useState(toInputAmount(account.balance))
  const [invalid, setInvalid] = useState(false)

  const handleSave = () => {
    const text = value.trim()
    // Un saldo puede ser cero
    const v = text === '' || /^0+$/.test(text) ? 0 : parseMoney(text)
    if (v === null) { setInvalid(true); return }
    onUpdateBalance(account.id, v)
    setEditing(false)
    setInvalid(false)
  }

  return (
    <li className="bg-bg-card border border-bg-border rounded-xl pl-4 pr-1.5 py-1.5 min-w-0">
      <div className="flex items-center gap-3 min-w-0">
        <span className="shrink-0 w-2.5 h-2.5 rounded-full" style={{ backgroundColor: account.color }} aria-hidden="true" />
        <span className="text-sm text-gray-100 truncate flex-1 min-w-0 py-2">{account.name}</span>

        {editing ? (
          <div className="flex items-center gap-1 shrink-0">
            <input
              value={value}
              onChange={(e) => { setValue(e.target.value); setInvalid(false) }}
              onKeyDown={(e) => { if (e.key === 'Enter') handleSave(); if (e.key === 'Escape') setEditing(false) }}
              inputMode={currencyInfo().decimals === 0 ? 'numeric' : 'decimal'}
              autoFocus
              aria-label={`Nuevo saldo de ${account.name}`}
              aria-invalid={invalid || undefined}
              className={`w-28 bg-bg-elevated border rounded-lg px-2 py-1.5 text-sm text-white outline-none ${invalid ? 'border-accent-red' : 'border-accent-indigo'}`}
            />
            <button type="button" onClick={handleSave} aria-label="Guardar saldo" className={`${iconButton} text-accent-green`}><Check size={15} aria-hidden="true" /></button>
            <button type="button" onClick={() => { setEditing(false); setInvalid(false) }} aria-label="Cancelar" className={iconButton}><X size={15} aria-hidden="true" /></button>
          </div>
        ) : (
          <div className="flex items-center shrink-0">
            <span className={`text-sm font-semibold mr-1 ${account.balance >= 0 ? 'text-accent-cyan' : 'text-rose-400'}`}>
              {formatCOP(account.balance)}
            </span>
            <button
              type="button"
              onClick={() => { setValue(toInputAmount(account.balance)); setEditing(true) }}
              className={iconButton}
              aria-label={`Actualizar saldo de ${account.name}`}
            >
              <RefreshCw size={13} aria-hidden="true" />
            </button>
            <button type="button" onClick={() => onEdit(account)} className={iconButton} aria-label={`Editar cuenta ${account.name}`}>
              <Pencil size={13} aria-hidden="true" />
            </button>
            <button type="button" onClick={() => onDelete(account)} className={`${iconButton} hover:text-rose-400`} aria-label={`Eliminar cuenta ${account.name}`}>
              <Trash2 size={13} aria-hidden="true" />
            </button>
          </div>
        )}
      </div>
      {invalid && <p role="alert" className="text-xs text-rose-400 pb-1.5">Monto inválido</p>}
    </li>
  )
}
