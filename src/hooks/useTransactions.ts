import { useState, useEffect, useCallback } from 'react'
import type { Transaction, TransactionSummary } from '@/types'
import type { TransactionFilters } from '@/lib/db'
import { db } from '@/lib/db'
import { currentMonth } from '@/lib/dates'

export function useTransactions(filters?: TransactionFilters) {
  const [transactions, setTransactions] = useState<Transaction[]>([])
  const [summary, setSummary] = useState<TransactionSummary | null>(null)
  const [loading, setLoading] = useState(true)

  const month = filters?.month ?? currentMonth()

  const refresh = useCallback(async () => {
    setLoading(true)
    try {
      const [list, sum] = await Promise.all([
        db.listTransactions(filters),
        db.getTransactionSummary(month),
      ])
      setTransactions(list)
      setSummary(sum)
    } finally {
      setLoading(false)
    }
  }, [month, filters?.type, filters?.category])

  useEffect(() => { refresh() }, [refresh])

  return {
    transactions,
    summary,
    loading,
    refresh,
    createTransaction: async (data: Omit<Transaction, 'id' | 'created_at'>) => {
      await db.createTransaction(data)
      refresh()
    },
    deleteTransaction: async (id: number) => {
      await db.deleteTransaction(id)
      refresh()
    },
    updateTransaction: async (id: number, data: Partial<Transaction>) => {
      await db.updateTransaction(id, data as any)
      refresh()
    },
  }
}
