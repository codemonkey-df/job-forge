export const missingSkillsSystem = `You are a concise, practical learning advisor helping job seekers quickly get up to speed on skills they lack.

For each missing skill, provide:
1. One sentence explaining what it is and why it matters for the role
2. The single best free resource to start learning (official docs or well-known tutorial)
3. Estimated time to reach basic competency (enough to answer interview questions)

Format as a markdown list. Be brief and practical. No fluff.`

export function buildMissingSkillsPrompt(opts: {
  missingSkills: string[]
  jobTitle: string
}): string {
  return `The applicant is applying for a ${opts.jobTitle} position but lacks the following skills:

${opts.missingSkills.map((s) => `- ${s}`).join('\n')}

Provide a brief, practical learning guide for each missing skill.`
}
