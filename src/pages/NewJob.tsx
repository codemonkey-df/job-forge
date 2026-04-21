import { useState, useRef, useEffect, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { AlertCircle, BookOpen } from 'lucide-react'
import { MarkdownRenderer } from '@/components/ui/MarkdownRenderer'
import { Spinner } from '@/components/ui/spinner'
import { JobInput } from '@/components/job/JobInput'
import { cn } from '@/lib/utils'
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
import {
  matchSkills,
  computeMatchPercentage,
  computeExcludedUserSkills,
  rankProjectsByJobRelevance,
} from '@/lib/utils/skillMatcher'
import { fetchJobDescription } from '@/lib/utils/jobParser'
import { buildAnalysisInsights } from '@/lib/utils/analysisInsights'
import { computeMandatoryKeywordCoverage, evaluateATSCompliance } from '@/lib/utils/atsChecks'
import { trackCVGeneration, trackKeywordCoverageDelta } from '@/lib/utils/telemetry'
import { downloadCVAsPDF } from '@/lib/pdf/generator'
import { useToast } from '@/hooks/use-toast'
import type { JobOffer, JobSkill } from '@/types/job'

type Step = 'input' | 'analyzing' | 'results' | 'generating-cv' | 'cv-ready'

export default function NewJob() {
  const navigate = useNavigate()
  const { jobs, addJob, updateJob, loadJobs } = useJobStore()
  const { profile } = useProfileStore()
  const { llm } = useSettingsStore()
  const { toast } = useToast()

  const mountedRef = useRef(true)
  useEffect(() => { return () => { mountedRef.current = false } }, [])
  useEffect(() => { loadJobs() }, [loadJobs])

  const [step, setStep] = useState<Step>('input')
  const [loadingMsg, setLoadingMsg] = useState('')
  const [loadingProgress, setLoadingProgress] = useState(0)
  const [currentJob, setCurrentJob] = useState<JobOffer | null>(null)
  const [cvMarkdown, setCvMarkdown] = useState('')
  const [missingReport, setMissingReport] = useState('')
  const [isExportingPDF, setIsExportingPDF] = useState(false)
  const [isCvWaiting, setIsCvWaiting] = useState(false)
  const [isDragging, setIsDragging] = useState(false)

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

      const job: Omit<JobOffer, 'id'> = {
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

  function toggleNiceToHave(name: string) {
    if (!currentJob) return
    const updated = currentJob.niceToHaveSkills.map((s) =>
      s.name === name ? { ...s, includeInCV: s.includeInCV === false ? true : false } : s,
    )
    setCurrentJob({ ...currentJob, niceToHaveSkills: updated })
    if (currentJob.id) updateJob(currentJob.id, { niceToHaveSkills: updated })
  }

  async function handleGenerateCV() {
    if (!currentJob || !profile) {
      toast({ title: 'Profile not found', description: 'Complete your profile before generating a CV.', variant: 'destructive' })
      return
    }
    setStep('generating-cv')
    setCvMarkdown('')
    setIsCvWaiting(true)

    const missingSkills = currentJob.mandatorySkills
      .filter((s) => !s.userHasSkill)
      .map((s) => ({ name: s.name, priority: s.priority }))
    const selectedNiceToHave = currentJob.niceToHaveSkills.filter((s) => s.includeInCV !== false)
    const skillAliases = [
      ...currentJob.mandatorySkills,
      ...currentJob.niceToHaveSkills,
    ].filter((s) => s.aliasedFrom).map((s) => ({ jobKeyword: s.name, userSkill: s.aliasedFrom! }))

    const allJobSkillNames = [
      ...currentJob.mandatorySkills,
      ...currentJob.niceToHaveSkills,
    ].map((s) => s.name)
    const rankedProjectNames = rankProjectsByJobRelevance(profile.projects ?? [], allJobSkillNames).map((p) => p.name)
    const excludedSkillNames = computeExcludedUserSkills(
      profile.skills,
      currentJob.mandatorySkills,
      currentJob.niceToHaveSkills,
    )

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
        jobFocus: currentJob.jobFocus,
        keyResponsibilities: currentJob.keyResponsibilities,
        primarySkills: currentJob.primarySkills,
        leadingKeywords: currentJob.analysisInsights?.leadingKeywords
          ?.filter((k) => k.importance !== 'low')
          .map((k) => k.keyword)
          .slice(0, 8),
        matchedMandatorySkills: currentJob.mandatorySkills.filter((s) => s.userHasSkill).map((s) => ({ name: s.name, level: s.userLevel })),
        missingMandatorySkills: missingSkills.map((s) => s.name),
        niceToHaveSkills: selectedNiceToHave.map((s) => s.name),
        skillAliases,
        excludedSkills: excludedSkillNames,
        rankedProjects: rankedProjectNames.length > 0 ? rankedProjectNames : undefined,
        profile,
      }),
      onChunk: (chunk) => {
        setIsCvWaiting(false)
        safeSetCv((prev) => prev + chunk)
      },
      onFinish: async (full) => {
        cvDone = true
        setIsCvWaiting(false)
        trackCVGeneration(true)
        const compliance = evaluateATSCompliance(full, currentJob)
        const beforeCoverage = computeMandatoryKeywordCoverage(currentJob.generatedCV ?? '', currentJob)
        const afterCoverage = computeMandatoryKeywordCoverage(full, currentJob)
        trackKeywordCoverageDelta(afterCoverage - beforeCoverage)
        if (compliance.mandatoryKeywordCoverage !== 'pass') {
          toast({
            title: 'ATS keyword warning',
            description: 'Some required job keywords are still missing in the generated CV.',
            variant: 'destructive',
          })
        }
        if (currentJob.id) await updateJob(currentJob.id, { generatedCV: full })
        if (reportDone) safeSetStep('cv-ready')
      },
      onError: (err) => {
        cvDone = true
        setIsCvWaiting(false)
        trackCVGeneration(false)
        toast({ title: 'CV generation failed', description: err.message, variant: 'destructive' })
        if (reportDone) safeSetStep('cv-ready')
      },
    })

    if (missingSkills.length > 0) {
      streamMarkdown({
        systemPrompt: missingSkillsSystem,
        prompt: buildMissingSkillsPrompt({ missingSkills, jobTitle: currentJob.jobTitle, jobFocus: currentJob.jobFocus }),
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

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    setIsDragging(false)
    const text = e.dataTransfer.getData('text/plain')
    if (text.trim()) handleJobSubmit(text.trim())
  }, [handleJobSubmit])

  const matchPct = currentJob ? computeMatchPercentage([...currentJob.mandatorySkills, ...currentJob.niceToHaveSkills]) : 0
  const isAnalyzing = step === 'analyzing'
  const recentJobs = [...jobs].sort((a, b) => new Date(b.analyzedAt).getTime() - new Date(a.analyzedAt).getTime()).slice(0, 3)

  return (
    <div className="space-y-6">
      {step === 'input' && (
        <div className="grid grid-cols-[1fr_280px] gap-5">
          <Card>
            <CardHeader>
              <CardTitle>Analyze a Job Offer</CardTitle>
              <p className="text-sm text-muted-foreground">Paste a URL or drop the full job description</p>
            </CardHeader>
            <CardContent className="space-y-4">
              {!llm.model && (
                <div className="flex items-center gap-2 p-3 rounded-md bg-yellow-50 border border-yellow-200 text-yellow-800 text-sm dark:bg-yellow-950 dark:border-yellow-800 dark:text-yellow-200">
                  <AlertCircle className="size-4 shrink-0" />
                  Configure your LLM provider in Settings before analyzing jobs.
                </div>
              )}
              {!profile && (
                <div className="flex items-center gap-2 p-3 rounded-md bg-blue-50 border border-blue-200 text-blue-800 text-sm dark:bg-blue-950 dark:border-blue-800 dark:text-blue-200">
                  <AlertCircle className="size-4 shrink-0" />
                  Complete your profile for the best skill matching results.
                </div>
              )}
              <JobInput onSubmit={handleJobSubmit} isLoading={isAnalyzing} />

              {/* Drag-drop zone */}
              <div
                onDragOver={(e) => { e.preventDefault(); setIsDragging(true) }}
                onDragLeave={() => setIsDragging(false)}
                onDrop={handleDrop}
                className={cn(
                  'border-2 border-dashed rounded-lg p-6 text-center cursor-pointer transition-colors',
                  isDragging
                    ? 'border-primary bg-primary/5'
                    : 'border-border hover:border-primary/50 bg-muted/30',
                )}
              >
                <div className="text-2xl mb-2">📋</div>
                <p className="text-sm font-medium">Drop job description here</p>
                <p className="text-xs text-muted-foreground mt-1">Or paste directly from clipboard</p>
              </div>
            </CardContent>
          </Card>

          {/* Recent analyses sidebar */}
          <div className="space-y-4">
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">Recent Analyses</CardTitle>
              </CardHeader>
              <CardContent className="p-0">
                {recentJobs.length === 0 ? (
                  <p className="text-xs text-muted-foreground px-4 pb-4">No analyses yet.</p>
                ) : (
                  <div className="divide-y">
                    {recentJobs.map((j) => {
                      const pct = computeMatchPercentage([...j.mandatorySkills, ...j.niceToHaveSkills])
                      const dotColor = pct >= 70 ? 'bg-emerald-500' : pct >= 40 ? 'bg-amber-500' : 'bg-destructive'
                      return (
                        <button
                          key={j.id}
                          onClick={() => navigate(`/jobs/${j.id}`)}
                          className="w-full flex items-center gap-3 px-4 py-3 text-left hover:bg-muted/30 transition-colors"
                        >
                          <span className={cn('w-2 h-2 rounded-full shrink-0', dotColor)} />
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-medium truncate">{j.jobTitle}</p>
                            <p className="text-xs text-muted-foreground truncate">{j.companyName}</p>
                          </div>
                          <span className="font-mono text-xs text-muted-foreground shrink-0">
                            {new Date(j.analyzedAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                          </span>
                        </button>
                      )
                    })}
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        </div>
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
                onToggleNiceToHave={step === 'results' ? toggleNiceToHave : undefined}
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

          {isCvWaiting && (
            <Card>
              <CardContent className="pt-6 pb-6 flex items-center justify-center gap-3 text-muted-foreground text-sm">
                <Spinner size="sm" />
                Waiting for model response...
              </CardContent>
            </Card>
          )}

          {(step === 'generating-cv' || step === 'cv-ready') && !isCvWaiting && (
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
                <MarkdownRenderer content={missingReport} />
              </CardContent>
            </Card>
          )}
        </>
      )}
    </div>
  )
}
