import { useId, type ReactNode } from 'react'

interface Props {
  checked: boolean
  onChange: (checked: boolean) => void
  label: ReactNode
  /** Explicación corta debajo de la etiqueta */
  description?: ReactNode
  disabled?: boolean
}

/** Interruptor accesible (role="switch") con su etiqueta y descripción asociadas. */
export function Switch({ checked, onChange, label, description, disabled }: Props) {
  const id = useId()
  return (
    <div className="flex items-start justify-between gap-3">
      <div className="min-w-0">
        <p id={`${id}-label`} className="text-sm text-gray-100">{label}</p>
        {description && <p id={`${id}-desc`} className="text-xs text-gray-400 mt-0.5">{description}</p>}
      </div>
      <button
        type="button"
        role="switch"
        aria-checked={checked}
        aria-labelledby={`${id}-label`}
        aria-describedby={description ? `${id}-desc` : undefined}
        disabled={disabled}
        onClick={() => onChange(!checked)}
        className={`relative shrink-0 w-12 h-7 rounded-full border transition-colors disabled:opacity-60 disabled:cursor-not-allowed ${
          checked ? 'bg-indigo-600 border-indigo-400' : 'bg-bg-elevated border-bg-field'
        }`}
      >
        <span
          aria-hidden="true"
          className={`absolute top-0.5 left-0.5 w-[22px] h-[22px] rounded-full bg-white transition-transform ${checked ? 'translate-x-5' : ''}`}
        />
      </button>
    </div>
  )
}
