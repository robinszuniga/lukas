import { db } from '@/lib/db'
import { formatCOP } from '@/lib/currency'
import { currentMonth } from '@/lib/dates'

/**
 * Arma un resumen compacto de las finanzas del usuario para que la IA
 * pueda responder preguntas con datos reales. Texto plano, en español.
 * Si algo falla (tabla vacía, error), esa sección simplemente se omite.
 */
export async function buildFinancialContext(): Promise<string> {
  const lines: string[] = []
  const month = currentMonth()

  try {
    const s = await db.getTransactionSummary(month)
    lines.push(`Mes actual (${month}): ingresos ${formatCOP(s.income)}, gastos ${formatCOP(s.expenses)}, balance ${formatCOP(s.balance)}.`)
    if (s.byCategory.length > 0) {
      lines.push('Gastos por categoría este mes: ' +
        s.byCategory.map((c) => `${c.category} ${formatCOP(c.total)}`).join(', ') + '.')
    }
  } catch { /* sin datos */ }

  try {
    const accounts = await db.listAccounts()
    if (accounts.length > 0) {
      const total = accounts.reduce((t, a) => t + a.balance, 0)
      lines.push(`Saldo real en cuentas: ${accounts.map((a) => `${a.name} ${formatCOP(a.balance)}`).join(', ')} (total ${formatCOP(total)}).`)
    }
  } catch { /* sin datos */ }

  try {
    const debts = (await db.listDebts()).filter((d) => d.paid === 0)
    if (debts.length > 0) {
      const meDeben = debts.filter((d) => d.type === 'owed_to_me')
      const yoDebo = debts.filter((d) => d.type === 'i_owe')
      if (meDeben.length) lines.push('Le deben al usuario: ' + meDeben.map((d) => `${d.person} ${formatCOP(d.amount)}`).join(', ') + '.')
      if (yoDebo.length) lines.push('El usuario debe: ' + yoDebo.map((d) => `${d.person} ${formatCOP(d.amount)}`).join(', ') + '.')
    }
  } catch { /* sin datos */ }

  try {
    const installments = (await db.listInstallments()).filter((i) => i.paid_months < i.total_months)
    if (installments.length > 0) {
      lines.push('Cuotas activas: ' + installments.map((i) =>
        `${i.name} (${i.paid_months}/${i.total_months}, ${formatCOP(i.monthly_amount)}/mes)`).join(', ') + '.')
    }
  } catch { /* sin datos */ }

  try {
    const recurring = await db.listRecurring()
    if (recurring.length > 0) {
      const pending = recurring.filter((r) => r.last_posted !== month)
      lines.push(`Pagos fijos mensuales: ${recurring.map((r) => `${r.name} ${formatCOP(r.amount)} (día ${r.day})`).join(', ')}.` +
        (pending.length ? ` Pendientes este mes: ${pending.map((r) => r.name).join(', ')}.` : ''))
    }
  } catch { /* sin datos */ }

  try {
    const goals = (await db.listGoals()).filter((g) => g.saved_amount < g.target_amount)
    if (goals.length > 0) {
      lines.push('Metas de ahorro: ' + goals.map((g) =>
        `${g.name} (${formatCOP(g.saved_amount)} de ${formatCOP(g.target_amount)})`).join(', ') + '.')
    }
  } catch { /* sin datos */ }

  try {
    const cards = await db.listCards()
    if (cards.length > 0) {
      lines.push('Tarjetas de crédito: ' + cards.map((c) =>
        `${c.bank_name} (deuda ${formatCOP(c.current_balance)} de cupo ${formatCOP(c.credit_limit)})`).join(', ') + '.')
    }
  } catch { /* sin datos */ }

  return lines.join('\n')
}
