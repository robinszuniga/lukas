import { useRef, useState } from 'react'
import { Upload, Sparkles } from 'lucide-react'
import { importBackupFile } from '@/lib/backup'

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
      const data = await importBackupFile(file)
      localStorage.setItem(FIRST_RUN_KEY, '1')
      setDone(`✓ Listo: ${data.transactions.length} movimientos, ${data.credit_cards.length} tarjetas y ${data.installments.length} cuotas.`)
      setTimeout(() => window.location.reload(), 900)
    } catch (err: any) {
      setError(err?.message ?? 'No se pudo importar')
      setBusy(false)
    }
  }

  return (
    <div
      className="min-h-[100dvh] bg-bg-base flex flex-col items-center justify-center px-6 text-center"
      style={{ paddingTop: 'env(safe-area-inset-top, 0px)', paddingBottom: 'env(safe-area-inset-bottom, 0px)' }}
    >
      <div className="w-20 h-20 rounded-3xl bg-gradient-to-br from-accent-green to-accent-yellow flex items-center justify-center text-4xl shadow-lg shadow-accent-green/20 mb-6">
        💸
      </div>
      <h1 className="text-2xl font-bold text-white mb-1">Lukas</h1>
      <p className="text-sm text-gray-500 mb-10 max-w-xs">
        Tus finanzas del día a día, sin enredos.
      </p>

      <div className="w-full max-w-sm space-y-3">
        <button
          onClick={() => fileRef.current?.click()}
          disabled={busy}
          className="w-full flex items-center justify-center gap-2 bg-accent-indigo hover:bg-accent-indigo/80 disabled:opacity-50 text-white font-medium py-3.5 rounded-2xl transition-colors"
        >
          <Upload size={18} />
          {busy ? 'Importando…' : 'Importar respaldo de Lukas'}
        </button>
        <input ref={fileRef} type="file" accept=".json,application/json" className="hidden" onChange={handleFile} />

        <button
          onClick={onDone}
          disabled={busy}
          className="w-full flex items-center justify-center gap-2 bg-bg-card border border-bg-border hover:border-gray-600 text-gray-300 font-medium py-3.5 rounded-2xl transition-colors"
        >
          <Sparkles size={18} />
          Empezar de cero
        </button>

        {error && <p className="text-xs text-accent-red pt-2">{error}</p>}
        {done && <p className="text-xs text-accent-green pt-2">{done}</p>}
      </div>

      <p className="text-[11px] text-gray-600 mt-10 max-w-xs leading-relaxed">
        En el Lukas anterior: Ajustes → Respaldo de datos → Exportar. Guarda el archivo y ábrelo aquí.
      </p>
    </div>
  )
}
