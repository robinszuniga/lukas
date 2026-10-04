import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App'
import { db } from './lib/db'
import './index.css'

function showFatal() {
  const root = document.getElementById('root')!
  // Mensaje fijo: no se muestran detalles técnicos ni datos en pantalla
  root.innerHTML = `
    <div role="alert" style="min-height:100dvh;display:flex;align-items:center;justify-content:center;padding:24px;text-align:center;color:#e5e7eb;font-family:system-ui">
      <div>
        <p style="font-size:40px;margin:0 0 12px" aria-hidden="true">😵</p>
        <p style="margin:0 0 6px;font-weight:600">Lukas no pudo abrir tus datos</p>
        <p style="margin:0;font-size:13px;color:#9ca3af">Cierra la app y vuelve a abrirla. Si sigue igual, revisa que el navegador no esté en modo incógnito y que tenga espacio disponible.</p>
      </div>
    </div>`
}

async function bootstrap() {
  await db.init()

  ReactDOM.createRoot(document.getElementById('root')!).render(
    <React.StrictMode>
      <App />
    </React.StrictMode>
  )
}

bootstrap().catch((err) => {
  // Solo el tipo de error: nunca datos financieros ni claves
  console.error('Lukas: fallo al iniciar —', (err as Error)?.name ?? 'Error')
  showFatal()
})
