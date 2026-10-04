import { createContext, useCallback, useContext, useEffect, useId, useMemo, useRef, useState, type ReactNode } from 'react'
import { AlertTriangle, Check, Undo2, X } from 'lucide-react'
import { Modal } from './Modal'
import { dangerButton, primaryButton, secondaryButton } from './styles'

export interface ConfirmOptions {
  title: string
  /** Texto principal: qué va a pasar */
  message?: ReactNode
  /** Datos del registro afectado, para que la persona vea exactamente qué es */
  details?: { label: string; value: string }[]
  /** Aclaración secundaria */
  note?: ReactNode
  confirmLabel?: string
  cancelLabel?: string
  danger?: boolean
}

export interface ToastOptions {
  message: string
  /** Texto del botón de acción (por ejemplo "Deshacer") */
  actionLabel?: string
  onAction?: () => void | Promise<void>
  tone?: 'ok' | 'error'
  /** Milisegundos visible. Con acción dura más para dar tiempo de usarla. */
  duration?: number
}

interface FeedbackApi {
  confirm: (options: ConfirmOptions) => Promise<boolean>
  toast: (options: ToastOptions) => void
}

const FeedbackContext = createContext<FeedbackApi | null>(null)

export function useFeedback(): FeedbackApi {
  const ctx = useContext(FeedbackContext)
  if (!ctx) throw new Error('useFeedback debe usarse dentro de <FeedbackProvider>')
  return ctx
}

interface ToastState extends ToastOptions {
  key: number
}

export function FeedbackProvider({ children }: { children: ReactNode }) {
  const [confirmState, setConfirmState] = useState<(ConfirmOptions & { resolve: (ok: boolean) => void }) | null>(null)
  const [toastState, setToastState] = useState<ToastState | null>(null)
  const [busy, setBusy] = useState(false)
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const counter = useRef(0)
  /** Aviso que está en pantalla ahora mismo */
  const current = useRef<{ key: number; duration: number } | null>(null)

  const clearTimer = () => { if (timer.current) { clearTimeout(timer.current); timer.current = null } }

  const startTimer = useCallback((key: number, duration: number) => {
    clearTimer()
    timer.current = setTimeout(() => {
      if (current.current?.key === key) current.current = null
      setToastState((t) => (t?.key === key ? null : t))
    }, duration)
  }, [])

  const confirm = useCallback((options: ConfirmOptions) => {
    return new Promise<boolean>((resolve) => setConfirmState({ ...options, resolve }))
  }, [])

  const toast = useCallback((options: ToastOptions) => {
    const key = ++counter.current
    // Con acción (Deshacer) dura más, para dar tiempo de leer y decidir
    const duration = options.duration ?? (options.actionLabel ? 12000 : 4000)
    current.current = { key, duration }
    setToastState({ ...options, key })
    startTimer(key, duration)
  }, [startTimer])

  useEffect(() => clearTimer, [])

  const dismiss = () => {
    clearTimer()
    current.current = null
    setToastState(null)
  }

  // Mientras el puntero o el foco están sobre el aviso, no desaparece
  const pause = () => clearTimer()
  const resume = () => {
    if (current.current) startTimer(current.current.key, Math.min(current.current.duration, 5000))
  }

  const closeConfirm = (ok: boolean) => {
    confirmState?.resolve(ok)
    setConfirmState(null)
  }

  const runAction = async () => {
    if (!toastState?.onAction || busy) return
    const key = toastState.key
    setBusy(true)
    try {
      await toastState.onAction()
      // Si la acción mostró su propio aviso ("Restaurado"), ese se queda
      if (current.current?.key === key) dismiss()
    } catch (err) {
      toast({ message: (err as Error)?.message || 'No se pudo deshacer', tone: 'error' })
    } finally {
      setBusy(false)
    }
  }

  const api = useMemo(() => ({ confirm, toast }), [confirm, toast])
  const isError = toastState?.tone === 'error'

  return (
    <FeedbackContext.Provider value={api}>
      {children}

      {confirmState && <ConfirmDialog options={confirmState} onClose={closeConfirm} />}

      {/* Región viva: los lectores de pantalla anuncian cada aviso al aparecer */}
      <div
        className="fixed left-0 right-0 z-[70] px-4 pointer-events-none"
        style={{ bottom: 'calc(5rem + env(safe-area-inset-bottom, 0px))' }}
        role={isError ? 'alert' : 'status'}
        aria-live={isError ? 'assertive' : 'polite'}
      >
        {toastState && (
          <div
            key={toastState.key}
            onMouseEnter={pause}
            onMouseLeave={resume}
            onFocus={pause}
            onBlur={resume}
            className={`pointer-events-auto max-w-lg mx-auto flex items-center gap-2 rounded-xl shadow-lg pl-4 pr-1.5 py-1.5 text-sm font-medium border ${
              isError
                ? 'bg-bg-elevated border-accent-red/60 text-white'
                : 'bg-bg-elevated border-accent-green/60 text-white'
            }`}
          >
            {isError
              ? <AlertTriangle size={16} className="text-rose-400 shrink-0" aria-hidden="true" />
              : <Check size={16} className="text-accent-green shrink-0" aria-hidden="true" />}
            <span className="flex-1 min-w-0 py-1.5">{toastState.message}</span>
            {toastState.actionLabel && toastState.onAction && (
              <button
                type="button"
                onClick={runAction}
                disabled={busy}
                className="shrink-0 inline-flex items-center gap-1.5 text-accent-cyan font-semibold px-3 py-2 rounded-lg hover:bg-bg-card disabled:opacity-60"
              >
                <Undo2 size={14} aria-hidden="true" />
                {toastState.actionLabel}
              </button>
            )}
            <button
              type="button"
              onClick={dismiss}
              aria-label="Cerrar aviso"
              className="shrink-0 w-9 h-9 inline-flex items-center justify-center rounded-lg text-gray-400 hover:text-white"
            >
              <X size={16} aria-hidden="true" />
            </button>
          </div>
        )}
      </div>
    </FeedbackContext.Provider>
  )
}

function ConfirmDialog({ options, onClose }: { options: ConfirmOptions; onClose: (ok: boolean) => void }) {
  const descId = useId()
  return (
    <Modal
      title={options.title}
      role="alertdialog"
      describedBy={descId}
      onClose={() => onClose(false)}
      footer={
        <>
          <button type="button" data-autofocus onClick={() => onClose(false)} className={secondaryButton}>
            {options.cancelLabel ?? 'Cancelar'}
          </button>
          <button type="button" onClick={() => onClose(true)} className={options.danger ? dangerButton : primaryButton}>
            {options.confirmLabel ?? 'Confirmar'}
          </button>
        </>
      }
    >
      <div id={descId} className="space-y-3">
        {options.message && <p className="text-sm text-gray-200">{options.message}</p>}
        {options.details && options.details.length > 0 && (
          <dl className="bg-bg-elevated border border-bg-border rounded-xl px-4 py-3 space-y-1.5">
            {options.details.map((d) => (
              <div key={d.label} className="flex items-baseline justify-between gap-3 text-sm">
                <dt className="text-gray-400 shrink-0">{d.label}</dt>
                <dd className="text-white text-right min-w-0 break-words">{d.value}</dd>
              </div>
            ))}
          </dl>
        )}
        {options.note && <p className="text-xs text-gray-400">{options.note}</p>}
      </div>
    </Modal>
  )
}
