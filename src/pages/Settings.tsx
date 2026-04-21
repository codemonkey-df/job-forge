import { useState } from 'react'
import { LLMProviderConfig } from '@/components/settings/LLMProviderConfig'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Label } from '@/components/ui/label'
import { Input } from '@/components/ui/input'
import { Switch } from '@/components/ui/switch'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { useSettingsStore } from '@/store/settingsStore'
import { useAuthStore } from '@/store/authStore'
import { useProfileStore } from '@/store/profileStore'
import { exportProfile, importProfile, saveProfile as saveProfileDB } from '@/lib/db/profile'
import { Button } from '@/components/ui/button'
import { useToast } from '@/hooks/use-toast'
import { Download, Upload, LogOut } from 'lucide-react'

export default function Settings() {
  const { theme, setTheme } = useSettingsStore()
  const { logout } = useAuthStore()
  const { profile } = useProfileStore()
  const { toast } = useToast()

  const [showOnlineStatus, setShowOnlineStatus] = useState(false)

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

  async function handleDeleteAccount() {
    if (!window.confirm('Are you sure? This will delete all your profile data.')) return
    try {
      await saveProfileDB({
        fullName: '',
        email: '',
        phone: '',
        location: '',
        linkedinUrl: '',
        portfolioUrl: '',
        summary: '',
        skills: [],
        experience: [],
        education: [],
        projects: [],
      })
      logout()
      toast({ title: 'Account deleted', description: 'All data has been removed.' })
    } catch (error) {
      console.error('Error deleting account:', error)
      toast({ title: 'Failed to delete account', variant: 'destructive' })
    }
  }

  return (
    <div className="space-y-6">
      {/* Page header */}
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-semibold">Settings</h1>
        <Button size="sm" onClick={() => toast({ title: 'Settings saved' })}>
          Save Changes
        </Button>
      </div>

      <Tabs defaultValue="general">
        <TabsList>
          <TabsTrigger value="general">General</TabsTrigger>
          <TabsTrigger value="ai">AI Settings</TabsTrigger>
          <TabsTrigger value="security">Security</TabsTrigger>
        </TabsList>

        {/* General tab */}
        <TabsContent value="general" className="mt-4">
          <Card>
            <CardContent className="space-y-5 pt-6">
              {/* Account Email */}
              <div className="space-y-1.5">
                <Label className="text-sm">Account Email</Label>
                <Input
                  value={profile?.email ?? ''}
                  readOnly
                  className="bg-muted/30 cursor-default"
                />
              </div>

              {/* Language + Timezone row */}
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <Label className="text-sm">Language</Label>
                  <Select defaultValue="en">
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="en">English</SelectItem>
                      <SelectItem value="fr">French</SelectItem>
                      <SelectItem value="de">German</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1.5">
                  <Label className="text-sm">Timezone</Label>
                  <Select defaultValue="utc">
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="utc">UTC (4th at 17:30 GMT)</SelectItem>
                      <SelectItem value="est">EST (Eastern)</SelectItem>
                      <SelectItem value="pst">PST (Pacific)</SelectItem>
                      <SelectItem value="cet">CET (Central European)</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              {/* Date Format */}
              <div className="space-y-1.5">
                <Label className="text-sm">Date Format</Label>
                <Select defaultValue="iso">
                  <SelectTrigger className="w-48">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="iso">2022-01-01</SelectItem>
                    <SelectItem value="us">01/01/2022</SelectItem>
                    <SelectItem value="eu">01.01.2022</SelectItem>
                  </SelectContent>
                </Select>
                <p className="text-xs text-muted-foreground">The shown date is in second device format.</p>
              </div>

              <div className="h-px bg-border" />

              {/* Dark Mode toggle */}
              <div className="flex items-center justify-between py-1">
                <div>
                  <p className="text-sm font-medium">Dark Mode</p>
                  <p className="text-xs text-muted-foreground">Use dark color scheme across the app</p>
                </div>
                <Switch
                  checked={theme === 'dark'}
                  onCheckedChange={(v) => setTheme(v ? 'dark' : 'light')}
                />
              </div>

              {/* Show Online Status */}
              <div className="flex items-center justify-between py-1">
                <div>
                  <p className="text-sm font-medium">Show Online Status</p>
                  <p className="text-xs text-muted-foreground">Let others see when you're active</p>
                </div>
                <Switch
                  checked={showOnlineStatus}
                  onCheckedChange={setShowOnlineStatus}
                />
              </div>

              <div className="h-px bg-border" />

              {/* Danger Zone */}
              <div className="pt-1">
                <p className="text-sm font-semibold text-destructive mb-1">Danger Zone</p>
                <p className="text-xs text-muted-foreground mb-3">
                  Permanently delete your account and all associated data. This cannot be undone.
                </p>
                <button
                  onClick={handleDeleteAccount}
                  className="text-sm text-destructive underline-offset-4 hover:underline font-medium"
                >
                  Delete Account
                </button>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* AI Settings tab */}
        <TabsContent value="ai" className="mt-4">
          <LLMProviderConfig />
        </TabsContent>

        {/* Security tab */}
        <TabsContent value="security" className="mt-4">
          <Card>
            <CardHeader>
              <CardTitle>Data Management</CardTitle>
              <CardDescription>Export or import your complete profile data.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex gap-3">
                <Button variant="outline" onClick={handleExport}>
                  <Download className="size-4" /> Export Profile
                </Button>
                <label>
                  <Button variant="outline" asChild>
                    <span><Upload className="size-4" /> Import Profile</span>
                  </Button>
                  <input type="file" accept=".json" className="hidden" onChange={handleImport} />
                </label>
              </div>
              <div className="h-px bg-border" />
              <Button variant="outline" onClick={logout}>
                <LogOut className="size-4" /> Logout
              </Button>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  )
}
