import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { useState } from 'react'
import { CheckCircle, XCircle } from 'lucide-react'
import { Spinner } from '@/components/ui/spinner'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { useSettingsStore, persistSettings } from '@/store/settingsStore'
import { testConnection } from '@/lib/llm/client'
import type { LLMProvider } from '@/types/settings'

const schema = z.object({
  provider: z.enum(['anthropic', 'google', 'ollama', 'proxy']),
  apiKey: z.string().optional(),
  model: z.string().min(1, 'Model is required'),
  baseUrl: z.string().optional(),
  temperature: z.coerce.number().min(0).max(2).optional(),
})

type FormValues = z.infer<typeof schema>

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

export function LLMProviderConfig() {
  const { llm, setLLMSettings } = useSettingsStore()
  const [testStatus, setTestStatus] = useState<'idle' | 'testing' | 'ok' | 'error'>('idle')
  const [testError, setTestError] = useState('')

  const { register, handleSubmit, watch, setValue, formState: { errors } } = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: {
      provider: llm.provider,
      apiKey: llm.apiKey ?? '',
      model: llm.model,
      baseUrl: llm.baseUrl ?? '',
      temperature: llm.temperature ?? 0.3,
    },
  })

  const provider = watch('provider') as LLMProvider
  const currentModel = watch('model')
  const currentBaseUrl = watch('baseUrl')

  function onProviderChange(value: string) {
    const p = value as LLMProvider
    setValue('provider', p)
    // Only set default model if not already configured
    if (!currentModel) setValue('model', defaultModels[p])
    // Only set baseUrl for ollama or proxy if not already configured
    if (p === 'ollama' && !currentBaseUrl) setValue('baseUrl', 'http://localhost:11434/api')
    else if (p === 'proxy' && !currentBaseUrl) setValue('baseUrl', 'http://localhost:8080/v1')
    else if (p !== 'ollama' && p !== 'proxy') setValue('baseUrl', '')
  }

  function onSubmit(data: FormValues) {
    setLLMSettings({
      provider: data.provider,
      apiKey: data.apiKey,
      model: data.model,
      baseUrl: data.baseUrl,
      temperature: data.temperature,
    })
    persistSettings()  // Persist non-sensitive settings
    setTestStatus('idle')
  }

  async function handleTest() {
    handleSubmit(onSubmit)()
    setTestStatus('testing')
    setTestError('')
    try {
      await testConnection()
      setTestStatus('ok')
    } catch (err) {
      setTestStatus('error')
      const msg = err instanceof Error ? err.message : String(err)
      if (msg.includes('Failed to fetch') || msg.includes('ERR_CONNECTION_REFUSED') || msg.includes('NetworkError')) {
        setTestError('Cannot reach server — check the URL and make sure the proxy is running')
      } else if (msg.includes('401') || msg.includes('Unauthorized')) {
        setTestError('Invalid API key')
      } else if (msg.includes('404')) {
        setTestError('Endpoint not found — verify the base URL path (should end in /v1)')
      } else {
        setTestError(msg)
      }
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>LLM Provider</CardTitle>
        <CardDescription>Configure your AI model provider. Non-sensitive settings are saved locally. API keys are stored in memory only.</CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          <div className="space-y-2">
            <Label>Provider</Label>
            <Select value={provider} onValueChange={onProviderChange}>
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

          {provider !== 'ollama' && (
            <div className="space-y-2">
              <Label>API Key</Label>
              <Input
                type="password"
                placeholder={provider === 'proxy' ? 'API key (optional)' : 'sk-...'}
                {...register('apiKey')}
              />
            </div>
          )}

          {(provider === 'ollama' || provider === 'proxy') && (
            <div className="space-y-2">
              <Label>Base URL</Label>
              <Input
                placeholder={provider === 'ollama' ? 'http://localhost:11434/api' : 'http://your-host:port/v1'}
                {...register('baseUrl')}
              />
              {provider === 'proxy' && (
                <p className="text-xs text-muted-foreground">
                  Must be an OpenAI-compatible endpoint (e.g. LM Studio, vLLM, llama.cpp server).
                </p>
              )}
            </div>
          )}

          <div className="space-y-2">
            <Label>Model</Label>
            <Input placeholder={defaultModels[provider]} {...register('model')} />
            {errors.model && <p className="text-xs text-destructive">{errors.model.message}</p>}
          </div>

          <div className="space-y-2">
            <Label>Temperature (0–2)</Label>
            <Input type="number" step="0.1" min="0" max="2" {...register('temperature')} />
          </div>

          <div className="flex items-center gap-3 pt-2">
            <Button type="submit">Save Settings</Button>
            <Button type="button" variant="outline" onClick={handleTest} disabled={testStatus === 'testing'}>
              {testStatus === 'testing' && <Spinner size="sm" />}
              Test Connection
            </Button>
            {testStatus === 'ok' && (
              <span className="flex items-center gap-1 text-sm text-green-600">
                <CheckCircle className="size-4" /> Connected
              </span>
            )}
            {testStatus === 'error' && (
              <span className="flex items-center gap-1 text-sm text-destructive">
                <XCircle className="size-4" /> {testError}
              </span>
            )}
          </div>
        </form>
      </CardContent>
    </Card>
  )
}
