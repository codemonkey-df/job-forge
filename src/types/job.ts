import type { SkillLevel, LanguageLevel } from './profile'
import type { SkillPriority } from '@/lib/llm/schemas'

export interface LanguageMatch {
  language: string
  requiredLevel: LanguageLevel
  mandatory: boolean
  userHasLanguage: boolean
  userLevel?: LanguageLevel
  meetsRequirement: boolean
}

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
  aliasedFrom?: string   // user's skill name when matched via fuzzy (e.g. "SQL" for job's "PostgreSQL")
  includeInCV?: boolean  // for nice-to-have skills: whether to include in generated CV (default true)
  priority?: SkillPriority // primary, secondary, or nice-to-have
  context?: string       // what the skill is used for in this job
}

export type MatchType = 'exact' | 'aliased' | 'transferable' | 'missing'
export type KeywordImportance = 'high' | 'medium' | 'low'

export interface DetailedSkillInsight {
  name: string
  priority: SkillPriority
  context?: string
  matched: boolean
  matchType: MatchType
  evidence: string
  suggestedPlacement: 'Summary' | 'Experience' | 'Skills' | 'Projects'
}

export interface LeadingKeywordInsight {
  keyword: string
  source: 'skill' | 'responsibility' | 'description' | 'domain'
  importance: KeywordImportance
  inCV?: boolean
}

export interface MatchBreakdownInsight {
  mandatoryCoverage: number
  niceToHaveCoverage: number
  weightedScore: number
  exactMatches: number
  aliasedMatches: number
  transferableMatches: number
}

export interface ATSComplianceInsight {
  singleColumnStructure: 'pass' | 'warn' | 'fail'
  standardSections: 'pass' | 'warn' | 'fail'
  mandatoryKeywordCoverage: 'pass' | 'warn' | 'fail'
  plainTextSafe: 'pass' | 'warn' | 'fail'
  reasons?: {
    singleColumnStructure?: string
    standardSections?: string
    mandatoryKeywordCoverage?: string
    plainTextSafe?: string
  }
}

export type ATSIssueSeverity = 'info' | 'warn' | 'error'

export interface ATSReviewIssue {
  id: string
  severity: ATSIssueSeverity
  message: string
  autoFixable: boolean
  section?: string
}

export interface ATSReviewResult {
  issues: ATSReviewIssue[]
  autoFixMarkdown: string
  autoFixedCount: number
  manualCount: number
}

export interface AnalysisInsights {
  requiredSkillsDetailed: DetailedSkillInsight[]
  missingSkillsDetailed: DetailedSkillInsight[]
  leadingKeywords: LeadingKeywordInsight[]
  matchBreakdown: MatchBreakdownInsight
  whyFit: string[]
  improveNext: string[]
  atsCompliance?: ATSComplianceInsight
  /** Profile skills not mapped to any mandatory or nice-to-have job skill for this offer */
  excludedUserSkills?: string[]
}

export interface JobOffer {
  id?: number
  companyName: string
  jobTitle: string
  originalUrl?: string
  rawDescription: string
  mandatorySkills: JobSkill[]
  niceToHaveSkills: JobSkill[]
  jobFocus?: string          // Core role description from LLM extraction
  keyResponsibilities?: string[]  // Key responsibilities from LLM extraction
  primarySkills?: string[]   // Primary skills from LLM extraction
  analysisInsights?: AnalysisInsights
  analysisSkillsHash?: string
  analysisLastComputedAt?: string
  languageRequirements?: LanguageMatch[]
  /** User decisions on fuzzy alias matches (job skill name → confirm or reject) */
  skillAliasOverrides?: Record<string, 'confirmed' | 'rejected'>
  generatedCV?: string
  missingSkillsReport?: string
  status: ApplicationStatus
  analyzedAt: string
  notes?: string
}
