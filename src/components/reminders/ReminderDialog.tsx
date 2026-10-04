import { useState } from 'react'
import { Bell, BellOff, BellRing } from 'lucide-react'
import type { ReminderKind, ReminderSetting } from '@/types'
import { addDays, formatDate, today } from '@/lib/dates'
import { REMINDER_DAY_OPTIONS } from '@/lib/prefs'
import { isSnoozed, kindLabel } from '@/lib/reminders'
import { Modal } from '@/components/ui/Modal'
import { Field } from '@/components/ui/Field'
import { iconButton, inputClass, primaryButton, secondaryButton } from '@/components/ui/styles'

export interface ReminderState {
  /** Hay aviso configurado (propio o general) */
  enabled: boolean
  /** Está avisando hoy */
  active: boolean
  snoozed: boolean
}

export function daysBeforeLabel(days: number): string {
  if (days === 0) return 'El mismo día'
  if (days === 1) return '1 día antes'
  return `${days} días antes`
}

/** Botón de campana: muestra el estado del recordatorio y abre su configuración. */
export function ReminderButton({ name, state, onClick }: { name: string; state: ReminderState; onClick: () => void }) {
  const status = !state.enabled ? 'silenciado' : state.snoozed ? 'pospuesto' : state.active ? 'avisando ahora' : 'activo'
  const Icon = !state.enabled ? BellOff : state.active ? BellRing : Bell
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={`Recordatorio de ${name}: ${status}. Configurar`}
      className={`${iconButton} ${state.active && state.enabled ? 'text-accent-yellow' : ''}`}
    >
      <Icon size={15} aria-hidden="true" />
    </button>
  )
}

interface Props {
  kind: ReminderKind
  /** Nombre del registro (cuota, persona, pago fijo) */
  name: string
  /** Próximo vencimiento, si lo tiene */
  dueDate: string | null
  setting: ReminderSetting | undefined
  /** Valores generales de Ajustes */
  defaults: { enabled: boolean; daysBefore: number }
  onSave: (patch: Partial<Pick<ReminderSetting, 'enabled' | 'days_before' | 'snoozed_until'>>) => Promise<unknown>
  onClose: () => void
}

/** Configura el recordatorio de un registro: activarlo, con cuánta anticipación y posponerlo. */
export function ReminderDialog({ kind, name, dueDate, setting, defaults, onSave, onClose }: Props) {
  const [enabled, setEnabled] = useState(setting ? setting.enabled === 1 : defaults.enabled)
  const [days, setDays] = useState<string>(setting?.days_before != null ? String(setting.days_before) : '')
  const [snoozedUntil, setSnoozedUntil] = useState<string | null>(
    setting && isSnoozed(setting) ? setting.snoozed_until : null
  )
  const [saving, setSaving] = useState(false)

  const save = async () => {
    setSaving(true)
    try {
      await onSave({
        enabled: enabled ? 1 : 0,
        days_before: days === '' ? null : Number(days),
        snoozed_until: snoozedUntil,
      })
      onClose()
    } finally {
      setSaving(false)
    }
  }

  return (
    <Modal
      title={`Recordatorio · ${name}`}
      onClose={onClose}
      footer={
        <>
          <button type="button" onClick={onClose} className={secondaryButton}>Cancelar</button>
          <button type="button" onClick={save} disabled={saving} className={primaryButton}>
            {saving ? 'Guardando…' : 'Guardar'}
          </button>
        </>
      }
    >
      <div className="space-y-4">
        <p className="text-xs text-gray-400">
          {kindLabel(kind)}
          {dueDate ? ` · próximo vencimiento: ${formatDate(dueDate)}` : ' · sin fecha de vencimiento'}
        </p>

        {!dueDate && (
          <p role="note" className="text-xs text-accent-yellow bg-accent-yellow/10 border border-accent-yellow/30 rounded-lg px-3 py-2">
            Este registro no tiene fecha límite. Agrégale una (botón de editar) para que el recordatorio pueda avisarte.
          </p>
        )}

        <label className="flex items-center gap-3 text-sm text-gray-100">
          <input
            type="checkbox"
            checked={enabled}
            onChange={(e) => setEnabled(e.target.checked)}
            className="w-5 h-5 accent-indigo-500"
          />
          Recordarme este pago
        </label>

        <Field label="¿Con cuánta anticipación?">
          {(control) => (
            <select {...control} value={days} onChange={(e) => setDays(e.target.value)} disabled={!enabled} className={`${inputClass} disabled:opacity-60`}>
              <option value="">Como en Ajustes ({daysBeforeLabel(defaults.daysBefore).toLowerCase()})</option>
              {REMINDER_DAY_OPTIONS.map((d) => <option key={d} value={d}>{daysBeforeLabel(d)}</option>)}
            </select>
          )}
        </Field>

        <div>
          <p id="posponer-titulo" className="text-xs text-gray-400 mb-2">Posponer el aviso</p>
          {snoozedUntil ? (
            <div className="flex items-center justify-between gap-3 bg-bg-elevated border border-bg-border rounded-lg px-3 py-2">
              <p className="text-sm text-gray-200">Pospuesto hasta el {formatDate(snoozedUntil)}</p>
              <button type="button" onClick={() => setSnoozedUntil(null)} className="text-xs text-accent-cyan shrink-0 py-1">
                Quitar
              </button>
            </div>
          ) : (
            <div role="group" aria-labelledby="posponer-titulo" className="grid grid-cols-3 gap-2">
              {[{ d: 1, label: 'Mañana' }, { d: 3, label: '3 días' }, { d: 7, label: '1 semana' }].map(({ d, label }) => (
                <button
                  key={d}
                  type="button"
                  disabled={!enabled}
                  onClick={() => setSnoozedUntil(addDays(today(), d))}
                  className="py-2 rounded-lg text-sm text-gray-200 bg-bg-elevated border border-bg-field hover:border-gray-400 disabled:opacity-60"
                >
                  {label}
                </button>
              ))}
            </div>
          )}
        </div>
      </div>
    </Modal>
  )
}
