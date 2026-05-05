import type { JobOffer, JobSkill, LanguageMatch } from '../../types/job'
import type { Project, Skill, LanguageProficiency, LanguageLevel } from '../../types/profile'
import type { SkillPriority } from '@/lib/llm/schemas'

const LANGUAGE_LEVEL_ORDER: LanguageLevel[] = ['A1', 'A2', 'B1', 'B2', 'C1', 'C2', 'native']

function languageLevelIndex(level: LanguageLevel): number {
  return LANGUAGE_LEVEL_ORDER.indexOf(level)
}

export function matchLanguages(
  requirements: Array<{ language: string; level: LanguageLevel; mandatory: boolean }>,
  userLanguages: LanguageProficiency[],
): LanguageMatch[] {
  const userMap = new Map(userLanguages.map((l) => [l.language.toLowerCase().trim(), l]))
  return requirements.map((req) => {
    const userLang = userMap.get(req.language.toLowerCase().trim())
    const meetsRequirement = userLang
      ? languageLevelIndex(userLang.level) >= languageLevelIndex(req.level)
      : false
    return {
      language: req.language,
      requiredLevel: req.level,
      mandatory: req.mandatory,
      userHasLanguage: !!userLang,
      userLevel: userLang?.level,
      meetsRequirement,
    }
  })
}

function extractParentheticalAcronym(skillName: string): string | null {
  const match = skillName.match(/\(\s*([A-Za-z]{2,10})\s*\)/)
  return match ? match[1].toLowerCase() : null
}

/**
 * Fuzzy match with substring, plural normalization, and acronym extraction.
 * - Both tokens must be at least 3 chars to avoid short-name collisions ("Go" ⊂ "Django").
 * - Strips trailing plural 's' before retrying ("LLMs" → "LLM").
 * - Extracts acronyms from "Full Name ( ABC )" notation and matches job skill tokens against them
 *   (e.g. "LLM pipelines" token "llm" matches "Large Language Model ( LLM )").
 */
export function fuzzyTokenMatch(a: string, b: string): boolean {
  const uKey = a.toLowerCase().trim()
  const key = b.toLowerCase().trim()
  if (uKey.length < 3 || key.length < 3) return false

  // Direct substring match
  if (uKey.includes(key) || key.includes(uKey)) return true

  // Plural normalization: strip trailing 's' and retry
  const uNorm = uKey.endsWith('s') ? uKey.slice(0, -1) : uKey
  const kNorm = key.endsWith('s') ? key.slice(0, -1) : key
  if ((uNorm !== uKey || kNorm !== key) && uNorm.length >= 3 && kNorm.length >= 3) {
    if (uKey.includes(kNorm) || kNorm.includes(uKey)) return true
    if (uNorm.includes(key) || key.includes(uNorm)) return true
    if (uNorm.includes(kNorm) || kNorm.includes(uNorm)) return true
  }

  // Acronym matching: extract ( ABC ) notation and match against it
  // e.g. user "Large Language Model ( LLM )" has acronym "llm"
  const aAcronym = extractParentheticalAcronym(a)
  const bAcronym = extractParentheticalAcronym(b)

  if (aAcronym && aAcronym.length >= 3) {
    if (key === aAcronym || kNorm === aAcronym) return true
    // Token-level: "LLM pipelines" → token "llm" matches acronym "llm"
    const bTokens = key.split(/[\s\-\/,()\[\]]+/).filter((t) => t.length >= 3)
    for (const bt of bTokens) {
      const btNorm = bt.endsWith('s') ? bt.slice(0, -1) : bt
      if (bt === aAcronym || btNorm === aAcronym) return true
    }
  }
  if (bAcronym && bAcronym.length >= 3) {
    if (uKey === bAcronym || uNorm === bAcronym) return true
    const aTokens = uKey.split(/[\s\-\/,()\[\]]+/).filter((t) => t.length >= 3)
    for (const at of aTokens) {
      const atNorm = at.endsWith('s') ? at.slice(0, -1) : at
      if (at === bAcronym || atNorm === bAcronym) return true
    }
  }

  return false
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

/**
 * Applies persisted alias confirm/reject decisions to matched skills.
 * Rejecting clears the fuzzy match so the job skill shows as missing without prompting again.
 */
export function applySkillAliasOverrides(
  skills: JobSkill[],
  overrides: Record<string, 'confirmed' | 'rejected'> | undefined,
): JobSkill[] {
  if (!overrides || Object.keys(overrides).length === 0) return skills
  return skills.map((s) => {
    if (overrides[s.name] === 'rejected' && s.aliasedFrom) {
      return { ...s, userHasSkill: false, aliasedFrom: undefined }
    }
    return s
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

/**
 * Profile match for a stored job: mandatory matched / mandatory count.
 * Applies {@link applySkillAliasOverrides} so Dashboard and Job Analysis stay aligned.
 */
export function computeJobProfileMatchPercentage(job: JobOffer): number {
  const mandatory = applySkillAliasOverrides(job.mandatorySkills, job.skillAliasOverrides)
  const niceToHave = applySkillAliasOverrides(job.niceToHaveSkills, job.skillAliasOverrides)
  return computeMatchPercentage([...mandatory, ...niceToHave])
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
