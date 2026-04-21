import { useState, useEffect } from 'react'
import { useProfileStore } from '@/store/profileStore'
import { calculateProfileCompleteness } from '@/lib/utils/auth'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Card, CardContent } from '@/components/ui/card'
import { SkillsManager } from '@/components/profile/SkillsManager'
import { useToast } from '@/hooks/use-toast'
import { CheckCircle2 } from 'lucide-react'
import type { Skill, WorkExperience, Education } from '@/types/profile'

interface OnboardingStepProps {
  profile: any
  setProfile: React.Dispatch<React.SetStateAction<any>>
  errors?: any
}

function PersonalInfoStep({ profile, setProfile, errors }: OnboardingStepProps) {
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label>Full Name *</Label>
          <Input
            value={profile.fullName || ''}
            onChange={(e) => setProfile({ ...profile, fullName: e.target.value })}
            placeholder="John Doe"
          />
          {errors.fullName && <p className="text-xs text-destructive">{errors.fullName}</p>}
        </div>
        <div className="space-y-2">
          <Label>Email *</Label>
          <Input
            type="email"
            value={profile.email || ''}
            onChange={(e) => setProfile({ ...profile, email: e.target.value })}
            placeholder="john@example.com"
          />
          {errors.email && <p className="text-xs text-destructive">{errors.email}</p>}
        </div>
      </div>
      <div className="space-y-2">
        <Label>Phone</Label>
        <Input
          value={profile.phone || ''}
          onChange={(e) => setProfile({ ...profile, phone: e.target.value })}
          placeholder="+1 234 567 8900"
        />
      </div>
      <div className="space-y-2">
        <Label>Location</Label>
        <Input
          value={profile.location || ''}
          onChange={(e) => setProfile({ ...profile, location: e.target.value })}
          placeholder="San Francisco, CA"
        />
      </div>
      <div className="space-y-2">
        <Label>LinkedIn URL</Label>
        <Input
          value={profile.linkedinUrl || ''}
          onChange={(e) => setProfile({ ...profile, linkedinUrl: e.target.value })}
          placeholder="https://linkedin.com/in/..."
        />
      </div>
      <div className="space-y-2">
        <Label>Portfolio URL</Label>
        <Input
          value={profile.portfolioUrl || ''}
          onChange={(e) => setProfile({ ...profile, portfolioUrl: e.target.value })}
          placeholder="https://yoursite.com"
        />
      </div>
    </div>
  )
}

function SkillsStep({ profile, setProfile, errors }: OnboardingStepProps) {
  const [skills, setSkills] = useState<Skill[]>(profile.skills || [])
  const [pendingSkillName, setPendingSkillName] = useState('')
  const [pendingSkillLevel, setPendingSkillLevel] = useState<Skill['level']>('intermediate')

  useEffect(() => {
    setProfile((prev: any) => ({ ...prev, skills }))
  }, [skills, setProfile])

  return (
    <div className="space-y-4">
      <div className="space-y-2">
        <Label>Skills *</Label>
        <p className="text-xs text-muted-foreground">
          Add 3-5 key skills relevant to your target role.
        </p>
      </div>
      <Card>
        <CardContent className="pt-6">
          <SkillsManager
            skills={skills}
            onChange={setSkills}
            pendingName={pendingSkillName}
            pendingLevel={pendingSkillLevel}
            onPendingNameChange={setPendingSkillName}
            onPendingLevelChange={setPendingSkillLevel}
            onAddPendingSkill={() => {
              const trimmedName = pendingSkillName.trim()
              if (!trimmedName) return
              setSkills((prev) => [...prev, { name: trimmedName, level: pendingSkillLevel }])
              setPendingSkillName('')
              setPendingSkillLevel('intermediate')
            }}
          />
        </CardContent>
      </Card>
      {errors.skills && <p className="text-xs text-destructive">{errors.skills}</p>}
    </div>
  )
}

function ExperienceStep({ profile, setProfile }: OnboardingStepProps) {
  const [experience, setExperience] = useState<WorkExperience[]>(profile.experience || [])

  useEffect(() => {
    setProfile((prev: any) => ({ ...prev, experience }))
  }, [experience, setProfile])

  function addExperience() {
    setExperience([
      ...experience,
      { company: '', title: '', description: '', startDate: '', endDate: '' },
    ])
  }

  function removeExperience(index: number) {
    setExperience(experience.filter((_, i) => i !== index))
  }

  function updateExperience(index: number, field: keyof WorkExperience, value: string) {
    setExperience(
      experience.map((exp, i) => (i === index ? { ...exp, [field]: value } : exp)),
    )
  }

  return (
    <div className="space-y-4">
      <div className="space-y-2">
        <Label>Work Experience</Label>
        <p className="text-xs text-muted-foreground">
          Add your current or most recent job.
        </p>
      </div>
      <div className="space-y-3">
        {experience.map((exp, i) => (
          <div key={i} className="border rounded-lg p-4 space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label className="text-xs">Company</Label>
                <Input
                  value={exp.company}
                  onChange={(e) => updateExperience(i, 'company', e.target.value)}
                  placeholder="Google"
                />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Title</Label>
                <Input
                  value={exp.title}
                  onChange={(e) => updateExperience(i, 'title', e.target.value)}
                  placeholder="Software Engineer"
                />
              </div>
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Description</Label>
              <Textarea
                value={exp.description}
                onChange={(e) => updateExperience(i, 'description', e.target.value)}
                placeholder="Brief description of your role..."
                rows={2}
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label className="text-xs">Start Date</Label>
                <Input
                  value={exp.startDate || ''}
                  onChange={(e) => updateExperience(i, 'startDate', e.target.value)}
                  placeholder="Jan 2020"
                />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">End Date</Label>
                <Input
                  value={exp.endDate || ''}
                  onChange={(e) => updateExperience(i, 'endDate', e.target.value)}
                  placeholder="Present"
                />
              </div>
            </div>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="text-destructive"
              onClick={() => removeExperience(i)}
            >
              Remove
            </Button>
          </div>
        ))}
        <Button type="button" variant="outline" className="w-full" onClick={addExperience}>
          + Add Experience
        </Button>
      </div>
    </div>
  )
}

function EducationStep({ profile, setProfile }: OnboardingStepProps) {
  const [education, setEducation] = useState<Education[]>(profile.education || [])

  useEffect(() => {
    setProfile((prev: any) => ({ ...prev, education }))
  }, [education, setProfile])

  function addEducation() {
    setEducation([
      ...education,
      { institution: '', degree: '', field: '', startDate: '', endDate: '' },
    ])
  }

  function removeEducation(index: number) {
    setEducation(education.filter((_, i) => i !== index))
  }

  function updateEducation(index: number, field: keyof Education, value: string) {
    setEducation(
      education.map((edu, i) => (i === index ? { ...edu, [field]: value } : edu)),
    )
  }

  return (
    <div className="space-y-4">
      <div className="space-y-2">
        <Label>Education</Label>
        <p className="text-xs text-muted-foreground">
          Add your most recent education entry.
        </p>
      </div>
      <div className="space-y-3">
        {education.map((edu, i) => (
          <div key={i} className="border rounded-lg p-4 space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label className="text-xs">Institution</Label>
                <Input
                  value={edu.institution}
                  onChange={(e) => updateEducation(i, 'institution', e.target.value)}
                  placeholder="MIT"
                />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Degree</Label>
                <Input
                  value={edu.degree}
                  onChange={(e) => updateEducation(i, 'degree', e.target.value)}
                  placeholder="Bachelor of Science"
                />
              </div>
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Field</Label>
              <Input
                value={edu.field}
                onChange={(e) => updateEducation(i, 'field', e.target.value)}
                placeholder="Computer Science"
              />
            </div>
            <div className="grid grid-cols-3 gap-3">
              <div className="space-y-1">
                <Label className="text-xs">Start</Label>
                <Input
                  value={edu.startDate || ''}
                  onChange={(e) => updateEducation(i, 'startDate', e.target.value)}
                  placeholder="Sep 2018"
                />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">End</Label>
                <Input
                  value={edu.endDate || ''}
                  onChange={(e) => updateEducation(i, 'endDate', e.target.value)}
                  placeholder="Jun 2022"
                />
              </div>
            </div>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="text-destructive"
              onClick={() => removeEducation(i)}
            >
              Remove
            </Button>
          </div>
        ))}
        <Button type="button" variant="outline" className="w-full" onClick={addEducation}>
          + Add Education
        </Button>
      </div>
    </div>
  )
}

function SummaryStep({ profile, setProfile, errors }: OnboardingStepProps) {
  return (
    <div className="space-y-4">
      <div className="space-y-2">
        <Label>Professional Summary</Label>
        <p className="text-xs text-muted-foreground">
          Write a brief overview of your professional background and goals.
        </p>
      </div>
      <div className="space-y-2">
        <Textarea
          value={profile.summary || ''}
          onChange={(e) => setProfile({ ...profile, summary: e.target.value })}
          placeholder="Brief professional summary..."
          rows={6}
        />
        {errors.summary && <p className="text-xs text-destructive">{errors.summary}</p>}
      </div>
    </div>
  )
}

interface ProfileOnboardingProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  onComplete: () => void
  prefill?: Partial<{
    fullName: string
    email: string
    phone: string
    location: string
    linkedinUrl: string
    portfolioUrl: string
    summary: string
    skills: Skill[]
    experience: WorkExperience[]
    education: Education[]
    projects: any[]
  }>
}

export function ProfileOnboarding({ open, onOpenChange, onComplete, prefill }: ProfileOnboardingProps) {
  const { saveProfile } = useProfileStore()
  const { toast } = useToast()
  const [step, setStep] = useState(0)
  const [localProfile, setLocalProfile] = useState<any>(null)
  const [errors, setErrors] = useState<any>({})
  const [showCongrats, setShowCongrats] = useState(false)

  useEffect(() => {
    if (open) {
      setLocalProfile({
        fullName: prefill?.fullName ?? '',
        email: prefill?.email ?? '',
        phone: prefill?.phone ?? '',
        location: prefill?.location ?? '',
        linkedinUrl: prefill?.linkedinUrl ?? '',
        portfolioUrl: prefill?.portfolioUrl ?? '',
        summary: prefill?.summary ?? '',
        skills: prefill?.skills ?? [],
        experience: prefill?.experience ?? [],
        education: prefill?.education ?? [],
        projects: prefill?.projects ?? [],
      })
      setErrors({})
      setStep(0)
      setShowCongrats(false)
    }
  }, [open]) // eslint-disable-line react-hooks/exhaustive-deps

  const completeness = calculateProfileCompleteness(localProfile)

  function validateStep(currentStep: number): boolean {
    const newErrors: any = {}
    let isValid = true

    switch (currentStep) {
      case 0:
        if (!localProfile?.fullName?.trim()) {
          newErrors.fullName = 'Name is required'
          isValid = false
        }
        if (!localProfile?.email?.trim()) {
          newErrors.email = 'Email is required'
          isValid = false
        }
        break
      case 1:
        if (!localProfile?.skills?.length) {
          newErrors.skills = 'At least one skill is required'
          isValid = false
        }
        break
    }

    setErrors(newErrors)
    return isValid
  }

  function handleNext() {
    if (validateStep(step)) {
      if (step < 4) {
        setStep(step + 1)
      } else {
        finishOnboarding()
      }
    }
  }

  function handleBack() {
    if (step > 0) {
      setStep(step - 1)
    }
  }

  async function finishOnboarding() {
    if (!validateStep(0)) {
      setStep(0)
      return
    }

    try {
      await saveProfile(localProfile)
      setShowCongrats(true)
    } catch (error) {
      console.error('Error saving profile:', error)
      toast({ title: 'Error saving profile', variant: 'destructive' })
    }
  }

  if (!localProfile) return null

  const steps = ['Personal Info', 'Skills', 'Experience', 'Education', 'Summary']

  return (
    <Dialog open={open} onOpenChange={(isOpen) => {
      if (!isOpen) return
      onOpenChange(isOpen)
    }}>
      <DialogContent className="sm:max-w-4xl max-h-[90vh] overflow-y-auto">
        {showCongrats ? (
          <div className="flex flex-col items-center justify-center py-12 gap-6 text-center">
            <CheckCircle2 className="size-16 text-emerald-500" />
            <div>
              <h2 className="text-2xl font-bold mb-2">Profile Created!</h2>
              <p className="text-muted-foreground">
                Your profile is ready. You can modify it anytime under My Profile.
              </p>
            </div>
            <Button onClick={onComplete} size="lg">
              Go to Dashboard
            </Button>
          </div>
        ) : (
          <>
            <DialogHeader>
              <div className="flex items-center justify-between">
                <div>
                  <DialogTitle>Complete Your Profile</DialogTitle>
                  <DialogDescription>
                    Fill in your professional information. All fields can be updated later.
                  </DialogDescription>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-sm text-muted-foreground">Step {step + 1} of 5</span>
                  <span className="text-sm text-muted-foreground">{completeness}% complete</span>
                </div>
              </div>
            </DialogHeader>

            <Tabs value={`step-${step}`} onValueChange={(v) => setStep(parseInt(v.replace('step-', '')))}>
              <TabsList className="grid w-full grid-cols-5">
                {steps.map((s, i) => (
                  <TabsTrigger key={i} value={`step-${i}`} disabled={i > step}>
                    {i + 1}. {s}
                  </TabsTrigger>
                ))}
              </TabsList>

              <div className="min-h-[300px] max-h-[50vh] overflow-y-auto">
                <TabsContent value="step-0">
                  <PersonalInfoStep profile={localProfile} setProfile={setLocalProfile} errors={errors} />
                </TabsContent>
                <TabsContent value="step-1">
                  <SkillsStep profile={localProfile} setProfile={setLocalProfile} errors={errors} />
                </TabsContent>
                <TabsContent value="step-2">
                  <ExperienceStep profile={localProfile} setProfile={setLocalProfile} errors={{}} />
                </TabsContent>
                <TabsContent value="step-3">
                  <EducationStep profile={localProfile} setProfile={setLocalProfile} errors={{}} />
                </TabsContent>
                <TabsContent value="step-4">
                  <SummaryStep profile={localProfile} setProfile={setLocalProfile} errors={errors} />
                </TabsContent>
              </div>
            </Tabs>

            <div className="flex justify-between pt-4 border-t">
              <Button type="button" variant="outline" onClick={handleBack} disabled={step === 0}>
                Back
              </Button>
              <Button type="button" onClick={handleNext}>
                {step === 4 ? 'Finish' : 'Next'}
              </Button>
            </div>
          </>
        )}
      </DialogContent>
    </Dialog>
  )
}
