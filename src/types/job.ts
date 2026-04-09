import type { SkillLevel } from './profile'

export type ApplicationStatus =
  | 'bookmarked'
  | 'applied'
  | 'interviewing'
  | 'offer'
  | 'rejected'
  | 'withdrawn'

export interface JobSkill {
  name: string
  mandatory: boolean
  userHasSkill: boolean
  userLevel?: SkillLevel
}

export interface JobOffer {
  id?: number
  companyName: string
  jobTitle: string
  originalUrl?: string
  rawDescription: string
  mandatorySkills: JobSkill[]
  niceToHaveSkills: JobSkill[]
  generatedCV?: string
  missingSkillsReport?: string
  status: ApplicationStatus
  analyzedAt: string
  notes?: string
}
