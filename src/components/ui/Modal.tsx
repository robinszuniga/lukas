import { useEffect, useId, useRef, type ReactNode } from 'react'
import { X } from 'lucide-react'
import { iconButton } from './styles'

const FOCUSABLE =
  'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), summary, [tabindex]:not([tabindex="-1"])'

/**
 * Comportamiento de diálogo accesible: lleva el foco adentro al abrir, lo mantiene
 * adentro con Tab, cierra con Escape y devuelve el foco a donde estaba al cerrar.
 */
export function useDialog(onClose: () => void) {
  const ref = useRef<HTMLDivElement>(null)
  const titleId = useId()
  const closeRef = useRef(onClose)
  closeRef.current = onClose

  useEffect(() => {
    const node = ref.current
    const previous = document.activeElement as HTMLElement | null

    const focusables = () =>
      node ? Array.from(node.querySelectorAll<HTMLElement>(FOCUSABLE)).filter((el) => el.offsetParent !== null) : []

    // Foco inicial: lo marcado con data-autofocus o, si no, el diálogo mismo
    // (así el lector de pantalla anuncia el título y en el celular no salta el teclado).
    const preferred = node?.querySelector<HTMLElement>('[data-autofocus]')
    ;(preferred ?? node)?.focus()

    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.stopPropagation()
        closeRef.current()
        return
      }
      if (e.key !== 'Tab') return
      const items = focusables()
      if (items.length === 0) { e.preventDefault(); return }
      const first = items[0]
      const last = items[items.length - 1]
      const active = document.activeElement
      if (e.shiftKey && (active === first || active === node)) { e.preventDefault(); last.focus() }
      else if (!e.shiftKey && active === last) { e.preventDefault(); first.focus() }
    }

    document.addEventListener('keydown', onKey, true)
    return () => {
      document.removeEventListener('keydown', onKey, true)
      if (previous && document.contains(previous)) previous.focus()
    }
  }, [])

  return { ref, titleId }
}

interface Props {
  title: string
  onClose: () => void
  children: ReactNode
  /** Botones de acción, fijos abajo */
  footer?: ReactNode
  /** 'alertdialog' para confirmaciones que interrumpen */
  role?: 'dialog' | 'alertdialog'
  describedBy?: string
}

/** Hoja inferior en celular, ventana centrada en pantallas grandes. */
export function Modal({ title, onClose, children, footer, role = 'dialog', describedBy }: Props) {
  const { ref, titleId } = useDialog(onClose)

  return (
    <div
      className="fixed inset-0 z-[60] flex items-end sm:items-center justify-center bg-black/60 backdrop-blur-sm"
      onMouseDown={(e) => { if (e.target === e.currentTarget) onClose() }}
    >
      <div
        ref={ref}
        role={role}
        aria-modal="true"
        aria-labelledby={titleId}
        aria-describedby={describedBy}
        tabIndex={-1}
        className="bg-bg-card border border-bg-border rounded-t-2xl sm:rounded-2xl w-full sm:max-w-md max-h-[85dvh] flex flex-col shadow-2xl"
      >
        <div className="flex items-center justify-between gap-3 pl-5 pr-3 py-3 border-b border-bg-border shrink-0">
          <h2 id={titleId} className="font-semibold text-white text-sm">{title}</h2>
          <button type="button" onClick={onClose} aria-label="Cerrar" className={iconButton}>
            <X size={18} aria-hidden="true" />
          </button>
        </div>

        <div className="overflow-y-auto flex-1 px-5 py-4">{children}</div>

        {footer && (
          <div
            className="px-5 pt-3 border-t border-bg-border shrink-0 flex gap-2"
            style={{ paddingBottom: 'max(1.25rem, env(safe-area-inset-bottom, 0px))' }}
          >
            {footer}
          </div>
        )}
      </div>
    </div>
  )
}
