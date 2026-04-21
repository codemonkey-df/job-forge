import { lazy, Suspense, useEffect, useState } from 'react'
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { Loader2 } from 'lucide-react'
import { Toaster } from '@/components/ui/toaster'
import { useSettingsStore } from '@/store/settingsStore'
import { useAuthStore } from '@/store/authStore'
import { hasProfile } from '@/lib/db/profile'
import { AppShell } from '@/components/layout/AppShell'
import './index.css'

const Dashboard = lazy(() => import('@/pages/Dashboard'))
const Profile = lazy(() => import('@/pages/Profile'))
const NewJob = lazy(() => import('@/pages/NewJob'))
const JobAnalysis = lazy(() => import('@/pages/JobAnalysis'))
const Settings = lazy(() => import('@/pages/Settings'))
const LLMConfig = lazy(() => import('@/components/onboarding/LLMConfig').then(m => ({ default: m.LLMConfig })))
const ProfileCreationEntry = lazy(() => import('@/components/onboarding/ProfileCreationEntry').then(m => ({ default: m.ProfileCreationEntry })))
const ProfileOnboarding = lazy(() => import('@/components/onboarding/ProfileOnboarding').then(m => ({ default: m.ProfileOnboarding })))

import Welcome from '@/pages/Welcome'

type OnboardingStage = 'checking' | 'llm-config' | 'profile-entry' | 'profile-form' | 'done'

function PageLoader() {
  return (
    <div className="flex items-center justify-center h-64">
      <Loader2 className="size-6 animate-spin text-muted-foreground" />
    </div>
  )
}

function FullPageLoader() {
  return (
    <div className="min-h-screen flex items-center justify-center">
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

function AuthGuard() {
  const { isLoggedIn, isLoading: authLoading, checkAuthStatus } = useAuthStore()
  const loadSettings = useSettingsStore((s) => s.loadSettings)
  const [stage, setStage] = useState<OnboardingStage>('checking')
  const [prefillData, setPrefillData] = useState<Record<string, any> | undefined>()

  useEffect(() => {
    checkAuthStatus()
    loadSettings()
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (authLoading || !isLoggedIn) return
    hasProfile().then((exists) => {
      setStage(exists ? 'done' : 'llm-config')
    })
  }, [isLoggedIn, authLoading])

  if (authLoading || stage === 'checking') {
    return <FullPageLoader />
  }

  if (!isLoggedIn) {
    return <Navigate to="/" replace />
  }

  return (
    <>
      <AppShell />

      <Suspense fallback={null}>
        <LLMConfig
          open={stage === 'llm-config'}
          onOpenChange={() => {}}
          onComplete={() => setStage('profile-entry')}
        />
        <ProfileCreationEntry
          open={stage === 'profile-entry'}
          onOpenChange={() => {}}
          onManual={(prefill) => {
            setPrefillData(prefill)
            setStage('profile-form')
          }}
          onComplete={() => setStage('done')}
        />
        <ProfileOnboarding
          open={stage === 'profile-form'}
          onOpenChange={() => {}}
          prefill={prefillData}
          onComplete={() => setStage('done')}
        />
      </Suspense>
    </>
  )
}

export default function App() {
  return (
    <BrowserRouter>
      <ThemeManager />
      <Routes>
        <Route path="/" element={<Welcome />} />
        <Route element={<AuthGuard />}>
          <Route path="/dashboard" element={<Suspense fallback={<PageLoader />}><Dashboard /></Suspense>} />
          <Route path="/profile" element={<Suspense fallback={<PageLoader />}><Profile /></Suspense>} />
          <Route path="/jobs/new" element={<Suspense fallback={<PageLoader />}><NewJob /></Suspense>} />
          <Route path="/jobs/:id" element={<Suspense fallback={<PageLoader />}><JobAnalysis /></Suspense>} />
          <Route path="/settings" element={<Suspense fallback={<PageLoader />}><Settings /></Suspense>} />
        </Route>
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
      <Toaster />
    </BrowserRouter>
  )
}
