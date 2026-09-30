import { useState } from 'react'
import { X } from 'lucide-react'
import { parseCOP } from '@/lib/currency'
import { today } from '@/lib/dates'
import type { Installment } from '@/types'

interface Props {
  initial?: Installment
  onSave: (data: any) => void
  onClose: () => void
}

export function InstallmentForm({ initial, onSave, onClose }: Props) {
  const [name, setName] = useState(initial?.name ?? '')
  const [totalAmount, setTotalAmount] = useState(initial ? String(initial.total_amount) : '')
  const [totalMonths, setTotalMonths] = useState(initial ? String(initial.total_months) : '12')
  const [paidMonths, setPaidMonths] = useState(initial ? String(initial.paid_months) : '0')
  const [nextDueDate, setNextDueDate] = useState(initial?.next_due_date ?? today())
  const [notes, setNotes] = useState(initial?.notes ?? '')
  const [monthlyOverride, setMonthlyOverride] = useState(
    initial ? String(initial.monthly_amount) : ''
  )
  const [monthlyManual, setMonthlyManual] = useState(!!initial)

  const total = parseCOP(totalAmount) || 0
  const months = parseInt(totalMonths) || 1
  const calculated = months > 0 ? Math.round(total / months) : 0

  const updateTotal = (v: string) => {
    setTotalAmount(v)
    if (!monthlyManual) {
      const t = parseCOP(v) || 0
      if (t > 0 && months > 0) setMonthlyOverride(String(Math.round(t / months)))
    }
  }
  const updateMonths = (v: string) => {
    setTotalMonths(v)
    if (!monthlyManual) {
      const m = parseInt(v) || 1
      if (total > 0 && m > 0) setMonthlyOverride(String(Math.round(total / m)))
    }
  }

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    const monthly = parseCOP(monthlyOverride) || calculated
    if (!name || total <= 0 || months <= 0 || monthly <= 0) return
    const paid = Math.min(Math.max(parseInt(paidMonths) || 0, 0), months)
    onSave({
      name,
      total_amount: total,
      total_months: months,
      paid_months: paid,
      monthly_amount: monthly,
      next_due_date: nextDueDate || null,
      notes: notes || null,
    })
  }

  const inputClass = 'w-full bg-bg-elevated border border-bg-border rounded-lg px-3 py-2.5 text-sm text-white placeholder-gray-600 outline-none focus:border-accent-indigo/50 transition-colors'

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-end sm:items-center justify-center z-[60]">
      <div className="bg-bg-card border border-bg-border rounded-t-2xl sm:rounded-2xl w-full sm:max-w-md max-h-[85dvh] flex flex-col">
        <div className="flex items-center justify-between px-5 py-4 border-b border-bg-border shrink-0">
          <h2 className="font-semibold text-white text-sm">{initial ? 'Editar cuota' : 'Nueva cuota'}</h2>
          <button onClick={onClose} className="text-gray-500 hover:text-white"><X size={18} /></button>
        </div>

        <form id="installment-form" onSubmit={handleSubmit} className="overflow-y-auto flex-1 px-5 py-4 space-y-3">
          <div>
            <label className="text-xs text-gray-500 mb-1 block">Nombre</label>
            <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Ej: Curso de inglés" className={inputClass} required />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs text-gray-500 block mb-1">Monto total</label>
              <input value={totalAmount} onChange={(e) => updateTotal(e.target.value)} placeholder="450000" inputMode="numeric" className={inputClass} required />
            </div>
            <div>
              <label className="text-xs text-gray-500 block mb-1">N° cuotas</label>
              <input type="number" value={totalMonths} onChange={(e) => updateMonths(e.target.value)} min={1} max={120} className={inputClass} required />
            </div>
          </div>
          <div>
            <label className="text-xs text-gray-500 block mb-1">Cuotas ya pagadas</label>
            <input type="number" value={paidMonths} onChange={(e) => setPaidMonths(e.target.value)} min={0} max={months} className={inputClass} />
          </div>
          <div>
            <label className="text-xs text-gray-500 block mb-1">
              Cuota mensual
              {!monthlyManual && calculated > 0 && (
                <span className="text-gray-700 ml-1">(calculada)</span>
              )}
            </label>
            <input
              value={monthlyOverride}
              onChange={(e) => { setMonthlyOverride(e.target.value); setMonthlyManual(true) }}
              placeholder={calculated > 0 ? String(calculated) : '0'}
              inputMode="numeric"
              className={`${inputClass} border-accent-cyan/40 focus:border-accent-cyan/70`}
            />
            {monthlyManual && calculated > 0 && parseCOP(monthlyOverride) !== calculated && (
              <button
                type="button"
                onClick={() => { setMonthlyOverride(String(calculated)); setMonthlyManual(false) }}
                className="text-xs text-gray-600 hover:text-accent-cyan mt-1 transition-colors"
              >
                ↺ Usar calculada: ${calculated.toLocaleString('es-CO')}
              </button>
            )}
          </div>
          <div>
            <label className="text-xs text-gray-500 block mb-1">Próxima fecha de pago</label>
            <input type="date" value={nextDueDate} onChange={(e) => setNextDueDate(e.target.value)} className={inputClass} />
          </div>
          <div>
            <label className="text-xs text-gray-500 block mb-1">Notas (opcional)</label>
            <input value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Ej: Banco Falabella" className={inputClass} />
          </div>
        </form>

        <div
          className="px-5 pt-3 border-t border-bg-border shrink-0 flex gap-2"
          style={{ paddingBottom: 'max(1.5rem, env(safe-area-inset-bottom, 0px))' }}
        >
          <button type="button" onClick={onClose} className="flex-1 py-2.5 bg-bg-elevated border border-bg-border text-gray-400 text-sm rounded-xl">Cancelar</button>
          <button type="submit" form="installment-form" className="flex-1 py-2.5 bg-accent-indigo hover:bg-accent-indigo/80 text-white text-sm font-medium rounded-xl transition-colors">Guardar</button>
        </div>
      </div>
    </div>
  )
}
