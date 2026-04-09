import { useState, useEffect } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { Save, Upload, Loader2 } from 'lucide-react'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Label } from '@/components/ui/label'
import { Card, CardContent } from '@/components/ui/card'
import { SkillsManager } from '@/components/profile/SkillsManager'
import { ExperienceEditor } from './ExperienceEditor'
import { useProfileStore } from '@/store/profileStore'
import { useSettingsStore } from '@/store/settingsStore'
import { useToast } from '@/hooks/use-toast'
import { extractTextFromPDF } from '@/lib/utils/cvUploader'
import { extractStructured } from '@/lib/llm/client'
import { UserProfileDraftSchema } from '@/lib/llm/schemas'
import { profileExtractionSystem } from '@/lib/llm/prompts/profileExtraction'
import type { Skill, WorkExperience, Education, Project } from '@/types/profile'

const schema = z.object({
  fullName: z.string().min(1, 'Name is required'),
  email: z.string().email('Invalid email'),
  phone: z.string().optional(),
  location: z.string().optional(),
  linkedinUrl: z.string().optional(),
  portfolioUrl: z.string().optional(),
  summary: z.string().optional(),
})

type FormValues = z.infer<typeof schema>

function emptyEducation(): Education {
  return { institution: '', degree: '', field: '', startDate: '', endDate: '' }
}

function emptyProject(): Project {
  return { name: '', description: '', url: '', technologies: [] }
}

export function CVEditor() {
  const { profile, saveProfile } = useProfileStore()
  const { toast } = useToast()
  const [skills, setSkills] = useState<Skill[]>(profile?.skills ?? [])
  const [experience, setExperience] = useState<WorkExperience[]>(profile?.experience ?? [])
  const [education, setEducation] = useState<Education[]>(profile?.education ?? [])
  const [projects, setProjects] = useState<Project[]>(profile?.projects ?? [])
  const [isParsing, setIsParsing] = useState(false)

  const { register, handleSubmit, reset, formState: { errors, isSubmitting } } = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: {
      fullName: profile?.fullName ?? '',
      email: profile?.email ?? '',
      phone: profile?.phone ?? '',
      location: profile?.location ?? '',
      linkedinUrl: profile?.linkedinUrl ?? '',
      portfolioUrl: profile?.portfolioUrl ?? '',
      summary: profile?.summary ?? '',
    },
  })

  useEffect(() => {
    if (profile) {
      reset({
        fullName: profile.fullName,
        email: profile.email,
        phone: profile.phone ?? '',
        location: profile.location ?? '',
        linkedinUrl: profile.linkedinUrl ?? '',
        portfolioUrl: profile.portfolioUrl ?? '',
        summary: profile.summary ?? '',
      })
      setSkills(profile.skills)
      setExperience(profile.experience)
      setEducation(profile.education)
      setProjects(profile.projects)
    }
  }, [profile, reset])

  async function onSubmit(data: FormValues) {
    await saveProfile({ ...data, skills, experience, education, projects })
    toast({ title: 'Profile saved', variant: 'success' })
  }

  async function handlePDFUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    
    // Check if LLM is configured before attempting to parse
    const { llm } = useSettingsStore.getState()
    if (!llm.model) {
      toast({
        title: 'LLM not configured',
        description: 'Please configure your AI provider in Settings first.',
        variant: 'destructive'
      })
      return
    }
    
    setIsParsing(true)
    try {
      const text = await extractTextFromPDF(file)
      console.log('Extracted text from PDF:', text.substring(0, 200) + '...') // Log first 200 chars
      const draft = await extractStructured({
        prompt: `Extract all profile information from the following CV text:\n\n${text}`,
        schema: UserProfileDraftSchema,
        systemPrompt: profileExtractionSystem,
      })
      if (draft.fullName) reset((prev) => ({ ...prev, fullName: draft.fullName ?? prev.fullName }))
      if (draft.email) reset((prev) => ({ ...prev, email: draft.email ?? prev.email }))
      if (draft.phone) reset((prev) => ({ ...prev, phone: draft.phone ?? prev.phone }))
      if (draft.location) reset((prev) => ({ ...prev, location: draft.location ?? prev.location }))
      if (draft.summary) reset((prev) => ({ ...prev, summary: draft.summary ?? prev.summary }))
      if (draft.skills?.length) setSkills(draft.skills)
      if (draft.experience?.length) setExperience(draft.experience)
      if (draft.education?.length) setEducation(draft.education)
      if (draft.projects?.length) setProjects(draft.projects)
      toast({ title: 'CV parsed successfully', description: 'Review and save your profile.' })
    } catch (error) {
      console.error('CV upload error:', error)
      const errorMessage = error instanceof Error ? error.message : 'Unknown error'
      toast({ title: 'Parse failed', description: `Could not parse CV: ${errorMessage}`, variant: 'destructive' })
    } finally {
      setIsParsing(false)
      e.target.value = ''
    }
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)}>
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <label className="cursor-pointer">
            <Button type="button" variant="outline" size="sm" disabled={isParsing} asChild>
              <span>
                {isParsing ? <Loader2 className="size-4 animate-spin" /> : <Upload className="size-4" />}
                Import from PDF
              </span>
            </Button>
            <input type="file" accept=".pdf" className="hidden" onChange={handlePDFUpload} />
          </label>
        </div>
        <Button type="submit" size="sm" disabled={isSubmitting}>
          {isSubmitting ? <Loader2 className="size-4 animate-spin" /> : <Save className="size-4" />}
          Save Profile
        </Button>
      </div>

      <Tabs defaultValue="personal">
        <TabsList className="mb-4">
          <TabsTrigger value="personal">Personal Info</TabsTrigger>
          <TabsTrigger value="skills">Skills</TabsTrigger>
          <TabsTrigger value="experience">Experience</TabsTrigger>
          <TabsTrigger value="education">Education & Projects</TabsTrigger>
        </TabsList>

        <TabsContent value="personal">
          <Card>
            <CardContent className="pt-6 space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1">
                  <Label>Full Name *</Label>
                  <Input {...register('fullName')} placeholder="John Doe" />
                  {errors.fullName && <p className="text-xs text-destructive">{errors.fullName.message}</p>}
                </div>
                <div className="space-y-1">
                  <Label>Email *</Label>
                  <Input type="email" {...register('email')} placeholder="john@example.com" />
                  {errors.email && <p className="text-xs text-destructive">{errors.email.message}</p>}
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1">
                  <Label>Phone</Label>
                  <Input {...register('phone')} placeholder="+1 234 567 8900" />
                </div>
                <div className="space-y-1">
                  <Label>Location</Label>
                  <Input {...register('location')} placeholder="San Francisco, CA" />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1">
                  <Label>LinkedIn URL</Label>
                  <Input {...register('linkedinUrl')} placeholder="https://linkedin.com/in/..." />
                </div>
                <div className="space-y-1">
                  <Label>Portfolio / Website</Label>
                  <Input {...register('portfolioUrl')} placeholder="https://yoursite.com" />
                </div>
              </div>
              <div className="space-y-1">
                <Label>Professional Summary</Label>
                <Textarea {...register('summary')} placeholder="Brief professional summary..." rows={4} />
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="skills">
          <Card>
            <CardContent className="pt-6">
              <SkillsManager skills={skills} onChange={setSkills} />
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="experience">
          <Card>
            <CardContent className="pt-6">
              <ExperienceEditor items={experience} onChange={setExperience} />
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="education">
          <Card>
            <CardContent className="pt-6 space-y-6">
              <div>
                <h3 className="text-sm font-semibold mb-3">Education</h3>
                <div className="space-y-3">
                  {education.map((edu, i) => (
                    <div key={i} className="border rounded-lg p-4 space-y-3">
                      <div className="grid grid-cols-2 gap-3">
                        <div className="space-y-1">
                          <Label className="text-xs">Institution</Label>
                          <Input
                            value={edu.institution}
                            onChange={(e) => setEducation(education.map((ed, idx) => idx === i ? { ...ed, institution: e.target.value } : ed))}
                            placeholder="MIT"
                          />
                        </div>
                        <div className="space-y-1">
                          <Label className="text-xs">Degree</Label>
                          <Input
                            value={edu.degree}
                            onChange={(e) => setEducation(education.map((ed, idx) => idx === i ? { ...ed, degree: e.target.value } : ed))}
                            placeholder="Bachelor of Science"
                          />
                        </div>
                      </div>
                      <div className="grid grid-cols-3 gap-3">
                        <div className="space-y-1">
                          <Label className="text-xs">Field</Label>
                          <Input
                            value={edu.field}
                            onChange={(e) => setEducation(education.map((ed, idx) => idx === i ? { ...ed, field: e.target.value } : ed))}
                            placeholder="Computer Science"
                          />
                        </div>
                        <div className="space-y-1">
                          <Label className="text-xs">Start</Label>
                          <Input
                            value={edu.startDate}
                            onChange={(e) => setEducation(education.map((ed, idx) => idx === i ? { ...ed, startDate: e.target.value } : ed))}
                            placeholder="Sep 2018"
                          />
                        </div>
                        <div className="space-y-1">
                          <Label className="text-xs">End</Label>
                          <Input
                            value={edu.endDate ?? ''}
                            onChange={(e) => setEducation(education.map((ed, idx) => idx === i ? { ...ed, endDate: e.target.value } : ed))}
                            placeholder="Jun 2022"
                          />
                        </div>
                      </div>
                      <Button type="button" variant="ghost" size="sm" className="text-destructive" onClick={() => setEducation(education.filter((_, idx) => idx !== i))}>
                        Remove
                      </Button>
                    </div>
                  ))}
                  <Button type="button" variant="outline" className="w-full" onClick={() => setEducation([...education, emptyEducation()])}>
                    + Add Education
                  </Button>
                </div>
              </div>

              <div>
                <h3 className="text-sm font-semibold mb-3">Projects</h3>
                <div className="space-y-3">
                  {projects.map((proj, i) => (
                    <div key={i} className="border rounded-lg p-4 space-y-3">
                      <div className="grid grid-cols-2 gap-3">
                        <div className="space-y-1">
                          <Label className="text-xs">Project Name</Label>
                          <Input
                            value={proj.name}
                            onChange={(e) => setProjects(projects.map((p, idx) => idx === i ? { ...p, name: e.target.value } : p))}
                            placeholder="My Awesome Project"
                          />
                        </div>
                        <div className="space-y-1">
                          <Label className="text-xs">URL (optional)</Label>
                          <Input
                            value={proj.url ?? ''}
                            onChange={(e) => setProjects(projects.map((p, idx) => idx === i ? { ...p, url: e.target.value } : p))}
                            placeholder="https://github.com/..."
                          />
                        </div>
                      </div>
                      <div className="space-y-1">
                        <Label className="text-xs">Description</Label>
                        <Textarea
                          value={proj.description}
                          onChange={(e) => setProjects(projects.map((p, idx) => idx === i ? { ...p, description: e.target.value } : p))}
                          placeholder="Brief description..."
                          rows={2}
                        />
                      </div>
                      <div className="space-y-1">
                        <Label className="text-xs">Technologies (comma-separated)</Label>
                        <Input
                          value={proj.technologies.join(', ')}
                          onChange={(e) => setProjects(projects.map((p, idx) => idx === i ? { ...p, technologies: e.target.value.split(',').map((t) => t.trim()).filter(Boolean) } : p))}
                          placeholder="React, TypeScript, Node.js"
                        />
                      </div>
                      <Button type="button" variant="ghost" size="sm" className="text-destructive" onClick={() => setProjects(projects.filter((_, idx) => idx !== i))}>
                        Remove
                      </Button>
                    </div>
                  ))}
                  <Button type="button" variant="outline" className="w-full" onClick={() => setProjects([...projects, emptyProject()])}>
                    + Add Project
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </form>
  )
}
