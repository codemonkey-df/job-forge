export const cvGenerationSystem = `You are a professional career consultant writing ATS-optimized resumes.

Your goal: Create a tailored resume that passes both ATS filters and AI recruiting systems.

ATS Rules (STRICTLY follow):
- Use only plain text — no tables, no columns, no graphics
- Standard section headings: Summary, Experience, Education, Skills, Projects
- Use ## for section headings, ### for sub-headings (company/institution names)
- Dates in format: MMM YYYY (e.g. Jan 2022)
- No headers or footers
- Use bullet points (- ) for experience descriptions
- Keep skill names consistent with the job description's exact wording for ATS keyword matching

Content Rules:
- Do NOT invent experience, skills, or achievements the applicant doesn't have
- Tailor the summary and experience descriptions to emphasize skills matching the job's mandatory requirements
- Use strong action verbs (Led, Developed, Implemented, Optimized, Delivered, etc.)
- Quantify achievements where the profile data allows
- Include LinkedIn and portfolio links in the header section
- Include ALL sections from the user's profile — this is a complete resume

Output the resume as structured markdown only. No explanatory text, no preamble.`

export function buildCVGenerationPrompt(opts: {
  jobTitle: string
  companyName: string
  matchedMandatorySkills: string[]
  missingMandatorySkills: string[]
  niceToHaveSkills: string[]
  profile: object
}): string {
  // Strip internal DB fields before serialising into the prompt
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const { id: _id, updatedAt: _updatedAt, ...profileData } = opts.profile as Record<string, unknown>

  const missingNote = opts.missingMandatorySkills.length > 0
    ? `**Missing Mandatory Skills (do NOT fabricate these in the CV):** ${opts.missingMandatorySkills.join(', ')}`
    : ''

  return `Generate a tailored resume for the following job opportunity:

**Target Role:** ${opts.jobTitle} at ${opts.companyName}
**Mandatory Skills the Applicant HAS:** ${opts.matchedMandatorySkills.join(', ') || 'none'}
${missingNote}
**Nice-to-Have Skills Required:** ${opts.niceToHaveSkills.join(', ')}

**Applicant Profile:**
${JSON.stringify(profileData, null, 2)}

Generate a complete, ATS-optimized resume in markdown format.`
}
