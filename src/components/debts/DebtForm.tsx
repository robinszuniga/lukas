import { useState } from 'react'
import { amountErrorMessage, currencyInfo, parseMoney, toInputAmount } from '@/lib/money'
import type { Debt, DebtType } from '@/types'
import { Modal } from '@/components/ui/Modal'
import { Field, FormError } from '@/components/ui/Field'
import { inputClass, primaryButton, secondaryButton } from '@/components/ui/styles'

interface Props {
  initial?: Debt
  onSave: (data: Omit<Debt, 'id' | 'created_at' | 'paid'>) => void | Promise<void>
  onClose: () => void
}

export function DebtForm({ initial, onSave, onClose }: Props) {
  const [type, setType] = useState<DebtType>(initial?.type ?? 'owed_to_me')
  const [person, setPerson] = useState(initial?.person ?? '')
  const [amount, setAmount] = useState(initial ? toInputAmount(initial.amount) : '')
  const [description, setDescription] = useState(initial?.description ?? '')
  const [dueDate, setDueDate] = useState(initial?.due_date ?? '')
  const [errors, setErrors] = useState<{ person?: string; amount?: string }>({})
  const [error, setError] = useState<string | null>(null)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    const val = parseMoney(amount)
    const next: typeof errors = {}
    if (!person.trim()) next.person = 'Escribe un nombre'
    if (val === null) next.amount = amountErrorMessage()
    setErrors(next)
    if (Object.keys(next).length > 0) return

    try {
      await onSave({
        person: person.trim(),
        amount: val!,
        type,
        description: description.trim() || null,
        due_date: dueDate || null,
      })
    } catch (err) {
      setError((err as Error)?.message ?? 'No se pudo guardar')
    }
  }

  const typeButton = (value: DebtType, label: string, arrow: string, activeClass: string) => (
    <button
      type="button"
      aria-pressed={type === value}
      onClick={() => setType(value)}
      className={`py-2.5 rounded-lg text-sm font-medium transition-colors border ${
        type === value ? activeClass : 'bg-bg-elevated border-bg-field text-gray-400 hover:text-gray-200'
      }`}
    >
      <span aria-hidden="true">{arrow} </span>{label}
    </button>
  )

  return (
    <Modal
      title={initial ? 'Editar deuda' : 'Nueva deuda'}
      onClose={onClose}
      footer={
        <>
          <button type="button" onClick={onClose} className={secondaryButton}>Cancelar</button>
          <button type="submit" form="debt-form" className={primaryButton}>Guardar</button>
        </>
      }
    >
      <form id="debt-form" onSubmit={handleSubmit} noValidate className="space-y-3">
        <div role="group" aria-label="Tipo de deuda" className="grid grid-cols-2 gap-2">
          {typeButton('owed_to_me', 'Me deben', '↙', 'bg-accent-green/20 border-accent-green/60 text-accent-green')}
          {typeButton('i_owe', 'Yo debo', '↗', 'bg-accent-red/20 border-accent-red/60 text-rose-400')}
        </div>

        <Field label={type === 'owed_to_me' ? '¿Quién te debe?' : '¿A quién le debes?'} error={errors.person}>
          {(c) => <input {...c} value={person} onChange={(e) => setPerson(e.target.value)} placeholder="Ej: Carlos, Mamá, Trabajo…" className={inputClass} required />}
        </Field>

        <Field label="Monto" error={errors.amount}>
          {(c) => (
            <input
              {...c}
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              placeholder="80000"
              inputMode={currencyInfo().decimals === 0 ? 'numeric' : 'decimal'}
              autoComplete="off"
              className={inputClass}
              required
            />
          )}
        </Field>

        <Field label="Motivo (opcional)">
          {(c) => <input {...c} value={description} onChange={(e) => setDescription(e.target.value)} placeholder="Ej: Préstamo para el almuerzo" className={inputClass} />}
        </Field>

        <Field label="Fecha límite (opcional)" hint="Con fecha límite puedes recibir un recordatorio.">
          {(c) => <input {...c} type="date" value={dueDate} onChange={(e) => setDueDate(e.target.value)} className={inputClass} />}
        </Field>
        <FormError message={error} />
      </form>
    </Modal>
  )
}
