import { generateObject, generateText, streamText } from 'ai'
import type { z, ZodTypeAny } from 'zod'
import { buildModel } from './providers'
import { useSettingsStore } from '../../store/settingsStore'

function isConnectionError(msg: string): boolean {
  return (
    msg.includes('Failed to fetch') ||
    msg.includes('ERR_CONNECTION_TIMED_OUT') ||
    msg.includes('ERR_CONNECTION_REFUSED') ||
    msg.includes('ECONNREFUSED') ||
    msg.includes('ENOTFOUND') ||
    msg.toLowerCase().includes('timeout') ||
    msg.includes('NetworkError')
  )
}

function toFriendlyLLMError(err: unknown): Error {
  const message = err instanceof Error ? err.message : String(err)
  if (!isConnectionError(message)) {
    return err instanceof Error ? err : new Error(message)
  }

  const settings = useSettingsStore.getState().llm
  const endpoint =
    settings.provider === 'proxy' || settings.provider === 'ollama'
      ? settings.baseUrl || '(base URL not configured)'
      : settings.provider

  return new Error(
    `LLM provider unreachable (${endpoint}). Check Settings -> LLM provider and ensure the server is running. Original error: ${message}`,
  )
}

// Extract the outermost JSON object from a text that may have surrounding noise
function extractJsonFromText(text: string): string {
  const start = text.indexOf('{')
  if (start === -1) throw new Error('No JSON object found in response')
  let depth = 0
  let inString = false
  let escape = false
  for (let i = start; i < text.length; i++) {
    const ch = text[i]
    if (escape) { escape = false; continue }
    if (ch === '\\' && inString) { escape = true; continue }
    if (ch === '"') { inString = !inString; continue }
    if (inString) continue
    if (ch === '{') depth++
    if (ch === '}') { depth--; if (depth === 0) return text.slice(start, i + 1) }
  }
  throw new Error('Malformed JSON: unbalanced braces')
}

export async function extractStructured<Schema extends ZodTypeAny>(opts: {
  prompt: string
  schema: Schema
  systemPrompt?: string
}): Promise<z.output<Schema>> {
  const settings = useSettingsStore.getState().llm
  const model = buildModel(settings)

  // First attempt: generateObject (structured output / tool-call / JSON mode)
  try {
    const { object } = await generateObject({
      model,
      schema: opts.schema,
      system: opts.systemPrompt,
      prompt: opts.prompt,
      temperature: settings.temperature ?? 0.2,
      mode: 'auto',
      onError: (error: Error) => {
        console.warn('AI generation warning (will attempt repair):', error.message)
      },
    })
    return object as z.output<Schema>
  } catch (firstError) {
    const err = firstError as Error
    if (isConnectionError(err.message)) {
      throw new Error('LLM provider unreachable. Please check your settings. Error: ' + err.message)
    }
    // Fall through to text-based fallback for parse / schema errors
  }

  // Second attempt: generateText + manual JSON extraction
  // Used for proxy/local models that don't support structured output
  try {
    const { text } = await generateText({
      model,
      system:
        (opts.systemPrompt ?? '') +
        '\n\nIMPORTANT: Respond with ONLY a single valid JSON object. No markdown fences, no explanations, no text before or after the JSON.',
      prompt: opts.prompt,
      temperature: 0.1,
    })
    const jsonStr = extractJsonFromText(text)
    const parsed = JSON.parse(jsonStr)
    const result = opts.schema.safeParse(parsed)
    if (result.success) return result.data
    // Zod parse failed — return raw parsed object (schema is lenient with optional fields)
    return parsed as z.output<Schema>
  } catch (fallbackError) {
    const fbErr = fallbackError as Error
    if (isConnectionError(fbErr.message)) {
      throw new Error('LLM provider unreachable. Please check your settings. Error: ' + fbErr.message)
    }
    throw new Error('Failed to extract profile from CV. The model response could not be parsed. Try a different provider or create your profile manually.')
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
    opts.onError?.(toFriendlyLLMError(err))
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
