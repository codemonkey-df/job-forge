import { db } from './schema'

export async function kvGet<T>(key: string): Promise<T | undefined> {
  const record = await db.kv.get(key)
  return record?.value as T | undefined
}

export async function kvSet<T>(key: string, value: T): Promise<void> {
  await db.kv.put({ key, value })
}

export async function kvDelete(key: string): Promise<void> {
  await db.kv.delete(key)
}
