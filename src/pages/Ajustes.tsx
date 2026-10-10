import { useEffect, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import {
  ArrowLeft, Key, Save, Trash2, Download, Upload, CalendarClock, DatabaseBackup, ExternalLink, Info,
  Coins, Bell, ShieldCheck, PiggyBank, ChevronRight,
} from 'lucide-react'
import { Header } from '@/components/layout/Header'
import { Field } from '@/components/ui/Field'
import { Switch } from '@/components/ui/Switch'
import { useFeedback } from '@/components/ui/Feedback'
import { iconButton, inputClass } from '@/components/ui/styles'
import { daysBeforeLabel } from '@/components/reminders/ReminderDialog'
import { usePrefs } from '@/hooks/usePrefs'
import { db } from '@/lib/db'
import { applyBackup, exportBackupFile, readBackupFile } from '@/lib/backup'
import { describeCounts } from '@/lib/backupFormat'
import { CURRENCIES, currencyInfo, formatMoney } from '@/lib/money'
import { REMINDER_DAY_OPTIONS, setNotificationsOn, setPrefs } from '@/lib/prefs'
import { notificationStatus, requestNotificationPermission } from '@/lib/notifications'
import { NEVER_SHARED, SHARED_ALWAYS, SHARED_ON_QUESTIONS } from '@/lib/ai/privacy'
import { formatDate } from '@/lib/dates'

const APP_VERSION = '2.3.1'

const card = 'bg-bg-card border border-bg-border rounded-2xl p-4'
const sectionTitle = 'text-sm font-medium text-white flex items-center gap-2 mb-1'

export function Ajustes() {
  const prefs = usePrefs()
  const { confirm, toast } = useFeedback()

  const [savedKey, setSavedKey] = useState<string | null>(null)
  const [keyInput, setKeyInput] = useState('')
  const [savingKey, setSavingKey] = useState(false)

  const [payday1, setPayday1] = useState(String(prefs.paydays[0] ?? 15))
  const [payday2, setPayday2] = useState(prefs.paydays[1] ? String(prefs.paydays[1]) : '')
  const [paydayError, setPaydayError] = useState<string | null>(null)

  const [busy, setBusy] = useState(false)
  const [backupError, setBackupError] = useState<string | null>(null)
  const [notifMessage, setNotifMessage] = useState<string | null>(null)
  const fileRef = useRef<HTMLInputElement>(null)

  useEffect(() => { db.getApiKey().then(setSavedKey) }, [])

  // ── API Key ───────────────────────────────────────────────────────────────
  const handleSaveKey = async (e: React.FormEvent) => {
    e.preventDefault()
    const clean = keyInput.trim()
    if (!clean) return
    setSavingKey(true)
    await db.saveApiKey(clean)
    setSavedKey(clean)
    setKeyInput('')
    setSavingKey(false)
    toast({ message: 'API Key guardada en este dispositivo' })
  }

  const handleRemoveKey = async () => {
    const ok = await confirm({
      title: '¿Quitar la API Key?',
      message: 'El modo «Con IA» dejará de funcionar hasta que pongas otra. El modo Rápido sigue igual.',
      confirmLabel: 'Quitar',
      danger: true,
    })
    if (!ok) return
    await db.saveApiKey('')
    setSavedKey(null)
    toast({ message: 'API Key eliminada de este dispositivo' })
  }

  // ── Días de pago ──────────────────────────────────────────────────────────
  const savePaydays = (d1: string, d2: string) => {
    const days = [d1, d2].filter((d) => d.trim() !== '').map((d) => parseInt(d, 10))
    if (days.length === 0 || days.some((n) => !(n >= 1 && n <= 31))) {
      setPaydayError('Escribe días entre 1 y 31')
      return
    }
    setPaydayError(null)
    setPrefs({ paydays: days })
  }

  // ── Notificaciones ────────────────────────────────────────────────────────
  const toggleNotifications = async (on: boolean) => {
    setNotifMessage(null)
    if (!on) {
      setNotificationsOn(false)
      return
    }
    // El permiso se pide únicamente aquí, cuando la persona activa la función
    const status = await requestNotificationPermission()
    if (status === 'granted') {
      setNotificationsOn(true)
      setNotifMessage('Listo. Verás una notificación al abrir Lukas cuando haya pagos por vencer.')
    } else if (status === 'unsupported') {
      setNotifMessage('Este navegador no permite notificaciones. Los recordatorios seguirán apareciendo dentro de la app, en la pantalla Hoy.')
    } else {
      setNotificationsOn(false)
      setNotifMessage('El permiso de notificaciones está bloqueado. Puedes cambiarlo en los ajustes del navegador para este sitio. Los recordatorios seguirán apareciendo dentro de la app.')
    }
  }

  // ── Respaldo ──────────────────────────────────────────────────────────────
  const handleExport = async () => {
    setBusy(true)
    setBackupError(null)
    try {
      await exportBackupFile()
      toast({ message: 'Respaldo exportado' })
    } catch {
      setBackupError('No se pudo exportar el respaldo. Inténtalo de nuevo.')
    } finally {
      setBusy(false)
    }
  }

  const handleImport = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    e.target.value = ''
    if (!file) return
    setBusy(true)
    setBackupError(null)
    try {
      // 1) Leer y validar sin tocar nada
      const { data, summary } = await readBackupFile(file)
      const current = await db.countRecords()
      const hasCurrent = Object.values(current).some((n) => n > 0)

      // 2) Mostrar qué trae y qué se reemplaza; nada se sobrescribe sin confirmar
      const ok = await confirm({
        title: hasCurrent ? '¿Reemplazar tus datos por este respaldo?' : '¿Importar este respaldo?',
        details: [
          { label: 'El archivo trae', value: describeCounts(summary.counts) },
          ...(summary.exportedAt ? [{ label: 'Exportado el', value: formatDate(summary.exportedAt.slice(0, 10)) }] : []),
          ...(hasCurrent ? [{ label: 'Se reemplazará', value: describeCounts(current) }] : []),
          ...(summary.hasPreferences ? [{ label: 'Preferencias', value: 'Moneda, días de pago y recordatorios' }] : []),
        ],
        note: [
          hasCurrent ? 'Tus datos actuales se borran y no se pueden recuperar después. Si quieres conservarlos, cancela y exporta un respaldo primero.' : '',
          summary.fromNewerVersion ? 'El respaldo viene de una versión más nueva de Lukas: se importará lo que esta versión entiende.' : '',
          summary.ignoredColumns.length > 0 ? 'Algunos campos desconocidos del archivo se ignorarán.' : '',
        ].filter(Boolean).join(' ') || undefined,
        confirmLabel: hasCurrent ? 'Reemplazar mis datos' : 'Importar',
        danger: hasCurrent,
      })
      if (!ok) return

      await applyBackup(data)
      const p = data.preferences as { paydays?: number[] } | undefined
      if (p?.paydays) {
        setPayday1(String(p.paydays[0] ?? 15))
        setPayday2(p.paydays[1] ? String(p.paydays[1]) : '')
      }
      toast({ message: `Respaldo importado: ${describeCounts(summary.counts)}` })
    } catch (err) {
      setBackupError((err as Error)?.message ?? 'No se pudo importar el archivo.')
    } finally {
      setBusy(false)
    }
  }

  const currency = currencyInfo(prefs.currency)
  const notif = notificationStatus()

  return (
    <div className="px-4 pt-4 space-y-4">
      <Header
        title="Ajustes"
        subtitle="Configuración de la app"
        showMonth={false}
        right={
          <Link to="/" className={iconButton} aria-label="Volver a Hoy">
            <ArrowLeft size={18} aria-hidden="true" />
          </Link>
        }
      />

      {/* ─── Moneda ─── */}
      <section aria-labelledby="aj-moneda" className={card}>
        <h2 id="aj-moneda" className={sectionTitle}><Coins size={14} className="text-indigo-300" aria-hidden="true" /> Moneda y formato</h2>
        <Field
          label="Moneda en la que se muestran los importes"
          hint={
            <>
              Ejemplo: {formatMoney(1234567.5, currency.code)}. Cambiar la moneda no convierte ni modifica tus montos guardados:
              solo cambia el símbolo y el formato{currency.decimals > 0 ? ', y permite escribir centavos' : ''}.
            </>
          }
        >
          {(c) => (
            <select {...c} value={prefs.currency} onChange={(e) => setPrefs({ currency: e.target.value })} className={inputClass}>
              {CURRENCIES.map((cur) => (
                <option key={cur.code} value={cur.code}>{cur.label} ({cur.code})</option>
              ))}
            </select>
          )}
        </Field>
      </section>

      {/* ─── Días de pago ─── */}
      <section aria-labelledby="aj-pago" className={card}>
        <h2 id="aj-pago" className={sectionTitle}><CalendarClock size={14} className="text-indigo-300" aria-hidden="true" /> Días de pago</h2>
        <p className="text-xs text-gray-400 mb-3">La pantalla Hoy te dice cuánto te queda hasta el siguiente.</p>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Primer pago (día del mes)">
            {(c) => (
              <input
                {...c}
                type="number" min={1} max={31} value={payday1}
                onChange={(e) => { setPayday1(e.target.value); savePaydays(e.target.value, payday2) }}
                className={inputClass}
              />
            )}
          </Field>
          <Field label="Segundo pago (opcional)">
            {(c) => (
              <input
                {...c}
                type="number" min={1} max={31} value={payday2}
                onChange={(e) => { setPayday2(e.target.value); savePaydays(payday1, e.target.value) }}
                className={inputClass}
              />
            )}
          </Field>
        </div>
        {paydayError && <p role="alert" className="text-xs text-rose-400 mt-2">{paydayError}</p>}
      </section>

      {/* ─── Presupuestos ─── */}
      <Link to="/presupuestos" className={`${card} flex items-center justify-between gap-3`}>
        <span className="min-w-0">
          <span className="text-sm font-medium text-white flex items-center gap-2"><PiggyBank size={14} className="text-indigo-300" aria-hidden="true" /> Presupuestos por categoría</span>
          <span className="text-xs text-gray-400 block mt-0.5">Límites mensuales de gasto y avisos al acercarte</span>
        </span>
        <ChevronRight size={16} className="text-gray-400 shrink-0" aria-hidden="true" />
      </Link>

      {/* ─── Recordatorios ─── */}
      <section aria-labelledby="aj-recordatorios" className={`${card} space-y-4`}>
        <div>
          <h2 id="aj-recordatorios" className={sectionTitle}><Bell size={14} className="text-indigo-300" aria-hidden="true" /> Recordatorios de pagos</h2>
          <p className="text-xs text-gray-400">Para cuotas, deudas con fecha y pagos fijos. Cada uno se puede ajustar o posponer desde su campana.</p>
        </div>

        <Switch
          checked={prefs.remindersEnabled}
          onChange={(on) => setPrefs({ remindersEnabled: on })}
          label="Avisarme dentro de la app"
          description="Resalta en la pantalla Hoy lo que está por vencer. No necesita permisos."
        />

        <Field label="¿Con cuánta anticipación?">
          {(c) => (
            <select
              {...c}
              value={prefs.reminderDays}
              onChange={(e) => setPrefs({ reminderDays: Number(e.target.value) })}
              className={inputClass}
            >
              {REMINDER_DAY_OPTIONS.map((d) => <option key={d} value={d}>{daysBeforeLabel(d)}</option>)}
            </select>
          )}
        </Field>

        <Switch
          checked={prefs.notificationsOn && notif === 'granted'}
          onChange={toggleNotifications}
          disabled={notif === 'unsupported'}
          label="Notificaciones del sistema"
          description="Al activarlas, el navegador te pedirá permiso. Solo se usan para avisarte de pagos por vencer: el texto incluye el nombre del pago y su monto."
        />
        {notifMessage && <p role="status" className="text-xs text-gray-200">{notifMessage}</p>}
        <p className="text-xs text-gray-400">
          <strong className="font-medium text-gray-200">Limitación:</strong> Lukas no tiene servidor, así que no puede notificarte con la app cerrada.
          La notificación aparece cuando abres Lukas o vuelves a ella (una vez al día). Los avisos dentro de la app funcionan siempre.
          {notif === 'unsupported' && ' En este navegador las notificaciones del sistema no están disponibles.'}
        </p>
      </section>

      {/* ─── IA ─── */}
      <section aria-labelledby="aj-ia" className={`${card} space-y-4`}>
        <div>
          <h2 id="aj-ia" className={sectionTitle}><Key size={14} className="text-indigo-300" aria-hidden="true" /> Asistente con IA (Gemini)</h2>
          <p className="text-xs text-gray-400">Solo para el modo «Con IA» de Registrar. La clave se guarda únicamente en este dispositivo y no viaja en los respaldos.</p>
        </div>

        {savedKey ? (
          <div className="flex items-center justify-between bg-accent-green/10 border border-accent-green/40 rounded-lg pl-3 pr-1 py-1">
            <span className="text-xs text-accent-green">✓ API Key configurada</span>
            <button type="button" onClick={handleRemoveKey} className={`${iconButton} hover:text-rose-400`} aria-label="Quitar la API Key">
              <Trash2 size={14} aria-hidden="true" />
            </button>
          </div>
        ) : (
          <a
            href="https://aistudio.google.com/app/apikey"
            target="_blank"
            rel="noreferrer noopener"
            className="inline-flex items-center gap-1 text-xs text-accent-cyan underline"
          >
            Obtener una clave gratis en Google AI Studio <ExternalLink size={10} aria-hidden="true" />
            <span className="sr-only">(se abre en otra pestaña)</span>
          </a>
        )}

        <form onSubmit={handleSaveKey} className="flex items-end gap-2">
          <Field label={savedKey ? 'Nueva API Key (reemplaza la actual)' : 'API Key de Gemini'} className="flex-1 min-w-0">
            {(c) => (
              <input
                {...c}
                type="password"
                value={keyInput}
                onChange={(e) => setKeyInput(e.target.value)}
                placeholder="AIzaSy…"
                autoComplete="off"
                spellCheck={false}
                className={inputClass}
              />
            )}
          </Field>
          <button
            type="submit"
            disabled={savingKey || !keyInput.trim()}
            aria-label="Guardar API Key"
            className="shrink-0 w-11 h-[42px] inline-flex items-center justify-center bg-indigo-600 hover:bg-indigo-500 disabled:opacity-60 disabled:cursor-not-allowed text-white rounded-lg"
          >
            <Save size={16} aria-hidden="true" />
          </button>
        </form>

        <Switch
          checked={prefs.aiShareContext}
          onChange={(on) => setPrefs({ aiShareContext: on })}
          label="Usar mis datos para responder preguntas"
          description="Si lo apagas, la IA solo recibe lo que escribes y no podrá responder preguntas sobre tus finanzas."
        />

        <div className="text-xs text-gray-400 border border-bg-border rounded-xl p-3 space-y-2">
          <h3 className="text-gray-200 font-medium flex items-center gap-1.5">
            <ShieldCheck size={13} className="text-accent-green" aria-hidden="true" /> Qué se envía a Google Gemini
          </h3>
          <p><span className="text-gray-200">Siempre:</span> {SHARED_ALWAYS}</p>
          <p>
            <span className="text-gray-200">Solo al hacer una pregunta sobre tus finanzas{prefs.aiShareContext ? '' : ' (ahora apagado)'}:</span> {SHARED_ON_QUESTIONS}
          </p>
          <p><span className="text-gray-200">Nunca:</span> {NEVER_SHARED}</p>
        </div>
      </section>

      {/* ─── Respaldo ─── */}
      <section aria-labelledby="aj-respaldo" className={card}>
        <h2 id="aj-respaldo" className={sectionTitle}><DatabaseBackup size={14} className="text-indigo-300" aria-hidden="true" /> Respaldo de datos</h2>
        <p className="text-xs text-gray-400 mb-3">
          Exporta un archivo con todo (movimientos, pagos, tarjetas, metas, presupuestos, recordatorios y preferencias) y guárdalo donde quieras.
          La API Key no se incluye. También sirve para pasar los datos entre el Lukas anterior y este.
        </p>
        <div className="grid grid-cols-2 gap-2">
          <button
            type="button"
            onClick={handleExport}
            disabled={busy}
            className="flex items-center justify-center gap-2 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-60 text-white text-sm py-2.5 rounded-xl"
          >
            <Download size={15} aria-hidden="true" /> Exportar
          </button>
          <button
            type="button"
            onClick={() => fileRef.current?.click()}
            disabled={busy}
            className="flex items-center justify-center gap-2 bg-bg-elevated border border-bg-field hover:border-gray-400 disabled:opacity-60 text-gray-100 text-sm py-2.5 rounded-xl"
          >
            <Upload size={15} aria-hidden="true" /> Importar
          </button>
          <input
            ref={fileRef}
            type="file"
            accept=".json,application/json"
            className="hidden"
            onChange={handleImport}
            aria-label="Archivo de respaldo para importar"
            tabIndex={-1}
          />
        </div>
        <p className="text-xs text-gray-400 mt-2">
          Al importar verás qué trae el archivo y qué se reemplaza antes de confirmar. Nada se sobrescribe sin tu confirmación.
        </p>
        {backupError && <p role="alert" className="text-xs text-rose-400 mt-2">{backupError}</p>}
      </section>

      {/* ─── Acerca de ─── */}
      <section aria-labelledby="aj-acerca" className={card}>
        <h2 id="aj-acerca" className={sectionTitle}><Info size={14} className="text-indigo-300" aria-hidden="true" /> Acerca de Lukas</h2>
        <p className="text-xs text-gray-400">
          Versión {APP_VERSION}. Tus datos viven solo en este dispositivo: no hay cuentas, servidores ni sincronización automática.
          Exporta un respaldo de vez en cuando.
        </p>
      </section>
    </div>
  )
}
