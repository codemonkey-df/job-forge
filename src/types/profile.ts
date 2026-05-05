export type SkillLevel = 'basic' | 'intermediate' | 'advanced' | 'expert'

export type LanguageLevel = 'A1' | 'A2' | 'B1' | 'B2' | 'C1' | 'C2' | 'native'

export interface LanguageProficiency {
  language: string
  level: LanguageLevel
}

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
  githubUrl?: string
  source?: 'manual' | 'github'
}

export interface UserProfile {
  id?: number
  fullName: string
  email: string
  phone?: string
  location?: string
  linkedinUrl?: string
  portfolioUrl?: string
  githubUsername?: string
  summary?: string
  skills: Skill[]
  languages?: LanguageProficiency[]
  experience: WorkExperience[]
  education: Education[]
  projects: Project[]
  createdAt?: string
  updatedAt: string
}
