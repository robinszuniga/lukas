import { useState, useRef, useEffect, useCallback } from 'react'
import { Send, Bot, User, Sparkles, X, RefreshCw, ShieldCheck } from 'lucide-react'
import { ConfirmTransaction } from './ConfirmTransaction'
import type { ParsedTransaction } from '@/types'
import type { AIResult } from '@/lib/ai/validate'
import { buildFinancialContext } from '@/lib/ai/context'
import { looksLikeQuestion, redactSecrets, NEVER_SHARED, SHARED_ALWAYS, SHARED_ON_QUESTIONS } from '@/lib/ai/privacy'
import { getPrefs } from '@/lib/prefs'
import { formatCOP } from '@/lib/currency'
import { db } from '@/lib/db'
import { useFeedback } from '@/components/ui/Feedback'

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
  'Recibí 1.500.000 de mi sueldo',
  '¿Cuánto llevo gastado este mes?',
  '¿En qué categoría gasto más?',
]

const IS_RATE_LIMIT = (msg: string) =>
  msg.toLowerCase().includes('límite') || msg.toLowerCase().includes('quota') || msg.includes('429')

const CONTEXT_OFF_MESSAGE =
  'Para responder preguntas sobre tus finanzas necesito un resumen de tus datos, y lo tienes desactivado. Puedes activarlo en Ajustes → «Usar mis datos para responder preguntas». Mientras tanto puedo registrar ingresos y gastos.'

interface Props {
  apiKey: string
}

export function ChatWindow({ apiKey }: Props) {
  const { toast } = useFeedback()
  const [messages, setMessages] = useState<Message[]>([
    {
      id: 0,
      role: 'assistant',
      text: '¡Hola! Cuéntame tus ingresos o gastos y los dejo listos para que los confirmes. También puedes hacerme preguntas sobre tus finanzas.',
    },
  ])
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(false)
  const [savingId, setSavingId] = useState<number | null>(null)
  const [retryCountdown, setRetryCountdown] = useState<number | null>(null)
  const bottomRef = useRef<HTMLDivElement>(null)
  const idRef = useRef(1)
  const abortRef = useRef<AbortController | null>(null)
  const retryTimerRef = useRef<ReturnType<typeof setInterval> | null>(null)

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth', block: 'nearest' })
  }, [messages])

  // Limpia el timer de reintento si el componente se desmonta
  useEffect(() => () => { if (retryTimerRef.current) clearInterval(retryTimerRef.current) }, [])

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

  /** Una llamada a Gemini, con 1 reintento automático a los 6 s si hay límite de solicitudes. */
  const request = async (text: string, signal: AbortSignal, context?: string): Promise<AIResult> => {
    try {
      return await db.parseWithAI(text, apiKey, signal, context)
    } catch (err) {
      if (signal.aborted) throw err
      if (!IS_RATE_LIMIT((err as Error)?.message ?? '')) throw err
      await new Promise<void>((resolve, reject) => {
        let secs = 6
        setRetryCountdown(secs)
        const tick = setInterval(() => {
          secs--
          if (signal.aborted) { clearInterval(tick); reject(new DOMException('Aborted', 'AbortError')); return }
          if (secs <= 0) { clearInterval(tick); setRetryCountdown(null); resolve(); return }
          setRetryCountdown(secs)
        }, 1000)
        retryTimerRef.current = tick
      })
      return await db.parseWithAI(text, apiKey, signal, context)
    }
  }

  /**
   * Privacidad: el resumen financiero solo se adjunta cuando el mensaje es una pregunta
   * (o cuando Gemini lo pide porque no puede responder sin datos) y la persona lo permite.
   * Para registrar gastos solo viaja el texto escrito.
   */
  const callAI = async (text: string, signal: AbortSignal): Promise<AIResult | { action: 'context_off' }> => {
    const allowContext = getPrefs().aiShareContext
    const loadContext = () => buildFinancialContext().catch(() => '')

    if (allowContext && looksLikeQuestion(text)) {
      return request(text, signal, await loadContext())
    }

    const first = await request(text, signal)
    if (first.action !== 'needs_context') return first
    if (!allowContext) return { action: 'context_off' }
    return request(text, signal, await loadContext())
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

      if (result.action === 'context_off') {
        addMsg({ role: 'assistant', text: CONTEXT_OFF_MESSAGE })
      } else if (result.action === 'needs_context') {
        addMsg({ role: 'assistant', text: 'No encontré datos suficientes para responder eso. Intenta con una pregunta más concreta.' })
      } else if (result.action === 'answer') {
        addMsg({ role: 'assistant', text: result.text })
      } else {
        // Una tarjeta de confirmación por cada transacción detectada
        for (const parsed of result.transactions) {
          addMsg({ role: 'confirm', parsed })
        }
        if (result.transactions.length > 1) {
          addMsg({ role: 'assistant', text: `Detecté ${result.transactions.length} movimientos. Confirma cada uno.` })
        }
      }
    } catch (err) {
      if ((err as Error)?.name === 'AbortError' || controller.signal.aborted) return
      // Nunca se muestra la clave ni texto crudo del proveedor
      const errMsg = redactSecrets((err as Error)?.message ?? 'Error desconocido', apiKey)
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

  const handleSend = (e?: React.FormEvent) => {
    e?.preventDefault()
    const text = input.trim()
    if (!text) return
    setInput('')
    addMsg({ role: 'user', text })
    sendText(text)
  }

  const handleRetry = (text: string) => {
    addMsg({ role: 'user', text: `Reintentando: "${text}"` })
    sendText(text)
  }

  const handleEdit = <K extends keyof ParsedTransaction>(msgId: number, field: K, value: ParsedTransaction[K]) => {
    setMessages((prev) =>
      prev.map((m) => m.id === msgId && m.parsed ? { ...m, parsed: { ...m.parsed, [field]: value } } : m)
    )
  }

  const handleConfirm = async (msgId: number, data: ParsedTransaction) => {
    setSavingId(msgId)
    try {
      const created = await db.createTransaction(data)
      setMessages((prev) => prev.map((m) => m.id === msgId ? { ...m, saved: true } : m))
      const summary = `${data.type === 'income' ? 'Ingreso' : 'Gasto'} de ${formatCOP(data.amount)} registrado en ${data.category}.`
      addMsg({ role: 'assistant', text: `✅ ${summary}` })
      toast({
        message: summary,
        actionLabel: 'Deshacer',
        onAction: async () => {
          await db.undoCreateTransaction(created.id)
          addMsg({ role: 'assistant', text: `Deshice el registro de ${formatCOP(data.amount)}.` })
        },
      })
    } catch (err) {
      addMsg({ role: 'assistant', text: `No se pudo guardar: ${(err as Error)?.message ?? 'error desconocido'}`, error: true })
    } finally {
      setSavingId(null)
    }
  }

  const handleCancelConfirm = (msgId: number) => {
    setMessages((prev) => prev.filter((m) => m.id !== msgId))
  }

  const shareContext = getPrefs().aiShareContext

  return (
    <div className="flex flex-col h-full">
      <details className="shrink-0 border-b border-bg-border px-4 py-2 text-xs text-gray-400">
        <summary className="cursor-pointer flex items-center gap-1.5 py-1 text-gray-200">
          <ShieldCheck size={13} className="text-accent-green shrink-0" aria-hidden="true" />
          ¿Qué se envía a Google Gemini?
        </summary>
        <dl className="mt-2 space-y-2 pb-1">
          <div>
            <dt className="text-gray-200">Siempre</dt>
            <dd>{SHARED_ALWAYS}</dd>
          </div>
          <div>
            <dt className="text-gray-200">Solo cuando haces una pregunta sobre tus finanzas {shareContext ? '' : '(ahora desactivado)'}</dt>
            <dd>{SHARED_ON_QUESTIONS}</dd>
          </div>
          <div>
            <dt className="text-gray-200">Nunca</dt>
            <dd>{NEVER_SHARED}</dd>
          </div>
        </dl>
      </details>

      <div className="flex-1 overflow-y-auto px-4 py-4 space-y-3 min-h-0" role="log" aria-live="polite" aria-label="Conversación con el asistente">
        {messages.map((msg) => (
          <div key={msg.id}>
            {msg.role === 'user' && (
              <div className="flex justify-end">
                <div className="flex items-end gap-2 max-w-[85%] min-w-0">
                  <div className="bg-accent-indigo/20 border border-accent-indigo/40 text-white text-sm px-4 py-2.5 rounded-2xl rounded-br-sm break-words min-w-0">
                    <span className="sr-only">Tú: </span>{msg.text}
                  </div>
                  <User size={16} className="text-gray-450 mb-0.5 shrink-0" aria-hidden="true" />
                </div>
              </div>
            )}

            {msg.role === 'assistant' && (
              <div className="flex items-end gap-2 max-w-[85%] min-w-0">
                <Bot size={16} className="text-accent-cyan mb-0.5 shrink-0" aria-hidden="true" />
                <div className="flex flex-col gap-1.5 min-w-0">
                  <div
                    role={msg.error ? 'alert' : undefined}
                    className={`text-sm px-4 py-2.5 rounded-2xl rounded-bl-sm border break-words whitespace-pre-line min-w-0 ${
                      msg.error
                        ? 'bg-accent-red/10 border-accent-red/40 text-red-200'
                        : 'bg-bg-elevated border-bg-border text-gray-100'
                    }`}
                  >
                    <span className="sr-only">{msg.error ? 'Error: ' : 'Asistente: '}</span>{msg.text}
                  </div>
                  {/* Botón reintentar — solo en errores de límite de solicitudes */}
                  {msg.error && msg.retryText && !loading && (
                    <button
                      type="button"
                      onClick={() => handleRetry(msg.retryText!)}
                      className="self-start flex items-center gap-1.5 text-xs text-gray-200 border border-bg-field hover:border-gray-400 px-3 py-2 rounded-lg transition-colors"
                    >
                      <RefreshCw size={11} aria-hidden="true" />
                      Reintentar
                    </button>
                  )}
                </div>
              </div>
            )}

            {msg.role === 'confirm' && msg.parsed && !msg.saved && (
              <div className="max-w-full sm:max-w-[90%]">
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
          <div className="flex items-center gap-2 max-w-[85%]">
            <Bot size={16} className="text-accent-cyan shrink-0" aria-hidden="true" />
            <div className="bg-bg-elevated border border-bg-border pl-4 pr-1 py-1 rounded-2xl rounded-bl-sm flex items-center gap-2">
              {retryCountdown !== null ? (
                <span className="text-xs text-gray-400">Reintentando en {retryCountdown} s…</span>
              ) : (
                <>
                  <span className="sr-only">El asistente está pensando</span>
                  <div className="flex gap-1" aria-hidden="true">
                    <div className="w-1.5 h-1.5 bg-accent-cyan rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
                    <div className="w-1.5 h-1.5 bg-accent-cyan rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
                    <div className="w-1.5 h-1.5 bg-accent-cyan rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
                  </div>
                </>
              )}
              <button
                type="button"
                onClick={handleCancel}
                className="w-9 h-9 inline-flex items-center justify-center text-gray-400 hover:text-rose-400 transition-colors"
                aria-label="Cancelar la solicitud"
              >
                <X size={14} aria-hidden="true" />
              </button>
            </div>
          </div>
        )}
        <div ref={bottomRef} />
      </div>

      {messages.length <= 1 && (
        <div className="px-4 pb-2 shrink-0">
          <p className="text-xs text-gray-400 mb-2 flex items-center gap-1">
            <Sparkles size={10} aria-hidden="true" /> Ejemplos
          </p>
          <div className="flex flex-wrap gap-2">
            {EXAMPLES.map((ex) => (
              <button
                key={ex}
                type="button"
                onClick={() => setInput(ex)}
                className="text-xs bg-bg-elevated border border-bg-border hover:border-accent-indigo/60 text-gray-200 px-3 py-2 rounded-full transition-colors text-left"
              >
                {ex}
              </button>
            ))}
          </div>
        </div>
      )}

      <form onSubmit={handleSend} className="px-4 pb-4 pt-2 border-t border-bg-border shrink-0">
        <div className="flex gap-2">
          <label htmlFor="chat-mensaje" className="sr-only">Mensaje para el asistente</label>
          <input
            id="chat-mensaje"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="Ej: Pagué 45.000 en el bus con Nequi"
            autoComplete="off"
            className="flex-1 min-w-0 bg-bg-elevated border border-bg-field focus:border-accent-indigo rounded-xl px-4 py-2.5 text-sm text-white placeholder-gray-450 outline-none transition-colors"
            disabled={loading}
          />
          <button
            type="submit"
            disabled={!input.trim() || loading}
            aria-label="Enviar mensaje"
            className="shrink-0 w-11 inline-flex items-center justify-center bg-indigo-600 hover:bg-indigo-500 disabled:opacity-60 text-white rounded-xl transition-colors"
          >
            <Send size={16} aria-hidden="true" />
          </button>
        </div>
      </form>
    </div>
  )
}
