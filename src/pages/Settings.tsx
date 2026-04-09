import { LLMProviderConfig } from '@/components/settings/LLMProviderConfig'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Label } from '@/components/ui/label'
import { useSettingsStore } from '@/store/settingsStore'
import { exportProfile, importProfile } from '@/lib/db/profile'
import { Button } from '@/components/ui/button'
import { useToast } from '@/hooks/use-toast'
import { Download, Upload } from 'lucide-react'

export default function Settings() {
  const { theme, setTheme } = useSettingsStore()
  const { toast } = useToast()

  async function handleExport() {
    const json = await exportProfile()
    const blob = new Blob([json], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = 'job-forge-profile.json'
    a.click()
    URL.revokeObjectURL(url)
  }

  async function handleImport(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    try {
      const text = await file.text()
      await importProfile(text)
      toast({ title: 'Profile imported successfully' })
    } catch {
      toast({ title: 'Import failed', description: 'Invalid profile file.', variant: 'destructive' })
    }
    e.target.value = ''
  }

  return (
    <div className="max-w-2xl space-y-6">
      <LLMProviderConfig />

      <Card>
        <CardHeader>
          <CardTitle>Appearance</CardTitle>
          <CardDescription>Choose your preferred color theme.</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-2">
            <Label>Theme</Label>
            <Select value={theme} onValueChange={(v) => setTheme(v as 'light' | 'dark' | 'system')}>
              <SelectTrigger className="w-48">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="light">Light</SelectItem>
                <SelectItem value="dark">Dark</SelectItem>
                <SelectItem value="system">System</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Data Management</CardTitle>
          <CardDescription>Export or import your complete profile data.</CardDescription>
        </CardHeader>
        <CardContent className="flex gap-3">
          <Button variant="outline" onClick={handleExport}>
            <Download className="size-4" /> Export Profile
          </Button>
          <label>
            <Button variant="outline" asChild>
              <span><Upload className="size-4" /> Import Profile</span>
            </Button>
            <input type="file" accept=".json" className="hidden" onChange={handleImport} />
          </label>
        </CardContent>
      </Card>
    </div>
  )
}
