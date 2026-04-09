import { generateObject, generateText, streamText } from 'ai'
import type { ZodType } from 'zod'
import { buildModel } from './providers'
import { useSettingsStore } from '../../store/settingsStore'

export async function extractStructured<T>(opts: {
  prompt: string
  schema: ZodType<T>
  systemPrompt?: string
}): Promise<T> {
  const settings = useSettingsStore.getState().llm
  const model = buildModel(settings)
  
  try {
    const { object } = await generateObject({
      model,
      schema: opts.schema,
      system: opts.systemPrompt,
      prompt: opts.prompt,
      temperature: settings.temperature ?? 0.2,
      mode: 'json', // Explicitly use JSON mode
      onError: (error: Error) => {
        console.warn('AI generation error (will attempt repair):', error.message)
      },
    })
    return object
  } catch (error) {
    const err = error as Error
    
    // Check if it's a connection error (LLM not configured or unreachable)
    if (err.message.includes('Failed to fetch') ||
        err.message.includes('ERR_CONNECTION_TIMED_OUT') ||
        err.message.includes('ECONNREFUSED') ||
        err.message.includes('ENOTFOUND')) {
      console.error('LLM connection error:', err)
      throw new Error('LLM provider unreachable. Please configure your LLM settings in Settings first. Error: ' + err.message)
    }
    
    // If repair failed, log the error and throw a user-friendly message
    console.error('AI object generation failed:', err)
    throw new Error(`Failed to extract structured data from CV. The LLM response did not match the expected schema. ${err.message}`)
  }
}

export async function streamMarkdown(opts: {
  prompt: string
  systemPrompt: string
  onChunk: (text: string) => void
  onFinish: (fullText: string) => void
  onError?: (err: Error) => void
}): Promise<void> {
  const settings = useSettingsStore.getState().llm
  const model = buildModel(settings)
  try {
    const result = streamText({
      model,
      system: opts.systemPrompt,
      prompt: opts.prompt,
      temperature: settings.temperature ?? 0.3,
    })
    let full = ''
    for await (const chunk of result.textStream) {
      full += chunk
      opts.onChunk(chunk)
    }
    opts.onFinish(full)
  } catch (err) {
    opts.onError?.(err instanceof Error ? err : new Error(String(err)))
  }
}

export async function testConnection(): Promise<void> {
  const settings = useSettingsStore.getState().llm
  if (!settings.model) throw new Error('No model configured')

  // Only require baseUrl for local/proxy providers
  if (settings.provider === 'ollama' || settings.provider === 'proxy') {
    if (!settings.baseUrl) throw new Error('No Base URL configured')
    try {
      new URL(settings.baseUrl)
    } catch {
      throw new Error('Invalid Base URL format')
    }
  }

  const model = buildModel(settings)
  // Use non-streaming generateText — more reliable with lazy-loading proxies
  // that need to cold-start the model before the first request completes
  try {
    const result = await generateText({
      model,
      prompt: 'Reply with exactly: OK',
      maxOutputTokens: 10,
      timeout: 30000, // 30 second timeout
    })
    // Validate that we got a real response
    if (!result.text || result.text.trim().length === 0) {
      throw new Error('Provider returned an empty response — the model may be unavailable')
    }
  } catch (err) {
    // Re-throw with clearer message if connection issue
    const msg = err instanceof Error ? err.message : String(err)
    if (msg.includes('Failed to fetch') ||
        msg.includes('ERR_CONNECTION_REFUSED') ||
        msg.includes('NetworkError') ||
        msg.includes('timeout')) {
      throw new Error('Cannot reach server — check the URL and make sure the proxy is running. Error: ' + msg)
    }
    throw err
  }
}
