export const cvGenerationSystem = `You are a professional career consultant writing ATS-optimized resumes.

Your goal: Create a tailored resume that passes both ATS filters and AI recruiting systems.

ATS Rules (STRICTLY follow):
- Use only plain text — no tables, no columns, no graphics
- If the user needs manual PDF page breaks, prefer the literal token <-new_page-> (HTML comment pagebreak is equivalent); do not add breaks unless asked
- Document header (exactly once at the very top): a single H1 line with full name, then 1–3 contact lines (email, phone, links). Do NOT add a second header block as an H2 with the same name that only repeats contact details in pipe-separated form — that duplicates the top header and hurts readability
- After the H1 name + contact lines, add a one-line role headline that mirrors the exact job title wording from the posting when available (e.g. "Senior Python Backend Engineer | FastAPI | AWS | Docker"); use primary skills/domain focus; do NOT repeat this headline elsewhere
- Standard section headings after the header/headline: Professional Summary, Technical Skills, Work Experience, Education, Projects — each as H2 section headings only
- Use ## for section headings, ### for sub-headings (company/institution names)
- Dates in format: MMM YYYY (e.g. Jan 2022)
- No headers or footers
- Use bullet points (- ) for experience descriptions
- Use the job description's EXACT skill keywords in the Technical Skills section for ATS keyword matching
- Do NOT repeat the same line twice in a row (especially in Education and heading-adjacent lines)

Skills Section Rules (CRITICAL for ATS):
- Include EVERY mandatory skill from the job, using the job's exact keyword
- For skills the applicant HAS: list with their proficiency level, e.g. "Python (Advanced)"
- For skills the applicant is MISSING: list the keyword with NO level badge (ATS keyword coverage only; do not fabricate proficiency)
- Do NOT skip any mandatory skill from the Skills section
- CRITICAL: If a job lists a skill as "To learn" or at a lower level, DO NOT assign a higher level than the job expects

Skills Section FORMAT (use EXACTLY this structure):
## Technical Skills

**Languages**  
- Python (Advanced), TypeScript (Intermediate)

**Frameworks & Libraries**  
- Django, FastAPI, React

**Cloud & DevOps**  
- GCP, CI/CD (Continuous Integration/Delivery), Docker

**Databases**  
- PostgreSQL, Redis

**Tools & Platforms**  
- Git, GitHub Actions, Jira

**AI/ML**  
- LLMs, LangChain

- Use bold category headers (## Technical Skills, then one of the required category names)
- Each category starts with a new line after blank line
- List skills on same line after "- "
- Only include level badges for skills where you have level info
- Use these categories: Languages | Frameworks & Libraries | Cloud & DevOps | Databases | Tools & Platforms | AI/ML
- Where acronym and full form differ, include both forms when possible (e.g. "CI/CD (Continuous Integration/Delivery)")
- Remove duplicates and normalize awkward variants (e.g. prefer "REST APIs" over "REST API", avoid duplicated "FastAPI" entries)
- In AI/ML, prefer concrete tools from profile evidence over vague labels (e.g. list specific frameworks/platforms instead of generic "Big Data")

Content Rules:
- Do NOT invent work experience, projects, or achievements the applicant doesn't have
- Tailor the summary and experience descriptions to emphasize the applicant's relevant skills
- Keep Professional Summary aligned to target role narrative (for backend roles, emphasize service ownership, API/system delivery, and production impact over unrelated focus areas)
- Use strong action verbs (Led, Developed, Implemented, Optimized, Delivered, etc.)
- Quantify achievements where the profile data allows
- Experience bullet pattern: action verb + what you built/changed + technologies + measurable outcome
- Embed primary and secondary job skills naturally inside Work Experience bullets, not only in Technical Skills
- For backend-targeted jobs, increase explicit backend context in recent roles where truthful (Python backend services, REST APIs, microservices, Docker, AWS, etc.)
- Include LinkedIn and portfolio links in the header section
- Include ALL experience entries from the profile, but minimize bullet points for roles with little overlap with the job
- Skills section: include every mandatory job keyword (with levels per the rules above) plus the nice-to-have skills requested for this CV — do NOT list unrelated profile skills that appear only in the "Skills to EXCLUDE" list in the user prompt (those add noise for this application)
- Projects: use only real project entries from the applicant profile JSON; follow project order and GitHub link formatting from the user prompt

REPOSITIONING INSTRUCTIONS (CRITICAL):
- Explicitly emphasize experience and skills that match the job's primary focus and key responsibilities
- Reposition the user's past experience to highlight alignment with what the employer wants
- Connect past achievements to the job requirements by emphasizing transferable skills
- Use the jobFocus and keyResponsibilities to frame the user's experience in context
- Emphasize PRIMARY skills more than SECONDARY or NICE-TO-HAVE skills throughout the resume
- In the Professional Summary and Work Experience sections, use language that mirrors the job description's focus

OUTPUT INSTRUCTIONS:
- Start with a strong professional summary that aligns with the jobFocus
- In Work Experience section, reposition achievements to highlight job-relevant skills
- Use action verbs and quantify results where possible
- The Technical Skills section MUST include all mandatory skills (levels only where proficiency is known; no level badge for missing mandatory skills)
- Make the resume compelling for both ATS and human reviewers
- Target 88–95% ATS alignment: include ALL mandatory keywords (non-negotiable for ATS filters) but only weave in 60–80% of nice-to-have keywords where they fit naturally — intentional omission of a few optional skills looks authentic; 100% coverage flags AI keyword-stuffing to human reviewers
- Ensure no adjacent duplicate lines in any section (case-insensitive, markdown-format-insensitive)

Output the resume as structured markdown only. No explanatory text, no preamble.`

export function buildCVGenerationPrompt(opts: {
  jobTitle: string
  companyName: string
  jobFocus?: string
  keyResponsibilities?: string[]
  primarySkills?: string[]
  leadingKeywords?: string[]
  matchedMandatorySkills: Array<{ name: string; level?: string }>
  missingMandatorySkills: string[]
  niceToHaveSkills: string[]
  skillAliases?: Array<{ jobKeyword: string; userSkill: string }>
  /** User profile skills not mapped to this job — must not appear in the Skills section */
  excludedSkills: string[]
  /** Project names in job-relevance order (most relevant first) */
  rankedProjects?: string[]
  profile: object
}): string {
  // Strip internal DB fields before serialising into the prompt
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const { id: _id, updatedAt: _updatedAt, createdAt: _createdAt, ...profileData } = opts.profile as Record<string, unknown>

  const matchedList = opts.matchedMandatorySkills
    .map((s) => s.level ? `${s.name} (${s.level})` : s.name)
    .join(', ') || 'none'

  const missingList = opts.missingMandatorySkills.join(', ')

  const aliasNote = opts.skillAliases && opts.skillAliases.length > 0
    ? `**Skill Keyword Aliases (use the job's exact keyword in CV):**\n${opts.skillAliases.map((a) => `- "${a.jobKeyword}" in the job = "${a.userSkill}" in the applicant's profile`).join('\n')}`
    : ''

  // Build job focus and requirements section
  const jobFocusSection = opts.jobFocus
    ? `**Job Focus:** ${opts.jobFocus}`
    : `**Target Role:** ${opts.jobTitle} at ${opts.companyName}`

  const keyResponsibilitiesSection = opts.keyResponsibilities && opts.keyResponsibilities.length > 0
    ? `**Key Responsibilities:**\n${opts.keyResponsibilities.map((r, i) => `- ${i + 1}. ${r}`).join('\n')}`
    : ''

  const primarySkillsSection = opts.primarySkills && opts.primarySkills.length > 0
    ? `**Primary Skills (emphasize these):** ${opts.primarySkills.join(', ')}`
    : ''

  const leadingKeywordsSection = opts.leadingKeywords && opts.leadingKeywords.length > 0
    ? `**Leading ATS Keywords (prioritize natural usage in Professional Summary and Work Experience):** ${opts.leadingKeywords.join(', ')}`
    : ''

  const excludedList = opts.excludedSkills.length > 0 ? opts.excludedSkills.join(', ') : 'none'

  const rankedProjectsSection =
    opts.rankedProjects && opts.rankedProjects.length > 0
      ? `**Projects in relevance order** (most relevant first): ${opts.rankedProjects.join(', ')}
- List projects in this order in the Projects section
- Projects not in this list may be omitted only if space is tight; never invent projects
- For each project, if the profile JSON includes a githubUrl for that project, use a subheading like: ### Project Name | [GitHub](url) (link must match profile githubUrl)`
      : ''

  const skillsExcludeBlock = `**Skills to EXCLUDE from the Skills section** (the applicant has these in their profile but they are not relevant to this job listing — do NOT list them under Skills; they add noise for this application): ${excludedList}`

  return `Generate a tailored resume for the following job opportunity:

${jobFocusSection}
${primarySkillsSection}
${leadingKeywordsSection}
${keyResponsibilitiesSection}

**Mandatory Skills the Applicant HAS (include with stated level, emphasize primary skills):** ${matchedList}
**Mandatory Skills the Applicant is MISSING (include as exact keywords, no level badge):** ${missingList || 'none'}
${aliasNote}
**Nice-to-Have Skills to Include:** ${opts.niceToHaveSkills.join(', ') || 'none'}

${skillsExcludeBlock}
${rankedProjectsSection}

**Applicant Profile:**
${JSON.stringify(profileData, null, 2)}

CRITICAL INSTRUCTIONS:
1. Reposition the user's experience to highlight alignment with the jobFocus and key responsibilities
2. Emphasize PRIMARY skills throughout the resume (summary, experience, skills)
3. Connect past achievements to what the employer wants by showcasing transferable experience
4. Use language that mirrors the job description's focus
5. Generate a complete, ATS-optimized resume in markdown format. Remember: every mandatory skill MUST appear in the Skills section.
6. Avoid keyword stuffing. Use leading keywords only where supported by real experience evidence from the profile.
7. Keep layout single-column and plain text friendly for ATS parsing.
8. Never duplicate the applicant name and contact block: after the initial H1 name plus contact lines and one-line headline, the next heading must be a real section (Professional Summary or Work Experience as H2), not another name-as-heading with the same email, phone, or LinkedIn repeated

Projects Section:
- If profile projects are missing/empty: extract 1-3 notable technical deliverables from Work Experience descriptions and present them as mini project entries
- For derived projects, use only words/facts already present in Work Experience text; never invent technologies, outcomes, or scope
- If profile projects exist: use only projects from the applicant profile; describe technologies and outcomes using profile facts only (no fabrication)
- For any project that has githubUrl in the profile JSON, use a subheading: ### Project Name | [GitHub](url) with the exact URL from the profile
- Prefer profile projects whenever present; only use derived projects as fallback when profile projects are absent
- In each project description, explicitly surface relevant language/framework/platform keywords and role contribution when present in profile facts (e.g. Python, Docker, REST APIs, AWS, LLMs)
  `;
}

export const cvRewriteSystem = `You are a CV writing assistant improving a specific selected excerpt.

Rules:
- Preserve original meaning and factual content.
- Improve clarity, impact, and conciseness.
- Keep ATS-critical skills and keywords from the source when present.
- Do not invent achievements, tools, or responsibilities.
- Return JSON only with this shape: {"rewrittenText":"...","notes":"..."}.
- rewrittenText must contain only the rewritten excerpt, no markdown code fences, no explanation.`

export function buildCVRewritePrompt(opts: {
  selectedText: string
  jobTitle?: string
  companyName?: string
  mandatorySkills: string[]
  niceToHaveSkills: string[]
  jobDescriptionExcerpt?: string
  profileSummary?: string
  currentSectionHeading?: string
}): string {
  return `Rewrite the selected CV text with ATS-aware improvements.

Selected text:
${opts.selectedText}

Context:
- Job title: ${opts.jobTitle ?? 'n/a'}
- Company: ${opts.companyName ?? 'n/a'}
- Current section: ${opts.currentSectionHeading ?? 'n/a'}
- Mandatory skills: ${opts.mandatorySkills.join(', ') || 'none'}
- Nice-to-have skills: ${opts.niceToHaveSkills.join(', ') || 'none'}
- Job description excerpt: ${opts.jobDescriptionExcerpt ?? 'n/a'}
- Profile summary: ${opts.profileSummary ?? 'n/a'}

Return strict JSON:
{
  "rewrittenText": "<rewritten selected text>",
  "notes": "<optional short note>"
}`
}