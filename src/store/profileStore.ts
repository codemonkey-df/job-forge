import { create } from 'zustand'
import type { UserProfile } from '../types/profile'
import { getProfile, saveProfile as saveProfileToDB } from '../lib/db/profile'

interface ProfileState {
  profile: UserProfile | null
  isLoading: boolean
  loadProfile: () => Promise<void>
  saveProfile: (data: Omit<UserProfile, 'id' | 'updatedAt'>) => Promise<void>
}

export const useProfileStore = create<ProfileState>()((set) => ({
  profile: null,
  isLoading: false,
  loadProfile: async () => {
    set({ isLoading: true })
    try {
      const profile = await getProfile()
      set({ profile: profile ?? null })
    } finally {
      set({ isLoading: false })
    }
  },
  saveProfile: async (data) => {
    await saveProfileToDB(data)
    const updated = await getProfile()
    set({ profile: updated ?? null })
  },
}))
