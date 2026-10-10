import { useId, useState } from 'react'
import { Check, CalendarDays } from 'lucide-react'
import { CATEGORIES, CATEGORY_ICONS } from '@/types'
import type { Category, TransactionType } from '@/types'
import { amountErrorMessage, currencyInfo, currencySymbol, formatMoney, formatWhileTyping, parseMoney } from '@/lib/money'
import { today } from '@/lib/dates'
import { storageGet, storageSet } from '@/lib/storage'
import { useFeedback } from '@/components/ui/Feedback'
import { PaymentMethodField } from '@/components/ui/PaymentMethodField'
import { db } from '@/lib/db'

const LAST_METHOD_KEY = 'lukas_last_method'

/** Registro manual en dos toques: monto + categoría. Funciona sin internet. */
export function QuickAdd() {
  const { toast } = useFeedback()
  const id = useId()

  const [type, setType] = useState<TransactionType>('expense')
  const [amountText, setAmountText] = useState('')
  const [category, setCategory] = useState<Category | null>(null)
  const [method, setMethod] = useState<string | null>(() => storageGet(LAST_METHOD_KEY))
  const [description, setDescription] = useState('')
  const [date, setDate] = useState(today())
  const [showDate, setShowDate] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const currency = currencyInfo()
  const amount = parseMoney(amountText)
  const isIncome = type === 'income'

  const reset = () => {
    setAmountText('')
    setCategory(null)
    setDescription('')
    setDate(today())
    setShowDate(false)
    setError(null)
  }

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault()
    if (amount === null) { setError(amountErrorMessage()); return }
    if (!category) { setError('Elige una categoría'); return }
    setSaving(true)
    setError(null)
    const paymentMethod = method?.trim() || null
    try {
      const created = await db.createTransaction({
        amount,
        type,
        category,
        description: description.trim() || category,
        payment_method: paymentMethod,
        date: date || today(),
      })
      if (paymentMethod) storageSet(LAST_METHOD_KEY, paymentMethod)
      toast({
        message: `${isIncome ? 'Ingreso' : 'Gasto'} de ${formatMoney(amount)} en ${category} guardado`,
        actionLabel: 'Deshacer',
        onAction: async () => {
          await db.undoCreateTransaction(created.id)
          toast({ message: 'Registro deshecho' })
        },
      })
      reset()
    } catch (err) {
      setError((err as Error)?.message ?? 'No se pudo guardar')
    } finally {
      setSaving(false)
    }
  }

  return (
    <form onSubmit={handleSave} noValidate className="space-y-4" aria-label="Registro rápido">
      <div role="group" aria-label="Tipo de movimiento" className="grid grid-cols-2 bg-bg-card border border-bg-border rounded-xl p-1">
        <button
          type="button"
          aria-pressed={!isIncome}
          onClick={() => setType('expense')}
          className={`py-2 rounded-lg text-sm font-medium transition-colors ${!isIncome ? 'bg-accent-red/20 text-rose-400' : 'text-gray-400'}`}
        >
          Gasto
        </button>
        <button
          type="button"
          aria-pressed={isIncome}
          onClick={() => setType('income')}
          className={`py-2 rounded-lg text-sm font-medium transition-colors ${isIncome ? 'bg-accent-green/20 text-accent-green' : 'text-gray-400'}`}
        >
          Ingreso
        </button>
      </div>

      <div className="bg-bg-card border border-bg-border focus-within:border-accent-indigo rounded-2xl px-4 py-3 transition-colors">
        <label htmlFor={`${id}-monto`} className="text-[11px] text-gray-400 uppercase tracking-wide">
          Monto ({currency.code})
        </label>
        <div className="flex items-baseline gap-1">
          <span className={`text-2xl font-semibold ${isIncome ? 'text-accent-green' : 'text-white'}`} aria-hidden="true">{currencySymbol()}</span>
          <input
            id={`${id}-monto`}
            value={amountText}
            onChange={(e) => { setAmountText(formatWhileTyping(e.target.value)); setError(null) }}
            inputMode={currency.decimals === 0 ? 'numeric' : 'decimal'}
            placeholder="0"
            autoComplete="off"
            aria-invalid={error && amount === null ? true : undefined}
            aria-describedby={error ? `${id}-error` : undefined}
            className={`flex-1 bg-transparent text-3xl font-bold outline-none placeholder-gray-450 min-w-0 ${isIncome ? 'text-accent-green' : 'text-white'}`}
          />
        </div>
      </div>

      <div>
        <p id={`${id}-cat`} className="text-[11px] text-gray-400 uppercase tracking-wide mb-2">Categoría</p>
        <div role="group" aria-labelledby={`${id}-cat`} className="grid grid-cols-5 gap-2">
          {CATEGORIES.map((c) => {
            const active = category === c
            return (
              <button
                key={c}
                type="button"
                aria-label={c}
                aria-pressed={active}
                onClick={() => { setCategory(c); setError(null) }}
                className={`flex flex-col items-center gap-1 py-2 rounded-xl border text-[10px] leading-tight transition-colors min-w-0 ${
                  active
                    ? 'bg-accent-indigo/20 border-accent-indigo text-white'
                    : 'bg-bg-card border-bg-border text-gray-400 active:bg-bg-elevated'
                }`}
              >
                <span className="text-xl" aria-hidden="true">{CATEGORY_ICONS[c]}</span>
                <span className="truncate w-full text-center px-0.5" aria-hidden="true">{c}</span>
              </button>
            )
          })}
        </div>
      </div>

      <PaymentMethodField
        value={method ?? ''}
        onChange={(v) => setMethod(v || null)}
        type={type}
        label={isIncome ? '¿A dónde llegó? (opcional)' : '¿Con qué pagaste? (opcional)'}
        labelClassName="text-[11px] text-gray-400 uppercase tracking-wide mb-2"
      />

      <div className="flex gap-2">
        <label htmlFor={`${id}-desc`} className="sr-only">Descripción (opcional)</label>
        <input
          id={`${id}-desc`}
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          placeholder="Descripción (opcional)"
          className="flex-1 min-w-0 bg-bg-card border border-bg-field focus:border-accent-indigo rounded-xl px-4 py-2.5 text-sm text-white placeholder-gray-450 outline-none"
        />
        <button
          type="button"
          onClick={() => setShowDate((v) => !v)}
          aria-expanded={showDate}
          aria-controls={`${id}-fecha-zona`}
          aria-label={date !== today() ? `Fecha del movimiento: ${date}. Cambiar` : 'Usar otra fecha'}
          className={`w-11 shrink-0 inline-flex items-center justify-center rounded-xl border bg-bg-card ${date !== today() ? 'border-accent-yellow text-accent-yellow' : 'border-bg-field text-gray-400'}`}
        >
          <CalendarDays size={18} aria-hidden="true" />
        </button>
      </div>
      <div id={`${id}-fecha-zona`}>
        {showDate && (
          <>
            <label htmlFor={`${id}-fecha`} className="text-xs text-gray-400 mb-1 block">Fecha del movimiento</label>
            <input
              id={`${id}-fecha`}
              type="date"
              value={date}
              max={today()}
              onChange={(e) => setDate(e.target.value || today())}
              className="w-full bg-bg-card border border-bg-field rounded-xl px-4 py-2.5 text-sm text-white outline-none focus:border-accent-indigo"
            />
          </>
        )}
      </div>

      {error && <p id={`${id}-error`} role="alert" className="text-xs text-rose-400">{error}</p>}

      <button
        type="submit"
        disabled={saving}
        className={`w-full flex items-center justify-center gap-2 font-semibold py-3.5 rounded-2xl transition-colors disabled:opacity-60 ${
          isIncome ? 'bg-accent-green text-black' : 'bg-indigo-600 text-white'
        }`}
      >
        <Check size={18} aria-hidden="true" />
        {saving ? 'Guardando…' : amount !== null ? `Guardar ${formatMoney(amount)}` : 'Guardar'}
      </button>
    </form>
  )
}
