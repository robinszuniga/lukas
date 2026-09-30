import { useState, useEffect, useCallback } from 'react'
import type { Recurring } from '@/types'
import { db } from '@/lib/db'
import { currentMonth } from '@/lib/dates'

export function useRecurring() {
  const [recurring, setRecurring] = useState<Recurring[]>([])
  const [loading, setLoading] = useState(true)

  const refresh = useCallback(async () => {
    setLoading(true)
    try {
      setRecurring(await db.listRecurring())
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { refresh() }, [refresh])

  const month = currentMonth()
  const pending = recurring.filter((r) => r.last_posted !== month)

  return {
    recurring,
    pending,
    loading,
    refresh,
    createRecurring: async (data: Omit<Recurring, 'id' | 'created_at' | 'last_posted'>) => {
      await db.createRecurring(data)
      refresh()
    },
    updateRecurring: async (id: number, data: Partial<Recurring>) => {
      await db.updateRecurring(id, data)
      refresh()
    },
    postRecurring: async (id: number) => {
      await db.postRecurring(id)
      refresh()
    },
    deleteRecurring: async (id: number) => {
      await db.deleteRecurring(id)
      refresh()
    },
  }
}
