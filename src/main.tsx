import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App'
import { db } from './lib/db'
import './index.css'

function showFatal(message: string) {
  const root = document.getElementById('root')!
  root.innerHTML = `
    <div style="min-height:100dvh;display:flex;align-items:center;justify-content:center;padding:24px;text-align:center;color:#e5e7eb;font-family:system-ui">
      <div>
        <p style="font-size:40px;margin:0 0 12px">😵</p>
        <p style="margin:0 0 6px;font-weight:600">Lukas no pudo abrir tus datos</p>
        <p style="margin:0;font-size:13px;color:#9ca3af">${message}</p>
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
  console.error(err)
  showFatal(String((err as Error)?.message ?? err))
})
