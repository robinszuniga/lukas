import { useState } from 'react'
import { Plus, X } from 'lucide-react'
import { Header } from '@/components/layout/Header'
import { CreditCardCard } from '@/components/cards/CreditCardCard'
import { AccountRow } from '@/components/accounts/AccountRow'
import { useCards } from '@/hooks/useCards'
import { useAccounts } from '@/hooks/useAccounts'
import { parseCOP, formatCOP } from '@/lib/currency'
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

const ACCOUNT_NAMES = ['Bancolombia', 'Nequi', 'Daviplata', 'Davivienda', 'Nu', 'Efectivo', 'Otra']

type Tab = 'cards' | 'accounts'

const emptyCardForm = {
  bank_name: '', last_four: '', credit_limit: '', current_balance: '',
  billing_day: '', cutoff_day: '',
}

export function Tarjetas() {
  const [tab, setTab] = useState<Tab>('cards')
  const [showForm, setShowForm] = useState(false)
  const [editingCard, setEditingCard] = useState<CreditCard | null>(null)
  const [editingAccount, setEditingAccount] = useState<Account | null>(null)
  const [form, setForm] = useState(emptyCardForm)
  const [accForm, setAccForm] = useState({ name: '', customName: '', balance: '' })

  const { cards, loading, createCard, updateCard, deleteCard } = useCards()
  const { accounts, loading: accLoading, createAccount, updateBalance, updateAccount, deleteAccount } = useAccounts()

  const totalLimit = cards.reduce((s, c) => s + c.credit_limit, 0)
  const totalBalance = cards.reduce((s, c) => s + c.current_balance, 0)
  const totalAccounts = accounts.reduce((s, a) => s + a.balance, 0)

  const startEditCard = (card: CreditCard) => {
    setForm({
      bank_name: card.bank_name,
      last_four: card.last_four ?? '',
      credit_limit: String(card.credit_limit),
      current_balance: String(card.current_balance),
      billing_day: card.billing_day ? String(card.billing_day) : '',
      cutoff_day: card.cutoff_day ? String(card.cutoff_day) : '',
    })
    setEditingCard(card)
  }

  const startEditAccount = (acc: Account) => {
    setAccForm({ name: 'Otra', customName: acc.name, balance: String(acc.balance) })
    setEditingAccount(acc)
  }

  const closeCardModal = () => { setShowForm(false); setEditingCard(null); setForm(emptyCardForm) }
  const closeAccModal = () => { setShowForm(false); setEditingAccount(null); setAccForm({ name: '', customName: '', balance: '' }) }

  const handleSubmitCard = async (e: React.FormEvent) => {
    e.preventDefault()
    const data = {
      bank_name: form.bank_name,
      last_four: form.last_four || null,
      credit_limit: parseCOP(form.credit_limit),
      current_balance: parseCOP(form.current_balance) || 0,
      billing_day: form.billing_day ? parseInt(form.billing_day) : null,
      cutoff_day: form.cutoff_day ? parseInt(form.cutoff_day) : null,
      color: bankColor(form.bank_name),
    }
    if (editingCard) {
      await updateCard(editingCard.id, data)
    } else {
      await createCard(data as any)
    }
    closeCardModal()
  }

  const handleSubmitAccount = async (e: React.FormEvent) => {
    e.preventDefault()
    const name = accForm.name === 'Otra' ? accForm.customName.trim() : accForm.name
    if (!name) return
    const data = { name, balance: parseCOP(accForm.balance) || 0, color: bankColor(name) }
    if (editingAccount) {
      await updateAccount(editingAccount.id, data)
    } else {
      await createAccount(data)
    }
    closeAccModal()
  }

  const inputClass = 'w-full bg-bg-elevated border border-bg-border rounded-lg px-3 py-2.5 text-sm text-white placeholder-gray-600 outline-none focus:border-accent-indigo/50 transition-colors'

  const showCardModal = showForm && tab === 'cards' || !!editingCard
  const showAccModal = (showForm && tab === 'accounts') || !!editingAccount

  return (
    <div className="px-4 py-4 md:px-6 md:py-6">
      <div className="flex items-start justify-between mb-3 gap-2">
        <Header
          title={tab === 'cards' ? 'Tarjetas' : 'Cuentas'}
          subtitle={tab === 'cards' ? 'Resumen de tu deuda en tarjetas' : 'Saldos reales de tus cuentas'}
        />
        <button onClick={() => setShowForm(true)} className="shrink-0 flex items-center gap-1.5 bg-accent-indigo hover:bg-accent-indigo/80 text-white text-sm px-3 py-2 rounded-lg transition-colors">
          <Plus size={14} /> <span className="hidden sm:inline">Agregar</span>
        </button>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 mb-4 bg-bg-card border border-bg-border rounded-xl p-1 w-fit">
        <button
          onClick={() => setTab('cards')}
          className={`px-4 py-1.5 rounded-lg text-sm font-medium transition-colors ${
            tab === 'cards' ? 'bg-accent-indigo text-white' : 'text-gray-500 hover:text-gray-300'
          }`}
        >
          Tarjetas
        </button>
        <button
          onClick={() => setTab('accounts')}
          className={`px-4 py-1.5 rounded-lg text-sm font-medium transition-colors ${
            tab === 'accounts' ? 'bg-accent-indigo text-white' : 'text-gray-500 hover:text-gray-300'
          }`}
        >
          Cuentas
        </button>
      </div>

      {/* ─── Tab Tarjetas ─── */}
      {tab === 'cards' && (
        <>
          {cards.length > 0 && (
            <div className="flex flex-wrap gap-x-4 gap-y-1 mb-4 text-sm">
              <span className="text-gray-500">Cupo: <span className="text-gray-200 font-medium">{formatCOP(totalLimit)}</span></span>
              <span className="text-gray-500">Deuda: <span className="text-accent-red font-medium">{formatCOP(totalBalance)}</span></span>
              <span className="text-gray-500">Uso: <span className={totalLimit > 0 && (totalBalance / totalLimit) * 100 >= 80 ? 'text-accent-red font-medium' : 'text-gray-200 font-medium'}>
                {totalLimit > 0 ? Math.round((totalBalance / totalLimit) * 100) : 0}%
              </span></span>
            </div>
          )}

          {loading ? (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {[1, 2].map((i) => <div key={i} className="h-52 bg-bg-card border border-bg-border rounded-xl animate-pulse" />)}
            </div>
          ) : cards.length === 0 ? (
            <div className="text-center py-16 text-gray-600">
              <p className="text-4xl mb-3">💳</p>
              <p className="text-sm">Registra tus tarjetas de crédito</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {cards.map((card) => (
                <CreditCardCard key={card.id} card={card} onDelete={deleteCard} onUpdate={updateCard} onEdit={startEditCard} />
              ))}
            </div>
          )}
        </>
      )}

      {/* ─── Tab Cuentas ─── */}
      {tab === 'accounts' && (
        <>
          {accounts.length > 0 && (
            <p className="text-sm text-gray-500 mb-4">
              Total disponible: <span className="text-accent-cyan font-semibold">{formatCOP(totalAccounts)}</span>
            </p>
          )}

          {accLoading ? (
            <div className="space-y-2">
              {[1, 2].map((i) => <div key={i} className="h-14 bg-bg-card border border-bg-border rounded-xl animate-pulse" />)}
            </div>
          ) : accounts.length === 0 ? (
            <div className="text-center py-16 text-gray-600">
              <p className="text-4xl mb-3">🏦</p>
              <p className="text-sm">Registra tus cuentas: Bancolombia, Nequi, efectivo…</p>
              <p className="text-xs text-gray-700 mt-1">Actualiza el saldo cuando quieras con el lápiz</p>
            </div>
          ) : (
            <div className="space-y-2">
              {accounts.map((acc) => (
                <AccountRow key={acc.id} account={acc} onUpdateBalance={updateBalance} onEdit={startEditAccount} onDelete={deleteAccount} />
              ))}
            </div>
          )}
        </>
      )}

      {/* ─── Modal tarjeta (crear/editar) ─── */}
      {showCardModal && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-end sm:items-center justify-center z-[60]">
          <div className="bg-bg-card border border-bg-border rounded-t-2xl sm:rounded-2xl w-full sm:max-w-md max-h-[85dvh] flex flex-col">
            <div className="flex items-center justify-between px-5 py-4 border-b border-bg-border shrink-0">
              <h2 className="font-semibold text-white text-sm">{editingCard ? 'Editar tarjeta' : 'Nueva tarjeta'}</h2>
              <button onClick={closeCardModal} className="text-gray-500 hover:text-white"><X size={18} /></button>
            </div>

            <form id="card-form" onSubmit={handleSubmitCard} className="overflow-y-auto flex-1 px-5 py-4 space-y-3">
              <div>
                <label className="text-xs text-gray-500 block mb-1">Banco</label>
                <select value={form.bank_name} onChange={(e) => setForm({ ...form, bank_name: e.target.value })} className={inputClass} required>
                  <option value="">Seleccionar banco</option>
                  {['Nu', 'Bancolombia', 'Davivienda', 'Nequi', 'Falabella', 'Scotiabank', 'Otro'].map((b) => (
                    <option key={b} value={b}>{b}</option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs text-gray-500 block mb-1">Últimos 4 dígitos</label>
                  <input value={form.last_four} onChange={(e) => setForm({ ...form, last_four: e.target.value })} placeholder="1234" maxLength={4} inputMode="numeric" className={inputClass} />
                </div>
                <div>
                  <label className="text-xs text-gray-500 block mb-1">Cupo total</label>
                  <input value={form.credit_limit} onChange={(e) => setForm({ ...form, credit_limit: e.target.value })} placeholder="5000000" inputMode="numeric" className={inputClass} required />
                </div>
                <div>
                  <label className="text-xs text-gray-500 block mb-1">Factura actual</label>
                  <input value={form.current_balance} onChange={(e) => setForm({ ...form, current_balance: e.target.value })} placeholder="0" inputMode="numeric" className={inputClass} />
                </div>
                <div>
                  <label className="text-xs text-gray-500 block mb-1">Día de pago</label>
                  <input type="number" value={form.billing_day} onChange={(e) => setForm({ ...form, billing_day: e.target.value })} placeholder="15" min={1} max={31} className={inputClass} />
                </div>
              </div>
            </form>

            <div
              className="px-5 pt-3 border-t border-bg-border shrink-0 flex gap-2"
              style={{ paddingBottom: 'max(1.5rem, env(safe-area-inset-bottom, 0px))' }}
            >
              <button type="button" onClick={closeCardModal} className="flex-1 py-2.5 bg-bg-elevated border border-bg-border text-gray-400 text-sm rounded-xl">Cancelar</button>
              <button type="submit" form="card-form" className="flex-1 py-2.5 bg-accent-indigo hover:bg-accent-indigo/80 text-white text-sm font-medium rounded-xl transition-colors">Guardar</button>
            </div>
          </div>
        </div>
      )}

      {/* ─── Modal cuenta (crear/editar) ─── */}
      {showAccModal && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-end sm:items-center justify-center z-[60]">
          <div className="bg-bg-card border border-bg-border rounded-t-2xl sm:rounded-2xl w-full sm:max-w-md max-h-[85dvh] flex flex-col">
            <div className="flex items-center justify-between px-5 py-4 border-b border-bg-border shrink-0">
              <h2 className="font-semibold text-white text-sm">{editingAccount ? 'Editar cuenta' : 'Nueva cuenta'}</h2>
              <button onClick={closeAccModal} className="text-gray-500 hover:text-white"><X size={18} /></button>
            </div>

            <form id="account-form" onSubmit={handleSubmitAccount} className="overflow-y-auto flex-1 px-5 py-4 space-y-3">
              <div>
                <label className="text-xs text-gray-500 block mb-1">Cuenta</label>
                <select value={accForm.name} onChange={(e) => setAccForm({ ...accForm, name: e.target.value })} className={inputClass} required>
                  <option value="">Seleccionar</option>
                  {ACCOUNT_NAMES.map((n) => <option key={n} value={n}>{n}</option>)}
                </select>
              </div>

              {accForm.name === 'Otra' && (
                <div>
                  <label className="text-xs text-gray-500 block mb-1">Nombre de la cuenta</label>
                  <input value={accForm.customName} onChange={(e) => setAccForm({ ...accForm, customName: e.target.value })} placeholder="Ej: Davivienda Ahorros" className={inputClass} required />
                </div>
              )}

              <div>
                <label className="text-xs text-gray-500 block mb-1">Saldo actual</label>
                <input value={accForm.balance} onChange={(e) => setAccForm({ ...accForm, balance: e.target.value })} placeholder="500000" inputMode="numeric" className={inputClass} />
              </div>
            </form>

            <div
              className="px-5 pt-3 border-t border-bg-border shrink-0 flex gap-2"
              style={{ paddingBottom: 'max(1.5rem, env(safe-area-inset-bottom, 0px))' }}
            >
              <button type="button" onClick={closeAccModal} className="flex-1 py-2.5 bg-bg-elevated border border-bg-border text-gray-400 text-sm rounded-xl">Cancelar</button>
              <button type="submit" form="account-form" className="flex-1 py-2.5 bg-accent-indigo hover:bg-accent-indigo/80 text-white text-sm font-medium rounded-xl transition-colors">Guardar</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
