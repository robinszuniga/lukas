import { useEffect, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { ArrowLeft, Key, Save, Trash2, Download, Upload, CalendarClock, DatabaseBackup, ExternalLink, Info } from 'lucide-react'
import { Header } from '@/components/layout/Header'
import { db } from '@/lib/db'
import { exportBackupFile, importBackupFile } from '@/lib/backup'
import { getPaydays, setPaydays } from '@/lib/paydays'

const APP_VERSION = '2.0.0'

export function Ajustes() {
  const [savedKey, setSavedKey] = useState<string | null>(null)
  const [keyInput, setKeyInput] = useState('')
  const [savingKey, setSavingKey] = useState(false)

  const initial = getPaydays()
  const [payday1, setPayday1] = useState(String(initial[0] ?? 15))
  const [payday2, setPayday2] = useState(initial[1] ? String(initial[1]) : '30')

  const [busy, setBusy] = useState(false)
  const [msg, setMsg] = useState<{ type: 'ok' | 'error'; text: string } | null>(null)
  const fileRef = useRef<HTMLInputElement>(null)

  useEffect(() => { db.getApiKey().then(setSavedKey) }, [])

  const handleSaveKey = async () => {
    if (!keyInput.trim()) return
    setSavingKey(true)
    await db.saveApiKey(keyInput.trim())
    setSavedKey(keyInput.trim())
    setKeyInput('')
    setSavingKey(false)
  }

  const handleRemoveKey = async () => {
    if (!window.confirm('¿Quitar la API Key? El modo "Con IA" dejará de funcionar hasta que pongas otra.')) return
    await db.saveApiKey('')
    setSavedKey(null)
  }

  const savePaydays = (d1: string, d2: string) => {
    setPaydays([parseInt(d1), parseInt(d2)].filter((n) => !Number.isNaN(n)))
  }

  const handleExport = async () => {
    setBusy(true)
    setMsg(null)
    try {
      await exportBackupFile()
      setMsg({ type: 'ok', text: '✓ Respaldo exportado' })
    } catch (e: any) {
      setMsg({ type: 'error', text: `Error al exportar: ${e.message}` })
    } finally {
      setBusy(false)
    }
  }

  const handleImport = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    e.target.value = ''
    if (!file) return
    const ok = window.confirm('⚠️ Importar un respaldo REEMPLAZA todos los datos actuales.\n\n¿Continuar?')
    if (!ok) return
    setBusy(true)
    setMsg(null)
    try {
      const data = await importBackupFile(file)
      setMsg({ type: 'ok', text: `✓ Respaldo importado (${data.transactions.length} movimientos). Recargando…` })
      setTimeout(() => window.location.reload(), 1200)
    } catch (err: any) {
      setMsg({ type: 'error', text: `Error al importar: ${err.message}` })
      setBusy(false)
    }
  }

  const inputClass = 'w-full bg-bg-elevated border border-bg-border rounded-lg px-3 py-2.5 text-sm text-white placeholder-gray-600 outline-none focus:border-accent-indigo/50 transition-colors'
  const card = 'bg-bg-card border border-bg-border rounded-2xl p-4'

  return (
    <div className="px-4 pt-4 space-y-4">
      <Header
        title="Ajustes"
        subtitle="Configuración de la app"
        showMonth={false}
        right={
          <Link to="/" className="p-2 rounded-lg text-gray-400 hover:text-white" title="Volver">
            <ArrowLeft size={20} />
          </Link>
        }
      />

      {/* ─── API Key ─── */}
      <section className={card}>
        <h2 className="text-sm font-medium text-white flex items-center gap-2 mb-1"><Key size={14} className="text-accent-indigo" /> API Key de Gemini</h2>
        <p className="text-xs text-gray-500 mb-3">Solo para el modo "Con IA". Se guarda únicamente en este celular.</p>
        {savedKey ? (
          <div className="flex items-center justify-between bg-accent-green/10 border border-accent-green/30 rounded-lg px-3 py-2 mb-3">
            <span className="text-xs text-accent-green">✓ API Key configurada</span>
            <button onClick={handleRemoveKey} className="text-gray-500 hover:text-accent-red" title="Quitar"><Trash2 size={14} /></button>
          </div>
        ) : (
          <a
            href="https://aistudio.google.com/app/apikey"
            target="_blank"
            rel="noreferrer"
            className="inline-flex items-center gap-1 text-xs text-accent-cyan mb-3"
          >
            Obtener una gratis en Google AI Studio <ExternalLink size={10} />
          </a>
        )}
        <div className="flex gap-2">
          <input
            type="password"
            value={keyInput}
            onChange={(e) => setKeyInput(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleSaveKey()}
            placeholder={savedKey ? 'Nueva API Key (reemplaza la actual)' : 'AIzaSy…'}
            className={inputClass}
          />
          <button
            onClick={handleSaveKey}
            disabled={savingKey || !keyInput.trim()}
            className="shrink-0 bg-accent-indigo disabled:opacity-40 text-white px-3 rounded-lg"
          >
            <Save size={16} />
          </button>
        </div>
      </section>

      {/* ─── Días de pago ─── */}
      <section className={card}>
        <h2 className="text-sm font-medium text-white flex items-center gap-2 mb-1"><CalendarClock size={14} className="text-accent-indigo" /> Días de pago</h2>
        <p className="text-xs text-gray-500 mb-3">La pantalla Hoy te dice cuánto te queda hasta el siguiente.</p>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="text-xs text-gray-500 block mb-1">Primer pago (día)</label>
            <input
              type="number" min={1} max={31} value={payday1}
              onChange={(e) => { setPayday1(e.target.value); savePaydays(e.target.value, payday2) }}
              className={inputClass}
            />
          </div>
          <div>
            <label className="text-xs text-gray-500 block mb-1">Segundo pago (día)</label>
            <input
              type="number" min={1} max={31} value={payday2}
              onChange={(e) => { setPayday2(e.target.value); savePaydays(payday1, e.target.value) }}
              className={inputClass}
            />
          </div>
        </div>
      </section>

      {/* ─── Respaldo ─── */}
      <section className={card}>
        <h2 className="text-sm font-medium text-white flex items-center gap-2 mb-1"><DatabaseBackup size={14} className="text-accent-indigo" /> Respaldo de datos</h2>
        <p className="text-xs text-gray-500 mb-3">
          Exporta un archivo con todo y guárdalo en Drive o donde quieras. Sirve para pasar los datos entre el Lukas anterior y este.
        </p>
        <div className="grid grid-cols-2 gap-2">
          <button
            onClick={handleExport}
            disabled={busy}
            className="flex items-center justify-center gap-2 bg-accent-indigo disabled:opacity-40 text-white text-sm py-2.5 rounded-xl"
          >
            <Download size={15} /> Exportar
          </button>
          <button
            onClick={() => fileRef.current?.click()}
            disabled={busy}
            className="flex items-center justify-center gap-2 bg-bg-elevated border border-bg-border disabled:opacity-40 text-gray-200 text-sm py-2.5 rounded-xl"
          >
            <Upload size={15} /> Importar
          </button>
          <input ref={fileRef} type="file" accept=".json,application/json" className="hidden" onChange={handleImport} />
        </div>
        <p className="text-[11px] text-accent-yellow mt-2">⚠️ Importar reemplaza todos los datos actuales</p>
        {msg && (
          <p className={`text-xs mt-2 ${msg.type === 'ok' ? 'text-accent-green' : 'text-accent-red'}`}>{msg.text}</p>
        )}
      </section>

      {/* ─── Acerca de ─── */}
      <section className={card}>
        <h2 className="text-sm font-medium text-white flex items-center gap-2 mb-1"><Info size={14} className="text-accent-indigo" /> Acerca de Lukas</h2>
        <p className="text-xs text-gray-500">Versión {APP_VERSION}. Tus datos viven solo en este celular. Exporta un respaldo de vez en cuando.</p>
      </section>
    </div>
  )
}
