export type TransactionType = 'income' | 'expense'

export type Category =
  | 'Alimentación'
  | 'Transporte'
  | 'Entretenimiento'
  | 'Educación'
  | 'Ropa'
  | 'Antojos'
  | 'Salud'
  | 'Servicios'
  | 'Ahorro'
  | 'Otro'

export const CATEGORIES: Category[] = [
  'Alimentación', 'Transporte', 'Entretenimiento', 'Educación',
  'Ropa', 'Antojos', 'Salud', 'Servicios', 'Ahorro', 'Otro',
]

export const CATEGORY_ICONS: Record<Category, string> = {
  Alimentación: '🍔',
  Transporte: '🚌',
  Entretenimiento: '🎬',
  Educación: '📚',
  Ropa: '👕',
  Antojos: '🍩',
  Salud: '💊',
  Servicios: '⚡',
  Ahorro: '💰',
  Otro: '📦',
}

export const CATEGORY_COLORS: Record<Category, string> = {
  Alimentación: '#f59e0b',
  Transporte: '#3b82f6',
  Entretenimiento: '#8b5cf6',
  Educación: '#10b981',
  Ropa: '#f43f5e',
  Antojos: '#ec4899',
  Salud: '#22d3ee',
  Servicios: '#f97316',
  Ahorro: '#6366f1',
  Otro: '#6b7280',
}

export interface Transaction {
  id: number
  amount: number
  type: TransactionType
  category: Category
  description: string | null
  payment_method: string | null
  date: string
  created_at: string
}

export interface Installment {
  id: number
  name: string
  total_amount: number
  total_months: number
  paid_months: number
  monthly_amount: number
  next_due_date: string | null
  notes: string | null
  created_at: string
}

export interface Goal {
  id: number
  name: string
  target_amount: number
  saved_amount: number
  deadline: string | null
  emoji: string
  created_at: string
}

export interface CreditCard {
  id: number
  bank_name: string
  last_four: string | null
  credit_limit: number
  current_balance: number
  billing_day: number | null
  cutoff_day: number | null
  color: string
}

export interface Budget {
  id: number
  category: Category
  monthly_limit: number
}

export type DebtType = 'owed_to_me' | 'i_owe'

export interface Debt {
  id: number
  person: string
  amount: number
  type: DebtType        // 'owed_to_me' = me deben · 'i_owe' = yo debo
  description: string | null
  due_date: string | null
  paid: number          // 0 = pendiente · 1 = saldada
  created_at: string
}

export interface InstallmentPayment {
  id: number
  installment_id: number
  paid_date: string
  amount: number
}

export interface Account {
  id: number
  name: string          // Bancolombia, Nequi, Daviplata, Efectivo…
  balance: number
  color: string
  created_at: string
}

export interface Recurring {
  id: number
  name: string          // Arriendo, Gym, Netflix…
  amount: number
  category: Category
  payment_method: string | null
  day: number           // día del mes en que se paga
  last_posted: string | null   // 'YYYY-MM' del último mes registrado
  created_at: string
}

export interface BackupData {
  version: 1
  app: 'lukas' | 'flux-finance'
  exported_at: string
  transactions: Transaction[]
  installments: Installment[]
  installment_payments: InstallmentPayment[]
  goals: Goal[]
  credit_cards: CreditCard[]
  budgets: Budget[]
  debts: Debt[]
  accounts?: Account[]
  recurring?: Recurring[]
}

export interface MonthlyTrendPoint {
  month: string         // 'YYYY-MM'
  income: number
  expenses: number
}

export interface TransactionSummary {
  income: number
  expenses: number
  balance: number
  byCategory: { category: Category; total: number }[]
}

export interface ParsedTransaction {
  amount: number
  type: TransactionType
  category: Category
  description: string
  payment_method: string | null
  date: string
}
