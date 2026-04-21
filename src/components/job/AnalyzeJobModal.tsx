import { useState } from 'react'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog'
import { Progress } from '@/components/ui/progress'
import { Spinner } from '@/components/ui/spinner'
import { JobInput } from '@/components/job/JobInput'
import { useJobStore } from '@/store/jobStore'
import { useProfileStore } from '@/store/profileStore'
import { useSettingsStore } from '@/store/settingsStore'
import { extractStructured } from '@/lib/llm/client'
import { SkillExtractionResultSchema } from '@/lib/llm/schemas'
import { skillExtractionSystem, buildSkillExtractionPrompt } from '@/lib/llm/prompts/skillExtraction'
import { matchSkills } from '@/lib/utils/skillMatcher'
import { fetchJobDescription } from '@/lib/utils/jobParser'
import { buildAnalysisInsights } from '@/lib/utils/analysisInsights'
import { useToast } from '@/hooks/use-toast'
import type { JobSkill } from '@/types/job'

interface Props {
  open: boolean
  onOpenChange: (open: boolean) => void
  onSuccess: (jobId: number) => void
}

export function AnalyzeJobModal({ open, onOpenChange, onSuccess }: Props) {
  const { addJob } = useJobStore()
  const { profile } = useProfileStore()
  const { llm } = useSettingsStore()
  const { toast } = useToast()

  const [step, setStep] = useState<'input' | 'analyzing'>('input')
  const [loadingMsg, setLoadingMsg] = useState('')
  const [loadingProgress, setLoadingProgress] = useState(0)

  function handleOpenChange(val: boolean) {
    if (step === 'analyzing') return // prevent close during analysis
    if (!val) setStep('input')
    onOpenChange(val)
  }

  async function handleJobSubmit(text: string, url?: string) {
    if (!llm.model) {
      toast({ title: 'LLM not configured', description: 'Go to Settings → AI Settings and configure your AI provider.', variant: 'destructive' })
      return
    }

    setStep('analyzing')
    setLoadingProgress(10)

    try {
      let description = text
      if (url) {
        setLoadingMsg('Fetching job page…')
        try {
          description = await fetchJobDescription(url)
        } catch {
          toast({ title: 'URL fetch failed', description: 'Could not fetch the page. Paste the description text instead.', variant: 'destructive' })
          setStep('input')
          return
        }
      }

      setLoadingMsg('Extracting skills with AI…')
      setLoadingProgress(40)

      const extraction = await extractStructured({
        prompt: buildSkillExtractionPrompt(description),
        schema: SkillExtractionResultSchema,
        systemPrompt: skillExtractionSystem,
      })

      setLoadingProgress(70)
      setLoadingMsg('Matching against your profile…')

      const allExtracted = [
        ...extraction.mandatorySkills.map((s) => ({ name: s.name, mandatory: true, priority: s.priority, context: s.context })),
        ...extraction.niceToHaveSkills.map((s) => ({ name: s.name, mandatory: false, priority: s.priority, context: s.context })),
      ]

      const matchedSkills = matchSkills(allExtracted, profile?.skills ?? [])
      const mandatory: JobSkill[] = matchedSkills.filter((s) => s.mandatory)
      const niceToHave: JobSkill[] = matchedSkills.filter((s) => !s.mandatory)
      const leadingKeywords = (extraction.leadingKeywords ?? []).filter(
        (item): item is { keyword: string; source?: 'skill' | 'responsibility' | 'domain'; importance?: 'high' | 'medium' | 'low' } =>
          typeof item.keyword === 'string' && item.keyword.trim().length > 0,
      )

      const id = await addJob({
        companyName: extraction.companyName,
        jobTitle: extraction.jobTitle,
        originalUrl: url,
        rawDescription: description,
        jobFocus: extraction.jobFocus,
        keyResponsibilities: extraction.keyResponsibilities,
        primarySkills: extraction.primarySkills,
        mandatorySkills: mandatory,
        niceToHaveSkills: niceToHave,
        analysisInsights: buildAnalysisInsights(
          {
            mandatorySkills: mandatory,
            niceToHaveSkills: niceToHave,
            rawDescription: description,
            keyResponsibilities: extraction.keyResponsibilities,
          },
          leadingKeywords.length ? leadingKeywords : undefined,
          profile?.skills ?? [],
        ),
        status: 'bookmarked',
        analyzedAt: new Date().toISOString(),
      })

      setLoadingProgress(100)
      setStep('input')
      onSuccess(id)
    } catch (err) {
      toast({ title: 'Analysis failed', description: err instanceof Error ? err.message : 'Unknown error', variant: 'destructive' })
      setStep('input')
    }
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Analyze a Job Offer</DialogTitle>
          <DialogDescription>
            Paste a job posting URL or the full job description text to extract skills and generate a tailored CV.
          </DialogDescription>
        </DialogHeader>

        {step === 'input' && (
          <JobInput onSubmit={handleJobSubmit} isLoading={false} />
        )}

        {step === 'analyzing' && (
          <div className="flex flex-col items-center gap-4 py-8">
            <Spinner size="lg" />
            <p className="text-sm text-muted-foreground">{loadingMsg}</p>
            <Progress value={loadingProgress} className="w-full" />
          </div>
        )}
      </DialogContent>
    </Dialog>
  )
}
