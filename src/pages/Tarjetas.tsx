import { useState } from 'react'
import { Plus } from 'lucide-react'
import { Header } from '@/components/layout/Header'
import { CreditCardCard } from '@/components/cards/CreditCardCard'
import { AccountRow } from '@/components/accounts/AccountRow'
import { useCards, useAccounts } from '@/hooks/useLists'
import { useDeleteWithUndo } from '@/hooks/useDeleteWithUndo'
import { formatCOP } from '@/lib/currency'
import { amountErrorMessage, currencyInfo, parseMoney, toInputAmount } from '@/lib/money'
import { Modal } from '@/components/ui/Modal'
import { Field, FormError } from '@/components/ui/Field'
import { inputClass, primaryButton, secondaryButton, tabClass } from '@/components/ui/styles'
import type { CreditCard, Account } from '@/types'

const BANK_COLORS: Record<string, string> = {
  'nu': '#8b5cf6',
  'bancolombia': '#f59e0b',
  'davivienda': '#ef4444',
  'nequi': '#3b82f6',
  'daviplata': '#dc2626',
  'efectivo': '#22c55e',
  'falabella': '#16a34a',
  'scotiabank': '#dc2626',
  'lulo': '#84cc16',
}

/** Busca el color del banco por coincidencia parcial del nombre */
function bankColor(name: string): string {
  const lower = name.toLowerCase()
  const key = Object.keys(BANK_COLORS).find((k) => lower.includes(k))
  return key ? BANK_COLORS[key] : '#6366f1'
}

const BANKS = ['Nu', 'Bancolombia', 'Davivienda', 'Nequi', 'Falabella', 'Scotiabank']
const ACCOUNT_NAMES = ['Bancolombia', 'Nequi', 'Daviplata', 'Davivienda', 'Nu', 'Efectivo']
const OTHER = '__otro__'

type Tab = 'cards' | 'accounts'

/** Monto que puede ser cero: '' o '0' → 0; inválido → null */
function parseAmountOrZero(text: string): number | null {
  const t = text.trim()
  if (t === '' || /^0+([.,]0+)?$/.test(t)) return 0
  return parseMoney(t)
}

function CardForm({ initial, onSave, onClose }: {
  initial: CreditCard | null
  onSave: (data: Omit<CreditCard, 'id'>) => Promise<void>
  onClose: () => void
}) {
  const known = initial ? BANKS.includes(initial.bank_name) : true
  const [bank, setBank] = useState(initial ? (known ? initial.bank_name : OTHER) : '')
  const [customBank, setCustomBank] = useState(initial && !known && initial.bank_name !== 'Otro' ? initial.bank_name : '')
  const [lastFour, setLastFour] = useState(initial?.last_four ?? '')
  const [limit, setLimit] = useState(initial ? toInputAmount(initial.credit_limit) : '')
  const [balance, setBalance] = useState(initial ? toInputAmount(initial.current_balance) : '')
  const [billingDay, setBillingDay] = useState(initial?.billing_day ? String(initial.billing_day) : '')
  const [errors, setErrors] = useState<{ bank?: string; lastFour?: string; limit?: string; balance?: string; day?: string }>({})
  const [error, setError] = useState<string | null>(null)
  const mode = currencyInfo().decimals === 0 ? 'numeric' : 'decimal'

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    const name = bank === OTHER ? (customBank.trim() || 'Otro') : bank
    const limitValue = parseMoney(limit)
    const balanceValue = parseAmountOrZero(balance)
    const day = billingDay.trim() ? parseInt(billingDay, 10) : null
    const next: typeof errors = {}
    if (!name) next.bank = 'Elige un banco'
    if (lastFour && !/^\d{4}$/.test(lastFour)) next.lastFour = 'Deben ser 4 números'
    if (limitValue === null) next.limit = amountErrorMessage()
    if (balanceValue === null) next.balance = amountErrorMessage()
    if (day !== null && !(day >= 1 && day <= 31)) next.day = 'Debe ser un día entre 1 y 31'
    setErrors(next)
    if (Object.keys(next).length > 0) return

    try {
      await onSave({
        bank_name: name,
        last_four: lastFour || null,
        credit_limit: limitValue!,
        current_balance: balanceValue!,
        billing_day: day,
        cutoff_day: initial?.cutoff_day ?? null,
        color: bankColor(name),
      })
    } catch (err) {
      setError((err as Error)?.message ?? 'No se pudo guardar')
    }
  }

  return (
    <Modal
      title={initial ? 'Editar tarjeta' : 'Nueva tarjeta'}
      onClose={onClose}
      footer={
        <>
          <button type="button" onClick={onClose} className={secondaryButton}>Cancelar</button>
          <button type="submit" form="card-form" className={primaryButton}>Guardar</button>
        </>
      }
    >
      <form id="card-form" onSubmit={submit} noValidate className="space-y-3">
        <Field label="Banco" error={errors.bank}>
          {(c) => (
            <select {...c} value={bank} onChange={(e) => setBank(e.target.value)} className={inputClass} required>
              <option value="">Seleccionar banco</option>
              {BANKS.map((b) => <option key={b} value={b}>{b}</option>)}
              <option value={OTHER}>Otro</option>
            </select>
          )}
        </Field>
        {bank === OTHER && (
          <Field label="Nombre del banco (opcional)">
            {(c) => <input {...c} value={customBank} onChange={(e) => setCustomBank(e.target.value)} placeholder="Ej: Banco de Bogotá" className={inputClass} />}
          </Field>
        )}

        <div className="grid grid-cols-2 gap-3">
          <Field label="Últimos 4 dígitos (opcional)" error={errors.lastFour}>
            {(c) => <input {...c} value={lastFour} onChange={(e) => setLastFour(e.target.value.replace(/\D/g, '').slice(0, 4))} placeholder="1234" maxLength={4} inputMode="numeric" autoComplete="off" className={inputClass} />}
          </Field>
          <Field label="Cupo total" error={errors.limit}>
            {(c) => <input {...c} value={limit} onChange={(e) => setLimit(e.target.value)} placeholder="5000000" inputMode={mode} autoComplete="off" className={inputClass} required />}
          </Field>
          <Field label="Factura actual" error={errors.balance}>
            {(c) => <input {...c} value={balance} onChange={(e) => setBalance(e.target.value)} placeholder="0" inputMode={mode} autoComplete="off" className={inputClass} />}
          </Field>
          <Field label="Día de pago" error={errors.day}>
            {(c) => <input {...c} type="number" value={billingDay} onChange={(e) => setBillingDay(e.target.value)} placeholder="15" min={1} max={31} className={inputClass} />}
          </Field>
        </div>
        <FormError message={error} />
      </form>
    </Modal>
  )
}

function AccountForm({ initial, onSave, onClose }: {
  initial: Account | null
  onSave: (data: Omit<Account, 'id' | 'created_at'>) => Promise<void>
  onClose: () => void
}) {
  const known = initial ? ACCOUNT_NAMES.includes(initial.name) : true
  const [name, setName] = useState(initial ? (known ? initial.name : OTHER) : '')
  const [customName, setCustomName] = useState(initial && !known ? initial.name : '')
  const [balance, setBalance] = useState(initial ? toInputAmount(initial.balance) : '')
  const [errors, setErrors] = useState<{ name?: string; balance?: string }>({})
  const [error, setError] = useState<string | null>(null)

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    const finalName = name === OTHER ? customName.trim() : name
    const value = parseAmountOrZero(balance)
    const next: typeof errors = {}
    if (!finalName) next.name = name === OTHER ? 'Escribe el nombre de la cuenta' : 'Elige una cuenta'
    if (value === null) next.balance = amountErrorMessage()
    setErrors(next)
    if (Object.keys(next).length > 0) return
    try {
      await onSave({ name: finalName, balance: value!, color: bankColor(finalName) })
    } catch (err) {
      setError((err as Error)?.message ?? 'No se pudo guardar')
    }
  }

  return (
    <Modal
      title={initial ? 'Editar cuenta' : 'Nueva cuenta'}
      onClose={onClose}
      footer={
        <>
          <button type="button" onClick={onClose} className={secondaryButton}>Cancelar</button>
          <button type="submit" form="account-form" className={primaryButton}>Guardar</button>
        </>
      }
    >
      <form id="account-form" onSubmit={submit} noValidate className="space-y-3">
        <Field label="Cuenta" error={name === OTHER ? undefined : errors.name}>
          {(c) => (
            <select {...c} value={name} onChange={(e) => setName(e.target.value)} className={inputClass} required>
              <option value="">Seleccionar</option>
              {ACCOUNT_NAMES.map((n) => <option key={n} value={n}>{n}</option>)}
              <option value={OTHER}>Otra</option>
            </select>
          )}
        </Field>
        {name === OTHER && (
          <Field label="Nombre de la cuenta" error={errors.name}>
            {(c) => <input {...c} value={customName} onChange={(e) => setCustomName(e.target.value)} placeholder="Ej: Davivienda Ahorros" className={inputClass} required />}
          </Field>
        )}
        <Field label="Saldo actual" error={errors.balance}>
          {(c) => (
            <input
              {...c}
              value={balance}
              onChange={(e) => setBalance(e.target.value)}
              placeholder="500000"
              inputMode={currencyInfo().decimals === 0 ? 'numeric' : 'decimal'}
              autoComplete="off"
              className={inputClass}
            />
          )}
        </Field>
        <FormError message={error} />
      </form>
    </Modal>
  )
}

export function Tarjetas() {
  const [tab, setTab] = useState<Tab>('cards')
  const [showForm, setShowForm] = useState(false)
  const [editingCard, setEditingCard] = useState<CreditCard | null>(null)
  const [editingAccount, setEditingAccount] = useState<Account | null>(null)

  const { cards, loading, createCard, updateCard } = useCards()
  const { accounts, loading: accLoading, createAccount, updateBalance, updateAccount } = useAccounts()
  const confirmDelete = useDeleteWithUndo()

  const totalLimit = cards.reduce((s, c) => s + c.credit_limit, 0)
  const totalBalance = cards.reduce((s, c) => s + c.current_balance, 0)
  const totalAccounts = accounts.reduce((s, a) => s + a.balance, 0)
  const usePct = totalLimit > 0 ? Math.round((totalBalance / totalLimit) * 100) : 0

  const deleteCard = (card: CreditCard) => confirmDelete({
    kind: 'card',
    id: card.id,
    title: '¿Eliminar esta tarjeta?',
    details: [
      { label: 'Tarjeta', value: `${card.bank_name}${card.last_four ? ` •••• ${card.last_four}` : ''}` },
      { label: 'Factura actual', value: formatCOP(card.current_balance) },
      { label: 'Cupo', value: formatCOP(card.credit_limit) },
    ],
    doneMessage: `Tarjeta ${card.bank_name} eliminada`,
  })

  const deleteAccount = (account: Account) => confirmDelete({
    kind: 'account',
    id: account.id,
    title: '¿Eliminar esta cuenta?',
    details: [
      { label: 'Cuenta', value: account.name },
      { label: 'Saldo', value: formatCOP(account.balance) },
    ],
    doneMessage: `Cuenta ${account.name} eliminada`,
  })

  const closeCard = () => { setShowForm(false); setEditingCard(null) }
  const closeAccount = () => { setShowForm(false); setEditingAccount(null) }

  const showCardModal = (showForm && tab === 'cards') || !!editingCard
  const showAccModal = (showForm && tab === 'accounts') || !!editingAccount
  const addLabel = tab === 'cards' ? 'Nueva tarjeta' : 'Nueva cuenta'

  return (
    <div className="px-4 pt-4">
      <Header
        title={tab === 'cards' ? 'Tarjetas' : 'Cuentas'}
        subtitle={tab === 'cards' ? 'Resumen de tu deuda en tarjetas' : 'Saldos reales de tus cuentas'}
        showMonth={false}
        right={
          <button
            type="button"
            onClick={() => setShowForm(true)}
            aria-label={addLabel}
            className="inline-flex items-center gap-1.5 bg-indigo-600 hover:bg-indigo-500 text-white text-sm px-3 py-2 rounded-lg transition-colors"
          >
            <Plus size={16} aria-hidden="true" />
            <span className="hidden sm:inline">{addLabel}</span>
          </button>
        }
      />

      <div role="group" aria-label="Ver" className="flex gap-1 mb-4 bg-bg-card border border-bg-border rounded-xl p-1 w-fit">
        <button type="button" aria-pressed={tab === 'cards'} onClick={() => setTab('cards')} className={tabClass(tab === 'cards')}>Tarjetas</button>
        <button type="button" aria-pressed={tab === 'accounts'} onClick={() => setTab('accounts')} className={tabClass(tab === 'accounts')}>Cuentas</button>
      </div>

      {tab === 'cards' && (
        <section aria-label="Tarjetas de crédito">
          {cards.length > 0 && (
            <div className="flex flex-wrap gap-x-4 gap-y-1 mb-4 text-sm">
              <span className="text-gray-400">Cupo: <span className="text-gray-100 font-medium">{formatCOP(totalLimit)}</span></span>
              <span className="text-gray-400">Deuda: <span className="text-rose-400 font-medium">{formatCOP(totalBalance)}</span></span>
              <span className="text-gray-400">Uso: <span className={usePct >= 80 ? 'text-rose-400 font-medium' : 'text-gray-100 font-medium'}>{usePct}%</span></span>
            </div>
          )}

          {loading ? (
            <div className="space-y-4" aria-hidden="true">
              {[1, 2].map((i) => <div key={i} className="h-52 bg-bg-card border border-bg-border rounded-xl animate-pulse" />)}
            </div>
          ) : cards.length === 0 ? (
            <div className="text-center py-16 text-gray-400">
              <p className="text-4xl mb-3" aria-hidden="true">💳</p>
              <p className="text-sm">Registra tus tarjetas de crédito</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              {cards.map((card) => (
                <CreditCardCard key={card.id} card={card} onDelete={deleteCard} onUpdate={updateCard} onEdit={setEditingCard} />
              ))}
            </div>
          )}
        </section>
      )}

      {tab === 'accounts' && (
        <section aria-label="Cuentas">
          {accounts.length > 0 && (
            <p className="text-sm text-gray-400 mb-4">
              Total disponible: <span className="text-accent-cyan font-semibold">{formatCOP(totalAccounts)}</span>
            </p>
          )}

          {accLoading ? (
            <div className="space-y-2" aria-hidden="true">
              {[1, 2].map((i) => <div key={i} className="h-14 bg-bg-card border border-bg-border rounded-xl animate-pulse" />)}
            </div>
          ) : accounts.length === 0 ? (
            <div className="text-center py-16 text-gray-400">
              <p className="text-4xl mb-3" aria-hidden="true">🏦</p>
              <p className="text-sm">Registra tus cuentas: Bancolombia, Nequi, efectivo…</p>
              <p className="text-xs mt-1">Actualiza el saldo cuando quieras</p>
            </div>
          ) : (
            <ul className="space-y-2">
              {accounts.map((acc) => (
                <AccountRow key={acc.id} account={acc} onUpdateBalance={updateBalance} onEdit={setEditingAccount} onDelete={deleteAccount} />
              ))}
            </ul>
          )}
          <p className="text-xs text-gray-400 mt-4">
            Al registrar un movimiento con el nombre de una cuenta, su saldo se ajusta solo. Si después editas o eliminas ese movimiento, corrige el saldo aquí.
          </p>
        </section>
      )}

      {showCardModal && (
        <CardForm
          initial={editingCard}
          onSave={async (data) => {
            if (editingCard) await updateCard(editingCard.id, data)
            else await createCard(data)
            closeCard()
          }}
          onClose={closeCard}
        />
      )}

      {showAccModal && (
        <AccountForm
          initial={editingAccount}
          onSave={async (data) => {
            if (editingAccount) await updateAccount(editingAccount.id, data)
            else await createAccount(data)
            closeAccount()
          }}
          onClose={closeAccount}
        />
      )}
    </div>
  )
}
