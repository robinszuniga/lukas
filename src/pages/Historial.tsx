import { useState, useMemo } from 'react'
import { Link } from 'react-router-dom'
import { Download, ArrowLeft } from 'lucide-react'
import { Header } from '@/components/layout/Header'
import { TransactionList } from '@/components/transactions/TransactionList'
import { TransactionFilters } from '@/components/transactions/TransactionFilters'
import { useTransactions } from '@/hooks/useTransactions'
import { currentMonth } from '@/lib/dates'
import { formatCOP } from '@/lib/currency'
import { CATEGORY_ICONS, CATEGORY_COLORS } from '@/types'
import type { Transaction } from '@/types'

function exportCSV(transactions: Transaction[]) {
  const header = 'Fecha,Tipo,Categoría,Descripción,Método de pago,Monto'
  const rows = transactions.map((tx) =>
    [
      tx.date,
      tx.type === 'income' ? 'Ingreso' : 'Gasto',
      tx.category,
      `"${(tx.description ?? '').replace(/"/g, '""')}"`,
      tx.payment_method ?? '',
      tx.amount,
    ].join(',')
  )
  const csv = [header, ...rows].join('\n')
  const blob = new Blob(['﻿' + csv], { type: 'text/csv;charset=utf-8;' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `lukas-${new Date().toISOString().slice(0, 7)}.csv`
  a.click()
  URL.revokeObjectURL(url)
}

export function Historial() {
  const [month, setMonth] = useState(currentMonth())
  const [type, setType] = useState('')
  const [category, setCategory] = useState('')
  const [search, setSearch] = useState('')

  const { transactions, summary, loading, deleteTransaction, updateTransaction } = useTransactions({
    month,
    type: type || undefined,
    category: category || undefined,
  })

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
              onClick={() => exportCSV(filtered)}
              disabled={filtered.length === 0}
              className="p-2 rounded-lg text-gray-400 hover:text-white disabled:opacity-30"
              title="Exportar CSV"
            >
              <Download size={20} />
            </button>
            <Link to="/" className="p-2 rounded-lg text-gray-400 hover:text-white" title="Volver">
              <ArrowLeft size={20} />
            </Link>
          </>
        }
      />

      {summary && (
        <div className="flex flex-wrap gap-2 mb-3 text-sm">
          <span className="text-accent-green">↑ {formatCOP(summary.income)}</span>
          <span className="text-gray-600">·</span>
          <span className="text-accent-red">↓ {formatCOP(summary.expenses)}</span>
          <span className="text-gray-600">·</span>
          <span className={summary.balance >= 0 ? 'text-accent-cyan' : 'text-accent-red'}>
            = {formatCOP(summary.balance)}
          </span>
        </div>
      )}

      {topCategories.length > 0 && !search && !category && (
        <div className="bg-bg-card border border-bg-border rounded-2xl p-4 mb-4 space-y-2">
          <p className="text-[11px] text-gray-500 uppercase tracking-wide">En qué se fue</p>
          {topCategories.map((c) => (
            <button key={c.category} onClick={() => setCategory(c.category)} className="w-full text-left">
              <div className="flex items-center justify-between text-xs mb-1">
                <span className="text-gray-300">{CATEGORY_ICONS[c.category]} {c.category}</span>
                <span className="text-gray-400">{formatCOP(c.total)}</span>
              </div>
              <div className="h-1.5 bg-bg-elevated rounded-full overflow-hidden">
                <div className="h-full rounded-full" style={{ width: `${maxCat ? (c.total / maxCat) * 100 : 0}%`, background: CATEGORY_COLORS[c.category] }} />
              </div>
            </button>
          ))}
        </div>
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

      {loading ? (
        <div className="space-y-2">
          {[1, 2, 3, 4, 5].map((i) => (
            <div key={i} className="h-16 bg-bg-card border border-bg-border rounded-xl animate-pulse" />
          ))}
        </div>
      ) : (
        <TransactionList
          transactions={filtered}
          onDelete={deleteTransaction}
          onUpdate={updateTransaction}
        />
      )}
    </div>
  )
}
