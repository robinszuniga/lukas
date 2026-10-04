import { useState } from 'react'
import { amountErrorMessage, currencyInfo, parseMoney, toInputAmount } from '@/lib/money'
import { CATEGORIES } from '@/types'
import type { Category, Recurring } from '@/types'
import { Modal } from '@/components/ui/Modal'
import { Field, FormError } from '@/components/ui/Field'
import { inputClass, primaryButton, secondaryButton } from '@/components/ui/styles'

interface Props {
  initial?: Recurring
  onSave: (data: Omit<Recurring, 'id' | 'created_at' | 'last_posted'>) => void | Promise<void>
  onClose: () => void
}

export function RecurringForm({ initial, onSave, onClose }: Props) {
  const [name, setName] = useState(initial?.name ?? '')
  const [amount, setAmount] = useState(initial ? toInputAmount(initial.amount) : '')
  const [category, setCategory] = useState<Category>((initial?.category as Category) ?? 'Servicios')
  const [paymentMethod, setPaymentMethod] = useState(initial?.payment_method ?? '')
  const [day, setDay] = useState(initial ? String(initial.day) : '1')
  const [errors, setErrors] = useState<{ name?: string; amount?: string; day?: string }>({})
  const [error, setError] = useState<string | null>(null)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    const val = parseMoney(amount)
    const d = parseInt(day, 10)
    const next: typeof errors = {}
    if (!name.trim()) next.name = 'Escribe un nombre'
    if (val === null) next.amount = amountErrorMessage()
    if (!(d >= 1 && d <= 31)) next.day = 'Debe ser un día entre 1 y 31'
    setErrors(next)
    if (Object.keys(next).length > 0) return

    try {
      await onSave({
        name: name.trim(),
        amount: val!,
        category,
        payment_method: paymentMethod.trim() || null,
        day: d,
      })
    } catch (err) {
      setError((err as Error)?.message ?? 'No se pudo guardar')
    }
  }

  return (
    <Modal
      title={initial ? 'Editar pago fijo' : 'Nuevo pago fijo'}
      onClose={onClose}
      footer={
        <>
          <button type="button" onClick={onClose} className={secondaryButton}>Cancelar</button>
          <button type="submit" form="recurring-form" className={primaryButton}>Guardar</button>
        </>
      }
    >
      <form id="recurring-form" onSubmit={handleSubmit} noValidate className="space-y-3">
        <Field label="Nombre" error={errors.name}>
          {(c) => <input {...c} value={name} onChange={(e) => setName(e.target.value)} placeholder="Ej: Arriendo, Gym, Netflix" className={inputClass} required />}
        </Field>

        <div className="grid grid-cols-2 gap-3">
          <Field label="Monto mensual" error={errors.amount}>
            {(c) => (
              <input
                {...c}
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                placeholder="500000"
                inputMode={currencyInfo().decimals === 0 ? 'numeric' : 'decimal'}
                autoComplete="off"
                className={inputClass}
                required
              />
            )}
          </Field>
          <Field label="Día del mes" error={errors.day}>
            {(c) => <input {...c} type="number" value={day} onChange={(e) => setDay(e.target.value)} min={1} max={31} className={inputClass} required />}
          </Field>
        </div>

        <Field label="Categoría">
          {(c) => (
            <select {...c} value={category} onChange={(e) => setCategory(e.target.value as Category)} className={inputClass}>
              {CATEGORIES.map((cat) => <option key={cat} value={cat}>{cat}</option>)}
            </select>
          )}
        </Field>

        <Field label="Método de pago (opcional)">
          {(c) => <input {...c} value={paymentMethod} onChange={(e) => setPaymentMethod(e.target.value)} placeholder="Nequi, Bancolombia…" className={inputClass} />}
        </Field>

        {!initial && (
          <p className="text-xs text-gray-400">
            Cada mes aparecerá como pendiente. Al tocar «Pagar» se crea el gasto automáticamente, y puedes deshacerlo.
          </p>
        )}
        <FormError message={error} />
      </form>
    </Modal>
  )
}
