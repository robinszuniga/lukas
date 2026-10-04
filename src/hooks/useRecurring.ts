import type { Recurring } from '@/types'
import { db } from '@/lib/db'
import { currentMonth } from '@/lib/dates'
import { useDbQuery } from './useDbQuery'

export function useRecurring() {
  const { data: recurring, loading, refresh } = useDbQuery(() => db.listRecurring(), [] as Recurring[])

  const month = currentMonth()
  const pending = recurring.filter((r) => r.last_posted !== month)

  return {
    recurring,
    pending,
    loading,
    refresh,
    createRecurring: async (data: Omit<Recurring, 'id' | 'created_at' | 'last_posted'>) => { await db.createRecurring(data) },
    updateRecurring: async (id: number, data: Partial<Recurring>) => { await db.updateRecurring(id, data) },
    postRecurring: (id: number) => db.postRecurring(id),
    undoPostRecurring: (id: number) => db.undoPostRecurring(id),
  }
}
