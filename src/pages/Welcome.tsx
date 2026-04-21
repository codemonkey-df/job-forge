import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent } from '@/components/ui/card'
import { Briefcase } from 'lucide-react'
import { useAuthStore } from '@/store/authStore'

export default function Welcome() {
  const { login, checkAuthStatus, isLoggedIn, isLoading, user } = useAuthStore()
  const navigate = useNavigate()
  const [name, setName] = useState('')
  const [error, setError] = useState('')

  // Restore existing session and redirect if already logged in
  useEffect(() => {
    checkAuthStatus()
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (!isLoading && isLoggedIn) {
      navigate('/dashboard', { replace: true })
    }
  }, [isLoading, isLoggedIn, navigate])

  async function handleLogin() {
    try {
      setError('')
      if (!name.trim()) {
        setError('Please enter your name')
        return
      }
      await login(name.trim())
      navigate('/dashboard')
    } catch {
      setError('Something went wrong. Please try again.')
    }
  }

  async function handleContinue() {
    navigate('/dashboard')
  }

  // Show returning user view while auth check is running or user is known
  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-background via-background to-muted/20">
        <div className="text-muted-foreground text-sm">Loading...</div>
      </div>
    )
  }

  // "Welcome back" screen for recognised session (before redirect fires)
  if (isLoggedIn && user) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-background via-background to-muted/20 p-4">
        <Card className="w-full max-w-sm shadow-xl">
          <CardContent className="pt-8 pb-8 flex flex-col items-center gap-6">
            <Briefcase className="size-10 text-primary" />
            <div className="text-center">
              <h1 className="text-2xl font-bold mb-1">Welcome back, {user.name}!</h1>
              <p className="text-sm text-muted-foreground">Picking up where you left off.</p>
            </div>
            <Button className="w-full" onClick={handleContinue}>
              Continue to Dashboard
            </Button>
          </CardContent>
        </Card>
      </div>
    )
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-background via-background to-muted/20 p-4">
      <Card className="w-full max-w-sm shadow-xl">
        <CardContent className="pt-8">
          <div className="text-center mb-8">
            <div className="flex items-center justify-center gap-2 mb-3">
              <Briefcase className="size-7 text-primary" />
              <span className="text-2xl font-bold tracking-tight">job-forge</span>
            </div>
            <p className="text-muted-foreground text-sm">
              Your AI-powered job application assistant
            </p>
          </div>

          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="name">Your Name</Label>
              <Input
                id="name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleLogin()}
                placeholder="e.g. Jane Smith"
                autoFocus
              />
            </div>

            {error && (
              <div className="rounded-md bg-destructive/15 p-3 text-sm text-destructive">
                {error}
              </div>
            )}

            <Button onClick={handleLogin} className="w-full">
              Get Started
            </Button>
          </div>

          <p className="mt-6 text-center text-xs text-muted-foreground">
            All data is stored locally in your browser. Nothing is sent to any server.
          </p>
        </CardContent>
      </Card>
    </div>
  )
}
