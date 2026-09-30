import { useState } from 'react'
import { Trash2, Edit2 } from 'lucide-react'
import { formatCOP, parseCOP } from '@/lib/currency'
import { daysUntilBilling } from '@/lib/dates'
import type { CreditCard } from '@/types'

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
  onDelete: (id: number) => void
  onUpdate: (id: number, data: Partial<CreditCard>) => void
  onEdit: (card: CreditCard) => void
}

export function CreditCardCard({ card, onDelete, onUpdate, onEdit }: Props) {
  const [editing, setEditing] = useState(false)
  const [balance, setBalance] = useState(String(card.current_balance))

  const usePct = card.credit_limit > 0 ? (card.current_balance / card.credit_limit) * 100 : 0
  const available = card.credit_limit - card.current_balance
  const days = card.billing_day ? daysUntilBilling(card.billing_day) : null
  const logo = BANK_LOGOS[card.bank_name] ?? '💳'

  const isHigh = usePct >= 80
  const isMid = usePct >= 50 && usePct < 80

  const handleSaveBalance = () => {
    const val = parseCOP(balance)
    if (val >= 0) onUpdate(card.id, { current_balance: val })
    setEditing(false)
  }

  return (
    <div className="bg-bg-card border border-bg-border rounded-xl p-5 relative overflow-hidden">
      <div
        className="absolute inset-0 opacity-5 pointer-events-none"
        style={{ background: `radial-gradient(circle at top right, ${card.color}, transparent 70%)` }}
      />

      <div className="flex items-start justify-between mb-4">
        <div className="flex items-center gap-2">
          <span className="text-2xl">{logo}</span>
          <div>
            <h3 className="text-sm font-medium text-white">{card.bank_name}</h3>
            {card.last_four && <p className="text-xs text-gray-600">•••• {card.last_four}</p>}
          </div>
        </div>
        <div className="flex items-center gap-0.5">
          <button onClick={() => onEdit(card)} className="text-gray-600 hover:text-accent-indigo p-1 rounded transition-colors" title="Editar">
            <Edit2 size={13} />
          </button>
          <button onClick={() => onDelete(card.id)} className="text-gray-600 hover:text-accent-red p-1 rounded transition-colors" title="Eliminar">
            <Trash2 size={14} />
          </button>
        </div>
      </div>

      <div className="mb-4">
        <div className="flex justify-between text-xs text-gray-500 mb-1.5">
          <span>Uso del cupo</span>
          <span className={isHigh ? 'text-accent-red font-medium' : isMid ? 'text-accent-yellow' : 'text-gray-400'}>
            {Math.round(usePct)}%
          </span>
        </div>
        <div className="w-full bg-bg-elevated rounded-full h-2">
          <div
            className="h-2 rounded-full transition-all"
            style={{
              width: `${Math.min(usePct, 100)}%`,
              backgroundColor: isHigh ? '#f43f5e' : isMid ? '#f59e0b' : card.color,
            }}
          />
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3 text-sm">
        <div>
          <p className="text-xs text-gray-600 mb-0.5">Factura actual</p>
          {editing ? (
            <div className="flex gap-1">
              <input
                value={balance}
                onChange={(e) => setBalance(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleSaveBalance()}
                className="w-full bg-bg-elevated border border-bg-border rounded px-2 py-0.5 text-xs text-white outline-none"
                autoFocus
              />
              <button onClick={handleSaveBalance} className="text-xs text-accent-green">✓</button>
            </div>
          ) : (
            <div className="flex items-center gap-1">
              <span className="text-accent-red font-semibold">{formatCOP(card.current_balance)}</span>
              <button onClick={() => setEditing(true)} className="text-gray-600 hover:text-gray-400">
                <Edit2 size={10} />
              </button>
            </div>
          )}
        </div>
        <div>
          <p className="text-xs text-gray-600 mb-0.5">Disponible</p>
          <span className="text-accent-green font-semibold">{formatCOP(available)}</span>
        </div>
        <div>
          <p className="text-xs text-gray-600 mb-0.5">Cupo total</p>
          <span className="text-gray-300">{formatCOP(card.credit_limit)}</span>
        </div>
        {days !== null && (
          <div>
            <p className="text-xs text-gray-600 mb-0.5">Vence en</p>
            <span className={days <= 5 ? 'text-accent-red font-medium' : 'text-gray-300'}>
              {days} días
            </span>
          </div>
        )}
      </div>
    </div>
  )
}
