import type { Budget, Category } from '@/types'

/**
 * Presupuestos por categoría.
 *
 * No se guarda ningún acumulado: el gasto de cada categoría se calcula cada vez
 * a partir de los movimientos de tipo GASTO del mes. Por eso:
 *  - los ingresos nunca cuentan;
 *  - editar el monto, eliminar un movimiento o cambiarlo de categoría (o de mes)
 *    se refleja de inmediato, sin pasos de "recalcular".
 */

/** A partir de este porcentaje se avisa que el límite está cerca. */
export const NEAR_LIMIT = 0.8

export type BudgetState = 'ok' | 'near' | 'over'

export interface BudgetLine {
  category: Category
  limit: number
  spent: number
  /** Lo que queda del límite (negativo si ya se pasó) */
  remaining: number
  /** Gasto / límite, sin tope (1.25 = 125 %) */
  ratio: number
  state: BudgetState
}

export interface BudgetTotals {
  limit: number
  spent: number
  remaining: number
  near: number
  over: number
}

export function budgetState(spent: number, limit: number): BudgetState {
  if (limit <= 0) return 'ok'
  if (spent > limit) return 'over'
  if (spent >= limit * NEAR_LIMIT) return 'near'
  return 'ok'
}

/**
 * @param budgets límites definidos
 * @param expensesByCategory total de GASTOS del mes por categoría (sin ingresos)
 */
export function buildBudgetLines(
  budgets: Budget[],
  expensesByCategory: { category: Category | string; total: number }[],
): BudgetLine[] {
  const spentBy = new Map<string, number>()
  for (const row of expensesByCategory) {
    spentBy.set(row.category, (spentBy.get(row.category) ?? 0) + (Number(row.total) || 0))
  }

  const order: Record<BudgetState, number> = { over: 0, near: 1, ok: 2 }

  return budgets
    .filter((b) => b.monthly_limit > 0)
    .map((b) => {
      const spent = spentBy.get(b.category) ?? 0
      return {
        category: b.category,
        limit: b.monthly_limit,
        spent,
        remaining: b.monthly_limit - spent,
        ratio: spent / b.monthly_limit,
        state: budgetState(spent, b.monthly_limit),
      }
    })
    // Primero lo urgente: pasados, luego cerca del límite, luego el resto por uso
    .sort((a, b) => order[a.state] - order[b.state] || b.ratio - a.ratio)
}

export function budgetTotals(lines: BudgetLine[]): BudgetTotals {
  const limit = lines.reduce((s, l) => s + l.limit, 0)
  const spent = lines.reduce((s, l) => s + l.spent, 0)
  return {
    limit,
    spent,
    remaining: limit - spent,
    near: lines.filter((l) => l.state === 'near').length,
    over: lines.filter((l) => l.state === 'over').length,
  }
}

/** Texto corto del estado, para lectores de pantalla y etiquetas. */
export function budgetStateLabel(state: BudgetState): string {
  if (state === 'over') return 'Límite superado'
  if (state === 'near') return 'Cerca del límite'
  return 'Dentro del límite'
}
