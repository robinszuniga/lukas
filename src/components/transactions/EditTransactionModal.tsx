import { useState } from 'react'
import { Save } from 'lucide-react'
import { CATEGORIES } from '@/types'
import type { Transaction, Category, TransactionType } from '@/types'
import { amountErrorMessage, currencyInfo, parseMoney, toInputAmount } from '@/lib/money'
import { today } from '@/lib/dates'
import { Modal } from '@/components/ui/Modal'
import { Field, FormError } from '@/components/ui/Field'
import { inputClass, primaryButton, secondaryButton } from '@/components/ui/styles'

interface Props {
  /** Si viene, es edición; si no, es registro nuevo */
  transaction?: Transaction
  onSave: (data: Partial<Transaction>) => Promise<void>
  onClose: () => void
}

export function TransactionModal({ transaction: tx, onSave, onClose }: Props) {
  const isEdit = !!tx
  const [amount, setAmount] = useState(tx ? toInputAmount(tx.amount) : '')
  const [type, setType] = useState<TransactionType>(tx?.type ?? 'expense')
  const [category, setCategory] = useState<Category>((tx?.category as Category) ?? 'Alimentación')
  const [description, setDescription] = useState(tx?.description ?? '')
  const [paymentMethod, setPaymentMethod] = useState(tx?.payment_method ?? '')
  const [date, setDate] = useState(tx?.date ?? today())
  const [saving, setSaving] = useState(false)
  const [amountError, setAmountError] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    const parsed = parseMoney(amount)
    if (parsed === null) { setAmountError(amountErrorMessage()); return }
    if (!date) { setError('Elige una fecha'); return }
    setAmountError(null)
    setError(null)
    setSaving(true)
    try {
      await onSave({
        amount: parsed,
        type,
        category,
        description: description.trim() || category,
        payment_method: paymentMethod.trim() || null,
        date,
      })
      onClose()
    } catch (err) {
      setError((err as Error)?.message ?? 'No se pudo guardar')
      setSaving(false)
    }
  }

  const decimals = currencyInfo().decimals

  return (
    <Modal
      title={isEdit ? 'Editar movimiento' : 'Registrar movimiento'}
      onClose={onClose}
      footer={
        <>
          <button type="button" onClick={onClose} className={secondaryButton}>Cancelar</button>
          <button type="submit" form="transaction-form" disabled={saving} className={`${primaryButton} inline-flex items-center justify-center gap-2`}>
            <Save size={14} aria-hidden="true" />
            {saving ? 'Guardando…' : isEdit ? 'Guardar' : 'Registrar'}
          </button>
        </>
      }
    >
      <form id="transaction-form" onSubmit={handleSubmit} noValidate className="space-y-3">
        <div role="group" aria-label="Tipo de movimiento" className="grid grid-cols-2 gap-2">
          {(['expense', 'income'] as const).map((t) => (
            <button
              key={t}
              type="button"
              aria-pressed={type === t}
              onClick={() => setType(t)}
              className={`py-2 rounded-lg text-sm font-medium transition-colors border ${
                type === t
                  ? t === 'expense'
                    ? 'bg-accent-red/20 border-accent-red/60 text-rose-400'
                    : 'bg-accent-green/20 border-accent-green/60 text-accent-green'
                  : 'bg-bg-elevated border-bg-field text-gray-400 hover:text-gray-200'
              }`}
            >
              <span aria-hidden="true">{t === 'expense' ? '↓ ' : '↑ '}</span>
              {t === 'expense' ? 'Gasto' : 'Ingreso'}
            </button>
          ))}
        </div>

        <Field label="Monto" error={amountError}>
          {(control) => (
            <input
              {...control}
              value={amount}
              onChange={(e) => { setAmount(e.target.value); setAmountError(null) }}
              placeholder={decimals === 0 ? '45000' : '45.50'}
              inputMode={decimals === 0 ? 'numeric' : 'decimal'}
              autoComplete="off"
              required
              data-autofocus={isEdit ? undefined : true}
              className={inputClass}
            />
          )}
        </Field>

        <Field label="Categoría">
          {(control) => (
            <select {...control} value={category} onChange={(e) => setCategory(e.target.value as Category)} className={inputClass}>
              {CATEGORIES.map((c) => <option key={c} value={c}>{c}</option>)}
            </select>
          )}
        </Field>

        <Field label="Descripción (opcional)">
          {(control) => (
            <input {...control} value={description} onChange={(e) => setDescription(e.target.value)} placeholder="Ej: Almuerzo en el trabajo" className={inputClass} />
          )}
        </Field>

        <Field label="Método de pago (opcional)">
          {(control) => (
            <input {...control} value={paymentMethod} onChange={(e) => setPaymentMethod(e.target.value)} placeholder="Nequi, Bancolombia, Efectivo…" className={inputClass} />
          )}
        </Field>

        <Field label="Fecha">
          {(control) => (
            <input {...control} type="date" value={date} onChange={(e) => setDate(e.target.value)} required className={inputClass} />
          )}
        </Field>

        <FormError message={error} />
      </form>
    </Modal>
  )
}

// Alias retrocompatible
export { TransactionModal as EditTransactionModal }
