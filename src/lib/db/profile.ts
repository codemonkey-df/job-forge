import { db } from './schema'
import type { UserProfile } from '../../types/profile'

export async function getProfile(): Promise<UserProfile | undefined> {
  return db.profile.get(1)
}

export async function saveProfile(data: Omit<UserProfile, 'id' | 'updatedAt'>): Promise<void> {
  const existing = await db.profile.get(1)
  const record = { ...data, updatedAt: new Date().toISOString() }
  if (existing) {
    await db.profile.update(1, record)
  } else {
    await db.profile.add({ id: 1, ...record })
  }
}

export async function exportProfile(): Promise<string> {
  const profile = await getProfile()
  return JSON.stringify(profile, null, 2)
}

export async function hasProfile(): Promise<boolean> {
  const profile = await getProfile()
  return !!profile
}

export async function isProfileComplete(): Promise<boolean> {
  const profile = await getProfile()
  if (!profile) return false
  return (
    profile.fullName?.trim()?.length > 0 &&
    profile.email?.trim()?.length > 0 &&
    profile.skills?.length > 0
  )
}

export async function setOnboarded(): Promise<void> {
  const profile = await getProfile()
  if (profile) {
    await db.profile.update(1, {
      ...profile,
      updatedAt: new Date().toISOString(),
    })
  }
}

export async function importProfile(json: string): Promise<void> {
  const data = JSON.parse(json) as UserProfile
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const { id: _id, updatedAt: _updatedAt, ...rest } = data
  await saveProfile(rest)
}
