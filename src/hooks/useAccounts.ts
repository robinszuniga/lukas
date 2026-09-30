import { useState, useEffect, useCallback } from 'react'
import type { Account } from '@/types'
import { db } from '@/lib/db'

export function useAccounts() {
  const [accounts, setAccounts] = useState<Account[]>([])
  const [loading, setLoading] = useState(true)

  const refresh = useCallback(async () => {
    setLoading(true)
    try {
      setAccounts(await db.listAccounts())
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { refresh() }, [refresh])

  return {
    accounts,
    loading,
    refresh,
    createAccount: async (data: Omit<Account, 'id' | 'created_at'>) => {
      await db.createAccount(data)
      refresh()
    },
    updateBalance: async (id: number, balance: number) => {
      await db.updateAccountBalance(id, balance)
      refresh()
    },
    updateAccount: async (id: number, data: Partial<Account>) => {
      await db.updateAccount(id, data)
      refresh()
    },
    deleteAccount: async (id: number) => {
      await db.deleteAccount(id)
      refresh()
    },
  }
}
