import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { Zap, Sparkles, Key } from 'lucide-react'
import { Header } from '@/components/layout/Header'
import { QuickAdd } from '@/components/registrar/QuickAdd'
import { ChatWindow } from '@/components/chat/ChatWindow'
import { useTransactions } from '@/hooks/useTransactions'
import { formatCOP } from '@/lib/currency'
import { today } from '@/lib/dates'
import { storageGet, storageSet } from '@/lib/storage'
import { CATEGORY_ICONS } from '@/types'
import { db } from '@/lib/db'

type Mode = 'quick' | 'ai'
const MODE_KEY = 'lukas_registrar_mode'

export function Registrar() {
  const [mode, setMode] = useState<Mode>(() => (storageGet(MODE_KEY) === 'ai' ? 'ai' : 'quick'))
  const [apiKey, setApiKey] = useState<string | null | undefined>(undefined)
  const { transactions } = useTransactions()

  useEffect(() => {
    db.getApiKey().then(setApiKey)
  }, [])

  const switchMode = (m: Mode) => {
    setMode(m)
    storageSet(MODE_KEY, m)
  }

  const todayStr = today()
  const todayTx = transactions.filter((t) => t.date === todayStr)
  const todaySpent = todayTx.filter((t) => t.type === 'expense').reduce((s, t) => s + t.amount, 0)

  const segment = (
    <div role="group" aria-label="Forma de registrar" className="grid grid-cols-2 bg-bg-card border border-bg-border rounded-xl p-1 text-sm font-medium">
      <button
        type="button"
        aria-pressed={mode === 'quick'}
        onClick={() => switchMode('quick')}
        className={`flex items-center justify-center gap-1.5 py-2 rounded-lg transition-colors ${mode === 'quick' ? 'bg-indigo-600 text-white' : 'text-gray-400'}`}
      >
        <Zap size={14} aria-hidden="true" /> Rápido
      </button>
      <button
        type="button"
        aria-pressed={mode === 'ai'}
        onClick={() => switchMode('ai')}
        className={`flex items-center justify-center gap-1.5 py-2 rounded-lg transition-colors ${mode === 'ai' ? 'bg-indigo-600 text-white' : 'text-gray-400'}`}
      >
        <Sparkles size={14} aria-hidden="true" /> Con IA
      </button>
    </div>
  )

  if (mode === 'ai') {
    return (
      <div className="flex flex-col" style={{ height: 'calc(100dvh - 6rem - env(safe-area-inset-top, 0px))' }}>
        <div className="px-4 pt-4 shrink-0">
          <Header title="Registrar" subtitle="Escribe en lenguaje natural o pregunta" showMonth={false} />
          <div className="mb-3">{segment}</div>
        </div>
        <section aria-label="Asistente con IA" className="flex-1 min-h-0 mx-4 bg-bg-card border border-bg-border rounded-2xl overflow-hidden flex flex-col">
          {apiKey === undefined ? null : apiKey ? (
            <ChatWindow apiKey={apiKey} />
          ) : (
            <div className="flex-1 flex flex-col items-center justify-center text-center px-6">
              <div className="w-12 h-12 bg-accent-indigo/10 rounded-2xl flex items-center justify-center mb-3" aria-hidden="true">
                <Key size={20} className="text-indigo-300" />
              </div>
              <h2 className="text-sm text-white font-medium mb-1">Falta la API Key de Gemini</h2>
              <p className="text-xs text-gray-400 mb-4 max-w-xs">
                El modo Con IA usa Google Gemini con tu propia clave gratuita. Se guarda solo en este dispositivo.
                Sin clave puedes seguir usando el modo Rápido.
              </p>
              <Link to="/ajustes" className="bg-indigo-600 hover:bg-indigo-500 text-white text-sm px-4 py-2.5 rounded-lg">Configurar en Ajustes</Link>
            </div>
          )}
        </section>
      </div>
    )
  }

  return (
    <div className="px-4 pt-4">
      <Header
        title="Registrar"
        subtitle={todayTx.length > 0 ? `Hoy llevas ${formatCOP(todaySpent)} en ${todayTx.length} movimiento${todayTx.length === 1 ? '' : 's'}` : 'Monto + categoría y listo'}
        showMonth={false}
      />
      <div className="mb-4">{segment}</div>

      <QuickAdd />

      {todayTx.length > 0 && (
        <section aria-labelledby="registrado-hoy" className="mt-6">
          <h2 id="registrado-hoy" className="text-[11px] text-gray-400 uppercase tracking-wide mb-2">Registrado hoy</h2>
          <ul className="bg-bg-card border border-bg-border rounded-2xl divide-y divide-bg-border px-4">
            {todayTx.map((tx) => (
              <li key={tx.id} className="flex items-center gap-3 py-2.5">
                <span className="text-lg w-7 text-center shrink-0" aria-hidden="true">{CATEGORY_ICONS[tx.category] ?? '📦'}</span>
                <div className="flex-1 min-w-0">
                  <p className="text-sm text-gray-100 truncate">{tx.description || tx.category}</p>
                  {tx.payment_method && <p className="text-[11px] text-gray-400 truncate">{tx.payment_method}</p>}
                </div>
                <span className={`text-sm font-medium shrink-0 ${tx.type === 'income' ? 'text-accent-green' : 'text-gray-100'}`}>
                  <span className="sr-only">{tx.type === 'income' ? 'Ingreso de ' : 'Gasto de '}</span>
                  <span aria-hidden="true">{tx.type === 'income' ? '+' : '−'}</span>{formatCOP(tx.amount)}
                </span>
              </li>
            ))}
          </ul>
          <p className="text-[11px] text-gray-400 mt-2">
            Para corregir o eliminar un movimiento, ve al <Link to="/historial" className="text-accent-cyan underline">Historial</Link>.
          </p>
        </section>
      )}
    </div>
  )
}
