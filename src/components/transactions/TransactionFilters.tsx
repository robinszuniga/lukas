import { useId } from 'react'
import { Search, X } from 'lucide-react'
import { CATEGORIES } from '@/types'

interface Props {
  month: string
  type: string
  category: string
  search: string
  onMonthChange: (v: string) => void
  onTypeChange: (v: string) => void
  onCategoryChange: (v: string) => void
  onSearchChange: (v: string) => void
}

const controlClass =
  'w-full min-w-0 bg-bg-card border border-bg-field text-sm text-gray-200 rounded-lg px-3 py-2 outline-none focus:border-accent-indigo transition-colors'

/**
 * Filtros del historial. En pantallas angostas se acomodan en filas (2 columnas +
 * categoría a todo el ancho) en vez de desbordarse hacia un lado.
 */
export function TransactionFilters({
  month, type, category, search,
  onMonthChange, onTypeChange, onCategoryChange, onSearchChange,
}: Props) {
  const id = useId()
  const hasFilters = !!(type || category || search)

  return (
    <form role="search" aria-label="Filtrar movimientos" onSubmit={(e) => e.preventDefault()} className="space-y-2 mb-4">
      <div className="relative">
        <label htmlFor={`${id}-buscar`} className="sr-only">Buscar por descripción, categoría o método de pago</label>
        <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-450 pointer-events-none" aria-hidden="true" />
        <input
          id={`${id}-buscar`}
          type="search"
          value={search}
          onChange={(e) => onSearchChange(e.target.value)}
          placeholder="Buscar descripción o método de pago"
          className={`${controlClass} pl-9 placeholder-gray-450`}
        />
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
        <div className="min-w-0">
          <label htmlFor={`${id}-mes`} className="sr-only">Mes</label>
          <input
            id={`${id}-mes`}
            type="month"
            value={month}
            onChange={(e) => e.target.value && onMonthChange(e.target.value)}
            className={controlClass}
          />
        </div>
        <div className="min-w-0">
          <label htmlFor={`${id}-tipo`} className="sr-only">Tipo de movimiento</label>
          <select id={`${id}-tipo`} value={type} onChange={(e) => onTypeChange(e.target.value)} className={controlClass}>
            <option value="">Todos los tipos</option>
            <option value="income">Ingresos</option>
            <option value="expense">Gastos</option>
          </select>
        </div>
        <div className="min-w-0 col-span-2 sm:col-span-1">
          <label htmlFor={`${id}-categoria`} className="sr-only">Categoría</label>
          <select id={`${id}-categoria`} value={category} onChange={(e) => onCategoryChange(e.target.value)} className={controlClass}>
            <option value="">Todas las categorías</option>
            {CATEGORIES.map((c) => <option key={c} value={c}>{c}</option>)}
          </select>
        </div>
      </div>

      {hasFilters && (
        <button
          type="button"
          onClick={() => { onTypeChange(''); onCategoryChange(''); onSearchChange('') }}
          className="inline-flex items-center gap-1 text-xs text-accent-cyan py-1"
        >
          <X size={12} aria-hidden="true" /> Quitar filtros
        </button>
      )}
    </form>
  )
}
