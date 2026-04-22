import { useEffect } from 'react'
import { Outlet, useLocation } from 'react-router-dom'
import { Sidebar } from './Sidebar'
import { Header } from './Header'
import { cn } from '@/lib/utils'
import { useProfileStore } from '@/store/profileStore'

const pageTitles: Record<string, string> = {
  '/dashboard': 'Dashboard',
  '/profile': 'My Profile',
  '/jobs/new': 'Analyze New Job',
  '/settings': 'Settings',
}

function getTitle(pathname: string): string {
  if (pageTitles[pathname]) return pageTitles[pathname]
  if (pathname.startsWith('/jobs/')) return 'Job Analysis'
  return 'job-forge'
}

export function AppShell() {
  const location = useLocation()
  const loadProfile = useProfileStore((state) => state.loadProfile)
  const title = getTitle(location.pathname)
  const isJobAnalysis = /^\/jobs\/\d+/.test(location.pathname)

  useEffect(() => {
    void loadProfile()
  }, [loadProfile])

  return (
    <div className="flex min-h-0 flex-1 bg-background overflow-hidden">
      <Sidebar />
      <div className="flex flex-col flex-1 min-w-0 overflow-hidden">
        <Header title={title} />
        <main className={cn(
          'flex-1 min-h-0 min-w-0',
          isJobAnalysis ? 'overflow-hidden flex flex-col' : 'p-6 overflow-y-auto overflow-x-hidden',
        )}>
          <Outlet />
        </main>
      </div>
    </div>
  )
}
