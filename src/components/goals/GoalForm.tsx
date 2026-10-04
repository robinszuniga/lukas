import { useState } from 'react'
import { amountErrorMessage, currencyInfo, parseMoney, toInputAmount } from '@/lib/money'
import type { Goal } from '@/types'
import { Modal } from '@/components/ui/Modal'
import { Field, FormError } from '@/components/ui/Field'
import { inputClass, primaryButton, secondaryButton } from '@/components/ui/styles'

const EMOJIS: { emoji: string; name: string }[] = [
  { emoji: '🎯', name: 'Diana' }, { emoji: '✈️', name: 'Avión' }, { emoji: '🏍️', name: 'Moto' },
  { emoji: '💻', name: 'Computador' }, { emoji: '🏠', name: 'Casa' }, { emoji: '📱', name: 'Celular' },
  { emoji: '🎓', name: 'Estudio' }, { emoji: '💍', name: 'Anillo' }, { emoji: '🌴', name: 'Vacaciones' },
  { emoji: '🎸', name: 'Guitarra' }, { emoji: '🚗', name: 'Carro' }, { emoji: '💰', name: 'Ahorro' },
  { emoji: '📈', name: 'Inversión' }, { emoji: '🏆', name: 'Trofeo' },
]

interface Props {
  initial?: Goal
  onSave: (data: Omit<Goal, 'id' | 'created_at'>) => void | Promise<void>
  onClose: () => void
}

export function GoalForm({ initial, onSave, onClose }: Props) {
  const [name, setName] = useState(initial?.name ?? '')
  const [targetAmount, setTargetAmount] = useState(initial ? toInputAmount(initial.target_amount) : '')
  const [savedAmount, setSavedAmount] = useState(initial && initial.saved_amount > 0 ? toInputAmount(initial.saved_amount) : '')
  const [deadline, setDeadline] = useState(initial?.deadline ?? '')
  const [emoji, setEmoji] = useState(initial?.emoji ?? '🎯')
  const [errors, setErrors] = useState<{ name?: string; target?: string; saved?: string }>({})
  const [error, setError] = useState<string | null>(null)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    const target = parseMoney(targetAmount)
    const savedText = savedAmount.trim()
    const saved = savedText === '' || /^0+$/.test(savedText) ? 0 : parseMoney(savedText)
    const next: typeof errors = {}
    if (!name.trim()) next.name = 'Escribe un nombre'
    if (target === null) next.target = amountErrorMessage()
    if (saved === null) next.saved = amountErrorMessage()
    setErrors(next)
    if (Object.keys(next).length > 0) return

    try {
      await onSave({ name: name.trim(), target_amount: target!, saved_amount: saved!, deadline: deadline || null, emoji })
    } catch (err) {
      setError((err as Error)?.message ?? 'No se pudo guardar')
    }
  }

  const mode = currencyInfo().decimals === 0 ? 'numeric' : 'decimal'
  // Si la meta ya tenía un emoji que no está en la lista, se conserva como opción
  const options = EMOJIS.some((e) => e.emoji === emoji) ? EMOJIS : [{ emoji, name: 'Actual' }, ...EMOJIS]

  return (
    <Modal
      title={initial ? 'Editar meta' : 'Nueva meta'}
      onClose={onClose}
      footer={
        <>
          <button type="button" onClick={onClose} className={secondaryButton}>Cancelar</button>
          <button type="submit" form="goal-form" className={primaryButton}>{initial ? 'Guardar' : 'Crear meta'}</button>
        </>
      }
    >
      <form id="goal-form" onSubmit={handleSubmit} noValidate className="space-y-3">
        <div>
          <p id="goal-emoji-label" className="text-xs text-gray-400 mb-2">Icono</p>
          <div role="group" aria-labelledby="goal-emoji-label" className="flex flex-wrap gap-2">
            {options.map((e) => (
              <button
                key={e.emoji}
                type="button"
                onClick={() => setEmoji(e.emoji)}
                aria-label={e.name}
                aria-pressed={emoji === e.emoji}
                className={`text-xl w-11 h-11 rounded-lg transition-colors border ${
                  emoji === e.emoji ? 'bg-accent-indigo/20 border-accent-indigo' : 'bg-bg-elevated border-transparent hover:border-bg-field'
                }`}
              >
                <span aria-hidden="true">{e.emoji}</span>
              </button>
            ))}
          </div>
        </div>

        <Field label="Nombre" error={errors.name}>
          {(c) => <input {...c} value={name} onChange={(e) => setName(e.target.value)} placeholder="Ej: Viaje a Cartagena" className={inputClass} required />}
        </Field>

        <div className="grid grid-cols-2 gap-3">
          <Field label="Meta total" error={errors.target}>
            {(c) => <input {...c} value={targetAmount} onChange={(e) => setTargetAmount(e.target.value)} placeholder="3000000" inputMode={mode} autoComplete="off" className={inputClass} required />}
          </Field>
          <Field label="Ya tengo" error={errors.saved}>
            {(c) => <input {...c} value={savedAmount} onChange={(e) => setSavedAmount(e.target.value)} placeholder="0" inputMode={mode} autoComplete="off" className={inputClass} />}
          </Field>
        </div>

        <Field label="Fecha límite (opcional)">
          {(c) => <input {...c} type="date" value={deadline} onChange={(e) => setDeadline(e.target.value)} className={inputClass} />}
        </Field>
        <FormError message={error} />
      </form>
    </Modal>
  )
}
