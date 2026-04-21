import Dexie, { type EntityTable } from 'dexie'
import type { UserProfile } from '../../types/profile'
import type { JobOffer } from '../../types/job'

export interface KVRecord {
  key: string
  value: unknown
}

export class JobForgeDB extends Dexie {
  profile!: EntityTable<UserProfile, 'id'>
  jobs!: EntityTable<JobOffer, 'id'>
  kv!: EntityTable<KVRecord, 'key'>

  constructor() {
    super('job-forge-db')
    this.version(1).stores({
      profile: '++id',
      jobs: '++id, companyName, jobTitle, status, analyzedAt',
    })
    this.version(2).stores({
      profile: '++id',
      jobs: '++id, companyName, jobTitle, status, analyzedAt',
      kv: 'key',
    })
  }
}

export const db = new JobForgeDB()
