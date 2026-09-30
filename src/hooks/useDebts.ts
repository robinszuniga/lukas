import { useState, useEffect, useCallback } from 'react'
import type { Debt } from '@/types'
import { db } from '@/lib/db'

export function useDebts() {
  const [debts, setDebts] = useState<Debt[]>([])
  const [loading, setLoading] = useState(true)

  const refresh = useCallback(async () => {
    setLoading(true)
    try {
      setDebts(await db.listDebts())
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { refresh() }, [refresh])

  return {
    debts,
    loading,
    refresh,
    createDebt: async (data: Omit<Debt, 'id' | 'created_at' | 'paid'>) => {
      await db.createDebt(data)
      refresh()
    },
    updateDebt: async (id: number, data: Partial<Debt>) => {
      await db.updateDebt(id, data)
      refresh()
    },
    toggleDebtPaid: async (id: number) => {
      await db.toggleDebtPaid(id)
      refresh()
    },
    deleteDebt: async (id: number) => {
      await db.deleteDebt(id)
      refresh()
    },
  }
}
