import { NavLink } from 'react-router-dom'
import { Home, PlusCircle, Layers, CreditCard } from 'lucide-react'

const links = [
  { to: '/', icon: Home, label: 'Hoy' },
  { to: '/registrar', icon: PlusCircle, label: 'Registrar' },
  { to: '/pagos', icon: Layers, label: 'Pagos' },
  { to: '/tarjetas', icon: CreditCard, label: 'Tarjetas' },
]

export function BottomNav() {
  return (
    <nav
      className="fixed bottom-0 left-0 right-0 z-50 bg-bg-card/95 backdrop-blur border-t border-bg-border"
      style={{ paddingBottom: 'env(safe-area-inset-bottom, 0px)' }}
    >
      <div className="flex items-stretch justify-around h-16 max-w-lg mx-auto">
        {links.map(({ to, icon: Icon, label }) => (
          <NavLink
            key={to}
            to={to}
            end={to === '/'}
            className={({ isActive }) =>
              `flex flex-col items-center justify-center gap-1 flex-1 min-w-0 transition-colors ${
                isActive ? 'text-accent-indigo' : 'text-gray-500 active:text-gray-300'
              }`
            }
          >
            <Icon size={22} strokeWidth={1.9} />
            <span className="text-[11px] font-medium truncate">{label}</span>
          </NavLink>
        ))}
      </div>
    </nav>
  )
}
