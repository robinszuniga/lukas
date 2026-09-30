import { useState } from 'react'
import { Link } from 'react-router-dom'
import { Plus, ArrowLeft } from 'lucide-react'
import { Header } from '@/components/layout/Header'
import { GoalCard } from '@/components/goals/GoalCard'
import { GoalForm } from '@/components/goals/GoalForm'
import { useGoals } from '@/hooks/useGoals'
import type { Goal } from '@/types'

export function Metas() {
  const { goals, loading, createGoal, updateGoal, addToGoal, deleteGoal } = useGoals()
  const [showForm, setShowForm] = useState(false)
  const [editing, setEditing] = useState<Goal | null>(null)

  return (
    <div className="px-4 pt-4">
      <Header
        title="Metas de ahorro"
        subtitle="Tus objetivos"
        showMonth={false}
        right={
          <>
            <button onClick={() => setShowForm(true)} className="p-2 rounded-lg bg-accent-indigo text-white" title="Nueva meta">
              <Plus size={18} />
            </button>
            <Link to="/" className="p-2 rounded-lg text-gray-400 hover:text-white" title="Volver">
              <ArrowLeft size={20} />
            </Link>
          </>
        }
      />

      {loading ? (
        <div className="space-y-3">
          {[1, 2].map((i) => <div key={i} className="h-32 bg-bg-card border border-bg-border rounded-xl animate-pulse" />)}
        </div>
      ) : goals.length === 0 ? (
        <div className="text-center py-16 text-gray-600">
          <p className="text-4xl mb-3">🎯</p>
          <p className="text-sm">Crea una meta de ahorro</p>
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
