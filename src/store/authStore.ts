import { create } from 'zustand'
import { kvGet, kvSet, kvDelete } from '../lib/db/kv'

interface User {
  id: string
  name: string
}

interface AuthState {
  isLoggedIn: boolean
  user: User | null
  isLoading: boolean
  login: (name: string) => Promise<void>
  logout: () => void
  checkAuthStatus: () => Promise<void>
}

const KV_KEY = 'auth'
const LEGACY_LS_KEY = 'job-forge-auth'

function createUserId(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID()
  }

  const timestamp = Date.now().toString(36)
  const random = Math.random().toString(36).slice(2, 10)
  return `user_${timestamp}_${random}`
}

export const useAuthStore = create<AuthState>((set) => ({
  isLoggedIn: false,
  user: null,
  isLoading: true,
  login: async (name) => {
    const user: User = {
      id: createUserId(),
      name: name || 'User',
    }
    await kvSet(KV_KEY, user)
    set({ isLoggedIn: true, user, isLoading: false })
  },
  logout: () => {
    kvDelete(KV_KEY).catch(() => {})
    set({ isLoggedIn: false, user: null })
  },
  checkAuthStatus: async () => {
    try {
      let user = await kvGet<User>(KV_KEY)
      if (!user) {
        const raw = localStorage.getItem(LEGACY_LS_KEY)
        if (raw) {
          user = JSON.parse(raw) as User
          await kvSet(KV_KEY, user)
          localStorage.removeItem(LEGACY_LS_KEY)
        }
      }
      if (user) {
        set({ isLoggedIn: true, user, isLoading: false })
      } else {
        set({ isLoggedIn: false, user: null, isLoading: false })
      }
    } catch {
      set({ isLoggedIn: false, user: null, isLoading: false })
    }
  },
}))
