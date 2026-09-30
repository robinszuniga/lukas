import type {
  Transaction, Installment, Goal, CreditCard, Budget, TransactionSummary, Debt, BackupData,
  Account, Recurring,
} from '@/types'

export interface TransactionFilters {
  month?: string
  type?: string
  category?: string
  dateFrom?: string   // YYYY-MM-DD
  dateTo?: string     // YYYY-MM-DD
}

export interface DBService {
  init(): Promise<void>

  // Transactions
  listTransactions(filters?: TransactionFilters): Promise<Transaction[]>
  createTransaction(data: Omit<Transaction, 'id' | 'created_at'>): Promise<Transaction>
  updateTransaction(id: number, data: Partial<Transaction>): Promise<Transaction>
  deleteTransaction(id: number): Promise<void>
  getTransactionSummary(month: string): Promise<TransactionSummary>

  // Installments
  listInstallments(): Promise<Installment[]>
  createInstallment(data: Omit<Installment, 'id' | 'created_at' | 'paid_months'> & { paid_months?: number }): Promise<Installment>
  updateInstallment(id: number, data: Partial<Installment>): Promise<Installment>
  payInstallment(id: number): Promise<Installment>
  deleteInstallment(id: number): Promise<void>
  listInstallmentPayments(installmentId: number): Promise<import('@/types').InstallmentPayment[]>

  // Goals
  listGoals(): Promise<Goal[]>
  createGoal(data: Omit<Goal, 'id' | 'created_at'>): Promise<Goal>
  updateGoal(id: number, data: Partial<Goal>): Promise<Goal>
  addToGoal(id: number, amount: number): Promise<Goal>
  deleteGoal(id: number): Promise<void>

  // Cards
  listCards(): Promise<CreditCard[]>
  createCard(data: Omit<CreditCard, 'id'>): Promise<CreditCard>
  updateCard(id: number, data: Partial<CreditCard>): Promise<CreditCard>
  deleteCard(id: number): Promise<void>

  // Budgets
  listBudgets(): Promise<Budget[]>
  upsertBudget(category: string, limit: number): Promise<Budget>
  deleteBudget(category: string): Promise<void>

  // Debts (me deben / yo debo)
  listDebts(): Promise<Debt[]>
  createDebt(data: Omit<Debt, 'id' | 'created_at' | 'paid'>): Promise<Debt>
  updateDebt(id: number, data: Partial<Debt>): Promise<Debt>
  toggleDebtPaid(id: number): Promise<Debt>
  deleteDebt(id: number): Promise<void>

  // Accounts (cuentas bancarias / efectivo)
  listAccounts(): Promise<Account[]>
  createAccount(data: Omit<Account, 'id' | 'created_at'>): Promise<Account>
  updateAccount(id: number, data: Partial<Account>): Promise<Account>
  updateAccountBalance(id: number, balance: number): Promise<Account>
  deleteAccount(id: number): Promise<void>

  // Recurring (pagos fijos mensuales)
  listRecurring(): Promise<Recurring[]>
  createRecurring(data: Omit<Recurring, 'id' | 'created_at' | 'last_posted'>): Promise<Recurring>
  updateRecurring(id: number, data: Partial<Recurring>): Promise<Recurring>
  postRecurring(id: number): Promise<Recurring>
  deleteRecurring(id: number): Promise<void>

  // Backup (exportar/importar todo)
  exportBackup(): Promise<BackupData>
  importBackup(data: BackupData): Promise<void>

  // AI key (platform-specific storage)
  getApiKey(): Promise<string | null>
  saveApiKey(key: string): Promise<void>

  // AI (Gemini) — registra transacciones o responde preguntas con contexto
  parseWithAI(text: string, apiKey: string, signal?: AbortSignal, context?: string): Promise<import('@/lib/ai/validate').AIResult>
}
