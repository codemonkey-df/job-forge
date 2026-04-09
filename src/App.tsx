import { lazy, Suspense, useEffect } from 'react'
import { BrowserRouter, Routes, Route } from 'react-router-dom'
import { Loader2 } from 'lucide-react'
import { AppShell } from '@/components/layout/AppShell'
import { Toaster } from '@/components/ui/toaster'
import { useSettingsStore } from '@/store/settingsStore'
import { useProfileStore } from '@/store/profileStore'
import { useJobStore } from '@/store/jobStore'
import './index.css'

const Dashboard = lazy(() => import('@/pages/Dashboard'))
const Profile = lazy(() => import('@/pages/Profile'))
const NewJob = lazy(() => import('@/pages/NewJob'))
const JobAnalysis = lazy(() => import('@/pages/JobAnalysis'))
const Settings = lazy(() => import('@/pages/Settings'))

function PageLoader() {
  return (
    <div className="flex items-center justify-center h-64">
      <Loader2 className="size-6 animate-spin text-muted-foreground" />
    </div>
  )
}

function ThemeManager() {
  const theme = useSettingsStore((s) => s.theme)
  useEffect(() => {
    const isDark =
      theme === 'dark' ||
      (theme === 'system' && window.matchMedia('(prefers-color-scheme: dark)').matches)
    document.documentElement.classList.toggle('dark', isDark)
  }, [theme])
  return null
}

function AppInit() {
  const loadProfile = useProfileStore((s) => s.loadProfile)
  const loadJobs = useJobStore((s) => s.loadJobs)
  useEffect(() => {
    loadProfile()
    loadJobs()
  }, [loadProfile, loadJobs])
  return null
}

export default function App() {
  return (
    <BrowserRouter>
      <ThemeManager />
      <AppInit />
      <Routes>
        <Route element={<AppShell />}>
          <Route index element={<Suspense fallback={<PageLoader />}><Dashboard /></Suspense>} />
          <Route path="profile" element={<Suspense fallback={<PageLoader />}><Profile /></Suspense>} />
          <Route path="jobs/new" element={<Suspense fallback={<PageLoader />}><NewJob /></Suspense>} />
          <Route path="jobs/:id" element={<Suspense fallback={<PageLoader />}><JobAnalysis /></Suspense>} />
          <Route path="settings" element={<Suspense fallback={<PageLoader />}><Settings /></Suspense>} />
        </Route>
      </Routes>
      <Toaster />
    </BrowserRouter>
  )
}
