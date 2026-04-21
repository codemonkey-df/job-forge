import { Moon, Sun } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { useSettingsStore } from '@/store/settingsStore'
import { useAuthStore } from '@/store/authStore'
import { useProfileStore } from '@/store/profileStore'
import { calculateProfileCompleteness } from '@/lib/utils/auth'

export function Header({ title }: { title: string }) {
  const { theme, setTheme } = useSettingsStore()
  const { profile } = useProfileStore()
  const { isLoggedIn } = useAuthStore()

  function toggleTheme() {
    setTheme(theme === 'dark' ? 'light' : 'dark')
  }

  const completeness = profile ? calculateProfileCompleteness(profile) : 0

  return (
    <header className="flex items-center justify-between h-14 px-6 border-b bg-background">
      <div className="flex items-center gap-4">
        <h1 className="text-base font-semibold">{title}</h1>
        {isLoggedIn && (
          <div className="flex items-center gap-2 text-xs">
            <span className="text-muted-foreground">Profile:</span>
            <div className="flex items-center gap-1">
              <div
                className={`h-2 w-2 rounded-full ${
                  completeness >= 80 ? 'bg-emerald-500' : completeness >= 40 ? 'bg-yellow-500' : 'bg-red-500'
                }`}
              />
              <span className="text-muted-foreground">{completeness}%</span>
            </div>
          </div>
        )}
      </div>
      <Button variant="ghost" size="icon" onClick={toggleTheme} aria-label="Toggle theme">
        {theme === 'dark' ? <Sun className="size-4" /> : <Moon className="size-4" />}
      </Button>
    </header>
  )
}
