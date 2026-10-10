import { useId, useMemo, useState } from 'react'
import { AlertTriangle, Wallet } from 'lucide-react'
import type { TransactionType } from '@/types'
import { useAccounts, useCards } from '@/hooks/useLists'
import { matchPaymentTargets, normalizeName } from '@/lib/paymentMethod'
import { formatMoney } from '@/lib/money'
import { inputClass } from './styles'

interface Props {
  /** '' = sin método de pago */
  value: string
  onChange: (value: string) => void
  label?: string
  labelClassName?: string
  /** Para decir si el dinero sale o entra */
  type?: TransactionType
}

const CASH = 'Efectivo'
const chip = (active: boolean) =>
  `px-3 py-2 rounded-full text-xs border transition-colors ${
    active ? 'bg-accent-cyan/15 border-accent-cyan text-accent-cyan' : 'bg-bg-card border-bg-border text-gray-400'
  }`

/**
 * Elegir con qué se pagó: botones con las cuentas y tarjetas (y «Otro» para escribir).
 * Debajo dice qué saldo se mueve o avisa si ese nombre no corresponde a ninguno.
 */
export function PaymentMethodField({ value, onChange, label = 'Método de pago (opcional)', labelClassName, type = 'expense' }: Props) {
  const { accounts } = useAccounts()
  const { cards } = useCards()
  const id = useId()

  const options = useMemo(() => {
    const seen = new Set<string>()
    return [...accounts.map((a) => a.name), ...cards.map((c) => c.bank_name), CASH]
      .map((n) => n.trim())
      .filter((n) => {
        const key = normalizeName(n)
        if (!key || seen.has(key)) return false
        seen.add(key)
        return true
      })
  }, [accounts, cards])

  const norm = normalizeName(value)
  const selected = options.find((o) => normalizeName(o) === norm) ?? null
  // Un valor que no es ninguno de los botones (escrito a mano o sugerido por la IA) se muestra en «Otro»
  const [writing, setWriting] = useState(false)
  const showOther = writing || (!!norm && !selected)

  const targets = matchPaymentTargets(value, accounts, cards)
  const income = type === 'income'

  return (
    <div>
      <p id={`${id}-label`} className={labelClassName ?? 'text-xs text-gray-400 mb-1'}>{label}</p>
      <div role="group" aria-labelledby={`${id}-label`} aria-describedby={`${id}-saldo`} className="flex flex-wrap gap-2">
        {options.map((o) => {
          const active = !showOther && selected === o
          return (
            <button
              key={o}
              type="button"
              aria-pressed={active}
              onClick={() => { setWriting(false); onChange(active ? '' : o) }}
              className={chip(active)}
            >
              {o}
            </button>
          )
        })}
        <button
          type="button"
          aria-pressed={showOther}
          aria-expanded={showOther}
          aria-controls={`${id}-otro`}
          onClick={() => { setWriting(!showOther); onChange('') }}
          className={chip(showOther)}
        >
          Otro
        </button>
      </div>

      <div id={`${id}-otro`}>
        {showOther && (
          <>
            <label htmlFor={`${id}-texto`} className="sr-only">Escribe el método de pago</label>
            <input
              id={`${id}-texto`}
              value={value}
              onChange={(e) => onChange(e.target.value)}
              placeholder="Escribe con qué pagaste"
              autoComplete="off"
              className={`${inputClass} mt-2`}
            />
          </>
        )}
      </div>

      <div id={`${id}-saldo`} aria-live="polite">
        {targets.length > 0 ? (
          <ul className="mt-1.5 space-y-0.5">
            {targets.map((t) => {
              const account = t.target === 'account' ? accounts.find((a) => a.id === t.id) : undefined
              return (
                <li key={`${t.target}-${t.id}`} className="flex items-center gap-1.5 text-xs text-gray-400">
                  <Wallet size={12} className="shrink-0 text-accent-cyan" aria-hidden="true" />
                  {t.target === 'account'
                    ? `${income ? 'Entra a' : 'Sale de'} tu cuenta «${t.name}»${account ? ` · saldo ${formatMoney(account.balance)}` : ''}`
                    : `${income ? 'Abona a' : 'Va a'} la deuda de tu tarjeta «${t.name}»`}
                </li>
              )
            })}
          </ul>
        ) : norm ? (
          <p className="mt-1.5 flex items-start gap-1.5 text-xs text-accent-yellow">
            <AlertTriangle size={12} className="shrink-0 mt-0.5" aria-hidden="true" />
            <span>
              No tienes una cuenta ni tarjeta llamada «{value.trim()}»: no se moverá ningún saldo.
              {' '}Si quieres llevar su saldo, créala en Tarjetas → Cuentas con ese nombre.
            </span>
          </p>
        ) : null}
      </div>
    </div>
  )
}
