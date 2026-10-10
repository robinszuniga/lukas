import type { Account, BalanceMove, BalanceTarget, CreditCard, TransactionType } from '@/types'
import { formatMoney } from './money'

/**
 * Método de pago ↔ cuentas y tarjetas. Función pura: no toca la base.
 *
 * Un movimiento mueve el saldo de la cuenta o tarjeta que se llama igual que su
 * método de pago. La comparación ignora mayúsculas, tildes y espacios de más
 * («SOBRE ALIMENTACIÓN» = «sobre alimentacion»).
 */

/** Nombre comparable: sin tildes, en minúsculas y con un solo espacio entre palabras. */
export function normalizeName(name: string | null | undefined): string {
  return (name ?? '')
    .normalize('NFD')
    .replace(/\p{M}/gu, '')
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .trim()
}

export interface PaymentTarget {
  target: BalanceTarget
  id: number
  name: string
}

/**
 * Cuenta y tarjeta que corresponden a un método de pago: como mucho una de cada
 * (la primera creada si hay nombres repetidos). Sin coincidencia devuelve [].
 */
export function matchPaymentTargets(
  method: string | null | undefined,
  accounts: Pick<Account, 'id' | 'name'>[],
  cards: Pick<CreditCard, 'id' | 'bank_name'>[],
): PaymentTarget[] {
  const norm = normalizeName(method)
  if (!norm) return []
  const byId = <T extends { id: number }>(a: T, b: T) => a.id - b.id
  const account = [...accounts].sort(byId).find((a) => normalizeName(a.name) === norm)
  const card = [...cards].sort(byId).find((c) => normalizeName(c.bank_name) === norm)
  const out: PaymentTarget[] = []
  if (account) out.push({ target: 'account', id: account.id, name: account.name })
  if (card) out.push({ target: 'card', id: card.id, name: card.bank_name })
  return out
}

/** Cuánto cambia el saldo: un gasto baja el saldo de una cuenta y sube la deuda de una tarjeta. */
export function balanceDelta(target: BalanceTarget, type: TransactionType, amount: number): number {
  const sign = type === 'expense' ? -1 : 1
  return target === 'account' ? sign * amount : -sign * amount
}

/** «Descontar $50.000 de Sobre», «Sumar $80.000 a la deuda de Nu»… */
export function describeMove(move: Pick<BalanceMove, 'target' | 'name' | 'delta'>): string {
  const amount = formatMoney(Math.abs(move.delta))
  if (move.target === 'account') {
    return move.delta < 0 ? `Descontar ${amount} de ${move.name}` : `Devolver ${amount} a ${move.name}`
  }
  return move.delta > 0
    ? `Sumar ${amount} a la deuda de ${move.name}`
    : `Restar ${amount} de la deuda de ${move.name}`
}
