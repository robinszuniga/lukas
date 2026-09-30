import type { ReactNode } from 'react'
import { monthLabel, currentMonth } from '@/lib/dates'

interface Props {
  title: string
  subtitle?: string
  /** Acciones a la derecha (iconos, botones). El mes se muestra debajo del título. */
  right?: ReactNode
  showMonth?: boolean
}

export function Header({ title, subtitle, right, showMonth = true }: Props) {
  return (
    <div className="mb-4 flex items-start justify-between gap-3">
      <div className="min-w-0">
        <h1 className="text-xl font-semibold text-white leading-tight">{title}</h1>
        {subtitle && <p className="text-xs text-gray-500 mt-0.5 truncate">{subtitle}</p>}
      </div>
      <div className="flex items-center gap-2 shrink-0">
        {right}
        {showMonth && (
          <span className="text-[11px] text-gray-500 bg-bg-card border border-bg-border px-2.5 py-1 rounded-full capitalize whitespace-nowrap">
            {monthLabel(currentMonth())}
          </span>
        )}
      </div>
    </div>
  )
}
