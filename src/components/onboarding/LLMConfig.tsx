import { useSettingsStore } from '@/store/settingsStore'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog'
import type { LLMProvider } from '@/types/settings'

interface LLMConfigProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  onComplete: () => void
}

const defaultModels: Record<LLMProvider, string> = {
  anthropic: 'claude-sonnet-4-6',
  google: 'gemini-2.0-flash',
  ollama: 'llama3.2',
  proxy: 'gemma-4e4b',
}

const providerLabels: Record<LLMProvider, string> = {
  anthropic: 'Anthropic (Claude)',
  google: 'Google Gemini',
  ollama: 'Ollama (local)',
  proxy: 'Custom Proxy',
}

export function LLMConfig({ open, onOpenChange, onComplete }: LLMConfigProps) {
  const { llm, setLLMSettings } = useSettingsStore()

  function onProviderChange(value: string) {
    const p = value as LLMProvider
    const baseUrl =
      p === 'ollama' ? 'http://localhost:11434/api'
      : p === 'proxy' ? 'http://localhost:8080/v1'
      : ''
    setLLMSettings({ ...llm, provider: p, baseUrl, model: llm.model || defaultModels[p] })
  }

  return (
    <Dialog open={open} onOpenChange={(isOpen) => {
      // Only allow closing via the Skip button (which calls onComplete)
      if (!isOpen) {
        // User clicked outside or pressed Escape - prevent closing
        return
      }
      onOpenChange(isOpen)
    }}>
      <DialogContent className="sm:max-w-md" onCloseAutoFocus={(e) => e.preventDefault()}>
        <DialogHeader>
          <DialogTitle>Configure AI Provider</DialogTitle>
          <DialogDescription>
            Set up your AI provider for automatic CV parsing and profile extraction.
            This is optional but recommended.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          <div className="space-y-2">
            <Label>Provider</Label>
            <Select value={llm.provider} onValueChange={onProviderChange}>
              <SelectTrigger>
                <SelectValue placeholder="Select provider" />
              </SelectTrigger>
              <SelectContent>
                {(Object.keys(providerLabels) as LLMProvider[]).map((p) => (
                  <SelectItem key={p} value={p}>{providerLabels[p]}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {llm.provider !== 'ollama' && (
            <div className="space-y-2">
              <Label>API Key</Label>
              <Input
                type="password"
                placeholder={llm.provider === 'proxy' ? 'API key (optional)' : 'sk-...'}
                value={llm.apiKey || ''}
                onChange={(e) => setLLMSettings({ ...llm, apiKey: e.target.value })}
              />
            </div>
          )}

          {(llm.provider === 'ollama' || llm.provider === 'proxy') && (
            <div className="space-y-2">
              <Label>Base URL</Label>
              <Input
                placeholder={llm.provider === 'ollama' ? 'http://localhost:11434/api' : 'http://your-host:port/v1'}
                value={llm.baseUrl || ''}
                onChange={(e) => setLLMSettings({ ...llm, baseUrl: e.target.value })}
              />
              {llm.provider === 'proxy' && (
                <p className="text-xs text-muted-foreground">
                  Must be an OpenAI-compatible endpoint (e.g. LM Studio, vLLM, llama.cpp server).
                </p>
              )}
            </div>
          )}

          <div className="space-y-2">
            <Label>Model</Label>
            <Input
              placeholder={defaultModels[llm.provider as LLMProvider]}
              value={llm.model || ''}
              onChange={(e) => setLLMSettings({ ...llm, model: e.target.value })}
            />
          </div>
          <div className="p-3 bg-muted rounded-md text-xs text-muted-foreground">
            Your API key is stored in sessionStorage (cleared on tab close) for security.
          </div>
        </div>
        <div className="flex justify-end gap-2">
          <Button variant="outline" onClick={onComplete}>
            Skip for now
          </Button>
          <Button onClick={onComplete}>
            Save & Continue
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}
