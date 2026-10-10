import { useEffect, useState } from 'react'
import { HashRouter, Routes, Route, useLocation } from 'react-router-dom'
import { BottomNav } from '@/components/layout/BottomNav'
import { FirstRun, FIRST_RUN_KEY } from '@/components/FirstRun'
import { FeedbackProvider } from '@/components/ui/Feedback'
import { Hoy } from '@/pages/Hoy'
import { Registrar } from '@/pages/Registrar'
import { Pagos } from '@/pages/Pagos'
import { Tarjetas } from '@/pages/Tarjetas'
import { Historial } from '@/pages/Historial'
import { Metas } from '@/pages/Metas'
import { Presupuestos } from '@/pages/Presupuestos'
import { Ajustes } from '@/pages/Ajustes'
import { db } from '@/lib/db'
import { storageGet, storageSet } from '@/lib/storage'
import { notifyDueReminders } from '@/lib/notifications'
import { usePrefs } from '@/hooks/usePrefs'
import { useReminders } from '@/hooks/useReminders'

const TITLES: Record<string, string> = {
  '/': 'Hoy',
  '/registrar': 'Registrar',
  '/pagos': 'Pagos',
  '/tarjetas': 'Tarjetas',
  '/historial': 'Historial',
  '/metas': 'Metas',
  '/presupuestos': 'Presupuestos',
  '/ajustes': 'Ajustes',
}

function useFirstRun() {
  const [state, setState] = useState<'checking' | 'show' | 'done'>(() =>
    storageGet(FIRST_RUN_KEY) ? 'done' : 'checking'
  )

  useEffect(() => {
    if (state !== 'checking') return
    // Solo mostramos la bienvenida si la base está vacía
    Promise.all([db.listTransactions(), db.listCards(), db.listInstallments(), db.listRecurring()])
      .then(([tx, cards, inst, rec]) => {
        const empty = tx.length === 0 && cards.length === 0 && inst.length === 0 && rec.length === 0
        if (!empty) storageSet(FIRST_RUN_KEY, '1')
        setState(empty ? 'show' : 'done')
      })
      .catch(() => setState('done'))
  }, [state])

  return { state, finish: () => { storageSet(FIRST_RUN_KEY, '1'); setState('done') } }
}

/**
 * Notificaciones del sistema: solo si la persona las activó en Ajustes y dio permiso.
 * Se revisan al abrir la app y cada vez que vuelve a primer plano.
 */
function ReminderNotifier() {
  const { notificationsOn } = usePrefs()
  const { active } = useReminders()

  useEffect(() => {
    if (!notificationsOn) return
    const check = () => { if (document.visibilityState === 'visible') void notifyDueReminders(active) }
    check()
    document.addEventListener('visibilitychange', check)
    return () => document.removeEventListener('visibilitychange', check)
  }, [notificationsOn, active])

  return null
}

function AppInner() {
  const firstRun = useFirstRun()
  const location = useLocation()
  // Al cambiar moneda u otra preferencia, toda la app se vuelve a dibujar con el formato nuevo
  usePrefs()

  useEffect(() => {
    const name = TITLES[location.pathname] ?? 'Hoy'
    document.title = `${name} · Lukas`
    window.scrollTo(0, 0)
  }, [location.pathname])

  if (firstRun.state === 'checking') return null
  if (firstRun.state === 'show') return <FirstRun onDone={firstRun.finish} />

  return (
    <div
      className="min-h-[100dvh] bg-bg-base"
      style={{ paddingTop: 'env(safe-area-inset-top, 0px)' }}
    >
      <a
        href="#contenido"
        onClick={(e) => { e.preventDefault(); document.getElementById('contenido')?.focus() }}
        className="sr-only focus:not-sr-only focus:fixed focus:top-2 focus:left-2 focus:z-[80] focus:bg-accent-indigo focus:text-white focus:px-3 focus:py-2 focus:rounded-lg"
      >
        Saltar al contenido
      </a>
      {/* Al final queda espacio para la barra de abajo y, si hay un aviso, también para él */}
      <main
        id="contenido"
        tabIndex={-1}
        className="max-w-lg lg:max-w-2xl mx-auto outline-none"
        style={{ paddingBottom: 'calc(6rem + var(--toast-space, 0px))' }}
      >
        <Routes>
          <Route path="/" element={<Hoy />} />
          <Route path="/registrar" element={<Registrar />} />
          <Route path="/pagos" element={<Pagos />} />
          <Route path="/tarjetas" element={<Tarjetas />} />
          <Route path="/historial" element={<Historial />} />
          <Route path="/metas" element={<Metas />} />
          <Route path="/presupuestos" element={<Presupuestos />} />
          <Route path="/ajustes" element={<Ajustes />} />
          <Route path="*" element={<Hoy />} />
        </Routes>
      </main>
      <BottomNav />
      <ReminderNotifier />
    </div>
  )
}

export default function App() {
  return (
    <HashRouter>
      <FeedbackProvider>
        <AppInner />
      </FeedbackProvider>
    </HashRouter>
  )
}
