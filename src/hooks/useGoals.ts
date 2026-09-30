import { useState, useEffect, useCallback } from 'react'
import type { Goal } from '@/types'
import { db } from '@/lib/db'

export function useGoals() {
  const [goals, setGoals] = useState<Goal[]>([])
  const [loading, setLoading] = useState(true)

  const refresh = useCallback(async () => {
    setLoading(true)
    try { setGoals(await db.listGoals()) }
    finally { setLoading(false) }
  }, [])

  useEffect(() => { refresh() }, [refresh])

  return {
    goals, loading, refresh,
    createGoal: async (data: Omit<Goal, 'id' | 'created_at'>) => {
      await db.createGoal(data); refresh()
    },
    updateGoal: async (id: number, data: Partial<Goal>) => { await db.updateGoal(id, data); refresh() },
    addToGoal: async (id: number, amount: number) => { await db.addToGoal(id, amount); refresh() },
    deleteGoal: async (id: number) => { await db.deleteGoal(id); refresh() },
  }
}
