import { useState, useRef, useEffect, useCallback } from 'react'
import { Send, Bot, User, Sparkles, X, RefreshCw } from 'lucide-react'
import { ConfirmTransaction } from './ConfirmTransaction'
import type { ParsedTransaction } from '@/types'
import type { AIResult } from '@/lib/ai/validate'
import { buildFinancialContext } from '@/lib/ai/context'
import { formatCOP } from '@/lib/currency'
import { db } from '@/lib/db'

interface Message {
  id: number
  role: 'user' | 'assistant' | 'confirm'
  text?: string
  parsed?: ParsedTransaction
  saved?: boolean
  error?: boolean
  retryText?: string   // texto original para poder reintentar
}

const EXAMPLES = [
  'Hoy: 12k bus, 25k almuerzo y 8k café',
  'Recibí 1.050.000 de mi sueldo',
  '¿Cuánto llevo gastado este mes?',
  '¿En qué categoría gasto más?',
]

const IS_RATE_LIMIT = (msg: string) =>
  msg.toLowerCase().includes('límite') || msg.toLowerCase().includes('quota') || msg.includes('429')

interface Props {
  apiKey: string
  onTransactionSaved: () => void
}

export function ChatWindow({ apiKey, onTransactionSaved }: Props) {
  const [messages, setMessages] = useState<Message[]>([
    {
      id: 0,
      role: 'assistant',
      text: '¡Hola! Cuéntame sobre tus ingresos o gastos y yo los registro automáticamente. Puedes escribir en lenguaje natural.',
    },
  ])
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(false)
  const [savingId, setSavingId] = useState<number | null>(null)
  const [retryCountdown, setRetryCountdown] = useState<number | null>(null)
  const bottomRef = useRef<HTMLDivElement>(null)
  const idRef = useRef(1)
  const abortRef = useRef<AbortController | null>(null)
  const retryTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  // Limpia el timer de reintento si el componente se desmonta
  useEffect(() => () => { if (retryTimerRef.current) clearTimeout(retryTimerRef.current) }, [])

  const addMsg = (msg: Omit<Message, 'id'>) => {
    const id = idRef.current++
    setMessages((prev) => [...prev, { ...msg, id }])
    return id
  }

  const handleCancel = useCallback(() => {
    abortRef.current?.abort()
    abortRef.current = null
    setLoading(false)
    setRetryCountdown(null)
  }, [])

  const callAI = async (text: string, signal: AbortSignal): Promise<AIResult> => {
    // Contexto financiero para que la IA pueda responder preguntas con datos reales
    const context = await buildFinancialContext().catch(() => '')

    // 1 reintento automático después de 6s si hay rate limit
    try {
      return await db.parseWithAI(text, apiKey, signal, context)
    } catch (err: any) {
      if (signal.aborted) throw err
      if (IS_RATE_LIMIT(err.message ?? '')) {
        // Mostrar cuenta regresiva en el indicador de carga
        await new Promise<void>((resolve, reject) => {
          let secs = 6
          setRetryCountdown(secs)
          const tick = setInterval(() => {
            secs--
            if (signal.aborted) { clearInterval(tick); reject(new DOMException('Aborted', 'AbortError')); return }
            if (secs <= 0) { clearInterval(tick); setRetryCountdown(null); resolve(); return }
            setRetryCountdown(secs)
          }, 1000)
          retryTimerRef.current = tick as any
        })
        return await db.parseWithAI(text, apiKey, signal, context)
      }
      throw err
    }
  }

  const sendText = async (text: string) => {
    if (!text.trim() || loading) return
    setLoading(true)
    setRetryCountdown(null)

    const controller = new AbortController()
    abortRef.current = controller

    try {
      const result = await callAI(text, controller.signal)
      if (controller.signal.aborted) return

      if (result.action === 'answer') {
        // La IA respondió una pregunta sobre los datos
        addMsg({ role: 'assistant', text: result.text })
      } else {
        // Una tarjeta de confirmación por cada transacción detectada
        for (const parsed of result.transactions) {
          addMsg({ role: 'confirm', parsed })
        }
        if (result.transactions.length > 1) {
          addMsg({ role: 'assistant', text: `Detecté ${result.transactions.length} transacciones — confirma cada una.` })
        }
      }
    } catch (err: any) {
      if (err?.name === 'AbortError' || controller.signal.aborted) return
      const errMsg = err.message ?? 'Error desconocido'
      addMsg({
        role: 'assistant',
        text: errMsg,
        error: true,
        retryText: IS_RATE_LIMIT(errMsg) ? text : undefined,
      })
    } finally {
      abortRef.current = null
      setLoading(false)
      setRetryCountdown(null)
    }
  }

  const handleSend = () => {
    const text = input.trim()
    if (!text) return
    setInput('')
    addMsg({ role: 'user', text })
    sendText(text)
  }

  const handleRetry = (text: string) => {
    addMsg({ role: 'user', text: `🔄 Reintentando: "${text}"` })
    sendText(text)
  }

  const handleEdit = (msgId: number, field: keyof ParsedTransaction, value: any) => {
    setMessages((prev) =>
      prev.map((m) => m.id === msgId && m.parsed ? { ...m, parsed: { ...m.parsed, [field]: value } } : m)
    )
  }

  const handleConfirm = async (msgId: number, data: ParsedTransaction) => {
    setSavingId(msgId)
    try {
      await db.createTransaction(data)
      setMessages((prev) => prev.map((m) => m.id === msgId ? { ...m, saved: true } : m))
      addMsg({
        role: 'assistant',
        text: `✅ ${data.type === 'income' ? 'Ingreso' : 'Gasto'} de ${formatCOP(data.amount)} registrado en ${data.category}.`,
      })
      onTransactionSaved()
    } catch (err: any) {
      addMsg({ role: 'assistant', text: `Error al guardar: ${err.message}`, error: true })
    } finally {
      setSavingId(null)
    }
  }

  const handleCancelConfirm = (msgId: number) => {
    setMessages((prev) => prev.filter((m) => m.id !== msgId))
  }

  return (
    <div className="flex flex-col h-full">
      <div className="flex-1 overflow-y-auto px-4 py-4 space-y-3 min-h-0">
        {messages.map((msg) => (
          <div key={msg.id}>
            {msg.role === 'user' && (
              <div className="flex justify-end">
                <div className="flex items-end gap-2 max-w-[82%] min-w-0">
                  <div className="bg-accent-indigo/20 border border-accent-indigo/30 text-white text-sm px-4 py-2.5 rounded-2xl rounded-br-sm break-words min-w-0">
                    {msg.text}
                  </div>
                  <User size={16} className="text-gray-600 mb-0.5 shrink-0" />
                </div>
              </div>
            )}

            {msg.role === 'assistant' && (
              <div className="flex items-end gap-2 max-w-[82%] min-w-0">
                <Bot size={16} className="text-accent-cyan mb-0.5 shrink-0" />
                <div className="flex flex-col gap-1.5 min-w-0">
                  <div className={`text-sm px-4 py-2.5 rounded-2xl rounded-bl-sm border break-words min-w-0 ${
                    msg.error
                      ? 'bg-accent-red/10 border-accent-red/30 text-accent-red'
                      : 'bg-bg-card border-bg-border text-gray-200'
                  }`}>
                    {msg.text}
                  </div>
                  {/* Botón reintentar — solo en errores de rate limit */}
                  {msg.error && msg.retryText && !loading && (
                    <button
                      onClick={() => handleRetry(msg.retryText!)}
                      className="self-start flex items-center gap-1.5 text-xs text-gray-500 hover:text-white border border-bg-border hover:border-gray-600 px-3 py-1.5 rounded-lg transition-colors"
                    >
                      <RefreshCw size={11} />
                      Reintentar
                    </button>
                  )}
                </div>
              </div>
            )}

            {msg.role === 'confirm' && msg.parsed && !msg.saved && (
              <div className="max-w-[90%]">
                <ConfirmTransaction
                  data={msg.parsed}
                  onConfirm={() => handleConfirm(msg.id, msg.parsed!)}
                  onEdit={(field, value) => handleEdit(msg.id, field, value)}
                  onCancel={() => handleCancelConfirm(msg.id)}
                  loading={savingId === msg.id}
                />
              </div>
            )}
          </div>
        ))}

        {loading && (
          <div className="flex items-center gap-2 max-w-[82%]">
            <Bot size={16} className="text-accent-cyan shrink-0" />
            <div className="bg-bg-card border border-bg-border px-4 py-2.5 rounded-2xl rounded-bl-sm flex items-center gap-3">
              {retryCountdown !== null ? (
                // Mostrando cuenta regresiva de reintento
                <span className="text-xs text-gray-500">
                  Reintentando en {retryCountdown}s…
                </span>
              ) : (
                // Puntos animados normales
                <div className="flex gap-1">
                  <div className="w-1.5 h-1.5 bg-accent-cyan rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
                  <div className="w-1.5 h-1.5 bg-accent-cyan rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
                  <div className="w-1.5 h-1.5 bg-accent-cyan rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
                </div>
              )}
              <button
                onClick={handleCancel}
                className="text-gray-600 hover:text-accent-red transition-colors"
                title="Cancelar"
              >
                <X size={12} />
              </button>
            </div>
          </div>
        )}
        <div ref={bottomRef} />
      </div>

      {messages.length <= 1 && (
        <div className="px-4 pb-2">
          <p className="text-xs text-gray-600 mb-2 flex items-center gap-1">
            <Sparkles size={10} /> Ejemplos
          </p>
          <div className="flex flex-wrap gap-2">
            {EXAMPLES.map((ex) => (
              <button
                key={ex}
                onClick={() => setInput(ex)}
                className="text-xs bg-bg-card border border-bg-border hover:border-accent-indigo/50 text-gray-400 hover:text-white px-3 py-1.5 rounded-full transition-colors"
              >
                {ex}
              </button>
            ))}
          </div>
        </div>
      )}

      <div className="px-4 pb-4 pt-2 border-t border-bg-border">
        <div className="flex gap-2">
          <input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && !e.shiftKey && handleSend()}
            placeholder="Ej: Pagué 45.000 en el bus con Bancolombia..."
            className="flex-1 bg-bg-card border border-bg-border focus:border-accent-indigo/50 rounded-xl px-4 py-2.5 text-sm text-white placeholder-gray-600 outline-none transition-colors"
            disabled={loading}
          />
          <button
            onClick={handleSend}
            disabled={!input.trim() || loading}
            className="bg-accent-indigo hover:bg-accent-indigo/80 disabled:opacity-40 text-white px-4 py-2.5 rounded-xl transition-colors"
          >
            <Send size={16} />
          </button>
        </div>
      </div>
    </div>
  )
}
