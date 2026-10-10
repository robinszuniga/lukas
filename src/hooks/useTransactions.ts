import type { Transaction, TransactionSummary } from '@/types'
import type { TransactionFilters } from '@/lib/db'
import { db } from '@/lib/db'
import { currentMonth } from '@/lib/dates'
import { useDbQuery } from './useDbQuery'

const EMPTY: { transactions: Transaction[]; summary: TransactionSummary | null } = { transactions: [], summary: null }

export function useTransactions(filters?: TransactionFilters) {
  const month = filters?.month ?? currentMonth()

  const { data, loading, refresh } = useDbQuery(
    async () => {
      const [transactions, summary] = await Promise.all([
        db.listTransactions(filters),
        db.getTransactionSummary(month),
      ])
      return { transactions, summary }
    },
    EMPTY,
    [month, filters?.type, filters?.category, filters?.dateFrom, filters?.dateTo],
  )

  return {
    transactions: data.transactions,
    summary: data.summary,
    loading,
    refresh,
    createTransaction: (tx: Omit<Transaction, 'id' | 'created_at'>) => db.createTransaction(tx),
    updateTransaction: async (id: number, patch: Partial<Transaction>, options?: { adjustBalances?: boolean }) => {
      await db.updateTransaction(id, patch, options)
    },
  }
}
