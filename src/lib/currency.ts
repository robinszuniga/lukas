/**
 * Alias históricos. Todo el formato de importes vive en ./money.
 * `formatCOP` y `parseCOP` conservan su nombre para no tocar cada pantalla,
 * pero ya respetan la moneda elegida en Ajustes.
 */
import { formatMoney, parseMoney } from './money'

export function formatCOP(amount: number): string {
  return formatMoney(amount)
}

/** Devuelve 0 cuando el texto no es un monto válido (las pantallas validan `> 0`). */
export function parseCOP(str: string): number {
  return parseMoney(str) ?? 0
}

export * from './money'
