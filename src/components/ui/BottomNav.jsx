import { NavLink } from 'react-router-dom'
import {
  FolderKanban,
  Home,
  LayoutGrid,
  MoreHorizontal,
  ReceiptText,
} from 'lucide-react'

const navItems = [
  { to: '/', label: 'Beranda', icon: Home, end: true },
  { to: '/transactions', label: 'Transaksi', icon: ReceiptText },
  { to: '/projects', label: 'Proyek', icon: FolderKanban },
  { to: '/master', label: 'Master', icon: LayoutGrid },
  { to: '/more', label: 'Lainnya', icon: MoreHorizontal },
]

function BottomNav() {
  return (
    <nav className="fixed inset-x-0 bottom-0 z-50 mx-auto w-full max-w-md border-t border-[var(--app-border-color)] bg-[var(--app-surface-color)] px-2 pb-[max(0.5rem,env(safe-area-inset-bottom))] pt-2 backdrop-blur-xl">
      <div className="flex h-14 items-center justify-around gap-1">
        {navItems.map((item) => {
          const Icon = item.icon

          return (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.end}
              className={({ isActive }) =>
                `flex min-w-0 flex-1 flex-col items-center justify-center rounded-2xl px-1 py-1 text-[10px] font-medium transition ${
                  isActive
                    ? 'text-[var(--app-button-color)]'
                    : 'text-[var(--app-hint-color)] hover:text-[var(--app-text-color)]'
                }`
              }
            >
              <Icon className="h-4 w-4" aria-hidden="true" />
              <span className="mt-1 truncate leading-none">{item.label}</span>
            </NavLink>
          )
        })}
      </div>
    </nav>
  )
}

export default BottomNav
