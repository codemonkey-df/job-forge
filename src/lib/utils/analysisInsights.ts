import type {
  AnalysisInsights,
  DetailedSkillInsight,
  JobOffer,
  JobSkill,
  KeywordImportance,
  LeadingKeywordInsight,
  MatchType,
} from '@/types/job'
import type { Skill } from '@/types/profile'
import { computeDetailedMatchMetrics, computeExcludedUserSkills } from '@/lib/utils/skillMatcher'

const STOP_WORDS = new Set([
  'the', 'and', 'for', 'with', 'from', 'that', 'this', 'your', 'you', 'our', 'are', 'was', 'were', 'will', 'have',
  'has', 'job', 'role', 'team', 'work', 'years', 'experience', 'required', 'requirements', 'using', 'build', 'plus',
])

function normalizePriority(priority: JobSkill['priority']): 'primary' | 'secondary' | 'nice-to-have' {
  return priority ?? 'secondary'
}

function matchTypeOf(skill: JobSkill): MatchType {
  const transferableScore = (skill as { transferableScore?: number }).transferableScore
  if (!skill.userHasSkill) return 'missing'
  if (skill.aliasedFrom) return 'aliased'
  if (transferableScore && transferableScore < 85) return 'transferable'
  return 'exact'
}

function suggestedPlacementFor(priority: JobSkill['priority']): DetailedSkillInsight['suggestedPlacement'] {
  if (priority === 'primary') return 'Summary'
  if (priority === 'secondary') return 'Experience'
  return 'Skills'
}

function evidenceFor(skill: JobSkill): string {
  const transferableScore = (skill as { transferableScore?: number }).transferableScore
  if (!skill.userHasSkill) return 'Missing in current profile match'
  if (skill.aliasedFrom) return `Matched via related profile skill: ${skill.aliasedFrom}`
  if (transferableScore) return `Transferable fit score: ${transferableScore}%`
  return skill.userLevel ? `Matched with ${skill.userLevel} level` : 'Direct skill match found'
}

function toDetailed(skill: JobSkill): DetailedSkillInsight {
  return {
    name: skill.name,
    priority: normalizePriority(skill.priority),
    context: skill.context,
    matched: skill.userHasSkill,
    matchType: matchTypeOf(skill),
    evidence: evidenceFor(skill),
    suggestedPlacement: suggestedPlacementFor(skill.priority),
  }
}

function extractLeadingKeywords(
  job: Pick<JobOffer, 'rawDescription' | 'keyResponsibilities' | 'mandatorySkills' | 'niceToHaveSkills'>,
  extractedLeadingKeywords?: Array<{ keyword: string; source?: 'skill' | 'responsibility' | 'domain'; importance?: 'high' | 'medium' | 'low' }>,
): LeadingKeywordInsight[] {
  const fromSkills: LeadingKeywordInsight[] = [
    ...job.mandatorySkills.map((s) => ({
      keyword: s.name,
      source: 'skill' as const,
      importance: (s.priority === 'primary' ? 'high' : 'medium') as KeywordImportance,
    })),
    ...job.niceToHaveSkills.map((s) => ({
      keyword: s.name,
      source: 'skill' as const,
      importance: 'low' as KeywordImportance,
    })),
  ]

  const responsibilityWords = (job.keyResponsibilities ?? [])
    .flatMap((line) => line.toLowerCase().split(/\W+/))
    .filter((w) => w.length > 4 && !STOP_WORDS.has(w))
    .slice(0, 8)

  const descriptionWords = job.rawDescription
    .toLowerCase()
    .split(/\W+/)
    .filter((w) => w.length > 5 && !STOP_WORDS.has(w))
    .slice(0, 20)

  const dedup = new Map<string, LeadingKeywordInsight>()
  for (const item of extractedLeadingKeywords ?? []) {
    dedup.set(item.keyword.toLowerCase(), {
      keyword: item.keyword,
      source: item.source ?? 'description',
      importance: item.importance ?? 'medium',
    })
  }
  for (const item of fromSkills) dedup.set(item.keyword.toLowerCase(), item)
  for (const word of responsibilityWords) {
    if (!dedup.has(word)) dedup.set(word, { keyword: word, source: 'responsibility', importance: 'medium' })
  }
  for (const word of descriptionWords) {
    if (!dedup.has(word)) dedup.set(word, { keyword: word, source: 'description', importance: 'low' })
  }

  return [...dedup.values()].slice(0, 20)
}

export function buildAnalysisInsights(
  job: Pick<JobOffer, 'mandatorySkills' | 'niceToHaveSkills' | 'rawDescription' | 'keyResponsibilities'>,
  extractedLeadingKeywords?: Array<{ keyword: string; source?: 'skill' | 'responsibility' | 'domain'; importance?: 'high' | 'medium' | 'low' }>,
  userSkills?: Skill[],
): AnalysisInsights {
  const allSkills = [...job.mandatorySkills, ...job.niceToHaveSkills]
  const detailed = allSkills.map(toDetailed)
  const requiredSkillsDetailed = detailed.filter((s) => s.matched)
  const missingSkillsDetailed = detailed.filter((s) => !s.matched)
  const metrics = computeDetailedMatchMetrics(job.mandatorySkills, job.niceToHaveSkills)
  const leadingKeywords = extractLeadingKeywords(job, extractedLeadingKeywords)

  const whyFit = requiredSkillsDetailed
    .filter((s) => s.priority !== 'nice-to-have')
    .slice(0, 4)
    .map((s) => `${s.name}: ${s.evidence}`)

  const improveNext = missingSkillsDetailed
    .slice(0, 4)
    .map((s) => `Add ${s.name} evidence in ${s.suggestedPlacement}`)

  const excludedUserSkills =
    userSkills !== undefined
      ? computeExcludedUserSkills(userSkills, job.mandatorySkills, job.niceToHaveSkills)
      : undefined

  return {
    requiredSkillsDetailed,
    missingSkillsDetailed,
    leadingKeywords,
    matchBreakdown: metrics,
    whyFit,
    improveNext,
    ...(excludedUserSkills !== undefined && excludedUserSkills.length > 0
      ? { excludedUserSkills }
      : {}),
  }
}

export function withDerivedInsights(job: JobOffer): JobOffer {
  if (job.analysisInsights) return job
  return {
    ...job,
    analysisInsights: buildAnalysisInsights(job),
  }
}
