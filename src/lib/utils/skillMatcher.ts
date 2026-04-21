import type { JobSkill } from '../../types/job'
import type { Project, Skill } from '../../types/profile'
import type { SkillPriority } from '@/lib/llm/schemas'

/**
 * Substring fuzzy match when both tokens are at least 3 chars (same rules as {@link matchSkills}).
 */
export function fuzzyTokenMatch(a: string, b: string): boolean {
  const uKey = a.toLowerCase().trim()
  const key = b.toLowerCase().trim()
  if (uKey.length < 3 || key.length < 3) return false
  return uKey.includes(key) || key.includes(uKey)
}

export interface JobSkillWithContext extends JobSkill {
  priority?: SkillPriority
  context?: string
  transferableScore?: number // 0-100 score for how well user's experience maps to this job skill
}

export function matchSkills(
  jobSkills: Array<{ name: string; mandatory: boolean; priority?: SkillPriority; context?: string }>,
  userSkills: Skill[],
): JobSkill[] {
  const userMap = new Map(userSkills.map((s) => [s.name.toLowerCase().trim(), s]))

  return jobSkills.map((js) => {
    const key = js.name.toLowerCase().trim()
    const exactMatch = userMap.get(key)

    // Fuzzy: only match if BOTH tokens are at least 3 chars to avoid
    // short-name collisions ("Go" ⊂ "Django", "C" ⊂ "Docker", etc.)
    // Min 3 allows "sql" to match "postgresql", "aws" to match "awslambda", etc.
    const fuzzyMatch =
      !exactMatch
        ? userSkills.find((us) => fuzzyTokenMatch(us.name, js.name))
        : undefined

    const resolved = exactMatch ?? fuzzyMatch
    
    // Calculate transferable score for fuzzy matches
    const transferableScore = fuzzyMatch ? calculateTransferableScore(js.name, fuzzyMatch) : undefined
    
    return {
      name: js.name,
      mandatory: js.mandatory,
      userHasSkill: !!resolved,
      userLevel: resolved?.level,
      priority: js.priority,
      context: js.context,
      aliasedFrom: !exactMatch && fuzzyMatch ? fuzzyMatch.name : undefined,
      transferableScore,
    }
  })
}

/** Profile skills not mapped to any matched mandatory or nice-to-have job skill slot. */
export function computeExcludedUserSkills(
  userSkills: Skill[],
  mandatory: JobSkill[],
  nice: JobSkill[],
): string[] {
  const slots = [...mandatory, ...nice]
  return userSkills
    .filter((us) => {
      const u = us.name.toLowerCase().trim()
      return !slots.some((js) => {
        if (!js.userHasSkill) return false
        const matched = (js.aliasedFrom ?? js.name).toLowerCase().trim()
        return matched === u
      })
    })
    .map((us) => us.name)
}

/** Order projects by count of technologies that fuzzy-match any job skill name (score 0 last, stable). */
export function rankProjectsByJobRelevance(projects: Project[], jobSkillNames: string[]): Project[] {
  const jobKeys = jobSkillNames.map((n) => n.toLowerCase().trim())
  const scoreFor = (p: Project) => {
    let c = 0
    for (const tech of p.technologies) {
      for (const jn of jobKeys) {
        if (fuzzyTokenMatch(tech, jn)) {
          c++
          break
        }
      }
    }
    return c
  }
  return [...projects]
    .map((p, index) => ({ p, index, score: scoreFor(p) }))
    .sort((a, b) => b.score - a.score || a.index - b.index)
    .map(({ p }) => p)
}

function calculateTransferableScore(jobSkillName: string, userSkill: Skill): number {
  // Higher score for exact category match
  const categoryMatch = userSkill.category ? 
    (jobSkillName.toLowerCase().includes(userSkill.category.toLowerCase()) || 
     userSkill.category.toLowerCase().includes(jobSkillName.toLowerCase())) ? 80 : 50 : 30
  
  // Higher score for expert/advanced levels
  const levelScore = userSkill.level === 'expert' ? 100 : 
                     userSkill.level === 'advanced' ? 85 : 
                     userSkill.level === 'intermediate' ? 60 : 40
  
  // Combine factors
  return Math.round((categoryMatch * 0.5) + (levelScore * 0.5))
}

export function computeMatchPercentage(skills: JobSkill[]): number {
  const mandatory = skills.filter((s) => s.mandatory)
  if (mandatory.length === 0) return 0
  const matched = mandatory.filter((s) => s.userHasSkill).length
  return Math.round((matched / mandatory.length) * 100)
}

export interface DetailedMatchMetrics {
  mandatoryCoverage: number
  niceToHaveCoverage: number
  weightedScore: number
  exactMatches: number
  aliasedMatches: number
  transferableMatches: number
}

export function computeDetailedMatchMetrics(
  mandatorySkills: JobSkill[],
  niceToHaveSkills: JobSkill[],
): DetailedMatchMetrics {
  const mandatoryMatched = mandatorySkills.filter((s) => s.userHasSkill).length
  const niceMatched = niceToHaveSkills.filter((s) => s.userHasSkill).length

  const mandatoryCoverage = mandatorySkills.length
    ? Math.round((mandatoryMatched / mandatorySkills.length) * 100)
    : 100
  const niceToHaveCoverage = niceToHaveSkills.length
    ? Math.round((niceMatched / niceToHaveSkills.length) * 100)
    : 100

  const all = [...mandatorySkills, ...niceToHaveSkills]
  const totalWeight = all.reduce((acc, s) => acc + getPriorityScore(s.priority), 0)
  const matchedWeight = all.reduce((acc, s) => {
    if (!s.userHasSkill) return acc
    return acc + getPriorityScore(s.priority)
  }, 0)

  const aliasedMatches = all.filter((s) => s.userHasSkill && !!s.aliasedFrom).length
  const transferableMatches = all.filter((s) => {
    const score = (s as { transferableScore?: number }).transferableScore
    return s.userHasSkill && typeof score === 'number'
  }).length
  const exactMatches = all.filter((s) => s.userHasSkill && !s.aliasedFrom).length - transferableMatches

  return {
    mandatoryCoverage,
    niceToHaveCoverage,
    weightedScore: totalWeight ? Math.round((matchedWeight / totalWeight) * 100) : 0,
    exactMatches,
    aliasedMatches,
    transferableMatches,
  }
}

export function getPriorityScore(priority?: SkillPriority): number {
  // Weight priorities for scoring
  switch (priority) {
    case 'primary': return 3
    case 'secondary': return 2
    case 'nice-to-have': return 1
    default: return 1
  }
}

export function analyzeSkillMatch(jobSkills: JobSkill[]): {
  primarySkillsMatched: number
  secondarySkillsMatched: number
  niceToHaveSkillsMatched: number
  totalWeightedScore: number
  potentialMatchPercentage: number
} {
  const primarySkills = jobSkills.filter(s => s.priority === 'primary')
  const secondarySkills = jobSkills.filter(s => s.priority === 'secondary')
  const niceToHaveSkills = jobSkills.filter(s => s.priority === 'nice-to-have')
  
  const primaryMatched = primarySkills.filter(s => s.userHasSkill).length
  const secondaryMatched = secondarySkills.filter(s => s.userHasSkill).length
  const niceToHaveMatched = niceToHaveSkills.filter(s => s.userHasSkill).length
  
  // Weighted scoring: primary=3, secondary=2, nice-to-have=1
  const totalWeighted = (primarySkills.length * 3) + (secondarySkills.length * 2) + (niceToHaveSkills.length * 1)
  const matchedWeighted = (primaryMatched * 3) + (secondaryMatched * 2) + (niceToHaveMatched * 1)
  
  return {
    primarySkillsMatched: primaryMatched,
    secondarySkillsMatched: secondaryMatched,
    niceToHaveSkillsMatched: niceToHaveMatched,
    totalWeightedScore: matchedWeighted,
    potentialMatchPercentage: totalWeighted > 0 ? Math.round((matchedWeighted / totalWeighted) * 100) : 0,
  }
}
