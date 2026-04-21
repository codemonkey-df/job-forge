import { db } from './schema'

function fallbackKey(key: string): string {
  return `job-forge-kv:${key}`
}

export async function kvGet<T>(key: string): Promise<T | undefined> {
  try {
    const record = await db.kv.get(key)
    return record?.value as T | undefined
  } catch {
    const raw = localStorage.getItem(fallbackKey(key))
    if (!raw) return undefined
    return JSON.parse(raw) as T
  }
}

export async function kvSet<T>(key: string, value: T): Promise<void> {
  try {
    await db.kv.put({ key, value })
  } catch {
    localStorage.setItem(fallbackKey(key), JSON.stringify(value))
  }
}

export async function kvDelete(key: string): Promise<void> {
  try {
    await db.kv.delete(key)
  } catch {
    localStorage.removeItem(fallbackKey(key))
  }
}
