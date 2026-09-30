import { useMemo, useState } from 'react'
import { Check, CalendarDays } from 'lucide-react'
import { CATEGORIES, CATEGORY_ICONS } from '@/types'
import type { Category, TransactionType } from '@/types'
import { formatCOP } from '@/lib/currency'
import { today } from '@/lib/dates'
import { useAccounts } from '@/hooks/useAccounts'
import { useCards } from '@/hooks/useCards'
import { db } from '@/lib/db'

const LAST_METHOD_KEY = 'lukas_last_method'

interface Props {
  onSaved: () => void
}

function formatTyping(raw: string): string {
  const digits = raw.replace(/[^0-9]/g, '')
  if (!digits) return ''
  return Number(digits).toLocaleString('es-CO')
}

/** Registro manual en dos toques: monto + categoría. Funciona sin internet. */
export function QuickAdd({ onSaved }: Props) {
  const { accounts } = useAccounts()
  const { cards } = useCards()

  const [type, setType] = useState<TransactionType>('expense')
  const [amountText, setAmountText] = useState('')
  const [category, setCategory] = useState<Category | null>(null)
  const [method, setMethod] = useState<string | null>(() => {
    try { return localStorage.getItem(LAST_METHOD_KEY) } catch { return null }
  })
  const [description, setDescription] = useState('')
  const [date, setDate] = useState(today())
  const [showDate, setShowDate] = useState(false)
  const [saving, setSaving] = useState(false)
  const [toast, setToast] = useState<string | null>(null)

  const methods = useMemo(() => {
    const names = [...accounts.map((a) => a.name), ...cards.map((c) => c.bank_name), 'Efectivo']
    return Array.from(new Set(names.map((n) => n.trim()).filter(Boolean)))
  }, [accounts, cards])

  const amount = Number(amountText.replace(/[^0-9]/g, ''))
  const canSave = amount > 0 && !!category && !saving

  const reset = () => {
    setAmountText('')
    setCategory(null)
    setDescription('')
    setDate(today())
    setShowDate(false)
  }

  const handleSave = async () => {
    if (!canSave || !category) return
    setSaving(true)
    try {
      await db.createTransaction({
        amount,
        type,
        category,
        description: description.trim() || category,
        payment_method: method,
        date,
      })
      if (method) localStorage.setItem(LAST_METHOD_KEY, method)
      setToast(`${type === 'income' ? 'Ingreso' : 'Gasto'} de ${formatCOP(amount)} · ${category}`)
      setTimeout(() => setToast(null), 2500)
      reset()
      onSaved()
    } finally {
      setSaving(false)
    }
  }

  const isIncome = type === 'income'

  return (
    <div className="space-y-4">
      {/* Gasto / Ingreso */}
      <div className="grid grid-cols-2 bg-bg-card border border-bg-border rounded-xl p-1">
        <button
          onClick={() => setType('expense')}
          className={`py-2 rounded-lg text-sm font-medium transition-colors ${!isIncome ? 'bg-accent-red/20 text-accent-red' : 'text-gray-500'}`}
        >
          Gasto
        </button>
        <button
          onClick={() => setType('income')}
          className={`py-2 rounded-lg text-sm font-medium transition-colors ${isIncome ? 'bg-accent-green/20 text-accent-green' : 'text-gray-500'}`}
        >
          Ingreso
        </button>
      </div>

      {/* Monto */}
      <div className="bg-bg-card border border-bg-border rounded-2xl px-4 py-3">
        <label className="text-[11px] text-gray-500 uppercase tracking-wide">Monto</label>
        <div className="flex items-baseline gap-1">
          <span className={`text-2xl font-semibold ${isIncome ? 'text-accent-green' : 'text-white'}`}>$</span>
          <input
            value={amountText}
            onChange={(e) => setAmountText(formatTyping(e.target.value))}
            inputMode="numeric"
            placeholder="0"
            autoComplete="off"
            className={`flex-1 bg-transparent text-3xl font-bold outline-none placeholder-gray-700 min-w-0 ${isIncome ? 'text-accent-green' : 'text-white'}`}
          />
        </div>
      </div>

      {/* Categoría */}
      <div>
        <p className="text-[11px] text-gray-500 uppercase tracking-wide mb-2">Categoría</p>
        <div className="grid grid-cols-5 gap-2">
          {CATEGORIES.map((c) => {
            const active = category === c
            return (
              <button
                key={c}
                type="button"
                aria-label={c}
                aria-pressed={active}
                onClick={() => setCategory(c)}
                className={`flex flex-col items-center gap-1 py-2 rounded-xl border text-[10px] leading-tight transition-colors ${
                  active
                    ? 'bg-accent-indigo/20 border-accent-indigo text-white'
                    : 'bg-bg-card border-bg-border text-gray-400 active:bg-bg-elevated'
                }`}
              >
                <span className="text-xl">{CATEGORY_ICONS[c]}</span>
                <span className="truncate w-full text-center px-0.5">{c}</span>
              </button>
            )
          })}
        </div>
      </div>

      {/* Método de pago */}
      {methods.length > 0 && (
        <div>
          <p className="text-[11px] text-gray-500 uppercase tracking-wide mb-2">¿Con qué pagaste?</p>
          <div className="flex flex-wrap gap-2">
            {methods.map((m) => {
              const active = method?.toLowerCase() === m.toLowerCase()
              return (
                <button
                  key={m}
                  onClick={() => setMethod(active ? null : m)}
                  className={`px-3 py-1.5 rounded-full text-xs border transition-colors ${
                    active ? 'bg-accent-cyan/15 border-accent-cyan text-accent-cyan' : 'bg-bg-card border-bg-border text-gray-400'
                  }`}
                >
                  {m}
                </button>
              )
            })}
          </div>
        </div>
      )}

      {/* Descripción + fecha */}
      <div className="flex gap-2">
        <input
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          placeholder="Descripción (opcional)"
          className="flex-1 bg-bg-card border border-bg-border focus:border-accent-indigo/50 rounded-xl px-4 py-2.5 text-sm text-white placeholder-gray-600 outline-none"
        />
        <button
          onClick={() => setShowDate((v) => !v)}
          className={`px-3 rounded-xl border ${date !== today() ? 'border-accent-yellow text-accent-yellow' : 'border-bg-border text-gray-500'} bg-bg-card`}
          title="Otra fecha"
        >
          <CalendarDays size={18} />
        </button>
      </div>
      {showDate && (
        <input
          type="date"
          value={date}
          max={today()}
          onChange={(e) => setDate(e.target.value || today())}
          className="w-full bg-bg-card border border-bg-border rounded-xl px-4 py-2.5 text-sm text-white outline-none"
        />
      )}

      <button
        onClick={handleSave}
        disabled={!canSave}
        className={`w-full flex items-center justify-center gap-2 font-semibold py-3.5 rounded-2xl transition-colors disabled:opacity-40 ${
          isIncome ? 'bg-accent-green text-black' : 'bg-accent-indigo text-white'
        }`}
      >
        <Check size={18} />
        {saving ? 'Guardando…' : amount > 0 ? `Guardar ${formatCOP(amount)}` : 'Guardar'}
      </button>

      {toast && (
        <div className="fixed left-4 right-4 bottom-24 z-[70] max-w-lg mx-auto bg-accent-green text-black text-sm font-medium px-4 py-3 rounded-xl shadow-lg flex items-center gap-2">
          <Check size={16} /> {toast}
        </div>
      )}
    </div>
  )
}
