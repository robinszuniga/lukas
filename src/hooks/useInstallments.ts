import type { Installment } from '@/types'
import { db } from '@/lib/db'
import { useDbQuery } from './useDbQuery'

export function useInstallments() {
  const { data: installments, loading, refresh } = useDbQuery(() => db.listInstallments(), [] as Installment[])

  return {
    installments, loading, refresh,
    createInstallment: async (data: Omit<Installment, 'id' | 'created_at' | 'paid_months'>) => { await db.createInstallment(data) },
    updateInstallment: async (id: number, data: Partial<Installment>) => { await db.updateInstallment(id, data) },
    updateInstallmentAmount: async (id: number, amount: number) => { await db.updateInstallment(id, { monthly_amount: amount }) },
    payInstallment: (id: number) => db.payInstallment(id),
    undoPayInstallment: (id: number) => db.undoPayInstallment(id),
  }
}
