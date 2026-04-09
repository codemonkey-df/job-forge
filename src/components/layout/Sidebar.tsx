import { NavLink } from 'react-router-dom'
import { LayoutDashboard, User, PlusCircle, Settings, Briefcase } from 'lucide-react'
import { cn } from '@/lib/utils'

const navItems = [
  { to: '/', icon: LayoutDashboard, label: 'Dashboard' },
  { to: '/profile', icon: User, label: 'My Profile' },
  { to: '/jobs/new', icon: PlusCircle, label: 'Analyze Job' },
  { to: '/settings', icon: Settings, label: 'Settings' },
]

export function Sidebar() {
  return (
    <aside className="flex flex-col w-60 shrink-0 border-r bg-sidebar h-screen sticky top-0">
      <div className="flex items-center gap-2 px-6 py-5 border-b">
        <Briefcase className="size-5 text-primary" />
        <span className="font-bold text-lg tracking-tight">job-forge</span>
      </div>
      <nav className="flex-1 py-4 px-3 space-y-1">
        {navItems.map(({ to, icon: Icon, label }) => (
          <NavLink
            key={to}
            to={to}
            end={to === '/'}
            className={({ isActive }) =>
              cn(
                'flex items-center gap-3 px-3 py-2 rounded-md text-sm font-medium transition-colors',
                isActive
                  ? 'bg-sidebar-primary text-sidebar-primary-foreground'
                  : 'text-sidebar-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground',
              )
            }
          >
            <Icon className="size-4" />
            {label}
          </NavLink>
        ))}
      </nav>
    </aside>
  )
}
