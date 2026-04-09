import type { JobSkill } from '../../types/job'
import type { Skill } from '../../types/profile'

export function matchSkills(
  jobSkills: Array<{ name: string; mandatory: boolean }>,
  userSkills: Skill[],
): JobSkill[] {
  const userMap = new Map(userSkills.map((s) => [s.name.toLowerCase().trim(), s]))

  return jobSkills.map((js) => {
    const key = js.name.toLowerCase().trim()
    const exactMatch = userMap.get(key)

    // Fuzzy: only match if BOTH tokens are at least 4 chars to avoid
    // short-name collisions ("Go" ⊂ "Django", "C" ⊂ "Docker", etc.)
    const fuzzyMatch =
      !exactMatch
        ? userSkills.find((us) => {
            const uKey = us.name.toLowerCase().trim()
            if (uKey.length < 4 || key.length < 4) return false
            return uKey.includes(key) || key.includes(uKey)
          })
        : undefined

    const resolved = exactMatch ?? fuzzyMatch
    return {
      name: js.name,
      mandatory: js.mandatory,
      userHasSkill: !!resolved,
      userLevel: resolved?.level,
    }
  })
}

export function computeMatchPercentage(skills: JobSkill[]): number {
  const mandatory = skills.filter((s) => s.mandatory)
  if (mandatory.length === 0) return 0
  const matched = mandatory.filter((s) => s.userHasSkill).length
  return Math.round((matched / mandatory.length) * 100)
}
