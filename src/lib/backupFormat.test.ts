import { describe, expect, it } from 'vitest'
import { BackupError, describeCounts, parseBackupText, sanitizeBackup } from './backupFormat'
import { extractJSON, friendlyAIError, validateAIResponse, validateParsed } from './ai/validate'
import { looksLikeQuestion, redactSecrets } from './ai/privacy'
import { buildAIPrompt } from './ai/prompt'
import { applyImportedPreferences, getPrefs, setPrefs } from './prefs'

/** Respaldo tal como lo exporta el Lukas anterior: sin secciones nuevas. */
function oldBackup() {
  return {
    version: 1,
    app: 'flux-finance',
    exported_at: '2026-09-30T12:00:00.000Z',
    transactions: [
      { id: 1, amount: 2500000, type: 'income', category: 'Otro', description: 'Sueldo', payment_method: 'Bancolombia', date: '2026-09-15', created_at: '2026-09-15 10:00:00' },
      { id: 2, amount: 654321, type: 'expense', category: 'Alimentación', description: 'mercado', payment_method: null, date: '2026-09-27', created_at: '2026-09-27 10:00:00' },
    ],
    installments: [
      { id: 1, name: 'Préstamo', total_amount: 6000000, total_months: 60, paid_months: 3, monthly_amount: 100000, next_due_date: '2026-11-11', notes: null, created_at: '2026-06-01 10:00:00' },
    ],
    installment_payments: [{ id: 1, installment_id: 1, paid_date: '2026-09-11', amount: 100000 }],
    goals: [{ id: 1, name: 'Viaje', target_amount: 10000000, saved_amount: 1500000, deadline: null, emoji: '📈', created_at: '2026-05-01 10:00:00' }],
    credit_cards: [{ id: 1, bank_name: 'Bancolombia', last_four: '1234', credit_limit: 5000000, current_balance: 800000, billing_day: 23, cutoff_day: null, color: '#ef4444' }],
    budgets: [{ id: 1, category: 'Alimentación', monthly_limit: 900000 }],
    debts: [{ id: 1, person: 'Ana', amount: 1000000, type: 'i_owe', description: null, due_date: '2026-10-05', paid: 0, created_at: '2026-09-01 10:00:00' }],
    accounts: [{ id: 1, name: 'Mercado', balance: 1400000, color: '#6366f1', created_at: '2026-09-01 10:00:00' }],
    recurring: [{ id: 1, name: 'Servicios', amount: 440000, category: 'Servicios', payment_method: null, day: 20, last_posted: null, created_at: '2026-09-01 10:00:00' }],
  }
}

describe('respaldos', () => {
  it('acepta un respaldo del Lukas anterior y rellena las secciones nuevas vacías', () => {
    const { data, summary } = sanitizeBackup(oldBackup())
    expect(summary.counts.transactions).toBe(2)
    expect(summary.counts.budgets).toBe(1)
    expect(summary.counts.payment_log).toBe(0)
    expect(summary.counts.reminders).toBe(0)
    expect(summary.hasPreferences).toBe(false)
    expect(summary.fromNewerVersion).toBe(false)
    expect(data.transactions[1].amount).toBe(654321)
    expect(data.payment_log).toEqual([])
    expect(describeCounts(summary.counts)).toContain('2 movimientos')
  })

  it('acepta respaldos sin cuentas ni pagos fijos (los más viejos)', () => {
    const b: Record<string, unknown> = oldBackup()
    delete b.accounts
    delete b.recurring
    const { summary } = sanitizeBackup(b)
    expect(summary.counts.accounts).toBe(0)
    expect(summary.counts.recurring).toBe(0)
  })

  it('conserva preferencias y secciones nuevas cuando vienen', () => {
    const b = {
      ...oldBackup(),
      schema_version: 2,
      preferences: { currency: 'COP', paydays: [15, 30] },
      reminders: [{ id: 1, kind: 'debt', item_id: 1, enabled: true, days_before: 5, snoozed_until: null }],
      payment_log: [{ id: 1, kind: 'recurring', item_id: 1, period: '2026-09', transaction_id: 2, installment_payment_id: null, prev_value: null, amount: 440000, paid_at: '2026-09-20' }],
    }
    const { data, summary } = sanitizeBackup(b)
    expect(summary.hasPreferences).toBe(true)
    expect(summary.counts.reminders).toBe(1)
    // los booleanos se guardan como 1/0
    expect(data.reminders?.[0].enabled).toBe(1)
  })

  it('ignora columnas desconocidas y lo informa', () => {
    const b = oldBackup()
    ;(b.transactions[0] as Record<string, unknown>).columna_rara = 'x'
    const { data, summary } = sanitizeBackup(b)
    expect(summary.ignoredColumns).toEqual(['transactions.columna_rara'])
    expect(data.transactions[0]).not.toHaveProperty('columna_rara')
  })

  it.each([
    ['no es un objeto', 'hola'],
    ['es una lista', [1, 2]],
    ['otra app', { app: 'otra', transactions: [] }],
    ['sin movimientos', { app: 'lukas' }],
  ])('rechaza con mensaje claro cuando %s', (_n, raw) => {
    expect(() => sanitizeBackup(raw)).toThrow(BackupError)
    expect(() => sanitizeBackup(raw)).toThrow('no es un respaldo de Lukas')
  })

  it('rechaza un formato más nuevo pidiendo actualizar', () => {
    expect(() => sanitizeBackup({ ...oldBackup(), version: 2 })).toThrow('formato más nuevo')
  })

  it('rechaza el archivo completo si un registro está dañado', () => {
    const bad = oldBackup()
    ;(bad.transactions[1] as Record<string, unknown>).amount = 'mucho'
    expect(() => sanitizeBackup(bad)).toThrow('movimientos (registro 2)')

    const badSection = { ...oldBackup(), debts: 'no soy una lista' }
    expect(() => sanitizeBackup(badSection)).toThrow('deudas')

    const badNested = oldBackup()
    ;(badNested.goals[0] as Record<string, unknown>).name = { x: 1 }
    expect(() => sanitizeBackup(badNested)).toThrow('No se importó nada')
  })

  it('explica cuando el archivo no es JSON', () => {
    expect(() => parseBackupText('esto no es json')).toThrow(BackupError)
  })

  it('aplica las preferencias del respaldo y nunca lee una API Key', () => {
    setPrefs({ currency: 'COP', paydays: [15, 30], reminderDays: 3 })
    applyImportedPreferences({ currency: 'USD', paydays: [1, 16], reminderDays: 5, apiKey: 'AIzaNoDeberiaUsarse', currency_rara: 1 })
    expect(getPrefs()).toMatchObject({ currency: 'USD', paydays: [1, 16], reminderDays: 5 })
    // valores inválidos se ignoran
    applyImportedPreferences({ currency: 'XXX', paydays: [99] })
    expect(getPrefs()).toMatchObject({ currency: 'USD', paydays: [1, 16] })
    applyImportedPreferences(undefined)
    setPrefs({ currency: 'COP', paydays: [15, 30], reminderDays: 3 })
  })
})

describe('modo Con IA: privacidad y validación', () => {
  it('distingue preguntas de registros', () => {
    expect(looksLikeQuestion('¿Cuánto llevo gastado este mes?')).toBe(true)
    expect(looksLikeQuestion('cuanto gaste en comida')).toBe(true)
    expect(looksLikeQuestion('tengo 300k, a qué abono')).toBe(true)
    expect(looksLikeQuestion('me conviene pagar la tarjeta')).toBe(true)
    expect(looksLikeQuestion('hoy: 12k bus, 25k almuerzo y 8k café')).toBe(false)
    expect(looksLikeQuestion('Recibí 1.050.000 de mi sueldo')).toBe(false)
    expect(looksLikeQuestion('pagué 45000 en el bus con Bancolombia')).toBe(false)
  })

  it('el prompt sin contexto no lleva datos financieros y pide el contexto solo si hace falta', () => {
    const sin = buildAIPrompt('2026-10-04')
    expect(sin).toContain('needs_context')
    expect(sin).not.toContain('CONTEXTO FINANCIERO DEL USUARIO')
    const con = buildAIPrompt('2026-10-04', 'Mes actual: ingresos $ 15.000.000')
    expect(con).toContain('CONTEXTO FINANCIERO DEL USUARIO')
    expect(con).toContain('ingresos $ 15.000.000')
  })

  it('oculta la API Key en cualquier mensaje', () => {
    const key = 'AIzaSyD-ejemplo_de_clave_1234567890abcd'
    expect(redactSecrets(`fallo con ${key}`, key)).not.toContain(key)
    expect(redactSecrets('GET https://x/v1?key=AIzaSyOtraClaveDistinta12345&alt=json')).not.toMatch(/AIza/)
    expect(redactSecrets('x-goog-api-key: secreto123')).not.toContain('secreto123')
  })

  it('los errores mostrados nunca incluyen la clave ni texto crudo del proveedor', () => {
    const key = 'AIzaSyD-ejemplo_de_clave_1234567890abcd'
    const raw = new Error(`[GoogleGenerativeAI Error]: fetch failed ${key} {"saldo": 1234567}`)
    const shown = friendlyAIError(raw, key)
    expect(shown).not.toContain(key)
    expect(shown).not.toContain('1234567')
    expect(friendlyAIError(new Error('[403] API key not valid'), key)).toContain('API Key inválida')
    expect(friendlyAIError(new Error('algo totalmente inesperado con datos 123'), key)).toBe('Error al contactar Gemini — intenta de nuevo en unos segundos.')
  })

  it('valida montos y acciones de la respuesta', () => {
    expect(validateParsed({ amount: 45000, type: 'expense', category: 'transporte', date: '2026-10-01' }))
      .toMatchObject({ amount: 45000, type: 'expense', category: 'Transporte', date: '2026-10-01' })
    expect(validateParsed({ amount: '$ 45.000', type: 'gasto', category: 'inventada' }))
      .toMatchObject({ amount: 45000, category: 'Otro' })
    expect(() => validateParsed({ amount: 'cuarenta', type: 'expense' })).toThrow('monto')
    expect(() => validateParsed({ amount: -5, type: 'expense' })).toThrow('monto')
    expect(() => validateParsed({ amount: 100, type: 'regalo' })).toThrow()

    expect(validateAIResponse({ action: 'needs_context' })).toEqual({ action: 'needs_context' })
    expect(validateAIResponse(extractJSON('```json\n{"action":"answer","text":"Hola"}\n```'))).toEqual({ action: 'answer', text: 'Hola' })
    expect(() => validateAIResponse({ action: 'register', transactions: [] })).toThrow()
  })
})
