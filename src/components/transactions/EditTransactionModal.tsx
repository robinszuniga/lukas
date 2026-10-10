import { useEffect, useRef, useState } from 'react'
import { Save } from 'lucide-react'
import { CATEGORIES } from '@/types'
import type { BalancePlan, Transaction, Category, TransactionType } from '@/types'
import { amountErrorMessage, currencyInfo, parseMoney, toInputAmount } from '@/lib/money'
import { describeMove } from '@/lib/paymentMethod'
import { today } from '@/lib/dates'
import { db } from '@/lib/db'
import { Modal } from '@/components/ui/Modal'
import { Field, FormError } from '@/components/ui/Field'
import { PaymentMethodField } from '@/components/ui/PaymentMethodField'
import { inputClass, primaryButton, secondaryButton } from '@/components/ui/styles'

export interface SaveOptions {
  /** Corregir también los saldos de cuentas y tarjetas */
  adjustBalances: boolean
}

interface Props {
  /** Si viene, es edición; si no, es registro nuevo */
  transaction?: Transaction
  onSave: (data: Partial<Transaction>, options: SaveOptions) => Promise<void>
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
  /** Cambios listos para guardar que mueven saldos: se pregunta antes */
  const [pending, setPending] = useState<{ data: Partial<Transaction>; plan: BalancePlan } | null>(null)
  const askRef = useRef<HTMLDivElement>(null)
  const formRef = useRef<HTMLFormElement>(null)
  const asked = useRef(false)

  // Al cambiar de paso, el foco va al contenido nuevo (el botón que se tocó desaparece)
  useEffect(() => {
    if (pending) askRef.current?.focus()
    else if (asked.current) formRef.current?.focus()
    asked.current = !!pending
  }, [pending])

  const save = async (data: Partial<Transaction>, options: SaveOptions) => {
    setSaving(true)
    setError(null)
    try {
      await onSave(data, options)
      onClose()
    } catch (err) {
      setError((err as Error)?.message ?? 'No se pudo guardar')
      setSaving(false)
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    const parsed = parseMoney(amount)
    if (parsed === null) { setAmountError(amountErrorMessage()); return }
    if (!date) { setError('Elige una fecha'); return }
    setAmountError(null)
    setError(null)
    const data: Partial<Transaction> = {
      amount: parsed,
      type,
      category,
      description: description.trim() || category,
      payment_method: paymentMethod.trim() || null,
      date,
    }

    if (tx) {
      try {
        const plan = await db.planBalanceUpdate(tx.id, data)
        if (plan.moves.length > 0) { setPending({ data, plan }); return }
      } catch (err) {
        setError((err as Error)?.message ?? 'No se pudo guardar')
        return
      }
    }
    await save(data, { adjustBalances: false })
  }

  const decimals = currencyInfo().decimals

  if (pending) {
    const { plan } = pending
    return (
      <Modal
        title="¿Ajustar saldos?"
        onClose={onClose}
        footer={
          <div className="grid gap-2 w-full">
            <button type="button" onClick={() => save(pending.data, { adjustBalances: true })} disabled={saving} className={primaryButton}>
              {saving ? 'Guardando…' : 'Ajustar saldos y guardar'}
            </button>
            <button type="button" onClick={() => save(pending.data, { adjustBalances: false })} disabled={saving} className={secondaryButton}>
              Solo guardar el cambio
            </button>
            <button type="button" onClick={() => setPending(null)} disabled={saving} className="py-2 text-sm text-gray-400 hover:text-white">
              Volver a editar
            </button>
          </div>
        }
      >
        <div ref={askRef} tabIndex={-1} className="space-y-3 outline-none">
          <p className="text-sm text-gray-200">
            Cambiaste el monto, el tipo o el método de pago. Para que tus saldos queden bien:
          </p>
          <ul className="bg-bg-elevated border border-bg-border rounded-xl px-4 py-3 space-y-1.5">
            {plan.moves.map((m) => (
              <li key={`${m.target}-${m.target_id}`} className="text-sm text-white">{describeMove(m)}</li>
            ))}
          </ul>
          {plan.untracked.length > 0 && (
            <p className="text-xs text-accent-yellow">
              Este movimiento es de antes de que Lukas anotara qué saldo tocó, así que no sé si al registrarlo
              ya se descontó de {plan.untracked.join(' y ')}. Si ya se había descontado, elige «Solo guardar el cambio»
              y corrige el saldo a mano en Tarjetas → Cuentas.
            </p>
          )}
          <p className="text-xs text-gray-400">«Solo guardar el cambio» edita el movimiento y deja los saldos como están.</p>
          <FormError message={error} />
        </div>
      </Modal>
    )
  }

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
      <form id="transaction-form" ref={formRef} tabIndex={-1} onSubmit={handleSubmit} noValidate className="space-y-3 outline-none">
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

        <PaymentMethodField value={paymentMethod} onChange={setPaymentMethod} type={type} />

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
