import { useState } from 'react'
import { Link } from 'react-router-dom'
import { Plus, ArrowLeft, Pencil, Trash2 } from 'lucide-react'
import { Header } from '@/components/layout/Header'
import { BudgetBar } from '@/components/budgets/BudgetBar'
import { useBudgetLines } from '@/hooks/useBudgetLines'
import { useFeedback } from '@/components/ui/Feedback'
import { Modal } from '@/components/ui/Modal'
import { Field, FormError } from '@/components/ui/Field'
import { iconButton, inputClass, primaryButton, secondaryButton } from '@/components/ui/styles'
import { formatCOP } from '@/lib/currency'
import { amountErrorMessage, currencyInfo, parseMoney, toInputAmount } from '@/lib/money'
import { monthLabel } from '@/lib/dates'
import { NEAR_LIMIT, type BudgetLine } from '@/lib/budgets'
import { CATEGORIES } from '@/types'
import type { Category } from '@/types'

interface FormProps {
  /** Si viene, se edita el límite de esa categoría */
  editing: BudgetLine | null
  /** Categorías que todavía no tienen límite */
  available: Category[]
  onSave: (category: Category, limit: number) => Promise<void>
  onClose: () => void
}

function BudgetForm({ editing, available, onSave, onClose }: FormProps) {
  const [category, setCategory] = useState<Category | ''>(editing?.category ?? available[0] ?? '')
  const [limit, setLimit] = useState(editing ? toInputAmount(editing.limit) : '')
  const [limitError, setLimitError] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    const value = parseMoney(limit)
    if (value === null) { setLimitError(amountErrorMessage()); return }
    if (!category) { setError('Elige una categoría'); return }
    try {
      await onSave(category, value)
    } catch (err) {
      setError((err as Error)?.message ?? 'No se pudo guardar')
    }
  }

  return (
    <Modal
      title={editing ? `Límite de ${editing.category}` : 'Nuevo presupuesto'}
      onClose={onClose}
      footer={
        <>
          <button type="button" onClick={onClose} className={secondaryButton}>Cancelar</button>
          <button type="submit" form="budget-form" className={primaryButton}>Guardar</button>
        </>
      }
    >
      <form id="budget-form" onSubmit={submit} noValidate className="space-y-3">
        {!editing && (
          <Field label="Categoría de gasto">
            {(c) => (
              <select {...c} value={category} onChange={(e) => setCategory(e.target.value as Category)} className={inputClass} required>
                {available.map((cat) => <option key={cat} value={cat}>{cat}</option>)}
              </select>
            )}
          </Field>
        )}
        <Field
          label="Límite mensual"
          error={limitError}
          hint={`Te avisamos al llegar al ${Math.round(NEAR_LIMIT * 100)} % y cuando lo superes.`}
        >
          {(c) => (
            <input
              {...c}
              value={limit}
              onChange={(e) => { setLimit(e.target.value); setLimitError(null) }}
              placeholder="600000"
              inputMode={currencyInfo().decimals === 0 ? 'numeric' : 'decimal'}
              autoComplete="off"
              data-autofocus
              className={inputClass}
              required
            />
          )}
        </Field>
        <FormError message={error} />
      </form>
    </Modal>
  )
}

export function Presupuestos() {
  const { lines, totals, budgets, loading, month, upsertBudget, deleteBudget } = useBudgetLines()
  const { confirm, toast } = useFeedback()
  const [showForm, setShowForm] = useState(false)
  const [editing, setEditing] = useState<BudgetLine | null>(null)

  const used = new Set(budgets.map((b) => b.category))
  const available = CATEGORIES.filter((c) => !used.has(c))

  const remove = async (line: BudgetLine) => {
    const ok = await confirm({
      title: '¿Quitar este presupuesto?',
      details: [
        { label: 'Categoría', value: line.category },
        { label: 'Límite mensual', value: formatCOP(line.limit) },
      ],
      note: 'Solo se quita el límite. Tus movimientos no cambian. Podrás deshacerlo justo después.',
      confirmLabel: 'Quitar',
      danger: true,
    })
    if (!ok) return
    try {
      await deleteBudget(line.category)
      toast({
        message: `Presupuesto de ${line.category} quitado`,
        actionLabel: 'Deshacer',
        onAction: async () => { await upsertBudget(line.category, line.limit) },
      })
    } catch (err) {
      toast({ message: (err as Error)?.message ?? 'No se pudo quitar', tone: 'error' })
    }
  }

  return (
    <div className="px-4 pt-4">
      <Header
        title="Presupuestos"
        subtitle={`Límites de gasto de ${monthLabel(month)}`}
        showMonth={false}
        right={
          <>
            <button
              type="button"
              onClick={() => setShowForm(true)}
              disabled={available.length === 0}
              aria-label="Nuevo presupuesto"
              className="inline-flex items-center justify-center w-9 h-9 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white disabled:opacity-60 disabled:cursor-not-allowed"
            >
              <Plus size={18} aria-hidden="true" />
            </button>
            <Link to="/" className={iconButton} aria-label="Volver a Hoy">
              <ArrowLeft size={18} aria-hidden="true" />
            </Link>
          </>
        }
      />

      {loading ? (
        <div className="space-y-3" aria-hidden="true">
          {[1, 2, 3].map((i) => <div key={i} className="h-24 bg-bg-card border border-bg-border rounded-xl animate-pulse" />)}
        </div>
      ) : lines.length === 0 ? (
        <div className="text-center py-14 text-gray-400">
          <p className="text-4xl mb-3" aria-hidden="true">🧮</p>
          <p className="text-sm text-gray-200 mb-1">Aún no tienes presupuestos</p>
          <p className="text-xs max-w-xs mx-auto mb-5">
            Pon un límite mensual a una categoría (por ejemplo, Alimentación) y Lukas te avisa cuando te acerques o lo superes.
          </p>
          <button
            type="button"
            onClick={() => setShowForm(true)}
            className="inline-flex items-center gap-2 bg-indigo-600 hover:bg-indigo-500 text-white text-sm font-medium px-4 py-2.5 rounded-xl"
          >
            <Plus size={16} aria-hidden="true" /> Crear mi primer presupuesto
          </button>
        </div>
      ) : (
        <>
          <section aria-label="Resumen de presupuestos" className="bg-bg-card border border-bg-border rounded-2xl p-4 mb-4">
            <dl className="grid grid-cols-3 gap-2">
              <div>
                <dt className="text-[11px] text-gray-400">Presupuestado</dt>
                <dd className="text-sm font-semibold text-white">{formatCOP(totals.limit)}</dd>
              </div>
              <div>
                <dt className="text-[11px] text-gray-400">Gastado</dt>
                <dd className="text-sm font-semibold text-white">{formatCOP(totals.spent)}</dd>
              </div>
              <div>
                <dt className="text-[11px] text-gray-400">{totals.remaining >= 0 ? 'Queda' : 'Excedido'}</dt>
                <dd className={`text-sm font-semibold ${totals.remaining >= 0 ? 'text-accent-green' : 'text-rose-400'}`}>
                  {formatCOP(Math.abs(totals.remaining))}
                </dd>
              </div>
            </dl>
            {(totals.over > 0 || totals.near > 0) && (
              <p role="status" className="text-xs mt-3 text-gray-200">
                {totals.over > 0 && <span className="text-rose-400">{totals.over} superado{totals.over === 1 ? '' : 's'}</span>}
                {totals.over > 0 && totals.near > 0 && ' · '}
                {totals.near > 0 && <span className="text-accent-yellow">{totals.near} cerca del límite</span>}
              </p>
            )}
          </section>

          <ul className="space-y-3">
            {lines.map((line) => (
              <li
                key={line.category}
                className={`bg-bg-card border rounded-xl pl-4 pr-2 py-3 ${
                  line.state === 'over' ? 'border-accent-red/50' : line.state === 'near' ? 'border-accent-yellow/50' : 'border-bg-border'
                }`}
              >
                <BudgetBar
                  line={line}
                  actions={
                    <>
                      <button type="button" onClick={() => setEditing(line)} className={`${iconButton} ml-1`} aria-label={`Editar límite de ${line.category}`}>
                        <Pencil size={14} aria-hidden="true" />
                      </button>
                      <button type="button" onClick={() => remove(line)} className={`${iconButton} hover:text-rose-400`} aria-label={`Quitar presupuesto de ${line.category}`}>
                        <Trash2 size={14} aria-hidden="true" />
                      </button>
                    </>
                  }
                />
              </li>
            ))}
          </ul>
        </>
      )}

      <section aria-label="Cómo funcionan" className="text-xs text-gray-400 mt-6 space-y-1.5">
        <h2 className="text-gray-200 font-medium">Cómo se calcula</h2>
        <p>Se suman los <strong className="font-medium text-gray-200">gastos</strong> del mes en curso de cada categoría. Los ingresos no cuentan.</p>
        <p>Si editas el monto de un movimiento, lo eliminas, lo cambias de categoría o de mes, el presupuesto se actualiza al instante.</p>
        <p>Al empezar un mes nuevo, el gasto vuelve a cero y el límite se mantiene.</p>
      </section>

      {(showForm || editing) && (
        <BudgetForm
          editing={editing}
          available={available}
          onSave={async (category, limit) => {
            await upsertBudget(category, limit)
            setShowForm(false)
            setEditing(null)
          }}
          onClose={() => { setShowForm(false); setEditing(null) }}
        />
      )}
    </div>
  )
}
