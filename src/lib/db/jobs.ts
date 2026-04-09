import { db } from './schema'
import type { JobOffer, ApplicationStatus } from '../../types/job'

export async function listJobs(): Promise<JobOffer[]> {
  return db.jobs.orderBy('analyzedAt').reverse().toArray()
}

export async function getJob(id: number): Promise<JobOffer | undefined> {
  return db.jobs.get(id)
}

export async function addJob(job: Omit<JobOffer, 'id'>): Promise<number> {
  const id = await db.jobs.add(job)
  return id as number
}

export async function updateJob(id: number, changes: Partial<Omit<JobOffer, 'id'>>): Promise<void> {
  await db.jobs.update(id, changes)
}

export async function deleteJob(id: number): Promise<void> {
  await db.jobs.delete(id)
}

export async function updateJobStatus(id: number, status: ApplicationStatus): Promise<void> {
  await db.jobs.update(id, { status })
}
