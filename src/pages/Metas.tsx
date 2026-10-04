import { useState } from 'react'
import { Link } from 'react-router-dom'
import { Plus, ArrowLeft } from 'lucide-react'
import { Header } from '@/components/layout/Header'
import { GoalCard } from '@/components/goals/GoalCard'
import { GoalForm } from '@/components/goals/GoalForm'
import { useGoals } from '@/hooks/useLists'
import { useDeleteWithUndo } from '@/hooks/useDeleteWithUndo'
import { formatCOP } from '@/lib/currency'
import { iconButton } from '@/components/ui/styles'
import type { Goal } from '@/types'

export function Metas() {
  const { goals, loading, createGoal, updateGoal, addToGoal } = useGoals()
  const [showForm, setShowForm] = useState(false)
  const [editing, setEditing] = useState<Goal | null>(null)
  const confirmDelete = useDeleteWithUndo()

  const deleteGoal = (goal: Goal) => confirmDelete({
    kind: 'goal',
    id: goal.id,
    title: '¿Eliminar esta meta?',
    details: [
      { label: 'Meta', value: goal.name },
      { label: 'Ahorrado', value: `${formatCOP(goal.saved_amount)} de ${formatCOP(goal.target_amount)}` },
    ],
    doneMessage: `Meta ${goal.name} eliminada`,
  })

  return (
    <div className="px-4 pt-4">
      <Header
        title="Metas de ahorro"
        subtitle="Tus objetivos"
        showMonth={false}
        right={
          <>
            <button
              type="button"
              onClick={() => setShowForm(true)}
              aria-label="Nueva meta"
              className="inline-flex items-center justify-center w-9 h-9 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white"
            >
              <Plus size={18} aria-hidden="true" />
            </button>
            <Link to="/" className={iconButton} aria-label="Volver a Hoy">
              <ArrowLeft size={18} aria-hidden="true" />
            </Link>
          </>
        }
      />

      {loading ? (
        <div className="space-y-3" aria-hidden="true">
          {[1, 2].map((i) => <div key={i} className="h-32 bg-bg-card border border-bg-border rounded-xl animate-pulse" />)}
        </div>
      ) : goals.length === 0 ? (
        <div className="text-center py-16 text-gray-400">
          <p className="text-4xl mb-3" aria-hidden="true">🎯</p>
          <p className="text-sm">Crea una meta de ahorro con el botón +</p>
        </div>
      ) : (
        <div className="space-y-3">
          {goals.map((g) => (
            <GoalCard key={g.id} goal={g} onAdd={addToGoal} onEdit={setEditing} onDelete={deleteGoal} />
          ))}
        </div>
      )}

      {showForm && (
        <GoalForm
          onSave={async (data) => { await createGoal(data); setShowForm(false) }}
          onClose={() => setShowForm(false)}
        />
      )}
      {editing && (
        <GoalForm
          initial={editing}
          onSave={async (data) => { await updateGoal(editing.id, data); setEditing(null) }}
          onClose={() => setEditing(null)}
        />
      )}
    </div>
  )
}
