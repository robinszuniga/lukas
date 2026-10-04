import { useState } from 'react'
import { amountErrorMessage, currencyInfo, formatMoney, parseMoney, roundMoney, toInputAmount } from '@/lib/money'
import { today } from '@/lib/dates'
import type { Installment } from '@/types'
import { Modal } from '@/components/ui/Modal'
import { Field, FormError } from '@/components/ui/Field'
import { inputClass, primaryButton, secondaryButton } from '@/components/ui/styles'

type InstallmentData = Omit<Installment, 'id' | 'created_at'>

interface Props {
  initial?: Installment
  onSave: (data: InstallmentData) => void | Promise<void>
  onClose: () => void
}

export function InstallmentForm({ initial, onSave, onClose }: Props) {
  const [name, setName] = useState(initial?.name ?? '')
  const [totalAmount, setTotalAmount] = useState(initial ? toInputAmount(initial.total_amount) : '')
  const [totalMonths, setTotalMonths] = useState(initial ? String(initial.total_months) : '12')
  const [paidMonths, setPaidMonths] = useState(initial ? String(initial.paid_months) : '0')
  const [nextDueDate, setNextDueDate] = useState(initial?.next_due_date ?? today())
  const [notes, setNotes] = useState(initial?.notes ?? '')
  const [monthlyOverride, setMonthlyOverride] = useState(initial ? toInputAmount(initial.monthly_amount) : '')
  const [monthlyManual, setMonthlyManual] = useState(!!initial)
  const [errors, setErrors] = useState<{ name?: string; total?: string; months?: string; monthly?: string }>({})
  const [error, setError] = useState<string | null>(null)

  const total = parseMoney(totalAmount) ?? 0
  const months = parseInt(totalMonths, 10) || 0
  const calculated = total > 0 && months > 0 ? roundMoney(total / months) : 0

  const updateTotal = (v: string) => {
    setTotalAmount(v)
    if (!monthlyManual) {
      const t = parseMoney(v) ?? 0
      if (t > 0 && months > 0) setMonthlyOverride(toInputAmount(roundMoney(t / months)))
    }
  }
  const updateMonths = (v: string) => {
    setTotalMonths(v)
    if (!monthlyManual) {
      const m = parseInt(v, 10) || 0
      if (total > 0 && m > 0) setMonthlyOverride(toInputAmount(roundMoney(total / m)))
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    const monthly = monthlyOverride.trim() ? parseMoney(monthlyOverride) : (calculated || null)
    const next: typeof errors = {}
    if (!name.trim()) next.name = 'Escribe un nombre'
    if (total <= 0) next.total = amountErrorMessage()
    if (months < 1 || months > 600) next.months = 'Debe ser un número entre 1 y 600'
    if (monthly === null || monthly <= 0) next.monthly = amountErrorMessage()
    setErrors(next)
    if (Object.keys(next).length > 0) return

    const paid = Math.min(Math.max(parseInt(paidMonths, 10) || 0, 0), months)
    try {
      await onSave({
        name: name.trim(),
        total_amount: total,
        total_months: months,
        paid_months: paid,
        monthly_amount: monthly!,
        next_due_date: nextDueDate || null,
        notes: notes.trim() || null,
      })
    } catch (err) {
      setError((err as Error)?.message ?? 'No se pudo guardar')
    }
  }

  const mode = currencyInfo().decimals === 0 ? 'numeric' : 'decimal'
  const monthlyValue = parseMoney(monthlyOverride)

  return (
    <Modal
      title={initial ? 'Editar cuota' : 'Nueva cuota'}
      onClose={onClose}
      footer={
        <>
          <button type="button" onClick={onClose} className={secondaryButton}>Cancelar</button>
          <button type="submit" form="installment-form" className={primaryButton}>Guardar</button>
        </>
      }
    >
      <form id="installment-form" onSubmit={handleSubmit} noValidate className="space-y-3">
        <Field label="Nombre" error={errors.name}>
          {(c) => <input {...c} value={name} onChange={(e) => setName(e.target.value)} placeholder="Ej: Curso de inglés" className={inputClass} required />}
        </Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Monto total" error={errors.total}>
            {(c) => <input {...c} value={totalAmount} onChange={(e) => updateTotal(e.target.value)} placeholder="450000" inputMode={mode} autoComplete="off" className={inputClass} required />}
          </Field>
          <Field label="Número de cuotas" error={errors.months}>
            {(c) => <input {...c} type="number" value={totalMonths} onChange={(e) => updateMonths(e.target.value)} min={1} max={600} className={inputClass} required />}
          </Field>
        </div>
        <Field label="Cuotas ya pagadas">
          {(c) => <input {...c} type="number" value={paidMonths} onChange={(e) => setPaidMonths(e.target.value)} min={0} max={months || undefined} className={inputClass} />}
        </Field>
        <Field
          label={<>Cuota mensual{!monthlyManual && calculated > 0 ? ' (calculada)' : ''}</>}
          error={errors.monthly}
        >
          {(c) => (
            <input
              {...c}
              value={monthlyOverride}
              onChange={(e) => { setMonthlyOverride(e.target.value); setMonthlyManual(true) }}
              placeholder={calculated > 0 ? toInputAmount(calculated) : '0'}
              inputMode={mode}
              autoComplete="off"
              className={inputClass}
            />
          )}
        </Field>
        {monthlyManual && calculated > 0 && monthlyValue !== calculated && (
          <button
            type="button"
            onClick={() => { setMonthlyOverride(toInputAmount(calculated)); setMonthlyManual(false) }}
            className="text-xs text-accent-cyan py-1"
          >
            Usar la calculada: {formatMoney(calculated)}
          </button>
        )}
        <Field label="Próxima fecha de pago">
          {(c) => <input {...c} type="date" value={nextDueDate} onChange={(e) => setNextDueDate(e.target.value)} className={inputClass} />}
        </Field>
        <Field label="Notas (opcional)">
          {(c) => <input {...c} value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Ej: Banco Falabella" className={inputClass} />}
        </Field>
        <FormError message={error} />
      </form>
    </Modal>
  )
}
