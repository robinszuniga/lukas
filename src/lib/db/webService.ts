import initSqlJs from 'sql.js'
import wasmUrl from 'sql.js/dist/sql-wasm.wasm?url'
import { SqlDBService } from './sqlService'
import { SqlJsConn } from './conn'
import { SCHEMA_VERSION, getSchemaVersion } from './schema'
import { loadDatabaseBytes, saveDatabaseBytes, preMigrationKey } from './idbStore'

/**
 * Arranque en el navegador: SQLite (sql.js) cargado desde IndexedDB.
 * Toda la lógica de datos está en SqlDBService.
 */
export class WebDBService extends SqlDBService {
  async init(): Promise<void> {
    const SQL = await initSqlJs({ locateFile: () => wasmUrl })
    const bytes = await loadDatabaseBytes()
    const database = bytes ? new SQL.Database(bytes) : new SQL.Database()
    const conn = new SqlJsConn(database, (data) => saveDatabaseBytes(data))
    this.conn = conn

    // Antes de migrar una base que ya tiene datos, se guarda una copia tal cual estaba.
    if (bytes) {
      const from = await getSchemaVersion(conn)
      if (from < SCHEMA_VERSION) {
        try { await saveDatabaseBytes(bytes, preMigrationKey(from)) } catch { /* la copia es una red de seguridad, no un requisito */ }
      }
    }

    await super.init()

    // Pide al navegador que no borre los datos por falta de espacio
    try { await navigator.storage?.persist?.() } catch { /* opcional */ }
  }
}
