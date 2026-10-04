import { useId, type ReactNode } from 'react'

export interface FieldControlProps {
  id: string
  'aria-describedby'?: string
  'aria-invalid'?: true
}

interface Props {
  label: ReactNode
  /** Ayuda corta debajo del campo */
  hint?: ReactNode
  /** Mensaje de error: se anuncia a lectores de pantalla y marca el campo como inválido */
  error?: string | null
  className?: string
  /** Recibe el id y los atributos que enlazan el campo con su etiqueta, ayuda y error */
  children: (control: FieldControlProps) => ReactNode
}

/** Campo de formulario con etiqueta asociada por código (no solo por cercanía visual). */
export function Field({ label, hint, error, className, children }: Props) {
  const id = useId()
  const hintId = `${id}-ayuda`
  const errorId = `${id}-error`
  const describedBy = [hint ? hintId : null, error ? errorId : null].filter(Boolean).join(' ') || undefined

  return (
    <div className={className}>
      <label htmlFor={id} className="text-xs text-gray-400 mb-1 block">{label}</label>
      {children({ id, 'aria-describedby': describedBy, ...(error ? { 'aria-invalid': true as const } : {}) })}
      {hint && <p id={hintId} className="text-xs text-gray-450 mt-1">{hint}</p>}
      {error && <p id={errorId} role="alert" className="text-xs text-rose-400 mt-1">{error}</p>}
    </div>
  )
}

/** Error general de un formulario */
export function FormError({ message }: { message: string | null | undefined }) {
  if (!message) return null
  return (
    <p role="alert" className="text-xs text-rose-400 bg-accent-red/10 border border-accent-red/30 rounded-lg px-3 py-2">
      {message}
    </p>
  )
}
