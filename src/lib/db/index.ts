import { WebDBService } from './webService'
import type { DBService } from './types'

// Una sola implementación: SQLite (sql.js) en el navegador, persistida en IndexedDB.
export const db: DBService = new WebDBService()

export type { DBService, TransactionFilters } from './types'
