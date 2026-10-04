import { useCallback } from 'react'
import type { Debt, Installment, Recurring } from '@/types'
import { db } from '@/lib/db'
import { formatMoney } from '@/lib/money'
import { useFeedback } from '@/components/ui/Feedback'

/**
 * Marcar como pagado y deshacer, igual desde Hoy y desde Pagos.
 * Cada acción deja un aviso con "Deshacer" que la revierte por completo.
 */
export function usePaymentActions() {
  const { toast } = useFeedback()

  const fail = useCallback(
    (err: unknown) => toast({ message: (err as Error)?.message ?? 'No se pudo completar la acción', tone: 'error' }),
    [toast],
  )

  const payInstallment = useCallback(async (inst: Pick<Installment, 'id' | 'name'>) => {
    try {
      await db.payInstallment(inst.id)
      toast({
        message: `Cuota de ${inst.name} marcada como pagada`,
        actionLabel: 'Deshacer',
        onAction: async () => { await db.undoPayInstallment(inst.id) },
      })
    } catch (err) { fail(err) }
  }, [toast, fail])

  const undoInstallment = useCallback(async (inst: Pick<Installment, 'id' | 'name'>) => {
    try {
      await db.undoPayInstallment(inst.id)
      toast({ message: `Se deshizo el último pago de ${inst.name}` })
    } catch (err) { fail(err) }
  }, [toast, fail])

  const postRecurring = useCallback(async (item: Pick<Recurring, 'id' | 'name' | 'amount'>) => {
    try {
      await db.postRecurring(item.id)
      toast({
        message: `${item.name} pagado: se registró un gasto de ${formatMoney(item.amount)}`,
        actionLabel: 'Deshacer',
        onAction: async () => { await db.undoPostRecurring(item.id) },
      })
    } catch (err) { fail(err) }
  }, [toast, fail])

  const undoRecurring = useCallback(async (item: Pick<Recurring, 'id' | 'name'>) => {
    try {
      await db.undoPostRecurring(item.id)
      toast({ message: `${item.name} volvió a quedar pendiente y se quitó su gasto` })
    } catch (err) { fail(err) }
  }, [toast, fail])

  const toggleDebt = useCallback(async (debt: Pick<Debt, 'id' | 'person' | 'paid'>) => {
    try {
      await db.toggleDebtPaid(debt.id)
      toast({
        message: debt.paid === 1
          ? `La deuda de ${debt.person} volvió a quedar pendiente`
          : `Deuda de ${debt.person} marcada como saldada`,
        actionLabel: 'Deshacer',
        onAction: async () => { await db.toggleDebtPaid(debt.id) },
      })
    } catch (err) { fail(err) }
  }, [toast, fail])

  return { payInstallment, undoInstallment, postRecurring, undoRecurring, toggleDebt }
}
