import { AlertTriangle, AlertCircle } from 'lucide-react'
import type { ReactNode } from 'react'
import { formatCOP } from '@/lib/currency'
import { budgetStateLabel, type BudgetLine } from '@/lib/budgets'
import { CATEGORY_ICONS } from '@/types'

const BAR_COLOR = { ok: 'bg-accent-green', near: 'bg-accent-yellow', over: 'bg-accent-red' } as const
const TEXT_COLOR = { ok: 'text-gray-400', near: 'text-accent-yellow', over: 'text-rose-400' } as const

interface Props {
  line: BudgetLine
  /** Versión reducida para el resumen de Hoy */
  compact?: boolean
  /** Botones (editar, quitar) a la derecha del título */
  actions?: ReactNode
}

/** Una categoría con su límite: gastado, lo que queda y aviso cuando se acerca o se pasa. */
export function BudgetBar({ line, compact, actions }: Props) {
  const pct = Math.round(line.ratio * 100)
  const remainingText = line.remaining >= 0
    ? `Quedan ${formatCOP(line.remaining)}`
    : `Te pasaste por ${formatCOP(Math.abs(line.remaining))}`

  return (
    <div>
      <div className="flex items-center justify-between gap-2 mb-1">
        <p className={`${compact ? 'text-sm' : 'text-sm font-medium'} text-gray-100 truncate min-w-0`}>
          <span aria-hidden="true">{CATEGORY_ICONS[line.category] ?? '📦'} </span>{line.category}
        </p>
        <div className="flex items-center shrink-0">
          <p className="text-xs text-gray-200">
            {formatCOP(line.spent)} <span className="text-gray-400">de {formatCOP(line.limit)}</span>
          </p>
          {actions}
        </div>
      </div>

      <div
        role="progressbar"
        aria-label={`Presupuesto de ${line.category}`}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={Math.min(pct, 100)}
        aria-valuetext={`${pct}% usado. ${remainingText}. ${budgetStateLabel(line.state)}.`}
        className="h-2 bg-bg-elevated rounded-full overflow-hidden"
      >
        <div className={`h-full rounded-full ${BAR_COLOR[line.state]}`} style={{ width: `${Math.min(pct, 100)}%` }} />
      </div>

      <p className={`text-xs mt-1 flex items-center gap-1 ${TEXT_COLOR[line.state]}`}>
        {line.state === 'over' && <AlertCircle size={12} className="shrink-0" aria-hidden="true" />}
        {line.state === 'near' && <AlertTriangle size={12} className="shrink-0" aria-hidden="true" />}
        <span>
          {line.state === 'over' && 'Límite superado. '}
          {line.state === 'near' && 'Cerca del límite. '}
          {remainingText} · {pct}%
        </span>
      </p>
    </div>
  )
}
