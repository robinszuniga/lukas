export function currentMonth(): string {
  return new Date().toISOString().slice(0, 7)
}

export function today(): string {
  return new Date().toISOString().split('T')[0]
}

export function daysUntil(dateStr: string): number {
  const target = new Date(dateStr)
  const now = new Date()
  now.setHours(0, 0, 0, 0)
  return Math.ceil((target.getTime() - now.getTime()) / (1000 * 60 * 60 * 24))
}

export function daysUntilBilling(billingDay: number): number {
  const now = new Date()
  const year = now.getFullYear()
  const month = now.getMonth()
  let target = new Date(year, month, billingDay)
  if (target <= now) target = new Date(year, month + 1, billingDay)
  return Math.ceil((target.getTime() - now.getTime()) / (1000 * 60 * 60 * 24))
}

export function formatDate(dateStr: string): string {
  return new Date(dateStr + 'T00:00:00').toLocaleDateString('es-CO', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  })
}

export function monthLabel(monthStr: string): string {
  const [year, month] = monthStr.split('-').map(Number)
  return new Date(year, month - 1, 1).toLocaleDateString('es-CO', {
    month: 'long',
    year: 'numeric',
  })
}
