export type LLMProvider = 'anthropic' | 'google' | 'ollama' | 'proxy'

export interface LLMSettings {
  provider: LLMProvider
  apiKey?: string
  model: string
  baseUrl?: string
  temperature?: number
}

export type Theme = 'light' | 'dark' | 'system'

export interface AppSettings {
  llm: LLMSettings
  theme: Theme
}
