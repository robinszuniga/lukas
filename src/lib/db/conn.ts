import type { Database } from 'sql.js'

/** Forma mínima de conexión que usa toda la lógica SQL (misma que Capacitor SQLite). */
export interface SqlConn {
  query(sql: string, params?: unknown[]): Promise<{ values: Record<string, unknown>[] }>
  run(sql: string, params?: unknown[]): Promise<{ changes?: { lastId?: number } }>
  execute(sql: string): Promise<void>
  /** Agrupa varias escrituras en una transacción: o se aplican todas o ninguna. */
  batch<T>(fn: () => Promise<T>): Promise<T>
}

/**
 * Adaptador sql.js → SqlConn. Después de cada escritura entrega la base completa
 * a `persist` (en el navegador: IndexedDB; en pruebas: nada).
 */
export class SqlJsConn implements SqlConn {
  private batching = false

  constructor(
    private sql: Database,
    private persistBytes: (bytes: Uint8Array) => Promise<void> = async () => {},
  ) {}

  async query(sqlText: string, params: unknown[] = []) {
    const stmt = this.sql.prepare(sqlText)
    try {
      stmt.bind(params as never[])
      const values: Record<string, unknown>[] = []
      while (stmt.step()) values.push(stmt.getAsObject() as Record<string, unknown>)
      return { values }
    } finally {
      stmt.free()
    }
  }

  async run(sqlText: string, params: unknown[] = []) {
    this.sql.run(sqlText, params as never[])
    const r = this.sql.exec('SELECT last_insert_rowid() AS id')
    const lastId = Number(r[0]?.values?.[0]?.[0] ?? 0)
    if (!this.batching) await this.persist()
    return { changes: { lastId } }
  }

  async execute(sqlText: string) {
    this.sql.exec(sqlText)
    if (!this.batching) await this.persist()
  }

  async batch<T>(fn: () => Promise<T>): Promise<T> {
    // Un lote dentro de otro simplemente se une al de afuera
    if (this.batching) return fn()

    this.batching = true
    this.sql.exec('BEGIN')
    try {
      const out = await fn()
      this.sql.exec('COMMIT')
      return out
    } catch (err) {
      try { this.sql.exec('ROLLBACK') } catch { /* la transacción ya se cerró */ }
      throw err
    } finally {
      this.batching = false
      await this.persist()
    }
  }

  async persist() {
    await this.persistBytes(this.sql.export())
  }
}
