import Dexie, { type EntityTable } from 'dexie'
import type { UserProfile } from '../../types/profile'
import type { JobOffer } from '../../types/job'

export class JobForgeDB extends Dexie {
  profile!: EntityTable<UserProfile, 'id'>
  jobs!: EntityTable<JobOffer, 'id'>

  constructor() {
    super('job-forge-db')
    this.version(1).stores({
      profile: '++id',
      jobs: '++id, companyName, jobTitle, status, analyzedAt',
    })
  }
}

export const db = new JobForgeDB()
