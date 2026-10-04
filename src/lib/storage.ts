/**
 * Acceso seguro a localStorage. Si no existe (pruebas en Node, modo privado estricto)
 * usa un mapa en memoria, así el resto del código no tiene que protegerse.
 */
const memory = new Map<string, string>()

function backend(): Storage | null {
  try {
    const ls = (globalThis as { localStorage?: Storage }).localStorage
    return ls ?? null
  } catch {
    return null
  }
}

export function storageGet(key: string): string | null {
  const ls = backend()
  if (ls) {
    try { return ls.getItem(key) } catch { /* cae a memoria */ }
  }
  return memory.has(key) ? memory.get(key)! : null
}

export function storageSet(key: string, value: string): void {
  const ls = backend()
  if (ls) {
    try { ls.setItem(key, value); return } catch { /* cae a memoria */ }
  }
  memory.set(key, value)
}

export function storageRemove(key: string): void {
  const ls = backend()
  if (ls) {
    try { ls.removeItem(key) } catch { /* nada */ }
  }
  memory.delete(key)
}
