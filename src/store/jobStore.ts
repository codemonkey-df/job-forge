import { create } from 'zustand'
import type { JobOffer, ApplicationStatus } from '../types/job'
import { listJobs, addJob as addJobToDB, updateJob as updateJobInDB, deleteJob as deleteJobFromDB } from '../lib/db/jobs'
import { withDerivedInsights } from '@/lib/utils/analysisInsights'

interface JobState {
  jobs: JobOffer[]
  isLoading: boolean
  loadingMessage: string
  loadJobs: () => Promise<void>
  addJob: (job: Omit<JobOffer, 'id'>) => Promise<number>
  updateJob: (id: number, changes: Partial<Omit<JobOffer, 'id'>>) => Promise<void>
  updateJobStatus: (id: number, status: ApplicationStatus) => Promise<void>
  deleteJob: (id: number) => Promise<void>
  setLoading: (isLoading: boolean, message?: string) => void
}

export const useJobStore = create<JobState>()((set, get) => ({
  jobs: [],
  isLoading: false,
  loadingMessage: '',
  loadJobs: async () => {
    set({ isLoading: true })
    try {
      const jobs = await listJobs()
      set({ jobs: jobs.map(withDerivedInsights) })
    } finally {
      set({ isLoading: false })
    }
  },
  addJob: async (job) => {
    const id = await addJobToDB(job)
    await get().loadJobs()
    return id
  },
  updateJob: async (id, changes) => {
    await updateJobInDB(id, changes)
    await get().loadJobs()
  },
  updateJobStatus: async (id, status) => {
    await updateJobInDB(id, { status })
    set((state) => ({
      jobs: state.jobs.map((j) => (j.id === id ? { ...j, status } : j)),
    }))
  },
  deleteJob: async (id) => {
    await deleteJobFromDB(id)
    set((state) => ({ jobs: state.jobs.filter((j) => j.id !== id) }))
  },
  setLoading: (isLoading, message = '') => set({ isLoading, loadingMessage: message }),
}))
