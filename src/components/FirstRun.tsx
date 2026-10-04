import { useRef, useState } from 'react'
import { Upload, Sparkles } from 'lucide-react'
import { importBackupFile } from '@/lib/backup'
import { describeCounts, sanitizeBackup } from '@/lib/backupFormat'
import { storageSet } from '@/lib/storage'

export const FIRST_RUN_KEY = 'lukas_first_run_done'

interface Props {
  onDone: () => void
}

/** Pantalla de bienvenida: importar el respaldo del Lukas anterior o empezar de cero. */
export function FirstRun({ onDone }: Props) {
  const fileRef = useRef<HTMLInputElement>(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [done, setDone] = useState<string | null>(null)

  const handleFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    e.target.value = ''
    if (!file) return
    setBusy(true)
    setError(null)
    try {
      // Aquí la base está vacía: no hay nada que sobrescribir, por eso no se pide confirmación.
      const data = await importBackupFile(file)
      storageSet(FIRST_RUN_KEY, '1')
      setDone(`Listo. Se importaron ${describeCounts(sanitizeBackup(data).summary.counts)}.`)
      setTimeout(() => window.location.reload(), 1200)
    } catch (err) {
      setError((err as Error)?.message ?? 'No se pudo importar el archivo')
      setBusy(false)
    }
  }

  return (
    <main
      className="min-h-[100dvh] bg-bg-base flex flex-col items-center justify-center px-6 text-center"
      style={{ paddingTop: 'env(safe-area-inset-top, 0px)', paddingBottom: 'env(safe-area-inset-bottom, 0px)' }}
    >
      <div className="w-20 h-20 rounded-3xl bg-gradient-to-br from-accent-green to-accent-yellow flex items-center justify-center text-4xl shadow-lg shadow-accent-green/20 mb-6" aria-hidden="true">
        💸
      </div>
      <h1 className="text-2xl font-bold text-white mb-1">Lukas</h1>
      <p className="text-sm text-gray-400 mb-10 max-w-xs">
        Tus finanzas del día a día, sin enredos.
      </p>

      <div className="w-full max-w-sm space-y-3">
        <button
          type="button"
          onClick={() => fileRef.current?.click()}
          disabled={busy}
          className="w-full flex items-center justify-center gap-2 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-60 text-white font-medium py-3.5 rounded-2xl transition-colors"
        >
          <Upload size={18} aria-hidden="true" />
          {busy ? 'Importando…' : 'Importar respaldo de Lukas'}
        </button>
        <input
          ref={fileRef}
          type="file"
          accept=".json,application/json"
          className="hidden"
          onChange={handleFile}
          aria-label="Archivo de respaldo de Lukas"
          tabIndex={-1}
        />

        <button
          type="button"
          onClick={onDone}
          disabled={busy}
          className="w-full flex items-center justify-center gap-2 bg-bg-card border border-bg-field hover:border-gray-400 text-gray-200 font-medium py-3.5 rounded-2xl transition-colors disabled:opacity-60"
        >
          <Sparkles size={18} aria-hidden="true" />
          Empezar de cero
        </button>

        {error && <p role="alert" className="text-xs text-rose-400 pt-2">{error}</p>}
        {done && <p role="status" className="text-xs text-accent-green pt-2">{done}</p>}
      </div>

      <p className="text-xs text-gray-400 mt-10 max-w-xs leading-relaxed">
        En el Lukas anterior: Ajustes → Respaldo de datos → Exportar. Guarda el archivo y ábrelo aquí.
      </p>
    </main>
  )
}
