import { useState } from 'react'
import { Plus } from 'lucide-react'
import { Header } from '@/components/layout/Header'
import { InstallmentCard } from '@/components/installments/InstallmentCard'
import { InstallmentForm } from '@/components/installments/InstallmentForm'
import { DebtCard } from '@/components/debts/DebtCard'
import { DebtForm } from '@/components/debts/DebtForm'
import { RecurringCard } from '@/components/recurring/RecurringCard'
import { RecurringForm } from '@/components/recurring/RecurringForm'
import { useInstallments } from '@/hooks/useInstallments'
import { useDebts } from '@/hooks/useDebts'
import { useRecurring } from '@/hooks/useRecurring'
import { formatCOP } from '@/lib/currency'

type Tab = 'installments' | 'debts' | 'recurring'

export function Pagos() {
  const [tab, setTab] = useState<Tab>('installments')
  const [showForm, setShowForm] = useState(false)
  const [editingInstallment, setEditingInstallment] = useState<import('@/types').Installment | null>(null)
  const [editingDebt, setEditingDebt] = useState<import('@/types').Debt | null>(null)
  const [editingRecurring, setEditingRecurring] = useState<import('@/types').Recurring | null>(null)

  const { installments, loading, createInstallment, updateInstallment, payInstallment, deleteInstallment,
    updateInstallmentAmount } = useInstallments()
  const { debts, loading: debtsLoading, createDebt, updateDebt, toggleDebtPaid, deleteDebt } = useDebts()
  const { recurring, pending: pendingRecurring, loading: recLoading, createRecurring, updateRecurring, postRecurring, deleteRecurring } = useRecurring()

  const active = installments.filter((i) => i.paid_months < i.total_months)
  const completed = installments.filter((i) => i.paid_months >= i.total_months)
  const totalMonthly = active.reduce((sum, i) => sum + i.monthly_amount, 0)

  const pendingDebts = debts.filter((d) => d.paid === 0)
  const paidDebts = debts.filter((d) => d.paid === 1)
  const totalOwedToMe = pendingDebts.filter((d) => d.type === 'owed_to_me').reduce((s, d) => s + d.amount, 0)
  const totalIOwe = pendingDebts.filter((d) => d.type === 'i_owe').reduce((s, d) => s + d.amount, 0)

  const handleSaveInstallment = async (data: any) => {
    await createInstallment(data)
    setShowForm(false)
  }

  const handleSaveDebt = async (data: any) => {
    await createDebt(data)
    setShowForm(false)
  }

  const handleSaveRecurring = async (data: any) => {
    await createRecurring(data)
    setShowForm(false)
  }

  const totalRecurring = recurring.reduce((s, r) => s + r.amount, 0)

  const TITLES: Record<Tab, [string, string, string]> = {
    installments: ['Cuotas', 'Seguimiento de pagos mensuales', 'Nueva cuota'],
    debts: ['Deudas', 'Me deben y yo debo', 'Nueva deuda'],
    recurring: ['Pagos fijos', 'Arriendo, gym, suscripciones…', 'Nuevo fijo'],
  }

  return (
    <div className="px-4 py-4 md:px-6 md:py-6">
      <div className="flex items-start justify-between mb-3 gap-2">
        <Header title={TITLES[tab][0]} subtitle={TITLES[tab][1]} />
        <button
          onClick={() => setShowForm(true)}
          className="shrink-0 flex items-center gap-1.5 bg-accent-indigo hover:bg-accent-indigo/80 text-white text-sm px-3 py-2 rounded-lg transition-colors"
        >
          <Plus size={14} /> <span className="hidden sm:inline">{TITLES[tab][2]}</span>
        </button>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 mb-4 bg-bg-card border border-bg-border rounded-xl p-1 w-fit max-w-full overflow-x-auto">
        <button
          onClick={() => setTab('installments')}
          className={`shrink-0 px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
            tab === 'installments' ? 'bg-accent-indigo text-white' : 'text-gray-500 hover:text-gray-300'
          }`}
        >
          Cuotas
        </button>
        <button
          onClick={() => setTab('debts')}
          className={`shrink-0 px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
            tab === 'debts' ? 'bg-accent-indigo text-white' : 'text-gray-500 hover:text-gray-300'
          }`}
        >
          Deudas
          {pendingDebts.length > 0 && (
            <span className="ml-1.5 text-xs bg-bg-elevated px-1.5 py-0.5 rounded-full">{pendingDebts.length}</span>
          )}
        </button>
        <button
          onClick={() => setTab('recurring')}
          className={`shrink-0 px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
            tab === 'recurring' ? 'bg-accent-indigo text-white' : 'text-gray-500 hover:text-gray-300'
          }`}
        >
          Fijos
          {pendingRecurring.length > 0 && (
            <span className="ml-1.5 text-xs bg-accent-yellow/20 text-accent-yellow px-1.5 py-0.5 rounded-full">{pendingRecurring.length}</span>
          )}
        </button>
      </div>

      {/* ─── Tab Cuotas ─── */}
      {tab === 'installments' && (
        <>
          {active.length > 0 && (
            <p className="text-xs text-gray-500 mb-4">
              Compromiso mensual: <span className="text-accent-yellow font-medium">{formatCOP(totalMonthly)}</span>
            </p>
          )}

          {loading ? (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {[1, 2, 3, 4].map((i) => <div key={i} className="h-40 bg-bg-card border border-bg-border rounded-xl animate-pulse" />)}
            </div>
          ) : (
            <>
              {active.length === 0 && completed.length === 0 && (
                <div className="text-center py-16 text-gray-600">
                  <p className="text-4xl mb-3">📋</p>
                  <p className="text-sm">Sin cuotas registradas</p>
                </div>
              )}
              {active.length > 0 && (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
                  {active.map((inst) => (
                    <InstallmentCard key={inst.id} installment={inst} onPay={payInstallment} onEdit={setEditingInstallment} onDelete={deleteInstallment} onUpdateAmount={updateInstallmentAmount} />
                  ))}
                </div>
              )}
              {completed.length > 0 && (
                <>
                  <p className="text-xs text-gray-600 mb-3">Completadas</p>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {completed.map((inst) => (
                      <InstallmentCard key={inst.id} installment={inst} onPay={payInstallment} onEdit={setEditingInstallment} onDelete={deleteInstallment} onUpdateAmount={updateInstallmentAmount} />
                    ))}
                  </div>
                </>
              )}
            </>
          )}
        </>
      )}

      {/* ─── Tab Deudas ─── */}
      {tab === 'debts' && (
        <>
          {pendingDebts.length > 0 && (
            <div className="flex flex-wrap gap-x-4 gap-y-1 mb-4 text-sm">
              <span className="text-gray-500">Me deben: <span className="text-accent-green font-medium">{formatCOP(totalOwedToMe)}</span></span>
              <span className="text-gray-500">Yo debo: <span className="text-accent-red font-medium">{formatCOP(totalIOwe)}</span></span>
              <span className="text-gray-500">Balance: <span className={totalOwedToMe - totalIOwe >= 0 ? 'text-accent-cyan font-medium' : 'text-accent-red font-medium'}>
                {formatCOP(totalOwedToMe - totalIOwe)}
              </span></span>
            </div>
          )}

          {debtsLoading ? (
            <div className="space-y-2">
              {[1, 2, 3].map((i) => <div key={i} className="h-20 bg-bg-card border border-bg-border rounded-xl animate-pulse" />)}
            </div>
          ) : debts.length === 0 ? (
            <div className="text-center py-16 text-gray-600">
              <p className="text-4xl mb-3">🤝</p>
              <p className="text-sm">Anota lo que te deben y lo que debes</p>
              <p className="text-xs text-gray-700 mt-1">Préstamos a amigos, plata del trabajo, lo que sea</p>
            </div>
          ) : (
            <div className="space-y-2">
              {pendingDebts.map((debt) => (
                <DebtCard key={debt.id} debt={debt} onTogglePaid={toggleDebtPaid} onEdit={setEditingDebt} onDelete={deleteDebt} />
              ))}
              {paidDebts.length > 0 && (
                <>
                  <p className="text-xs text-gray-600 pt-3 pb-1">Saldadas</p>
                  {paidDebts.map((debt) => (
                    <DebtCard key={debt.id} debt={debt} onTogglePaid={toggleDebtPaid} onEdit={setEditingDebt} onDelete={deleteDebt} />
                  ))}
                </>
              )}
            </div>
          )}
        </>
      )}

      {/* ─── Tab Fijos ─── */}
      {tab === 'recurring' && (
        <>
          {recurring.length > 0 && (
            <p className="text-xs text-gray-500 mb-4">
              Total fijo mensual: <span className="text-accent-yellow font-medium">{formatCOP(totalRecurring)}</span>
              {pendingRecurring.length > 0 && (
                <span className="ml-2 text-accent-yellow">· {pendingRecurring.length} pendiente{pendingRecurring.length === 1 ? '' : 's'} este mes</span>
              )}
            </p>
          )}

          {recLoading ? (
            <div className="space-y-2">
              {[1, 2, 3].map((i) => <div key={i} className="h-16 bg-bg-card border border-bg-border rounded-xl animate-pulse" />)}
            </div>
          ) : recurring.length === 0 ? (
            <div className="text-center py-16 text-gray-600">
              <p className="text-4xl mb-3">🔁</p>
              <p className="text-sm">Registra tus pagos fijos del mes</p>
              <p className="text-xs text-gray-700 mt-1">Arriendo, gym, Netflix, plan del celular…</p>
            </div>
          ) : (
            <div className="space-y-2">
              {recurring.map((item) => (
                <RecurringCard key={item.id} item={item} onPost={postRecurring} onEdit={setEditingRecurring} onDelete={deleteRecurring} />
              ))}
            </div>
          )}
        </>
      )}

      {/* Formularios de creación */}
      {showForm && tab === 'installments' && <InstallmentForm onSave={handleSaveInstallment} onClose={() => setShowForm(false)} />}
      {showForm && tab === 'debts' && <DebtForm onSave={handleSaveDebt} onClose={() => setShowForm(false)} />}
      {showForm && tab === 'recurring' && <RecurringForm onSave={handleSaveRecurring} onClose={() => setShowForm(false)} />}

      {/* Formularios de edición */}
      {editingInstallment && (
        <InstallmentForm
          initial={editingInstallment}
          onSave={async (data) => { await updateInstallment(editingInstallment.id, data); setEditingInstallment(null) }}
          onClose={() => setEditingInstallment(null)}
        />
      )}
      {editingDebt && (
        <DebtForm
          initial={editingDebt}
          onSave={async (data) => { await updateDebt(editingDebt.id, data); setEditingDebt(null) }}
          onClose={() => setEditingDebt(null)}
        />
      )}
      {editingRecurring && (
        <RecurringForm
          initial={editingRecurring}
          onSave={async (data) => { await updateRecurring(editingRecurring.id, data); setEditingRecurring(null) }}
          onClose={() => setEditingRecurring(null)}
        />
      )}
    </div>
  )
}
