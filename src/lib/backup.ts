import { db } from '@/lib/db'
import type { BackupData } from '@/types'
import { BackupError, parseBackupText, sanitizeBackup, type BackupSummary } from './backupFormat'
import { applyImportedPreferences, exportPreferences } from './prefs'
import { today } from './dates'

const MAX_BACKUP_BYTES = 25 * 1024 * 1024

function backupFilename(): string {
  return `lukas-respaldo-${today()}.json`
}

/**
 * Exporta todo a un archivo JSON: datos, presupuestos, recordatorios y preferencias
 * (moneda, días de pago). La API Key de Gemini NO se incluye.
 * - En el celular: abre la hoja de compartir (Drive, WhatsApp, Gmail…) si el navegador lo permite.
 * - Si no: descarga directa del archivo.
 */
export async function exportBackupFile(): Promise<void> {
  const data = await db.exportBackup()
  const full = { ...data, preferences: exportPreferences() }
  const json = JSON.stringify(full, null, 2)
  const filename = backupFilename()
  const file = new File([json], filename, { type: 'application/json' })

  const nav = navigator as Navigator & { canShare?: (d: ShareData) => boolean }
  if (nav.share && nav.canShare?.({ files: [file] })) {
    try {
      await nav.share({ files: [file], title: 'Respaldo Lukas' })
      return
    } catch (err) {
      // Si el usuario cancela la hoja de compartir, no descargamos nada
      if ((err as Error)?.name === 'AbortError') return
    }
  }

  const url = URL.createObjectURL(file)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  a.click()
  URL.revokeObjectURL(url)
}

/**
 * Lee y valida un archivo de respaldo SIN importar nada todavía.
 * Sirve para mostrar qué contiene antes de pedir confirmación.
 */
export async function readBackupFile(file: File): Promise<{ data: BackupData; summary: BackupSummary }> {
  if (file.size > MAX_BACKUP_BYTES) {
    throw new BackupError('El archivo es demasiado grande para ser un respaldo de Lukas.')
  }
  const text = await file.text()
  return sanitizeBackup(parseBackupText(text))
}

/** Reemplaza los datos actuales por los del respaldo (ya validado) y aplica sus preferencias. */
export async function applyBackup(data: BackupData): Promise<void> {
  await db.importBackup(data)
  applyImportedPreferences(data.preferences)
}

/**
 * Lee, valida e importa de una vez. Solo para la pantalla de bienvenida,
 * donde la base está vacía y no hay nada que sobrescribir.
 */
export async function importBackupFile(file: File): Promise<BackupData> {
  const { data } = await readBackupFile(file)
  await applyBackup(data)
  return data
}

export { BackupError }
export type { BackupSummary }
