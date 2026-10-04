import { storageGet, storageSet } from './storage'
import { CURRENCY_KEY, DEFAULT_CURRENCY, getCurrencyCode, isCurrencyCode } from './money'

/**
 * Preferencias del dispositivo. Se guardan en localStorage (lectura inmediata)
 * y viajan dentro del respaldo en el bloque `preferences`.
 * La API Key de Gemini y el permiso de notificaciones NO se incluyen en el respaldo.
 */

export const PAYDAYS_KEY = 'lukas_paydays'
export const REMINDERS_ON_KEY = 'lukas_reminders_on'
export const REMINDER_DAYS_KEY = 'lukas_reminder_days'
export const NOTIFICATIONS_ON_KEY = 'lukas_notifications_on'
export const AI_CONTEXT_KEY = 'lukas_ai_share_context'

export const DEFAULT_REMINDER_DAYS = 3
export const REMINDER_DAY_OPTIONS = [0, 1, 2, 3, 5, 7] as const

export interface Preferences {
  currency: string
  paydays: number[]
  /** Recordatorios dentro de la app */
  remindersEnabled: boolean
  /** Con cuántos días de anticipación avisar (valor general) */
  reminderDays: number
  /** Permite enviar el resumen financiero a Gemini para responder preguntas */
  aiShareContext: boolean
}

type Listener = () => void
const listeners = new Set<Listener>()
let version = 0

export function subscribePrefs(listener: Listener): () => void {
  listeners.add(listener)
  return () => { listeners.delete(listener) }
}

export function prefsVersion(): number {
  return version
}

function changed(): void {
  version++
  listeners.forEach((l) => l())
}

function parsePaydays(raw: string | null): number[] {
  return (raw ?? '15,30')
    .split(',')
    .map((s) => parseInt(s.trim(), 10))
    .filter((n) => Number.isInteger(n) && n >= 1 && n <= 31)
}

function parseBool(raw: string | null, fallback: boolean): boolean {
  if (raw === '1') return true
  if (raw === '0') return false
  return fallback
}

export function getPrefs(): Preferences {
  const days = parseInt(storageGet(REMINDER_DAYS_KEY) ?? '', 10)
  return {
    currency: getCurrencyCode(),
    paydays: parsePaydays(storageGet(PAYDAYS_KEY)),
    remindersEnabled: parseBool(storageGet(REMINDERS_ON_KEY), true),
    reminderDays: Number.isInteger(days) && days >= 0 && days <= 30 ? days : DEFAULT_REMINDER_DAYS,
    aiShareContext: parseBool(storageGet(AI_CONTEXT_KEY), true),
  }
}

export function setPrefs(patch: Partial<Preferences>): void {
  if (patch.currency !== undefined && isCurrencyCode(patch.currency)) {
    storageSet(CURRENCY_KEY, patch.currency)
  }
  if (patch.paydays !== undefined) {
    const clean = patch.paydays.filter((n) => Number.isInteger(n) && n >= 1 && n <= 31)
    storageSet(PAYDAYS_KEY, clean.join(','))
  }
  if (patch.remindersEnabled !== undefined) storageSet(REMINDERS_ON_KEY, patch.remindersEnabled ? '1' : '0')
  if (patch.reminderDays !== undefined && Number.isInteger(patch.reminderDays) && patch.reminderDays >= 0 && patch.reminderDays <= 30) {
    storageSet(REMINDER_DAYS_KEY, String(patch.reminderDays))
  }
  if (patch.aiShareContext !== undefined) storageSet(AI_CONTEXT_KEY, patch.aiShareContext ? '1' : '0')
  changed()
}

/** Notificaciones del sistema: preferencia propia de este dispositivo (no va al respaldo). */
export function getNotificationsOn(): boolean {
  return parseBool(storageGet(NOTIFICATIONS_ON_KEY), false)
}

export function setNotificationsOn(on: boolean): void {
  storageSet(NOTIFICATIONS_ON_KEY, on ? '1' : '0')
  changed()
}

/** Bloque `preferences` que se escribe en el respaldo. */
export function exportPreferences(): Preferences {
  return getPrefs()
}

/**
 * Aplica las preferencias que traiga un respaldo. Ignora lo que no reconozca
 * y nunca falla: un respaldo viejo sin este bloque deja todo como está.
 */
export function applyImportedPreferences(raw: unknown): void {
  if (!raw || typeof raw !== 'object') return
  const p = raw as Record<string, unknown>
  const patch: Partial<Preferences> = {}
  if (isCurrencyCode(p.currency)) patch.currency = p.currency
  if (Array.isArray(p.paydays)) {
    const days = p.paydays.filter((n): n is number => typeof n === 'number' && Number.isInteger(n) && n >= 1 && n <= 31)
    if (days.length > 0) patch.paydays = days
  }
  if (typeof p.remindersEnabled === 'boolean') patch.remindersEnabled = p.remindersEnabled
  if (typeof p.reminderDays === 'number') patch.reminderDays = p.reminderDays
  if (typeof p.aiShareContext === 'boolean') patch.aiShareContext = p.aiShareContext
  if (Object.keys(patch).length > 0) setPrefs(patch)
}

export { DEFAULT_CURRENCY }
