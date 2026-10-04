import { storageGet, storageSet } from './storage'
import { today } from './dates'
import { formatMoney } from './money'
import { dueLabel, kindLabel, type ActiveReminder } from './reminders'

/**
 * Notificaciones del sistema para los recordatorios.
 *
 * LIMITACIÓN: Lukas no tiene servidor, así que no puede enviar avisos con la app
 * cerrada. Las notificaciones se muestran cuando la app se abre o vuelve a primer
 * plano y hay algo por vencer (máximo una vez al día por cada grupo de pendientes).
 * Los recordatorios dentro de la app (pantalla Hoy) funcionan siempre, sin permisos.
 */

const NOTIFIED_KEY = 'lukas_notified'

export type NotificationStatus = 'unsupported' | 'default' | 'granted' | 'denied'

export function notificationStatus(): NotificationStatus {
  if (typeof Notification === 'undefined') return 'unsupported'
  return Notification.permission
}

/** Pide el permiso. Solo debe llamarse cuando la persona activa la función. */
export async function requestNotificationPermission(): Promise<NotificationStatus> {
  if (typeof Notification === 'undefined') return 'unsupported'
  if (Notification.permission === 'granted' || Notification.permission === 'denied') return Notification.permission
  try {
    return await Notification.requestPermission()
  } catch {
    return 'denied'
  }
}

async function show(title: string, body: string): Promise<boolean> {
  const options: NotificationOptions = { body, tag: 'lukas-recordatorios', lang: 'es' }
  try {
    // En Android solo se puede notificar a través del service worker
    const registration = await navigator.serviceWorker?.getRegistration()
    if (registration) {
      await registration.showNotification(title, options)
      return true
    }
  } catch { /* se intenta la forma directa */ }
  try {
    new Notification(title, options)
    return true
  } catch {
    return false
  }
}

/** Texto de la notificación. No incluye saldos ni datos fuera de lo que vence. */
export function reminderNotificationText(reminders: ActiveReminder[]): { title: string; body: string } {
  if (reminders.length === 1) {
    const r = reminders[0]
    return {
      title: `${kindLabel(r.kind)}: ${r.title}`,
      body: `${formatMoney(r.amount)} · ${dueLabel(r.daysLeft)}`,
    }
  }
  const first = reminders.slice(0, 3).map((r) => `${r.title} (${dueLabel(r.daysLeft)})`).join(', ')
  return {
    title: `Tienes ${reminders.length} pagos por atender`,
    body: reminders.length > 3 ? `${first} y ${reminders.length - 3} más` : first,
  }
}

/**
 * Muestra una notificación con lo que vence, si hay permiso y no se avisó ya hoy
 * por ese mismo grupo de pendientes.
 */
export async function notifyDueReminders(reminders: ActiveReminder[]): Promise<boolean> {
  if (reminders.length === 0) return false
  if (notificationStatus() !== 'granted') return false

  const signature = `${today()}|${reminders.map((r) => `${r.kind}:${r.id}`).sort().join(',')}`
  if (storageGet(NOTIFIED_KEY) === signature) return false

  const { title, body } = reminderNotificationText(reminders)
  const shown = await show(title, body)
  if (shown) storageSet(NOTIFIED_KEY, signature)
  return shown
}
