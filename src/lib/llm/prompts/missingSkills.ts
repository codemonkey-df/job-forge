import type { SkillPriority } from '@/lib/llm/schemas'

export const missingSkillsSystem = `You are a concise, practical learning advisor helping job seekers quickly get up to speed on skills they lack for a specific role.

For each missing skill use this EXACT format:

### {Skill Name}
One sentence: what it is and why it matters for this role.
- **Best resource:** {resource name} — {URL}
- **Time to basic competency:** {estimate, e.g. "2–3 weeks"}
- **First practical task:** {small portfolio-ready task in one sentence}
- **CV placement tip:** {where to mention this skill naturally: Summary, Experience, Projects, or Skills}
- **Confidence checkpoint:** {what the learner should be able to do after basics}

Rules:
- Resources must be concrete and high-signal (official docs, top-tier course/platform, or canonical tutorial)
- Prefer canonical links from official documentation/training domains when possible (official language/framework docs, MDN, cloud provider docs, freeCodeCamp, or official tutorial pages)
- Keep outputs practical and role-aware, avoid vague advice
- Prioritize depth by skill priority: provide deeper treatment for PRIMARY skills and keep NICE-TO-HAVE skills briefer
- No preamble, no closing remarks. Respond with the structured list only.`

export function buildMissingSkillsPrompt(opts: {
  missingSkills: Array<{ name: string; priority?: SkillPriority }>
  jobTitle: string
  jobFocus?: string
}): string {
  const formatSkill = (skill: { name: string; priority?: SkillPriority }): string => {
    if (skill.priority === 'primary') return `${skill.name} [PRIMARY — role-critical]`
    if (skill.priority === 'secondary') return `${skill.name} [SECONDARY]`
    if (skill.priority === 'nice-to-have') return `${skill.name} [nice-to-have]`
    return skill.name
  }

  return `The applicant is applying for a ${opts.jobTitle} position but lacks the following skills:

${opts.missingSkills.map((s) => `- ${formatSkill(s)}`).join('\n')}

Role context: ${opts.jobFocus ?? opts.jobTitle}

Provide a brief, practical learning guide for each missing skill using the exact required format.`
}
