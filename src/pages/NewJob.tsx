import { useState, useRef, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { AlertCircle, BookOpen } from 'lucide-react'
import { Spinner } from '@/components/ui/spinner'
import { JobInput } from '@/components/job/JobInput'
import { SkillList } from '@/components/job/SkillList'
import { CVPreview } from '@/components/cv/CVPreview'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Progress } from '@/components/ui/progress'
import { useJobStore } from '@/store/jobStore'
import { useProfileStore } from '@/store/profileStore'
import { useSettingsStore } from '@/store/settingsStore'
import { extractStructured, streamMarkdown } from '@/lib/llm/client'
import { SkillExtractionResultSchema } from '@/lib/llm/schemas'
import { skillExtractionSystem, buildSkillExtractionPrompt } from '@/lib/llm/prompts/skillExtraction'
import { cvGenerationSystem, buildCVGenerationPrompt } from '@/lib/llm/prompts/cvGeneration'
import { missingSkillsSystem, buildMissingSkillsPrompt } from '@/lib/llm/prompts/missingSkills'
import { matchSkills, computeMatchPercentage } from '@/lib/utils/skillMatcher'
import { fetchJobDescription } from '@/lib/utils/jobParser'
import { downloadCVAsPDF } from '@/lib/pdf/generator'
import { useToast } from '@/hooks/use-toast'
import type { JobOffer, JobSkill } from '@/types/job'

type Step = 'input' | 'analyzing' | 'results' | 'generating-cv' | 'cv-ready'

export default function NewJob() {
  const navigate = useNavigate()
  const { addJob, updateJob } = useJobStore()
  const { profile } = useProfileStore()
  const { llm } = useSettingsStore()
  const { toast } = useToast()

  const mountedRef = useRef(true)
  useEffect(() => { return () => { mountedRef.current = false } }, [])

  const [step, setStep] = useState<Step>('input')
  const [loadingMsg, setLoadingMsg] = useState('')
  const [loadingProgress, setLoadingProgress] = useState(0)
  const [currentJob, setCurrentJob] = useState<JobOffer | null>(null)
  const [cvMarkdown, setCvMarkdown] = useState('')
  const [missingReport, setMissingReport] = useState('')
  const [isExportingPDF, setIsExportingPDF] = useState(false)

  function checkSettings(): boolean {
    if (!llm.model) {
      toast({ title: 'LLM not configured', description: 'Go to Settings and configure your AI provider.', variant: 'destructive' })
      return false
    }
    return true
  }

  async function handleJobSubmit(text: string, url?: string) {
    if (!checkSettings()) return
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
        ...extraction.mandatorySkills.map((s) => ({ name: s.name, mandatory: true })),
        ...extraction.niceToHaveSkills.map((s) => ({ name: s.name, mandatory: false })),
      ]

      const matchedSkills = matchSkills(allExtracted, profile?.skills ?? [])
      const mandatory: JobSkill[] = matchedSkills.filter((s) => s.mandatory)
      const niceToHave: JobSkill[] = matchedSkills.filter((s) => !s.mandatory)

      const job: Omit<JobOffer, 'id'> = {
        companyName: extraction.companyName,
        jobTitle: extraction.jobTitle,
        originalUrl: url,
        rawDescription: description,
        mandatorySkills: mandatory,
        niceToHaveSkills: niceToHave,
        status: 'bookmarked',
        analyzedAt: new Date().toISOString(),
      }

      const id = await addJob(job)
      setCurrentJob({ ...job, id })
      setLoadingProgress(100)
      setStep('results')
    } catch (err) {
      toast({ title: 'Analysis failed', description: err instanceof Error ? err.message : 'Unknown error', variant: 'destructive' })
      setStep('input')
    }
  }

  async function handleGenerateCV() {
    if (!currentJob || !profile) {
      toast({ title: 'Profile not found', description: 'Complete your profile before generating a CV.', variant: 'destructive' })
      return
    }
    setStep('generating-cv')
    setCvMarkdown('')

    const missingSkillNames = [
      ...currentJob.mandatorySkills.filter((s) => !s.userHasSkill).map((s) => s.name),
      ...currentJob.niceToHaveSkills.filter((s) => !s.userHasSkill).map((s) => s.name),
    ]

    // Generate CV and missing skills report in parallel streams
    let cvDone = false
    let reportDone = false

    const safeSetStep = (s: Step) => { if (mountedRef.current) setStep(s) }
    const safeSetCv = (fn: (p: string) => string) => { if (mountedRef.current) setCvMarkdown(fn) }
    const safeSetReport = (fn: (p: string) => string) => { if (mountedRef.current) setMissingReport(fn) }

    streamMarkdown({
      systemPrompt: cvGenerationSystem,
      prompt: buildCVGenerationPrompt({
        jobTitle: currentJob.jobTitle,
        companyName: currentJob.companyName,
        matchedMandatorySkills: currentJob.mandatorySkills.filter((s) => s.userHasSkill).map((s) => s.name),
        missingMandatorySkills: currentJob.mandatorySkills.filter((s) => !s.userHasSkill).map((s) => s.name),
        niceToHaveSkills: currentJob.niceToHaveSkills.map((s) => s.name),
        profile,
      }),
      onChunk: (chunk) => safeSetCv((prev) => prev + chunk),
      onFinish: async (full) => {
        cvDone = true
        if (currentJob.id) await updateJob(currentJob.id, { generatedCV: full })
        if (reportDone) safeSetStep('cv-ready')
      },
      onError: (err) => {
        cvDone = true
        toast({ title: 'CV generation failed', description: err.message, variant: 'destructive' })
        if (reportDone) safeSetStep('cv-ready')
      },
    })

    if (missingSkillNames.length > 0) {
      streamMarkdown({
        systemPrompt: missingSkillsSystem,
        prompt: buildMissingSkillsPrompt({ missingSkills: missingSkillNames, jobTitle: currentJob.jobTitle }),
        onChunk: (chunk) => safeSetReport((prev) => prev + chunk),
        onFinish: async (full) => {
          reportDone = true
          if (currentJob.id) await updateJob(currentJob.id, { missingSkillsReport: full })
          if (cvDone) safeSetStep('cv-ready')
        },
        onError: () => { reportDone = true; if (cvDone) safeSetStep('cv-ready') },
      })
    } else {
      reportDone = true
    }
  }

  async function handleExportPDF() {
    if (!cvMarkdown || !profile) return
    setIsExportingPDF(true)
    try {
      await downloadCVAsPDF(cvMarkdown, profile)
    } catch (err) {
      toast({ title: 'PDF export failed', description: err instanceof Error ? err.message : 'Unknown error', variant: 'destructive' })
    } finally {
      setIsExportingPDF(false)
    }
  }

  const matchPct = currentJob ? computeMatchPercentage([...currentJob.mandatorySkills, ...currentJob.niceToHaveSkills]) : 0
  const isAnalyzing = step === 'analyzing'

  return (
    <div className="max-w-4xl space-y-6">
      {step === 'input' && (
        <Card>
          <CardHeader>
            <CardTitle>Analyze a Job Offer</CardTitle>
          </CardHeader>
          <CardContent>
            {!llm.model && (
              <div className="flex items-center gap-2 p-3 mb-4 rounded-md bg-yellow-50 border border-yellow-200 text-yellow-800 text-sm dark:bg-yellow-950 dark:border-yellow-800 dark:text-yellow-200">
                <AlertCircle className="size-4 shrink-0" />
                Configure your LLM provider in Settings before analyzing jobs.
              </div>
            )}
            {!profile && (
              <div className="flex items-center gap-2 p-3 mb-4 rounded-md bg-blue-50 border border-blue-200 text-blue-800 text-sm dark:bg-blue-950 dark:border-blue-800 dark:text-blue-200">
                <AlertCircle className="size-4 shrink-0" />
                Complete your profile for the best skill matching results.
              </div>
            )}
            <JobInput onSubmit={handleJobSubmit} isLoading={isAnalyzing} />
          </CardContent>
        </Card>
      )}

      {step === 'analyzing' && (
        <Card>
          <CardContent className="pt-10 pb-10 flex flex-col items-center gap-4">
            <Spinner size="lg" />
            <p className="text-sm text-muted-foreground">{loadingMsg}</p>
            <Progress value={loadingProgress} className="w-64" />
          </CardContent>
        </Card>
      )}

      {(step === 'results' || step === 'generating-cv' || step === 'cv-ready') && currentJob && (
        <>
          <Card>
            <CardHeader>
              <div className="flex items-start justify-between">
                <div>
                  <CardTitle>{currentJob.jobTitle}</CardTitle>
                  <p className="text-sm text-muted-foreground mt-1">{currentJob.companyName}</p>
                </div>
                <div className="text-right">
                  <div className="text-2xl font-bold text-primary">{matchPct}%</div>
                  <div className="text-xs text-muted-foreground">match</div>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <SkillList
                mandatorySkills={currentJob.mandatorySkills}
                niceToHaveSkills={currentJob.niceToHaveSkills}
              />

              {step === 'results' && (
                <div className="flex gap-3 mt-6">
                  <Button onClick={handleGenerateCV}>
                    Generate Tailored CV
                  </Button>
                  <Button variant="outline" onClick={() => navigate('/')}>
                    Save & Go to Dashboard
                  </Button>
                </div>
              )}
            </CardContent>
          </Card>

          {(step === 'generating-cv' || step === 'cv-ready') && (
            <CVPreview
              markdown={cvMarkdown}
              isStreaming={step === 'generating-cv'}
              onMarkdownChange={(v) => setCvMarkdown(v)}
              onExportPDF={handleExportPDF}
              isExporting={isExportingPDF}
            />
          )}

          {missingReport && (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <BookOpen className="size-5" />
                  Missing Skills — Learning Guide
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div
                  className="prose prose-sm max-w-none dark:prose-invert text-sm"
                  dangerouslySetInnerHTML={{
                    __html: missingReport
                      .replace(/^## (.+)$/gm, '<h3 class="font-semibold mt-4 mb-2">$1</h3>')
                      .replace(/^### (.+)$/gm, '<h4 class="font-medium mt-3 mb-1">$1</h4>')
                      .replace(/^- (.+)$/gm, '<li class="ml-4">$1</li>')
                      .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
                      .replace(/^(?!<[h|u|l|s])(.+)$/gm, '<p>$1</p>')
                  }}
                />
              </CardContent>
            </Card>
          )}
        </>
      )}
    </div>
  )
}
