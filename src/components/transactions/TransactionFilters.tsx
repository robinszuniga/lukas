import { Search } from 'lucide-react'
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

export function TransactionFilters({
  month, type, category, search,
  onMonthChange, onTypeChange, onCategoryChange, onSearchChange,
}: Props) {
  const selectClass =
    'bg-bg-card border border-bg-border text-sm text-gray-300 rounded-lg px-3 py-1.5 outline-none focus:border-accent-indigo/50 transition-colors'

  return (
    <div className="space-y-2 mb-4">
      {/* Búsqueda — fila completa */}
      <div className="relative">
        <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-600" />
        <input
          value={search}
          onChange={(e) => onSearchChange(e.target.value)}
          placeholder="Buscar por descripción o método de pago…"
          className="w-full bg-bg-card border border-bg-border text-sm text-gray-300 rounded-lg pl-9 pr-3 py-1.5 outline-none focus:border-accent-indigo/50 placeholder-gray-600 transition-colors"
        />
      </div>

      {/* Filtros — fila scrollable horizontal en móvil */}
      <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-hide">
        <input
          type="month"
          value={month}
          onChange={(e) => onMonthChange(e.target.value)}
          className={`${selectClass} shrink-0`}
        />
        <select value={type} onChange={(e) => onTypeChange(e.target.value)} className={`${selectClass} shrink-0`}>
          <option value="">Todos los tipos</option>
          <option value="income">Ingresos</option>
          <option value="expense">Gastos</option>
        </select>
        <select value={category} onChange={(e) => onCategoryChange(e.target.value)} className={`${selectClass} shrink-0`}>
          <option value="">Todas las categorías</option>
          {CATEGORIES.map((c) => <option key={c} value={c}>{c}</option>)}
        </select>
      </div>
    </div>
  )
}
