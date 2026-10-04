/**
 * Aviso de "los datos cambiaron". Cada vez que se escribe en la base, todas las
 * pantallas abiertas vuelven a leer: así los totales, presupuestos e historial
 * quedan coherentes después de crear, editar, eliminar o deshacer.
 */
type Listener = () => void

const listeners = new Set<Listener>()
let scheduled = false

export function onDataChange(listener: Listener): () => void {
  listeners.add(listener)
  return () => { listeners.delete(listener) }
}

export function emitDataChange(): void {
  // Varias escrituras seguidas producen un solo aviso
  if (scheduled) return
  scheduled = true
  queueMicrotask(() => {
    scheduled = false
    listeners.forEach((l) => {
      try { l() } catch { /* un oyente roto no debe frenar a los demás */ }
    })
  })
}
