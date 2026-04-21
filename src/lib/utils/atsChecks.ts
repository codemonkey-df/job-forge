import type { ATSComplianceInsight, ATSReviewIssue, ATSReviewResult, JobOffer } from '@/types/job'

const SECTION_SPECS: Array<{ label: string; aliases: string[] }> = [
  { label: 'Professional Summary', aliases: ['professional summary', 'summary', 'profile', 'about me'] },
  { label: 'Technical Skills', aliases: ['technical skills', 'skills', 'core skills', 'competencies'] },
  { label: 'Work Experience', aliases: ['work experience', 'experience', 'professional experience', 'employment history'] },
  { label: 'Education', aliases: ['education', 'academic background', 'qualifications'] },
]
const SKILL_ALIASES: Record<string, string[]> = {
  javascript: ['js'],
  typescript: ['ts'],
  'node.js': ['node', 'nodejs'],
  postgresql: ['postgres', 'psql'],
  'c#': ['csharp'],
  'c++': ['cpp'],
}

function verdict(pass: boolean, warn = false): 'pass' | 'warn' | 'fail' {
  if (pass) return 'pass'
  return warn ? 'warn' : 'fail'
}

function normalizeText(input: string): string {
  return input
    .toLowerCase()
    .replace(/[()/:,+.#-]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

function escapeRegExp(input: string): string {
  return input.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

function compileBoundaryRegex(term: string): RegExp {
  return new RegExp(`(^|[^a-z0-9])${escapeRegExp(term)}([^a-z0-9]|$)`, 'i')
}

function getSkillTerms(skillName: string): string[] {
  const normalized = normalizeText(skillName)
  const aliases = SKILL_ALIASES[normalized] ?? []
  return [normalized, ...aliases.map(normalizeText)].filter(Boolean)
}

function hasTerm(normalizedText: string, term: string): boolean {
  const normalizedTerm = normalizeText(term)
  if (!normalizedTerm) return false
  return compileBoundaryRegex(normalizedTerm).test(normalizedText)
}

function canonicalizeSkillToken(raw: string): string {
  const withoutLevel = raw.replace(/\([^)]*\)/g, ' ')
  const normalized = normalizeText(withoutLevel)
  if (!normalized) return ''
  const words = normalized
    .split(' ')
    .filter(Boolean)
    .filter((word) => !['framework', 'frameworks', 'library', 'libraries', 'tool', 'tools'].includes(word))
  const base = words.join(' ').trim()
  if (!base) return ''
  if (base === 'rest api') return 'rest apis'
  return base
}

function detectDuplicateSkills(markdown: string): string[] {
  const lines = markdown.split('\n')
  const duplicateGroups: string[] = []
  const canonicalToOriginal = new Map<string, Set<string>>()

  for (const line of lines) {
    const trimmed = line.trim()
    if (!trimmed.startsWith('- ')) continue
    const value = trimmed.slice(2).trim()
    if (!value) continue

    const tokens = value.split(',')
      .map((token) => token.trim())
      .filter(Boolean)

    for (const token of tokens) {
      const canonical = canonicalizeSkillToken(token)
      if (!canonical) continue
      const existing = canonicalToOriginal.get(canonical) ?? new Set<string>()
      existing.add(token)
      canonicalToOriginal.set(canonical, existing)
    }
  }

  for (const originals of canonicalToOriginal.values()) {
    if (originals.size > 1) {
      duplicateGroups.push(Array.from(originals).join(' / '))
    }
  }

  return duplicateGroups
}

export function hasSkillInMarkdown(markdown: string, skillName: string): boolean {
  const normalizedText = normalizeText(markdown)
  return getSkillTerms(skillName).some((term) => hasTerm(normalizedText, term))
}

export function splitMatchedSkills<T extends { name: string }>(
  markdown: string,
  skills: T[],
): { found: T[]; missing: T[] } {
  const found: T[] = []
  const missing: T[] = []
  for (const skill of skills) {
    if (hasSkillInMarkdown(markdown, skill.name)) {
      found.push(skill)
    } else {
      missing.push(skill)
    }
  }
  return { found, missing }
}

function detectSectionCoverage(markdown: string): { ratio: number; reason: string } {
  const headings = (markdown.match(/^##\s+.+$/gim) ?? [])
    .map((heading) => normalizeText(heading.replace(/^##\s+/i, '')))
  const missing: string[] = []
  for (const section of SECTION_SPECS) {
    const present = headings.some((h) => section.aliases.some((alias) => h === normalizeText(alias)))
    if (!present) missing.push(section.label)
  }
  const ratio = (SECTION_SPECS.length - missing.length) / SECTION_SPECS.length
  if (ratio >= 1) return { ratio, reason: 'All core ATS sections are present.' }
  if (missing.length === 1) return { ratio, reason: `Missing standard section: ${missing[0]}.` }
  return { ratio, reason: `Missing multiple standard sections (${missing.join(', ')}).` }
}

export function evaluateATSCompliance(markdown: string, job: Pick<JobOffer, 'mandatorySkills'>): ATSComplianceInsight {
  const md = markdown || ''
  const hasTables = /\|.+\|/.test(md)
  const hasHtmlTable = /<table[\s>]/i.test(md)
  const looksMultiColumn = /column|sidebar|left column|right column/i.test(md)
  const hasDenseSeparators = /^[-*_]{4,}$/m.test(md)
  const hasInlineHtml = /<(div|span|section|article|font)\b/i.test(md)

  const section = detectSectionCoverage(md)

  const mandatoryFound = job.mandatorySkills.filter((s) => hasSkillInMarkdown(md, s.name)).length
  const mandatoryCoverage = job.mandatorySkills.length
    ? mandatoryFound / job.mandatorySkills.length
    : 1

  const singleColumnPass = !hasTables && !hasHtmlTable && !looksMultiColumn && !hasDenseSeparators
  const plainTextPass = !/<[^>]+>/.test(md)

  return {
    singleColumnStructure: verdict(singleColumnPass, !hasTables && !hasHtmlTable),
    standardSections: verdict(section.ratio >= 1, section.ratio >= 0.75),
    mandatoryKeywordCoverage: verdict(mandatoryCoverage >= 1, mandatoryCoverage >= 0.8),
    plainTextSafe: verdict(plainTextPass, true),
    reasons: {
      singleColumnStructure: singleColumnPass
        ? 'Layout is ATS-friendly single column.'
        : 'Tables, multi-column hints, or heavy separators may confuse ATS parsers.',
      standardSections: section.reason,
      mandatoryKeywordCoverage:
        mandatoryCoverage >= 1
          ? 'All mandatory keywords detected.'
          : mandatoryCoverage >= 0.8
            ? 'Most mandatory keywords detected; add remaining terms naturally.'
            : 'Too many mandatory keywords missing.',
      plainTextSafe: plainTextPass
        ? 'Plain text markdown structure is safe.'
        : hasInlineHtml
          ? 'Inline HTML detected; prefer plain markdown text.'
          : 'HTML-like markup detected; keep content plain.',
    },
  }
}

export function computeMandatoryKeywordCoverage(markdown: string, job: Pick<JobOffer, 'mandatorySkills'>): number {
  const found = job.mandatorySkills.filter((s) => hasSkillInMarkdown(markdown, s.name)).length
  return job.mandatorySkills.length ? Math.round((found / job.mandatorySkills.length) * 100) : 100
}

export function computeCVKeywordMatch(
  markdown: string,
  job: Pick<JobOffer, 'mandatorySkills' | 'niceToHaveSkills'>,
): number {
  if (!markdown.trim()) return 0

  const mandatory = job.mandatorySkills
  const niceToHave = job.niceToHaveSkills
  const mandatoryFound = mandatory.filter((s) => hasSkillInMarkdown(markdown, s.name)).length
  const niceFound = niceToHave.filter((s) => hasSkillInMarkdown(markdown, s.name)).length
  const mandatoryScore = mandatory.length > 0 ? (mandatoryFound / mandatory.length) * 70 : 70
  const niceScore = niceToHave.length > 0 ? (niceFound / niceToHave.length) * 30 : 30
  return Math.round(mandatoryScore + niceScore)
}

export function complianceBadgeLabel(v: 'pass' | 'warn' | 'fail'): string {
  if (v === 'pass') return 'Pass'
  if (v === 'warn') return 'Warn'
  return 'Fail'
}

function buildSafeATSFixes(markdown: string): { markdown: string; fixCount: number } {
  const headingRules: Array<{ re: RegExp; to: string }> = [
    { re: /^##\s*(summary|professional summary|profile|about me)\s*$/gim, to: '## Professional Summary' },
    { re: /^##\s*(work experience|experience|professional experience|employment history)\s*$/gim, to: '## Work Experience' },
    { re: /^##\s*(academic background|qualifications)\s*$/gim, to: '## Education' },
    { re: /^##\s*(skills|technical skills|core skills|competencies)\s*$/gim, to: '## Technical Skills' },
  ]
  let next = markdown
  let fixCount = 0
  for (const rule of headingRules) {
    const matches = next.match(rule.re)
    if (matches?.length) fixCount += matches.length
    next = next.replace(rule.re, rule.to)
  }
  const bulletMatches = next.match(/^(\s*)\*\s+/gm)
  if (bulletMatches?.length) fixCount += bulletMatches.length
  next = next.replace(/^(\s*)\*\s+/gm, '$1- ')

  const tableMatches = next.match(/<table[\s\S]*?<\/table>/gi)
  if (tableMatches?.length) fixCount += tableMatches.length
  next = next.replace(/<table[\s\S]*?<\/table>/gi, '')

  const inlineMatches = next.match(/<\/?(div|span|section|article|font)[^>]*>/gi)
  if (inlineMatches?.length) fixCount += inlineMatches.length
  next = next.replace(/<\/?(div|span|section|article|font)[^>]*>/gi, '')

  // Normalize split experience entries to a single ATS-friendly H3 line:
  // ### Company
  // **Role**
  // MMM YYYY – Present
  // -> ### Role | Company · MMM YYYY – Present
  const splitExperienceEntryPattern =
    /(^###\s*([^\n]+?)\s*$\n^\*\*([^\n]+?)\*\*\s*$\n^((?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)\s+\d{4}\s*[–-]\s*(?:Present|(?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)\s+\d{4}))\s*$)/gim
  const splitExperienceEntries = next.match(splitExperienceEntryPattern)
  if (splitExperienceEntries?.length) fixCount += splitExperienceEntries.length
  next = next.replace(splitExperienceEntryPattern, (_fullMatch, _block, company, title, dateRange) => {
    const normalizedCompany = String(company).trim()
    const normalizedTitle = String(title).trim()
    const normalizedDateRange = String(dateRange).trim()
    return `### ${normalizedTitle} | ${normalizedCompany} · ${normalizedDateRange}`
  })

  if (/\n{3,}/.test(next)) fixCount += 1
  next = next.replace(/\n{3,}/g, '\n\n').trimEnd()
  return { markdown: next, fixCount }
}

export function reviewATSIssues(markdown: string, job: Pick<JobOffer, 'mandatorySkills'>): ATSReviewResult {
  const issues: ATSReviewIssue[] = []
  const compliance = evaluateATSCompliance(markdown, job)
  const missing = splitMatchedSkills(markdown, job.mandatorySkills).missing
  const duplicateSkills = detectDuplicateSkills(markdown)
  if (missing.length > 0) {
    issues.push({
      id: 'missing-mandatory-keywords',
      severity: 'error',
      message: `Missing mandatory keywords: ${missing.map((s) => s.name).join(', ')}`,
      autoFixable: false,
      section: 'Skills',
    })
  }
  if (duplicateSkills.length > 0) {
    issues.push({
      id: 'duplicate-skill-keywords',
      severity: 'warn',
      message: `Duplicate/overlapping skills detected: ${duplicateSkills.join(' | ')}`,
      autoFixable: false,
      section: 'Technical Skills',
    })
  }
  if (compliance.standardSections !== 'pass') {
    issues.push({
      id: 'section-structure',
      severity: compliance.standardSections === 'warn' ? 'warn' : 'error',
      message: compliance.reasons?.standardSections ?? 'Standard ATS sections are incomplete.',
      autoFixable: false,
    })
  }
  const { markdown: autoFixMarkdown, fixCount } = buildSafeATSFixes(markdown)
  if (fixCount > 0) {
    issues.push({
      id: 'safe-format-normalization',
      severity: 'warn',
      message: 'ATS formatting normalization available (headings, bullets, plain text cleanup).',
      autoFixable: true,
    })
  }
  if (issues.length === 0) {
    issues.push({
      id: 'ats-clean',
      severity: 'info',
      message: 'No ATS issues detected.',
      autoFixable: false,
    })
  }
  return {
    issues,
    autoFixMarkdown,
    autoFixedCount: fixCount,
    manualCount: issues.filter((i) => !i.autoFixable && i.id !== 'ats-clean').length,
  }
}
