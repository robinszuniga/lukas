import { useState } from 'react'
import { Trash2, Pencil, Check, X } from 'lucide-react'
import { formatCOP } from '@/lib/currency'
import { currencyInfo, parseMoney, toInputAmount } from '@/lib/money'
import { daysUntilBilling } from '@/lib/dates'
import type { CreditCard } from '@/types'
import { iconButton } from '@/components/ui/styles'

const BANK_LOGOS: Record<string, string> = {
  'Nu': '💜',
  'Bancolombia': '🟡',
  'Davivienda': '🔴',
  'Nequi': '💙',
  'Falabella': '🟢',
  'Scotiabank': '🔵',
}

interface Props {
  card: CreditCard
  onDelete: (card: CreditCard) => void
  onUpdate: (id: number, data: Partial<CreditCard>) => void
  onEdit: (card: CreditCard) => void
}

export function CreditCardCard({ card, onDelete, onUpdate, onEdit }: Props) {
  const [editing, setEditing] = useState(false)
  const [balance, setBalance] = useState(toInputAmount(card.current_balance))
  const [invalid, setInvalid] = useState(false)

  const usePct = card.credit_limit > 0 ? (card.current_balance / card.credit_limit) * 100 : 0
  const available = card.credit_limit - card.current_balance
  const days = card.billing_day ? daysUntilBilling(card.billing_day) : null
  const logo = BANK_LOGOS[card.bank_name] ?? '💳'
  const label = `${card.bank_name}${card.last_four ? ` terminada en ${card.last_four}` : ''}`

  const isHigh = usePct >= 80
  const isMid = usePct >= 50 && usePct < 80

  const handleSaveBalance = () => {
    const text = balance.trim()
    // La factura puede quedar en cero
    const val = text === '' || /^0+$/.test(text) ? 0 : parseMoney(text)
    if (val === null) { setInvalid(true); return }
    onUpdate(card.id, { current_balance: val })
    setEditing(false)
    setInvalid(false)
  }

  return (
    <article aria-label={`Tarjeta ${label}`} className="bg-bg-card border border-bg-border rounded-xl p-5 relative overflow-hidden">
      <div
        className="absolute inset-0 opacity-5 pointer-events-none"
        style={{ background: `radial-gradient(circle at top right, ${card.color}, transparent 70%)` }}
        aria-hidden="true"
      />

      <div className="relative flex items-start justify-between mb-4 gap-2">
        <div className="flex items-center gap-2 min-w-0">
          <span className="text-2xl shrink-0" aria-hidden="true">{logo}</span>
          <div className="min-w-0">
            <h3 className="text-sm font-medium text-white truncate">{card.bank_name}</h3>
            {card.last_four && <p className="text-xs text-gray-400"><span aria-hidden="true">•••• </span><span className="sr-only">terminada en </span>{card.last_four}</p>}
          </div>
        </div>
        <div className="flex items-center shrink-0">
          <button type="button" onClick={() => onEdit(card)} className={iconButton} aria-label={`Editar tarjeta ${label}`}>
            <Pencil size={14} aria-hidden="true" />
          </button>
          <button type="button" onClick={() => onDelete(card)} className={`${iconButton} hover:text-rose-400`} aria-label={`Eliminar tarjeta ${label}`}>
            <Trash2 size={14} aria-hidden="true" />
          </button>
        </div>
      </div>

      <div className="relative mb-4">
        <div className="flex justify-between text-xs text-gray-400 mb-1.5">
          <span>Uso del cupo</span>
          <span className={isHigh ? 'text-rose-400 font-medium' : isMid ? 'text-accent-yellow' : 'text-gray-200'}>
            {Math.round(usePct)}%
          </span>
        </div>
        <div
          role="progressbar"
          aria-label={`Uso del cupo de ${card.bank_name}`}
          aria-valuemin={0}
          aria-valuemax={100}
          aria-valuenow={Math.min(Math.round(usePct), 100)}
          className="w-full bg-bg-elevated rounded-full h-2"
        >
          <div
            className="h-2 rounded-full transition-all"
            style={{
              width: `${Math.min(usePct, 100)}%`,
              backgroundColor: isHigh ? '#f43f5e' : isMid ? '#f59e0b' : card.color,
            }}
          />
        </div>
      </div>

      <dl className="relative grid grid-cols-2 gap-3 text-sm">
        <div className="min-w-0">
          <dt className="text-xs text-gray-400 mb-0.5">Factura actual</dt>
          <dd>
            {editing ? (
              <div className="flex items-center gap-1">
                <input
                  value={balance}
                  onChange={(e) => { setBalance(e.target.value); setInvalid(false) }}
                  onKeyDown={(e) => { if (e.key === 'Enter') handleSaveBalance(); if (e.key === 'Escape') setEditing(false) }}
                  inputMode={currencyInfo().decimals === 0 ? 'numeric' : 'decimal'}
                  aria-label={`Factura actual de ${card.bank_name}`}
                  aria-invalid={invalid || undefined}
                  className={`w-full min-w-0 bg-bg-elevated border rounded-lg px-2 py-1.5 text-sm text-white outline-none ${invalid ? 'border-accent-red' : 'border-accent-indigo'}`}
                  autoFocus
                />
                <button type="button" onClick={handleSaveBalance} aria-label="Guardar factura" className={`${iconButton} text-accent-green`}><Check size={15} aria-hidden="true" /></button>
                <button type="button" onClick={() => { setEditing(false); setInvalid(false) }} aria-label="Cancelar" className={iconButton}><X size={15} aria-hidden="true" /></button>
              </div>
            ) : (
              <div className="flex items-center gap-0.5">
                <span className="text-rose-400 font-semibold">{formatCOP(card.current_balance)}</span>
                <button
                  type="button"
                  onClick={() => { setBalance(toInputAmount(card.current_balance)); setEditing(true) }}
                  className={`${iconButton} w-8 h-8`}
                  aria-label={`Actualizar factura de ${card.bank_name}`}
                >
                  <Pencil size={12} aria-hidden="true" />
                </button>
              </div>
            )}
            {invalid && <p role="alert" className="text-xs text-rose-400 mt-1">Monto inválido</p>}
          </dd>
        </div>
        <div>
          <dt className="text-xs text-gray-400 mb-0.5">Disponible</dt>
          <dd className="text-accent-green font-semibold">{formatCOP(available)}</dd>
        </div>
        <div>
          <dt className="text-xs text-gray-400 mb-0.5">Cupo total</dt>
          <dd className="text-gray-200">{formatCOP(card.credit_limit)}</dd>
        </div>
        {days !== null && (
          <div>
            <dt className="text-xs text-gray-400 mb-0.5">Vence en</dt>
            <dd className={days <= 5 ? 'text-rose-400 font-medium' : 'text-gray-200'}>
              {days} día{days === 1 ? '' : 's'}
            </dd>
          </div>
        )}
      </dl>
    </article>
  )
}
