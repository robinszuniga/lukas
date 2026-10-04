import { WebDBService } from './webService'
import { emitDataChange } from './events'
import type { DBService } from './types'

// Una sola implementación: SQLite (sql.js) en el navegador, persistida en IndexedDB.
const service = new WebDBService()

/** Métodos que escriben en la base: al terminar, avisan a las pantallas para que se refresquen. */
const WRITES = /^(create|update|delete|pay|post|undo|toggle|add|upsert|restore|set|import)/

export const db: DBService = new Proxy(service as DBService, {
  get(target, prop, receiver) {
    const value = Reflect.get(target, prop, receiver)
    if (typeof value !== 'function') return value
    if (typeof prop === 'string' && WRITES.test(prop)) {
      return async (...args: unknown[]) => {
        const result = await (value as (...a: unknown[]) => Promise<unknown>).apply(target, args)
        emitDataChange()
        return result
      }
    }
    return (value as (...a: unknown[]) => unknown).bind(target)
  },
})

export { onDataChange, emitDataChange } from './events'
export type { DBService, TransactionFilters } from './types'
