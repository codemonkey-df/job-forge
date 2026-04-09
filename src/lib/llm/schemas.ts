import { z } from 'zod'

export const ExtractedSkillSchema = z.object({
  name: z.string(),
  mandatory: z.boolean(),
})

export const SkillExtractionResultSchema = z.object({
  companyName: z.string(),
  jobTitle: z.string(),
  mandatorySkills: z.array(ExtractedSkillSchema),
  niceToHaveSkills: z.array(ExtractedSkillSchema),
  summary: z.string().optional(),
})

export type SkillExtractionResult = z.infer<typeof SkillExtractionResultSchema>

export const UserProfileDraftSchema = z.object({
  fullName: z.string().optional(),
  email: z.string().optional(),
  phone: z.string().optional(),
  location: z.string().optional(),
  summary: z.string().optional(),
  skills: z.array(
    z.object({
      name: z.string(),
      level: z.enum(['basic', 'intermediate', 'advanced', 'expert']),
      category: z.string().optional(),
    }),
  ).optional(),
  experience: z.array(
    z.object({
      company: z.string(),
      title: z.string(),
      startDate: z.string().optional(),
      endDate: z.string().optional(),
      description: z.string(),
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
      description: z.string(),
      url: z.string().optional(),
      technologies: z.array(z.string()),
    }),
  ).optional(),
})

export type UserProfileDraft = z.infer<typeof UserProfileDraftSchema>
