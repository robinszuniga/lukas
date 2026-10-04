import { useCallback } from 'react'
import type { EntityKind } from '@/types'
import { db } from '@/lib/db'
import { useFeedback } from '@/components/ui/Feedback'

export interface DeleteRequest {
  kind: EntityKind
  id: number
  /** Pregunta del diálogo: "¿Eliminar este movimiento?" */
  title: string
  /** Datos del registro, para que se vea exactamente qué se va a eliminar */
  details: { label: string; value: string }[]
  /** Aclaración opcional (por ejemplo, qué más se elimina con él) */
  note?: string
  /** Aviso tras eliminar: "Movimiento eliminado" */
  doneMessage: string
}

/**
 * Eliminación segura: muestra qué se va a eliminar, pide confirmación y deja
 * un aviso con "Deshacer" que restaura el registro exactamente como estaba.
 */
export function useDeleteWithUndo() {
  const { confirm, toast } = useFeedback()

  return useCallback(async (req: DeleteRequest): Promise<boolean> => {
    const ok = await confirm({
      title: req.title,
      details: req.details,
      note: req.note ?? 'Podrás deshacerlo justo después de eliminar.',
      confirmLabel: 'Eliminar',
      danger: true,
    })
    if (!ok) return false

    try {
      const snapshot = await db.deleteWithSnapshot(req.kind, req.id)
      // El botón que abrió el diálogo desaparece con el registro: el foco vuelve al contenido
      document.getElementById('contenido')?.focus({ preventScroll: true })
      toast({
        message: req.doneMessage,
        actionLabel: 'Deshacer',
        onAction: async () => {
          await db.restoreSnapshot(snapshot)
          toast({ message: 'Restaurado' })
        },
      })
      return true
    } catch (err) {
      toast({ message: (err as Error)?.message ?? 'No se pudo eliminar', tone: 'error' })
      return false
    }
  }, [confirm, toast])
}
