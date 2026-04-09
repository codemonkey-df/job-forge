import { Outlet, useLocation } from 'react-router-dom'
import { Sidebar } from './Sidebar'
import { Header } from './Header'

const pageTitles: Record<string, string> = {
  '/': 'Dashboard',
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
  const title = getTitle(location.pathname)

  return (
    <div className="flex min-h-screen bg-background">
      <Sidebar />
      <div className="flex flex-col flex-1 min-w-0">
        <Header title={title} />
        <main className="flex-1 p-6 overflow-auto">
          <Outlet />
        </main>
      </div>
    </div>
  )
}
