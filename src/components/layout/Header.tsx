import type { ReactNode } from 'react'
import { monthLabel, currentMonth } from '@/lib/dates'

interface Props {
  title: string
  subtitle?: string
  /** Acciones a la derecha (iconos, botones) */
  right?: ReactNode
  showMonth?: boolean
}

export function Header({ title, subtitle, right, showMonth = true }: Props) {
  return (
    <header className="mb-4 flex items-start justify-between gap-3">
      <div className="min-w-0">
        <h1 className="text-xl font-semibold text-white leading-tight">{title}</h1>
        {subtitle && <p className="text-xs text-gray-400 mt-0.5">{subtitle}</p>}
      </div>
      <div className="flex items-center gap-1 shrink-0">
        {right}
        {showMonth && (
          <span className="ml-1 text-[11px] text-gray-400 bg-bg-card border border-bg-border px-2.5 py-1 rounded-full capitalize whitespace-nowrap">
            {monthLabel(currentMonth())}
          </span>
        )}
      </div>
    </header>
  )
}
