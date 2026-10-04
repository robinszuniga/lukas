import type { Account, Budget, Category, CreditCard, Debt, Goal, PaymentLogEntry } from '@/types'
import { db } from '@/lib/db'
import { useDbQuery } from './useDbQuery'

/** Deudas (me deben / yo debo) */
export function useDebts() {
  const { data: debts, loading, refresh } = useDbQuery(() => db.listDebts(), [] as Debt[])
  return {
    debts, loading, refresh,
    createDebt: async (data: Omit<Debt, 'id' | 'created_at' | 'paid'>) => { await db.createDebt(data) },
    updateDebt: async (id: number, data: Partial<Debt>) => { await db.updateDebt(id, data) },
    toggleDebtPaid: (id: number) => db.toggleDebtPaid(id),
  }
}

/** Metas de ahorro */
export function useGoals() {
  const { data: goals, loading, refresh } = useDbQuery(() => db.listGoals(), [] as Goal[])
  return {
    goals, loading, refresh,
    createGoal: async (data: Omit<Goal, 'id' | 'created_at'>) => { await db.createGoal(data) },
    updateGoal: async (id: number, data: Partial<Goal>) => { await db.updateGoal(id, data) },
    addToGoal: async (id: number, amount: number) => { await db.addToGoal(id, amount) },
  }
}

/** Tarjetas de crédito */
export function useCards() {
  const { data: cards, loading, refresh } = useDbQuery(() => db.listCards(), [] as CreditCard[])
  return {
    cards, loading, refresh,
    createCard: async (data: Omit<CreditCard, 'id'>) => { await db.createCard(data) },
    updateCard: async (id: number, data: Partial<CreditCard>) => { await db.updateCard(id, data) },
  }
}

/** Cuentas con saldo real */
export function useAccounts() {
  const { data: accounts, loading, refresh } = useDbQuery(() => db.listAccounts(), [] as Account[])
  return {
    accounts, loading, refresh,
    createAccount: async (data: Omit<Account, 'id' | 'created_at'>) => { await db.createAccount(data) },
    updateBalance: async (id: number, balance: number) => { await db.updateAccountBalance(id, balance) },
    updateAccount: async (id: number, data: Partial<Account>) => { await db.updateAccount(id, data) },
  }
}

/** Límites mensuales por categoría */
export function useBudgets() {
  const { data: budgets, loading, refresh } = useDbQuery(() => db.listBudgets(), [] as Budget[])
  return {
    budgets, loading, refresh,
    getBudget: (category: Category) => budgets.find((b) => b.category === category)?.monthly_limit ?? null,
    upsertBudget: async (category: Category, limit: number) => { await db.upsertBudget(category, limit) },
    deleteBudget: async (category: Category) => { await db.deleteBudget(category) },
  }
}

/** Último pago registrado por cuota o pago fijo: permite ofrecer "Deshacer". */
export function useLastPayments() {
  const { data } = useDbQuery(() => db.listLastPayments(), [] as PaymentLogEntry[])
  const byKey = new Map(data.map((p) => [`${p.kind}:${p.item_id}`, p]))
  return {
    lastPayment: (kind: 'recurring' | 'installment', id: number) => byKey.get(`${kind}:${id}`),
  }
}
