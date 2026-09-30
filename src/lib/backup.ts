import { db } from '@/lib/db'
import type { BackupData } from '@/types'

function backupFilename(): string {
  const stamp = new Date().toISOString().slice(0, 10)
  return `lukas-respaldo-${stamp}.json`
}

/**
 * Exporta todo a un archivo JSON.
 * - En el celular: abre la hoja de compartir (Drive, WhatsApp, Gmail…) si el navegador lo permite.
 * - Si no: descarga directa del archivo.
 */
export async function exportBackupFile(): Promise<void> {
  const data = await db.exportBackup()
  const json = JSON.stringify(data, null, 2)
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
 * Importa un archivo de respaldo. REEMPLAZA todos los datos actuales.
 * Acepta respaldos del Lukas viejo (app: 'flux-finance') y de este.
 */
export async function importBackupFile(file: File): Promise<BackupData> {
  const text = await file.text()
  let data: BackupData
  try {
    data = JSON.parse(text)
  } catch {
    throw new Error('El archivo no es un JSON válido')
  }
  if (!['lukas', 'flux-finance'].includes(data?.app) || !Array.isArray(data.transactions)) {
    throw new Error('El archivo no es un respaldo de Lukas')
  }
  await db.importBackup(data)
  return data
}
