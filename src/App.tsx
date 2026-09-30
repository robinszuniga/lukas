import { useEffect, useState } from 'react'
import { HashRouter, Routes, Route } from 'react-router-dom'
import { BottomNav } from '@/components/layout/BottomNav'
import { FirstRun, FIRST_RUN_KEY } from '@/components/FirstRun'
import { Hoy } from '@/pages/Hoy'
import { Registrar } from '@/pages/Registrar'
import { Pagos } from '@/pages/Pagos'
import { Tarjetas } from '@/pages/Tarjetas'
import { Historial } from '@/pages/Historial'
import { Metas } from '@/pages/Metas'
import { Ajustes } from '@/pages/Ajustes'
import { db } from '@/lib/db'

function useFirstRun() {
  const [state, setState] = useState<'checking' | 'show' | 'done'>(() => {
    try { return localStorage.getItem(FIRST_RUN_KEY) ? 'done' : 'checking' } catch { return 'done' }
  })

  useEffect(() => {
    if (state !== 'checking') return
    // Solo mostramos la bienvenida si la base está vacía
    Promise.all([db.listTransactions(), db.listCards(), db.listInstallments(), db.listRecurring()])
      .then(([tx, cards, inst, rec]) => {
        const empty = tx.length === 0 && cards.length === 0 && inst.length === 0 && rec.length === 0
        if (!empty) localStorage.setItem(FIRST_RUN_KEY, '1')
        setState(empty ? 'show' : 'done')
      })
      .catch(() => setState('done'))
  }, [state])

  return { state, finish: () => { localStorage.setItem(FIRST_RUN_KEY, '1'); setState('done') } }
}

function AppInner() {
  const firstRun = useFirstRun()

  if (firstRun.state === 'checking') return null
  if (firstRun.state === 'show') return <FirstRun onDone={firstRun.finish} />

  return (
    <div
      className="min-h-[100dvh] bg-bg-base"
      style={{ paddingTop: 'env(safe-area-inset-top, 0px)' }}
    >
      <main className="max-w-lg mx-auto pb-24">
        <Routes>
          <Route path="/" element={<Hoy />} />
          <Route path="/registrar" element={<Registrar />} />
          <Route path="/pagos" element={<Pagos />} />
          <Route path="/tarjetas" element={<Tarjetas />} />
          <Route path="/historial" element={<Historial />} />
          <Route path="/metas" element={<Metas />} />
          <Route path="/ajustes" element={<Ajustes />} />
          <Route path="*" element={<Hoy />} />
        </Routes>
      </main>
      <BottomNav />
    </div>
  )
}

export default function App() {
  return (
    <HashRouter>
      <AppInner />
    </HashRouter>
  )
}
