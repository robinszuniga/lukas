import { useState, useEffect, useCallback } from 'react'
import type { Budget, Category } from '@/types'
import { db } from '@/lib/db'

export function useBudgets() {
  const [budgets, setBudgets] = useState<Budget[]>([])
  const [loading, setLoading] = useState(true)

  const refresh = useCallback(async () => {
    setLoading(true)
    try { setBudgets(await db.listBudgets()) }
    finally { setLoading(false) }
  }, [])

  useEffect(() => { refresh() }, [refresh])

  return {
    budgets, loading, refresh,
    getBudget: (category: Category) =>
      budgets.find((b) => b.category === category)?.monthly_limit ?? null,
    upsertBudget: async (category: Category, limit: number) => {
      await db.upsertBudget(category, limit); refresh()
    },
    deleteBudget: async (category: Category) => { await db.deleteBudget(category); refresh() },
  }
}
