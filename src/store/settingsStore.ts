import { create } from 'zustand'
import type { AppSettings, LLMSettings, Theme } from '../types/settings'

interface SettingsState extends AppSettings {
  setLLMSettings: (settings: LLMSettings) => void
  setTheme: (theme: Theme) => void
}

// Helper to load persisted settings
// API key is stored in sessionStorage (survives reloads, cleared on tab close)
const loadPersistedSettings = (): Partial<AppSettings> => {
  try {
    const stored = localStorage.getItem('job-forge-settings')
    const sessionApiKey = sessionStorage.getItem('job-forge-api-key') ?? undefined
    if (stored) {
      const parsed = JSON.parse(stored)
      return {
        theme: parsed.theme,
        llm: {
          provider: parsed.llm?.provider,
          model: parsed.llm?.model,
          baseUrl: parsed.llm?.baseUrl,
          temperature: parsed.llm?.temperature,
          apiKey: sessionApiKey,
        },
      }
    }
    if (sessionApiKey) {
      return { llm: { provider: 'anthropic', model: '', apiKey: sessionApiKey } }
    }
  } catch {
    // Ignore errors
  }
  return {}
}

export const useSettingsStore = create<SettingsState>()(
  (set) => ({
    llm: {
      provider: 'anthropic',
      model: '',
      baseUrl: '',
      temperature: 0.3,
      ...loadPersistedSettings().llm,
    },
    theme: 'system',
    setLLMSettings: (llm) => set({ llm }),
    setTheme: (theme) => set({ theme }),
  }),
)

// Persist settings: non-sensitive to localStorage, API key to sessionStorage
export const persistSettings = () => {
  const state = useSettingsStore.getState()
  const toPersist = {
    theme: state.theme,
    llm: {
      provider: state.llm.provider,
      model: state.llm.model,
      baseUrl: state.llm.baseUrl,
      temperature: state.llm.temperature,
    },
  }
  try {
    localStorage.setItem('job-forge-settings', JSON.stringify(toPersist))
    // API key goes to sessionStorage — survives page reloads but cleared on tab/window close
    if (state.llm.apiKey) {
      sessionStorage.setItem('job-forge-api-key', state.llm.apiKey)
    } else {
      sessionStorage.removeItem('job-forge-api-key')
    }
  } catch (e) {
    console.error('Failed to persist settings:', e)
  }
}
