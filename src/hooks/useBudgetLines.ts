import type { Budget, Category, TransactionSummary } from '@/types'
import { db } from '@/lib/db'
import { currentMonth } from '@/lib/dates'
import { buildBudgetLines, budgetTotals } from '@/lib/budgets'
import { useDbQuery } from './useDbQuery'

const EMPTY: { budgets: Budget[]; byCategory: TransactionSummary['byCategory'] } = { budgets: [], byCategory: [] }

/**
 * Presupuestos del mes en curso con su gasto. Se recalcula solo cada vez que cambia
 * cualquier movimiento, porque el gasto sale directo de los movimientos (solo gastos).
 */
export function useBudgetLines() {
  const month = currentMonth()
  const { data, loading } = useDbQuery(async () => {
    const [budgets, summary] = await Promise.all([db.listBudgets(), db.getTransactionSummary(month)])
    return { budgets, byCategory: summary.byCategory }
  }, EMPTY, [month])

  const lines = buildBudgetLines(data.budgets, data.byCategory)

  return {
    month,
    loading,
    budgets: data.budgets,
    lines,
    totals: budgetTotals(lines),
    upsertBudget: async (category: Category, limit: number) => { await db.upsertBudget(category, limit) },
    deleteBudget: async (category: Category) => { await db.deleteBudget(category) },
  }
}
