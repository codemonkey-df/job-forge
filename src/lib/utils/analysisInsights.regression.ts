import type { Skill } from '@/types/profile'
import { backendRoleFixture } from '@/lib/utils/analysisInsights.fixtures'
import { buildAnalysisInsights } from '@/lib/utils/analysisInsights'
import { computeMandatoryKeywordCoverage, evaluateATSCompliance, hasSkillInMarkdown } from '@/lib/utils/atsChecks'

/**
 * Lightweight deterministic regression checks.
 * Can be invoked from a console or test harness without extra dependencies.
 */
export function runAnalysisRegressionChecks(): string[] {
  const failures: string[] = []
  const profileSkills: Skill[] = [
    { name: 'Python', level: 'advanced' },
    { name: 'PostgreSQL', level: 'intermediate' },
    { name: 'Machine Learning', level: 'intermediate' },
  ]
  const insights = buildAnalysisInsights(backendRoleFixture, undefined, profileSkills)

  if (insights.matchBreakdown.mandatoryCoverage !== 67) {
    failures.push('mandatoryCoverage regression')
  }
  if (!insights.missingSkillsDetailed.some((s) => s.name === 'FastAPI')) {
    failures.push('missing skill extraction regression')
  }
  if (!insights.leadingKeywords.some((k) => k.keyword.toLowerCase() === 'python')) {
    failures.push('leading keyword generation regression')
  }
  if (!insights.excludedUserSkills?.includes('Machine Learning')) {
    failures.push('excludedUserSkills regression')
  }

  const goodMarkdown = `## Summary\nPython backend engineer.\n## Experience\n- Built FastAPI APIs.\n## Education\nBS CS\n## Skills\n- Python, FastAPI, PostgreSQL`
  const compliance = evaluateATSCompliance(goodMarkdown, backendRoleFixture)
  if (compliance.standardSections === 'fail') {
    failures.push('ATS section validation regression')
  }
  if (!compliance.reasons?.mandatoryKeywordCoverage) {
    failures.push('ATS compliance reason generation regression')
  }

  const removedPythonMarkdown = `## Summary\nBackend engineer.\n## Experience\n- Built APIs.\n## Education\nBS CS\n## Skills\n- FastAPI, PostgreSQL`
  const beforeCoverage = computeMandatoryKeywordCoverage(goodMarkdown, backendRoleFixture)
  const afterCoverage = computeMandatoryKeywordCoverage(removedPythonMarkdown, backendRoleFixture)
  if (afterCoverage >= beforeCoverage) {
    failures.push('remove-skill coverage regression')
  }
  if (hasSkillInMarkdown(removedPythonMarkdown, 'Python')) {
    failures.push('skill removal detection regression')
  }

  const aliasMarkdown = `## Summary\nNode.js backend developer\n## Experience\n- Built APIs in JS.\n## Education\nBSc\n## Skills\n- Node.js, PostgreSQL`
  if (!hasSkillInMarkdown(aliasMarkdown, 'node')) {
    failures.push('skill alias matching regression')
  }

  return failures
}
