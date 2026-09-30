import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { Zap, Sparkles, Key } from 'lucide-react'
import { Header } from '@/components/layout/Header'
import { QuickAdd } from '@/components/registrar/QuickAdd'
import { ChatWindow } from '@/components/chat/ChatWindow'
import { useTransactions } from '@/hooks/useTransactions'
import { formatCOP } from '@/lib/currency'
import { CATEGORY_ICONS } from '@/types'
import { db } from '@/lib/db'

type Mode = 'quick' | 'ai'
const MODE_KEY = 'lukas_registrar_mode'

export function Registrar() {
  const [mode, setMode] = useState<Mode>(() => {
    try { return (localStorage.getItem(MODE_KEY) as Mode) || 'quick' } catch { return 'quick' }
  })
  const [apiKey, setApiKey] = useState<string | null | undefined>(undefined)
  const { transactions, refresh } = useTransactions()

  useEffect(() => {
    db.getApiKey().then(setApiKey)
  }, [])

  const switchMode = (m: Mode) => {
    setMode(m)
    try { localStorage.setItem(MODE_KEY, m) } catch { /* sin storage */ }
  }

  const todayStr = new Date().toISOString().slice(0, 10)
  const todayTx = transactions.filter((t) => t.date === todayStr)
  const todaySpent = todayTx.filter((t) => t.type === 'expense').reduce((s, t) => s + t.amount, 0)

  const segment = (
    <div className="grid grid-cols-2 bg-bg-card border border-bg-border rounded-xl p-1 text-sm font-medium">
      <button
        onClick={() => switchMode('quick')}
        className={`flex items-center justify-center gap-1.5 py-2 rounded-lg transition-colors ${mode === 'quick' ? 'bg-accent-indigo text-white' : 'text-gray-500'}`}
      >
        <Zap size={14} /> Rápido
      </button>
      <button
        onClick={() => switchMode('ai')}
        className={`flex items-center justify-center gap-1.5 py-2 rounded-lg transition-colors ${mode === 'ai' ? 'bg-accent-indigo text-white' : 'text-gray-500'}`}
      >
        <Sparkles size={14} /> Con IA
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
        <div className="flex-1 min-h-0 mx-4 bg-bg-card border border-bg-border rounded-2xl overflow-hidden flex flex-col">
          {apiKey === undefined ? null : apiKey ? (
            <ChatWindow apiKey={apiKey} onTransactionSaved={refresh} />
          ) : (
            <div className="flex-1 flex flex-col items-center justify-center text-center px-6">
              <div className="w-12 h-12 bg-accent-indigo/10 rounded-2xl flex items-center justify-center mb-3">
                <Key size={20} className="text-accent-indigo" />
              </div>
              <p className="text-sm text-white font-medium mb-1">Falta la API Key de Gemini</p>
              <p className="text-xs text-gray-500 mb-4">Es gratis. Se guarda solo en tu celular.</p>
              <Link to="/ajustes" className="bg-accent-indigo text-white text-sm px-4 py-2 rounded-lg">Ir a Ajustes</Link>
            </div>
          )}
        </div>
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

      <QuickAdd onSaved={refresh} />

      {todayTx.length > 0 && (
        <section className="mt-6">
          <p className="text-[11px] text-gray-500 uppercase tracking-wide mb-2">Registrado hoy</p>
          <ul className="bg-bg-card border border-bg-border rounded-2xl divide-y divide-bg-border/60 px-4">
            {todayTx.map((tx) => (
              <li key={tx.id} className="flex items-center gap-3 py-2.5">
                <span className="text-lg w-7 text-center shrink-0">{CATEGORY_ICONS[tx.category] ?? '📦'}</span>
                <div className="flex-1 min-w-0">
                  <p className="text-sm text-gray-200 truncate">{tx.description || tx.category}</p>
                  {tx.payment_method && <p className="text-[11px] text-gray-500">{tx.payment_method}</p>}
                </div>
                <span className={`text-sm font-medium ${tx.type === 'income' ? 'text-accent-green' : 'text-gray-200'}`}>
                  {tx.type === 'income' ? '+' : '-'}{formatCOP(tx.amount)}
                </span>
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  )
}
