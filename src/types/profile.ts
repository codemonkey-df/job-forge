export type SkillLevel = 'basic' | 'intermediate' | 'advanced' | 'expert'

export interface Skill {
  name: string
  level: SkillLevel
  category?: string
}

export interface WorkExperience {
  company: string
  title: string
  startDate?: string
  endDate?: string
  description: string
}

export interface Education {
  institution: string
  degree: string
  field: string
  startDate?: string
  endDate?: string
}

export interface Project {
  name: string
  description: string
  url?: string
  technologies: string[]
}

export interface UserProfile {
  id?: number
  fullName: string
  email: string
  phone?: string
  location?: string
  linkedinUrl?: string
  portfolioUrl?: string
  summary?: string
  skills: Skill[]
  experience: WorkExperience[]
  education: Education[]
  projects: Project[]
  updatedAt: string
}
