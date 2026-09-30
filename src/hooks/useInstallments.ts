import { useState, useEffect, useCallback } from 'react'
import type { Installment } from '@/types'
import { db } from '@/lib/db'

export function useInstallments() {
  const [installments, setInstallments] = useState<Installment[]>([])
  const [loading, setLoading] = useState(true)

  const refresh = useCallback(async () => {
    setLoading(true)
    try { setInstallments(await db.listInstallments()) }
    finally { setLoading(false) }
  }, [])

  useEffect(() => { refresh() }, [refresh])

  return {
    installments, loading, refresh,
    createInstallment: async (data: Omit<Installment, 'id' | 'created_at' | 'paid_months'>) => {
      await db.createInstallment(data); refresh()
    },
    updateInstallment: async (id: number, data: Partial<Installment>) => { await db.updateInstallment(id, data); refresh() },
    updateInstallmentAmount: async (id: number, amount: number) => { await db.updateInstallment(id, { monthly_amount: amount }); refresh() },
    payInstallment: async (id: number) => { await db.payInstallment(id); refresh() },
    deleteInstallment: async (id: number) => { await db.deleteInstallment(id); refresh() },
  }
}
