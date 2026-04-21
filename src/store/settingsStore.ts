import { create } from 'zustand'
import type { AppSettings, LLMSettings, Theme } from '../types/settings'
import { kvGet, kvSet } from '../lib/db/kv'

interface SettingsState extends AppSettings {
  setLLMSettings: (settings: LLMSettings) => void
  setTheme: (theme: Theme) => void
  loadSettings: () => Promise<void>
}

const KV_KEY = 'llm-settings'
const THEME_LS_KEY = 'job-forge-theme'
const LEGACY_LS_KEY = 'job-forge-settings'

// Theme stays in localStorage — synchronous read prevents flash-of-wrong-theme
function getStoredTheme(): Theme {
  try {
    return (localStorage.getItem(THEME_LS_KEY) as Theme) ?? 'system'
  } catch {
    return 'system'
  }
}

export const useSettingsStore = create<SettingsState>()((set, get) => ({
  llm: {
    provider: 'anthropic',
    model: '',
    baseUrl: '',
    temperature: 0.3,
  },
  theme: getStoredTheme(),
  setLLMSettings: (llm) => {
    set({ llm })
    const { apiKey, ...toStore } = llm
    kvSet(KV_KEY, toStore).catch(() => {})
    if (apiKey) sessionStorage.setItem('job-forge-api-key', apiKey)
    else sessionStorage.removeItem('job-forge-api-key')
  },
  setTheme: (theme) => {
    set({ theme })
    try { localStorage.setItem(THEME_LS_KEY, theme) } catch {}
  },
  loadSettings: async () => {
    try {
      let stored = await kvGet<Omit<LLMSettings, 'apiKey'>>(KV_KEY)
      // Migrate from legacy localStorage on first run
      if (!stored) {
        const raw = localStorage.getItem(LEGACY_LS_KEY)
        if (raw) {
          const parsed = JSON.parse(raw)
          if (parsed.theme && !localStorage.getItem(THEME_LS_KEY)) {
            localStorage.setItem(THEME_LS_KEY, parsed.theme)
            set({ theme: parsed.theme as Theme })
          }
          if (parsed.llm) {
            stored = parsed.llm
            await kvSet(KV_KEY, stored)
          }
          localStorage.removeItem(LEGACY_LS_KEY)
        }
      }
      const apiKey = sessionStorage.getItem('job-forge-api-key') ?? undefined
      if (stored) {
        set({ llm: { ...stored, apiKey } })
      } else if (apiKey) {
        set({ llm: { ...get().llm, apiKey } })
      }
    } catch {
      // ignore
    }
  },
}))
