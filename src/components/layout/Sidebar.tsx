import { useState } from 'react'
import { NavLink } from 'react-router-dom'
import { LayoutDashboard, User, Settings, Briefcase, ChevronLeft, ChevronRight } from 'lucide-react'
import { cn } from '@/lib/utils'
import { useProfileStore } from '@/store/profileStore'
import { calculateProfileCompleteness } from '@/lib/utils/auth'

const navItems = [
  { to: '/dashboard', icon: LayoutDashboard, label: 'Dashboard' },
  { to: '/profile', icon: User, label: 'My Profile' },
  { to: '/settings', icon: Settings, label: 'Settings' },
]

export function Sidebar() {
  const { profile, isLoading } = useProfileStore()
  const completeness = profile ? calculateProfileCompleteness(profile) : 0
  const showLoadingState = isLoading && profile === null

  const [collapsed, setCollapsed] = useState(() =>
    localStorage.getItem('sidebar-collapsed') === 'true'
  )

  function toggle() {
    setCollapsed((c) => {
      const next = !c
      localStorage.setItem('sidebar-collapsed', String(next))
      return next
    })
  }

  return (
    <aside className={cn(
      'flex flex-col shrink-0 border-r bg-sidebar h-screen transition-all duration-200 overflow-hidden',
      collapsed ? 'w-14' : 'w-56',
    )}>
      {/* Logo */}
      <div className={cn(
        'flex items-center border-b shrink-0',
        collapsed ? 'justify-center px-0 py-5 h-[61px]' : 'gap-2 px-5 py-5',
      )}>
        <Briefcase className="size-5 text-primary shrink-0" />
        {!collapsed && <span className="font-bold text-lg tracking-tight">job-forge</span>}
      </div>

      {/* Nav */}
      <nav className="flex-1 py-4 px-2 space-y-0.5">
        {navItems.map(({ to, icon: Icon, label }) => (
          <NavLink
            key={to}
            to={to}
            end={to === '/dashboard'}
            title={collapsed ? label : undefined}
            className={({ isActive }) =>
              cn(
                'flex items-center gap-3 py-2 rounded-md text-sm font-medium transition-colors',
                collapsed ? 'justify-center px-2' : 'px-3',
                isActive
                  ? 'bg-sidebar-primary text-sidebar-primary-foreground border-l-2 border-primary rounded-l-none'
                  : 'text-sidebar-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground',
              )
            }
          >
            <Icon className="size-4 opacity-80 shrink-0" />
            {!collapsed && label}
          </NavLink>
        ))}
      </nav>

      {/* Toggle button */}
      <div className={cn('px-2 pb-2', collapsed ? 'flex justify-center' : '')}>
        <button
          onClick={toggle}
          title={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
          className={cn(
            'flex items-center gap-2 py-1.5 rounded-md text-xs font-medium text-muted-foreground hover:text-foreground hover:bg-sidebar-accent transition-colors',
            collapsed ? 'justify-center w-10 px-0' : 'px-3 w-full',
          )}
        >
          {collapsed ? <ChevronRight className="size-4 shrink-0" /> : (
            <>
              <ChevronLeft className="size-4 shrink-0" />
              <span>Collapse</span>
            </>
          )}
        </button>
      </div>

      {/* Profile completeness footer */}
      {!collapsed && (
        <div className="px-5 py-4 border-t">
          <div className="flex items-center justify-between mb-1.5">
            <span className="text-xs text-muted-foreground">Profile</span>
            <span className={cn(
              'text-xs font-semibold',
              showLoadingState
                ? 'text-muted-foreground'
                : completeness >= 80
                  ? 'text-emerald-500'
                  : completeness >= 40
                    ? 'text-amber-500'
                    : 'text-muted-foreground',
            )}>
              {showLoadingState ? '...' : `${completeness}%`}
            </span>
          </div>
          <div className="h-1 bg-muted rounded-full overflow-hidden">
            <div
              className={cn(
                'h-full rounded-full transition-all duration-500',
                showLoadingState
                  ? 'bg-muted-foreground/40'
                  : completeness >= 80
                    ? 'bg-emerald-500'
                    : completeness >= 40
                      ? 'bg-amber-500'
                      : 'bg-muted-foreground',
              )}
              style={{ width: showLoadingState ? '35%' : `${completeness}%` }}
            />
          </div>
        </div>
      )}
    </aside>
  )
}
