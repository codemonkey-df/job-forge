import { Moon, Sun } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { useSettingsStore } from '@/store/settingsStore'

export function Header({ title }: { title: string }) {
  const { theme, setTheme } = useSettingsStore()

  function toggleTheme() {
    setTheme(theme === 'dark' ? 'light' : 'dark')
  }

  return (
    <header className="flex items-center justify-between h-14 px-6 border-b bg-background">
      <h1 className="text-base font-semibold">{title}</h1>
      <Button variant="ghost" size="icon" onClick={toggleTheme} aria-label="Toggle theme">
        {theme === 'dark' ? <Sun className="size-4" /> : <Moon className="size-4" />}
      </Button>
    </header>
  )
}
