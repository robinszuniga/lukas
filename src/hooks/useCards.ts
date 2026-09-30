import { useState, useEffect, useCallback } from 'react'
import type { CreditCard } from '@/types'
import { db } from '@/lib/db'

export function useCards() {
  const [cards, setCards] = useState<CreditCard[]>([])
  const [loading, setLoading] = useState(true)

  const refresh = useCallback(async () => {
    setLoading(true)
    try { setCards(await db.listCards()) }
    finally { setLoading(false) }
  }, [])

  useEffect(() => { refresh() }, [refresh])

  return {
    cards, loading, refresh,
    createCard: async (data: Omit<CreditCard, 'id'>) => { await db.createCard(data); refresh() },
    updateCard: async (id: number, data: Partial<CreditCard>) => {
      await db.updateCard(id, data as any); refresh()
    },
    deleteCard: async (id: number) => { await db.deleteCard(id); refresh() },
  }
}
