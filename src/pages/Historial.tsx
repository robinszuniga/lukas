import { useState, useMemo } from 'react'
import { Link } from 'react-router-dom'
import { Download, ArrowLeft } from 'lucide-react'
import { Header } from '@/components/layout/Header'
import { TransactionList } from '@/components/transactions/TransactionList'
import { TransactionFilters } from '@/components/transactions/TransactionFilters'
import { useTransactions } from '@/hooks/useTransactions'
import { useAccounts, useCards } from '@/hooks/useLists'
import { useDeleteWithUndo } from '@/hooks/useDeleteWithUndo'
import { currentMonth, formatDate, monthLabel } from '@/lib/dates'
import { formatCOP } from '@/lib/currency'
import { getCurrencyCode, plainAmount } from '@/lib/money'
import { CATEGORY_ICONS, CATEGORY_COLORS } from '@/types'
import type { Transaction } from '@/types'
import { iconButton } from '@/components/ui/styles'
import { matchPaymentTargets } from '@/lib/paymentMethod'

/** CSV con importes planos (punto decimal, sin miles) y la moneda en su propia columna. */
function exportCSV(transactions: Transaction[], month: string) {
  const currency = getCurrencyCode()
  const cell = (text: string) => `"${text.replace(/"/g, '""')}"`
  const header = 'Fecha,Tipo,Categoría,Descripción,Método de pago,Monto,Moneda'
  const rows = transactions.map((tx) =>
    [
      tx.date,
      tx.type === 'income' ? 'Ingreso' : 'Gasto',
      cell(tx.category),
      cell(tx.description ?? ''),
      cell(tx.payment_method ?? ''),
      plainAmount(tx.amount),
      currency,
    ].join(',')
  )
  const csv = [header, ...rows].join('\n')
  const blob = new Blob(['﻿' + csv], { type: 'text/csv;charset=utf-8;' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `lukas-${month}.csv`
  a.click()
  URL.revokeObjectURL(url)
}

export function Historial() {
  const [month, setMonth] = useState(currentMonth())
  const [type, setType] = useState('')
  const [category, setCategory] = useState('')
  const [search, setSearch] = useState('')

  const { transactions, summary, loading, updateTransaction } = useTransactions({
    month,
    type: type || undefined,
    category: category || undefined,
  })
  const { accounts } = useAccounts()
  const { cards } = useCards()
  const confirmDelete = useDeleteWithUndo()

  const filtered = useMemo(() => {
    if (!search.trim()) return transactions
    const q = search.toLowerCase()
    return transactions.filter(
      (tx) =>
        (tx.description ?? '').toLowerCase().includes(q) ||
        (tx.payment_method ?? '').toLowerCase().includes(q) ||
        tx.category.toLowerCase().includes(q)
    )
  }, [transactions, search])

  const handleDelete = (tx: Transaction) => {
    const linked = matchPaymentTargets(tx.payment_method, accounts, cards)[0]?.name

    return confirmDelete({
      kind: 'transaction',
      id: tx.id,
      title: '¿Eliminar este movimiento?',
      details: [
        { label: tx.type === 'income' ? 'Ingreso' : 'Gasto', value: tx.description || tx.category },
        { label: 'Monto', value: formatCOP(tx.amount) },
        { label: 'Categoría', value: tx.category },
        { label: 'Fecha', value: formatDate(tx.date) },
      ],
      note: linked
        ? `Los totales y presupuestos se actualizan solos. El saldo de «${linked}» no se ajusta: corrígelo en Tarjetas si hace falta. Podrás deshacer justo después.`
        : 'Los totales y presupuestos se actualizan solos. Podrás deshacerlo justo después.',
      doneMessage: 'Movimiento eliminado',
    })
  }

  const topCategories = (summary?.byCategory ?? []).slice(0, 4)
  const maxCat = topCategories[0]?.total ?? 0

  return (
    <div className="px-4 pt-4">
      <Header
        title="Historial"
        subtitle="Todos tus movimientos"
        showMonth={false}
        right={
          <>
            <button
              type="button"
              onClick={() => exportCSV(filtered, month)}
              disabled={filtered.length === 0}
              className={`${iconButton} disabled:opacity-60 disabled:cursor-not-allowed`}
              aria-label={`Exportar a CSV los ${filtered.length} movimientos que se ven`}
            >
              <Download size={18} aria-hidden="true" />
            </button>
            <Link to="/" className={iconButton} aria-label="Volver a Hoy">
              <ArrowLeft size={18} aria-hidden="true" />
            </Link>
          </>
        }
      />

      {summary && (
        <dl className="flex flex-wrap gap-x-4 gap-y-1 mb-3 text-sm" aria-label={`Totales de ${monthLabel(month)}`}>
          <div className="flex gap-1">
            <dt className="text-gray-400">Ingresos</dt>
            <dd className="text-accent-green font-medium">{formatCOP(summary.income)}</dd>
          </div>
          <div className="flex gap-1">
            <dt className="text-gray-400">Gastos</dt>
            <dd className="text-rose-400 font-medium">{formatCOP(summary.expenses)}</dd>
          </div>
          <div className="flex gap-1">
            <dt className="text-gray-400">Saldo</dt>
            <dd className={`font-medium ${summary.balance >= 0 ? 'text-accent-cyan' : 'text-rose-400'}`}>{formatCOP(summary.balance)}</dd>
          </div>
        </dl>
      )}

      {topCategories.length > 0 && !search && !category && (
        <section aria-label="Categorías con más gasto" className="bg-bg-card border border-bg-border rounded-2xl p-4 mb-4 space-y-2">
          <h2 className="text-[11px] text-gray-400 uppercase tracking-wide">En qué se fue</h2>
          {topCategories.map((c) => (
            <button
              key={c.category}
              type="button"
              onClick={() => setCategory(c.category)}
              aria-label={`${c.category}: ${formatCOP(c.total)}. Filtrar por esta categoría`}
              className="w-full text-left py-0.5"
            >
              <div className="flex items-center justify-between text-xs mb-1 gap-2">
                <span className="text-gray-200 truncate"><span aria-hidden="true">{CATEGORY_ICONS[c.category]} </span>{c.category}</span>
                <span className="text-gray-200 shrink-0">{formatCOP(c.total)}</span>
              </div>
              <div className="h-1.5 bg-bg-elevated rounded-full overflow-hidden" aria-hidden="true">
                <div className="h-full rounded-full" style={{ width: `${maxCat ? (c.total / maxCat) * 100 : 0}%`, background: CATEGORY_COLORS[c.category] }} />
              </div>
            </button>
          ))}
        </section>
      )}

      <TransactionFilters
        month={month}
        type={type}
        category={category}
        search={search}
        onMonthChange={setMonth}
        onTypeChange={setType}
        onCategoryChange={setCategory}
        onSearchChange={setSearch}
      />

      <p className="sr-only" role="status">
        {loading ? 'Cargando movimientos' : `${filtered.length} movimiento${filtered.length === 1 ? '' : 's'}`}
      </p>

      {loading ? (
        <div className="space-y-2" aria-hidden="true">
          {[1, 2, 3, 4, 5].map((i) => (
            <div key={i} className="h-16 bg-bg-card border border-bg-border rounded-xl animate-pulse" />
          ))}
        </div>
      ) : (
        <TransactionList
          transactions={filtered}
          onDelete={handleDelete}
          onUpdate={updateTransaction}
        />
      )}
    </div>
  )
}
