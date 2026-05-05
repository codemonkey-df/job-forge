import { z } from 'zod'

export const ExtractedSkillSchema = z.object({
  name: z.string(),
  mandatory: z.boolean(),
  context: z.string().optional(), // What the skill is used for in this job
  priority: z.enum(['primary', 'secondary', 'nice-to-have']).optional(), // Priority level for this skill
})

export const NiceToHaveSkillSchema = z.object({
  name: z.string(),
  mandatory: z.literal(false),
  context: z.string().optional(), // What the skill is used for in this job
  priority: z.literal('nice-to-have').optional(), // Nice-to-have entries can only use nice-to-have priority
})

export const SkillExtractionResultSchema = z.object({
  companyName: z.string(),
  jobTitle: z.string(),
  mandatorySkills: z.array(ExtractedSkillSchema),
  niceToHaveSkills: z.array(NiceToHaveSkillSchema),
  jobFocus: z.string().optional(), // Core role description (e.g., "FastAPI backend engineer")
  keyResponsibilities: z.array(z.string()).optional(), // Key responsibilities indicating what the employer needs
  primarySkills: z.array(z.string()).optional(), // Skills critical to the role's primary focus
  leadingKeywords: z.array(
    z.object({
      keyword: z.string(),
      source: z.enum(['skill', 'responsibility', 'domain']).optional(),
      importance: z.enum(['high', 'medium', 'low']).optional(),
    }),
  ).optional(),
  summary: z.string().optional(),
  languageRequirements: z.array(
    z.object({
      language: z.string(),
      level: z.enum(['A1', 'A2', 'B1', 'B2', 'C1', 'C2', 'native']),
      mandatory: z.boolean(),
    }),
  ).optional(),
})

export type SkillExtractionResult = z.infer<typeof SkillExtractionResultSchema>

export type SkillPriority = 'primary' | 'secondary' | 'nice-to-have'

export const UserProfileDraftSchema = z.object({
  fullName: z.string().optional(),
  email: z.string().optional(),
  phone: z.string().optional(),
  location: z.string().optional(),
  linkedinUrl: z.string().optional(),
  portfolioUrl: z.string().optional(),
  githubUsername: z.string().optional(),
  summary: z.string().optional(),
  skills: z.array(
    z.object({
      name: z.string(),
      level: z.enum(['basic', 'intermediate', 'advanced', 'expert']),
      category: z.string().optional(),
    }),
  ).optional(),
  languages: z.array(
    z.object({
      language: z.string(),
      level: z.enum(['A1', 'A2', 'B1', 'B2', 'C1', 'C2', 'native']),
    }),
  ).optional(),
  experience: z.array(
    z.object({
      company: z.string(),
      title: z.string(),
      startDate: z.string().optional(),
      endDate: z.string().optional(),
      // Models often omit bullets; coerce so structured mode + Zod do not force a second LLM round-trip
      description: z
        .string()
        .optional()
        .transform((s) => s ?? ''),
    }),
  ).optional(),
  education: z.array(
    z.object({
      institution: z.string(),
      degree: z.string(),
      field: z.string(),
      startDate: z.string().optional(),
      endDate: z.string().optional(),
    }),
  ).optional(),
  projects: z.array(
    z.object({
      name: z.string(),
      description: z
        .string()
        .optional()
        .transform((s) => s ?? ''),
      url: z.string().optional(),
      githubUrl: z.string().optional(),
      source: z.enum(['manual', 'github']).optional(),
      technologies: z
        .array(z.string())
        .optional()
        .transform((t) => t ?? []),
    }),
  ).optional(),
})

/** Use `output` so nested `.transform()` fields (e.g. `description`) are typed as post-parse shapes */
export type UserProfileDraft = z.output<typeof UserProfileDraftSchema>

export const CVRewriteResultSchema = z.object({
  rewrittenText: z.string(),
  notes: z.string().optional(),
})

export type CVRewriteResult = z.infer<typeof CVRewriteResultSchema>
