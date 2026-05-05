import { useEffect, useMemo, useRef, useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { Loader2, ArrowLeft, RefreshCw, Check, X } from 'lucide-react'
import { FocusMode } from '@/components/cv/FocusMode'
import { Button } from '@/components/ui/button'
import { useJobStore } from '@/store/jobStore'
import { useProfileStore } from '@/store/profileStore'
import { streamMarkdown } from '@/lib/llm/client'
import { cvGenerationSystem, buildCVGenerationPrompt } from '@/lib/llm/prompts/cvGeneration'
import { missingSkillsSystem, buildMissingSkillsPrompt } from '@/lib/llm/prompts/missingSkills'
import {
  applySkillAliasOverrides,
  computeJobProfileMatchPercentage,
  computeExcludedUserSkills,
  matchSkills,
  matchLanguages,
  rankProjectsByJobRelevance,
} from '@/lib/utils/skillMatcher'
import { useToast } from '@/hooks/use-toast'
import { cn } from '@/lib/utils'
import type { JobOffer, JobSkill } from '@/types/job'
import { buildAnalysisInsights, withDerivedInsights } from '@/lib/utils/analysisInsights'
import { evaluateATSCompliance, computeMandatoryKeywordCoverage, computeCVKeywordMatch } from '@/lib/utils/atsChecks'
import { trackCVGeneration, trackKeywordCoverageDelta } from '@/lib/utils/telemetry'
import { computeSkillsSignature } from '@/lib/utils/skillsSignature'

function LargeMatchRing({ pct }: { pct: number }) {
  const r = 44
  const circ = 2 * Math.PI * r
  const offset = circ * (1 - pct / 100)
  const color = pct >= 70 ? '#22c55e' : pct >= 40 ? '#f59e0b' : '#ef4444'
  const textClass = pct >= 70 ? 'text-emerald-500' : pct >= 40 ? 'text-amber-500' : 'text-destructive'

  return (
    <div className="relative w-24 h-24">
      <svg width="96" height="96" viewBox="0 0 96 96" className="-rotate-90">
        <circle cx="48" cy="48" r={r} fill="none" stroke="currentColor" strokeWidth="6" className="text-muted/30" />
        <circle
          cx="48" cy="48" r={r}
          fill="none"
          stroke={color}
          strokeWidth="6"
          strokeLinecap="round"
          strokeDasharray={circ}
          strokeDashoffset={offset}
          style={{ transition: 'stroke-dashoffset 0.6s ease' }}
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className={cn('font-mono text-xl font-bold leading-none', textClass)}>{pct}%</span>
        <span className="text-[9px] text-muted-foreground mt-0.5">match</span>
      </div>
    </div>
  )
}

function KeywordPill({ label, variant }: { label: string; variant: 'high' | 'medium' | 'low' }) {
  const cls = {
    high: 'bg-destructive/10 text-destructive border-destructive/20',
    medium: 'bg-amber-500/10 text-amber-500 border-amber-500/20',
    low: 'bg-muted text-muted-foreground border-border',
  }[variant]
  return (
    <span className={cn('text-[10px] px-2 py-0.5 rounded-full border font-medium', cls)}>
      {label}
    </span>
  )
}

function JobFocusDisplay({ job }: { job: JobOffer }) {
  // Use LLM-extracted data directly (no hardcoding)
  const jobFocus = job.jobFocus
  const primarySkills = job.primarySkills || job.mandatorySkills.filter(s => s.priority === 'primary').map(s => s.name)
  const keyResponsibilities = job.keyResponsibilities || []
  
  return (
    <section className="space-y-3">
      <div>
        <p className="text-xs font-semibold mb-2">Job Focus & Requirements</p>
        <div className="bg-muted/30 rounded-lg p-3 space-y-2">
          <div>
            <p className="text-[10px] uppercase tracking-wider text-muted-foreground mb-1">Core Role Focus</p>
            <p className="text-sm font-medium">{jobFocus}</p>
          </div>
          
          {primarySkills.length > 0 && (
            <div>
              <p className="text-[10px] uppercase tracking-wider text-muted-foreground mb-1">Primary Skills (Critical)</p>
              <div className="flex flex-wrap gap-1">
                {primarySkills.map(skill => (
                  <span key={skill} className="text-[10px] px-2 py-0.5 bg-red-500/10 text-red-600 rounded-full">
                    {skill}
                  </span>
                ))}
              </div>
            </div>
          )}
          
          {keyResponsibilities.length > 0 && (
            <div>
              <p className="text-[10px] uppercase tracking-wider text-muted-foreground mb-1">Key Responsibilities</p>
              <ul className="space-y-1.5">
                {keyResponsibilities.map((resp, i) => (
                  <li key={i} className="text-xs flex gap-2">
                    <span className="text-muted-foreground">•</span>
                    <span>{resp}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      </div>
      
      {/* Why This Candidate Fits */}
      <div>
        <p className="text-xs font-semibold mb-2">Why This Candidate Fits</p>
        <div className="space-y-2">
          {/* Show how user's skills map to job requirements */}
          {job.mandatorySkills.filter(s => s.userHasSkill && s.priority === 'primary').slice(0, 3).map((skill, i) => (
            <div key={i} className="flex items-start gap-2 text-xs">
              <span className="mt-0.5 text-green-500">✓</span>
              <div>
                <p className="font-medium">{skill.name}</p>
                <p className="text-muted-foreground">You have this <span className="capitalize">{skill.userLevel}</span> experience</p>
              </div>
            </div>
          ))}
          
          {/* Show transferable experience */}
          {job.mandatorySkills.filter(s => s.userHasSkill && s.priority !== 'primary' && !s.aliasedFrom).slice(0, 2).map((skill, i) => (
            <div key={i} className="flex items-start gap-2 text-xs">
              <span className="mt-0.5 text-blue-500">→</span>
              <div>
                <p className="font-medium">{skill.name}</p>
                <p className="text-muted-foreground">Relevant experience shown</p>
              </div>
            </div>
          ))}
          
          {job.mandatorySkills.filter(s => s.userHasSkill).length === 0 && (
            <div className="text-xs text-muted-foreground italic">
              Match skills to job requirements to see why you're a good fit
            </div>
          )}
        </div>
      </div>
    </section>
  )
}

export default function JobAnalysis() {
  const enhancedInsightsEnabled = import.meta.env.VITE_ENHANCED_ANALYSIS !== 'false'
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const { jobs, updateJob } = useJobStore()
  const { profile } = useProfileStore()
  const { toast } = useToast()

  const [job, setJob] = useState<JobOffer | null>(null)
  const [cvMarkdown, setCvMarkdown] = useState('')
  const [isGenerating, setIsGenerating] = useState(false)
  const [focusModeOn, setFocusModeOn] = useState(false)
  const [skillInclusions, setSkillInclusions] = useState<Record<string, boolean>>({})
  const [isRefreshingAnalysis, setIsRefreshingAnalysis] = useState(false)
  const refreshInFlightRef = useRef<Set<number>>(new Set())

  useEffect(() => {
    if (!id) return
    const found = jobs.find((j) => j.id === Number(id))
    if (found) {
      setJob(withDerivedInsights(found))
      setCvMarkdown(found.generatedCV ?? '')
      setSkillInclusions(
        Object.fromEntries(found.niceToHaveSkills.map((skill) => [skill.name, skill.includeInCV !== false])),
      )
    }
  }, [id, jobs])

  useEffect(() => {
    if (!job?.id) return

    const jobId = job.id
    const currentSkills = profile?.skills ?? []
    const currentLanguages = profile?.languages ?? []
    const currentSkillsHash = computeSkillsSignature(currentSkills)
    const isStale = job.analysisSkillsHash !== currentSkillsHash
    if (!isStale) return
    if (refreshInFlightRef.current.has(jobId)) return

    const reanalyzeJob = async () => {
      refreshInFlightRef.current.add(jobId)
      setIsRefreshingAnalysis(true)
      try {
        const allExtracted = [
          ...job.mandatorySkills.map((skill) => ({
            name: skill.name,
            mandatory: true,
            priority: skill.priority,
            context: skill.context,
          })),
          ...job.niceToHaveSkills.map((skill) => ({
            name: skill.name,
            mandatory: false,
            priority: skill.priority,
            context: skill.context,
          })),
        ]

        const rematched = matchSkills(allExtracted, currentSkills)
        const mandatoryRaw = rematched.filter((skill) => skill.mandatory)
        const niceToHaveRaw = rematched.filter((skill) => !skill.mandatory)
        const overrides = job.skillAliasOverrides ?? {}
        const mandatoryForInsights = applySkillAliasOverrides(mandatoryRaw, overrides)
        const niceForInsights = applySkillAliasOverrides(niceToHaveRaw, overrides)
        const leadingKeywords = job.analysisInsights?.leadingKeywords?.map((item) => ({
          keyword: item.keyword,
          source: item.source === 'description' ? undefined : item.source,
          importance: item.importance,
        }))

        const nextInsights = buildAnalysisInsights(
          {
            mandatorySkills: mandatoryForInsights,
            niceToHaveSkills: niceForInsights,
            rawDescription: job.rawDescription,
            keyResponsibilities: job.keyResponsibilities,
          },
          leadingKeywords,
          currentSkills,
        )

        const now = new Date().toISOString()
        const rematcedLanguages = job.languageRequirements?.length
          ? matchLanguages(
              job.languageRequirements.map((l) => ({
                language: l.language,
                level: l.requiredLevel,
                mandatory: l.mandatory,
              })),
              currentLanguages,
            )
          : undefined
        const updates: Partial<JobOffer> = {
          mandatorySkills: mandatoryRaw,
          niceToHaveSkills: niceToHaveRaw,
          languageRequirements: rematcedLanguages,
          analysisInsights: nextInsights,
          analysisSkillsHash: currentSkillsHash,
          analysisLastComputedAt: now,
          skillAliasOverrides: job.skillAliasOverrides,
        }

        await updateJob(jobId, updates)
        setJob((prev) => (prev ? withDerivedInsights({ ...prev, ...updates }) : prev))
        setSkillInclusions((prev) => {
          const next = { ...prev }
          for (const skill of niceToHaveRaw) {
            if (!(skill.name in next)) {
              next[skill.name] = skill.includeInCV !== false
            }
          }
          return next
        })
      } catch (err) {
        toast({
          title: 'Analysis refresh failed',
          description: err instanceof Error ? err.message : 'Could not refresh skill matching.',
          variant: 'destructive',
        })
      } finally {
        refreshInFlightRef.current.delete(jobId)
        setIsRefreshingAnalysis(false)
      }
    }

    void reanalyzeJob()
  }, [job, profile?.skills, toast, updateJob])

  const effectiveMandatory = useMemo(() => {
    if (!job) return [] as JobSkill[]
    return applySkillAliasOverrides(job.mandatorySkills, job.skillAliasOverrides)
  }, [job])

  const effectiveNiceAll = useMemo(() => {
    if (!job) return [] as JobSkill[]
    return applySkillAliasOverrides(job.niceToHaveSkills, job.skillAliasOverrides)
  }, [job])

  const selectedNiceToHave = useMemo(
    () =>
      effectiveNiceAll.filter((skill) => {
        const override = skillInclusions[skill.name]
        return override !== undefined ? override : skill.includeInCV !== false
      }),
    [effectiveNiceAll, skillInclusions],
  )

  async function persistAliasDecision(skillName: string, decision: 'confirmed' | 'rejected') {
    if (!job?.id) return
    const nextOverrides: Record<string, 'confirmed' | 'rejected'> = {
      ...(job.skillAliasOverrides ?? {}),
      [skillName]: decision,
    }
    const mandatory = applySkillAliasOverrides(job.mandatorySkills, nextOverrides)
    const niceToHave = applySkillAliasOverrides(job.niceToHaveSkills, nextOverrides)
    const leadingKeywords = job.analysisInsights?.leadingKeywords?.map((item) => ({
      keyword: item.keyword,
      source: item.source === 'description' ? undefined : item.source,
      importance: item.importance,
    }))
    const nextInsights = buildAnalysisInsights(
      {
        mandatorySkills: mandatory,
        niceToHaveSkills: niceToHave,
        rawDescription: job.rawDescription,
        keyResponsibilities: job.keyResponsibilities,
      },
      leadingKeywords,
      profile?.skills ?? [],
    )
    await updateJob(job.id, {
      skillAliasOverrides: nextOverrides,
      analysisInsights: nextInsights,
    })
    setJob((prev) =>
      prev
        ? withDerivedInsights({
            ...prev,
            skillAliasOverrides: nextOverrides,
            analysisInsights: nextInsights,
          })
        : null,
    )
  }

  async function handleRegenerate() {
    if (!job || !profile) return
    setIsGenerating(true)
    setCvMarkdown('')

    const missingSkills = effectiveMandatory
      .filter((s) => !s.userHasSkill)
      .map((s) => ({ name: s.name, priority: s.priority }))
    const skillAliases = [...effectiveMandatory, ...selectedNiceToHave]
      .filter((s) => s.aliasedFrom)
      .map((s) => ({ jobKeyword: s.name, userSkill: s.aliasedFrom! }))

    const allJobSkillNames = [...effectiveMandatory, ...selectedNiceToHave].map((s) => s.name)
    const rankedProjectNames = rankProjectsByJobRelevance(profile.projects ?? [], allJobSkillNames).map((p) => p.name)
    const excludedSkillNames = computeExcludedUserSkills(
      profile.skills,
      effectiveMandatory,
      selectedNiceToHave,
    )

    // Use LLM-extracted job focus directly (no hardcoding)
    const primarySkills = job.primarySkills || job.mandatorySkills.filter(s => s.priority === 'primary').map(s => s.name)
    const jobFocus = job.jobFocus || 'Engineer'

    await streamMarkdown({
      systemPrompt: cvGenerationSystem,
      prompt: buildCVGenerationPrompt({
        jobTitle: job.jobTitle,
        companyName: job.companyName,
        jobFocus,
        keyResponsibilities: job.keyResponsibilities,
        primarySkills,
        leadingKeywords: job.analysisInsights?.leadingKeywords
          ?.filter((k) => k.importance !== 'low')
          .map((k) => k.keyword)
          .slice(0, 8),
        matchedMandatorySkills: effectiveMandatory.filter((s) => s.userHasSkill).map((s) => ({ name: s.name, level: s.userLevel })),
        missingMandatorySkills: missingSkills.map((s) => s.name),
        niceToHaveSkills: selectedNiceToHave.map((s) => s.name),
        skillAliases,
        excludedSkills: excludedSkillNames,
        rankedProjects: rankedProjectNames.length > 0 ? rankedProjectNames : undefined,
        profile,
      }),
      onChunk: (chunk) => {
        setCvMarkdown((prev) => prev + chunk)
      },
      onFinish: async (full) => {
        setIsGenerating(false)
        setFocusModeOn(true)
        trackCVGeneration(true)
        const compliance = evaluateATSCompliance(full, job)
        const beforeCoverage = computeMandatoryKeywordCoverage(job.generatedCV ?? '', job)
        const afterCoverage = computeMandatoryKeywordCoverage(full, job)
        trackKeywordCoverageDelta(afterCoverage - beforeCoverage)
        if (compliance.mandatoryKeywordCoverage !== 'pass') {
          toast({
            title: 'ATS keyword warning',
            description: 'Generated CV is missing some required job keywords.',
            variant: 'destructive',
          })
        }
        if (job.id) await updateJob(job.id, { generatedCV: full })
      },
      onError: (err) => {
        setIsGenerating(false)
        trackCVGeneration(false)
        toast({ title: 'Regeneration failed', description: err.message, variant: 'destructive' })
      },
    })

    if (missingSkills.length > 0) {
      await streamMarkdown({
        systemPrompt: missingSkillsSystem,
        prompt: buildMissingSkillsPrompt({ missingSkills, jobTitle: job.jobTitle, jobFocus: job.jobFocus }),
        onChunk: () => {},
        onFinish: async (full) => {
          if (job.id) await updateJob(job.id, { missingSkillsReport: full })
        },
        onError: () => {},
      })
    }
  }

  const matchPct = job ? computeJobProfileMatchPercentage(job) : 0
  const cvKeywordMatchPct = job
    ? computeCVKeywordMatch(cvMarkdown, {
      mandatorySkills: effectiveMandatory,
      niceToHaveSkills: selectedNiceToHave,
    })
    : 0
  const insights = job ? (job.analysisInsights ?? withDerivedInsights(job).analysisInsights) : null
  const missingMandatory = effectiveMandatory.filter((s) => !s.userHasSkill)
  const hasGeneratedCv = cvMarkdown.trim().length > 0
  const uniqueLeadingKeywords = insights?.leadingKeywords
    ? [...new Map(insights.leadingKeywords.map((k) => [k.keyword.toLowerCase(), k])).values()]
    : []

  const excludedSkillsForCv = profile
    ? (insights?.excludedUserSkills?.length
        ? insights.excludedUserSkills
        : computeExcludedUserSkills(profile.skills, effectiveMandatory, selectedNiceToHave))
    : []

  if (!job) {
    return (
      <div className="flex items-center justify-center h-full">
        <Loader2 className="size-6 animate-spin text-muted-foreground" />
      </div>
    )
  }

  return (
    <div className="flex flex-col h-full">
      {/* Top bar */}
      <div className="flex items-center justify-between px-6 py-3 border-b bg-background shrink-0">
        <Button variant="ghost" size="sm" onClick={() => navigate('/dashboard')} className="gap-1.5">
          <ArrowLeft className="size-4" />
          Back to Dashboard
        </Button>

        <h1 className="font-semibold text-sm absolute left-1/2 -translate-x-1/2">
          Job Analysis
        </h1>

        <div className="flex items-center gap-3 min-w-[120px] justify-end">
          <Button
            variant="outline"
            size="sm"
            className="gap-1.5"
            onClick={handleRegenerate}
            disabled={isGenerating || isRefreshingAnalysis || !profile}
          >
            {(isGenerating || isRefreshingAnalysis) ? <Loader2 className="size-4 animate-spin" /> : <RefreshCw className="size-4" />}
            {isRefreshingAnalysis ? 'Refreshing analysis...' : isGenerating ? 'Generating...' : cvMarkdown ? 'Regenerate CV' : 'Generate CV'}
          </Button>
        </div>
      </div>

      {/* Full-page analysis body */}
      <div className="flex-1 overflow-y-auto min-h-0">
        <div className="max-w-5xl mx-auto p-6 space-y-6">
          {(isGenerating || hasGeneratedCv) && (
            <section
              role={hasGeneratedCv ? 'button' : undefined}
              tabIndex={hasGeneratedCv ? 0 : -1}
              onClick={() => {
                if (hasGeneratedCv && !isGenerating) setFocusModeOn(true)
              }}
              onKeyDown={(e) => {
                if (!hasGeneratedCv || isGenerating) return
                if (e.key === 'Enter' || e.key === ' ') {
                  e.preventDefault()
                  setFocusModeOn(true)
                }
              }}
              className={cn(
                'rounded-xl border border-primary/25 bg-primary/5 p-4 flex flex-wrap items-center gap-4',
                hasGeneratedCv && !isGenerating && 'cursor-pointer hover:bg-primary/10 transition-colors',
              )}
            >
              <div>
                <p className="text-sm font-semibold">{isGenerating ? 'Generating CV...' : 'Generated CV is ready'}</p>
                <p className="text-xs text-muted-foreground">
                  {isGenerating
                    ? 'Live model output status based on streamed content.'
                    : 'Click here to open Focus Mode and refine your generated CV.'}
                </p>
              </div>
              <div className="ml-auto flex items-center gap-3">
                <LargeMatchRing pct={cvKeywordMatchPct} />
                {hasGeneratedCv && !isGenerating && (
                  <Button size="sm" onClick={() => setFocusModeOn(true)}>
                    Open Focus Mode
                  </Button>
                )}
              </div>
            </section>
          )}

          <section className="space-y-4">
            <div>
              <h2 className="text-3xl font-semibold tracking-tight">{job.jobTitle}</h2>
              <div className="flex flex-wrap items-center gap-2 mt-2">
                <span className="text-xs px-2.5 py-1 rounded-full border bg-muted/30 text-muted-foreground">
                  {job.companyName?.trim() || 'Company N/A'}
                </span>
                {job.jobFocus && (
                  <span className="text-xs px-2.5 py-1 rounded-full border border-primary/30 bg-primary/10 text-primary">
                    {job.jobFocus}
                  </span>
                )}
              </div>
            </div>
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              <div className="rounded-xl border bg-card p-4 sm:col-span-2">
                <p className="text-xs text-muted-foreground">Overall profile fit</p>
                <p className="text-4xl font-semibold text-amber-500 mt-1">{matchPct}%</p>
                <div className="mt-3 h-1.5 w-full rounded-full bg-muted overflow-hidden">
                  <div className="h-full bg-amber-500 rounded-full" style={{ width: `${matchPct}%` }} />
                </div>
                <p className="text-xs text-muted-foreground mt-2">
                  {missingMandatory.length > 0
                    ? `${missingMandatory.length} mandatory skill${missingMandatory.length > 1 ? 's' : ''} missing in profile`
                    : 'All mandatory skills are covered in your profile'}
                </p>
              </div>
              <div className="rounded-xl border bg-card p-4">
                <p className="text-[11px] text-muted-foreground">Mandatory match</p>
                <p className="text-2xl font-semibold text-amber-500 mt-1">{insights?.matchBreakdown.mandatoryCoverage ?? 0}%</p>
                <p className="text-[11px] text-muted-foreground mt-1">
                  {effectiveMandatory.filter((s) => s.userHasSkill).length} of {effectiveMandatory.length} required
                </p>
              </div>
              <div className="rounded-xl border bg-card p-4">
                <p className="text-[11px] text-muted-foreground">Nice-to-have</p>
                <p className="text-2xl font-semibold text-emerald-500 mt-1">{insights?.matchBreakdown.niceToHaveCoverage ?? 0}%</p>
                <p className="text-[11px] text-muted-foreground mt-1">
                  {selectedNiceToHave.filter((s) => s.userHasSkill).length} of {selectedNiceToHave.length} matched
                </p>
              </div>
            </div>
          </section>

          {job.languageRequirements && job.languageRequirements.length > 0 && (
            <section className="rounded-lg border bg-card p-4 space-y-3">
              <p className="text-sm font-semibold">Language Requirements</p>
              <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
                {job.languageRequirements.map((lang) => (
                  <div
                    key={lang.language}
                    className={cn(
                      'rounded-md border p-2.5',
                      lang.meetsRequirement
                        ? 'bg-emerald-500/10 border-emerald-500/30'
                        : lang.mandatory
                          ? 'bg-destructive/10 border-destructive/30'
                          : 'bg-amber-500/10 border-amber-500/30',
                    )}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <p className="text-sm font-medium">{lang.language}</p>
                      <span className={cn(
                        'text-[10px] px-2 py-0.5 rounded-full border font-medium',
                        lang.mandatory
                          ? 'bg-destructive/10 text-destructive border-destructive/20'
                          : 'bg-muted text-muted-foreground border-border',
                      )}>
                        {lang.mandatory ? 'Required' : 'Preferred'}
                      </span>
                    </div>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      Required: {lang.requiredLevel === 'native' ? 'Native' : lang.requiredLevel}
                      {lang.userLevel && ` · Your level: ${lang.userLevel === 'native' ? 'Native' : lang.userLevel}`}
                    </p>
                    <p className={cn(
                      'text-xs mt-1 font-medium',
                      lang.meetsRequirement ? 'text-emerald-700 dark:text-emerald-300' : 'text-destructive',
                    )}>
                      {lang.meetsRequirement
                        ? 'Meets requirement'
                        : lang.userHasLanguage
                          ? 'Level below requirement'
                          : 'Not in profile'}
                    </p>
                  </div>
                ))}
              </div>
            </section>
          )}

          {missingMandatory.length > 0 && (
            <section className="rounded-xl border border-amber-500/30 bg-amber-500/10 p-4 space-y-2">
              <p className="text-sm font-semibold text-amber-600 dark:text-amber-400">Quick wins to improve your match score</p>
              <ul className="space-y-1.5 text-xs text-amber-700 dark:text-amber-300">
                {missingMandatory.slice(0, 3).map((skill) => (
                  <li key={skill.name}>- Add concrete evidence for <span className="font-semibold">{skill.name}</span> in your summary or experience bullets.</li>
                ))}
              </ul>
            </section>
          )}

          <section className="grid gap-4 lg:grid-cols-2">
            <div className="rounded-lg border bg-card p-4 space-y-3">
              <p className="text-sm font-semibold">Required Skills (Profile Match)</p>
              <div className="space-y-2">
                {effectiveMandatory.map((skill) => {
                  const aliasDecision = job.skillAliasOverrides?.[skill.name]
                  const showAliasWarning = skill.aliasedFrom && !aliasDecision
                  const isMatched = skill.userHasSkill
                  return (
                    <div
                      key={skill.name}
                      className={cn(
                        'rounded-md border p-2.5',
                        isMatched
                          ? 'bg-emerald-500/10 border-emerald-500/30'
                          : 'bg-destructive/10 border-destructive/30',
                      )}
                    >
                      <div className="flex items-center justify-between gap-2">
                        <p className="text-sm font-medium text-foreground">
                          {skill.name}
                        </p>
                        <KeywordPill
                          label={skill.priority === 'primary' ? 'Primary' : skill.priority === 'secondary' ? 'Secondary' : 'Required'}
                          variant={skill.priority === 'primary' ? 'high' : 'medium'}
                        />
                      </div>
                      {skill.context && (
                        <p className="text-xs text-muted-foreground mt-1">{skill.context}</p>
                      )}
                      <p className={cn('text-xs mt-1 font-medium', isMatched ? 'text-emerald-700 dark:text-emerald-300' : 'text-destructive')}>
                        {skill.userHasSkill ? `Matched${skill.userLevel ? ` (${skill.userLevel})` : ''}` : 'Missing in profile'}
                      </p>
                      {showAliasWarning && (
                        <div className="mt-2 rounded-md border border-amber-400/40 bg-amber-500/10 px-2 py-1.5 space-y-1.5">
                          <p className="text-xs text-amber-700 dark:text-amber-300">
                            Aliased: {skill.aliasedFrom} -&gt; {skill.name}
                          </p>
                          <div className="flex items-center gap-2">
                            <Button
                              type="button"
                              size="sm"
                              variant="outline"
                              className="h-7 text-xs gap-1"
                              onClick={() => void persistAliasDecision(skill.name, 'confirmed')}
                            >
                              <Check className="size-3.5" />
                              Confirm
                            </Button>
                            <Button
                              type="button"
                              size="sm"
                              variant="outline"
                              className="h-7 text-xs gap-1"
                              onClick={() => void persistAliasDecision(skill.name, 'rejected')}
                            >
                              <X className="size-3.5" />
                              Reject
                            </Button>
                          </div>
                        </div>
                      )}
                    </div>
                  )
                })}
              </div>
            </div>

            <div className="space-y-4">
              <div className="rounded-lg border bg-card p-4 space-y-3">
                <p className="text-sm font-semibold">Role Snapshot</p>
                <ul className="space-y-1.5">
                  {(job.keyResponsibilities ?? []).slice(0, 4).map((item, index) => (
                    <li key={index} className="text-sm text-muted-foreground flex gap-2">
                      <span className="mt-2 size-1 rounded-full bg-muted-foreground/50 shrink-0" />
                      <span>{item}</span>
                    </li>
                  ))}
                  {!job.keyResponsibilities?.length && (
                    <li className="text-sm text-muted-foreground">{job.jobFocus || 'General engineering role'}</li>
                  )}
                </ul>
              </div>
              <div className="rounded-lg border bg-card p-4 space-y-3">
                <p className="text-sm font-semibold">Nice-to-Have Skills</p>
                <div className="grid gap-2 sm:grid-cols-2">
                  {job.niceToHaveSkills.map((skill) => {
                    const isIncluded = skillInclusions[skill.name] ?? skill.includeInCV !== false
                    return (
                      <label key={skill.name} className="rounded-md border p-2.5 flex items-start gap-2 cursor-pointer">
                        <input
                          type="checkbox"
                          className="mt-0.5"
                          checked={isIncluded}
                          onChange={(e) => setSkillInclusions((prev) => ({ ...prev, [skill.name]: e.target.checked }))}
                        />
                        <div className="min-w-0">
                          <p className="text-sm font-medium">{skill.name}</p>
                          <p className="text-xs text-muted-foreground">
                            {isIncluded ? 'Included in CV generation' : 'Excluded from CV generation'}
                          </p>
                        </div>
                      </label>
                    )
                  })}
                </div>
              </div>
            </div>
          </section>

          <section className="rounded-lg border bg-card p-4 space-y-2">
            <p className="text-sm font-semibold">Missing Skills (From Profile)</p>
            {enhancedInsightsEnabled && missingMandatory.length > 0 ? (
              <div className="grid gap-2 md:grid-cols-2">
                {missingMandatory.slice(0, 10).map((skill) => {
                  const suggestedPlacement =
                    insights?.missingSkillsDetailed.find((item) => item.name === skill.name)?.suggestedPlacement ??
                    'Summary or relevant experience bullets'
                  const priority = skill.priority === 'primary' ? 'primary' : 'secondary'
                  return (
                    <div key={skill.name} className="rounded-md border border-destructive/20 bg-destructive/5 p-2">
                      <div className="flex items-center justify-between gap-2">
                        <p className="text-xs font-medium">{skill.name}</p>
                        <KeywordPill label={priority} variant={priority === 'primary' ? 'high' : 'medium'} />
                      </div>
                      <p className="text-[11px] text-muted-foreground mt-1">Add evidence in: {suggestedPlacement}</p>
                    </div>
                  )
                })}
              </div>
            ) : missingMandatory.length > 0 ? (
              <div className="flex flex-wrap gap-1.5">
                {missingMandatory.map((s) => (
                  <KeywordPill key={s.name} label={s.name} variant="high" />
                ))}
              </div>
            ) : (
              <p className="text-sm text-muted-foreground">No missing mandatory skills detected.</p>
            )}
          </section>

          <section className="rounded-lg border bg-card p-4 space-y-2">
            <p className="text-sm font-semibold">Job Keywords (From Posting)</p>
            <p className="text-xs text-muted-foreground">
              Green keywords are detected in your profile. Red keywords are currently missing in your profile.
            </p>
            {uniqueLeadingKeywords.length > 0 ? (
              <div className="flex flex-wrap gap-1.5">
                {uniqueLeadingKeywords.slice(0, 16).map((item) => {
                  const inProfile = [...effectiveMandatory, ...selectedNiceToHave].some(
                    (skill) => skill.name.toLowerCase() === item.keyword.toLowerCase() && skill.userHasSkill,
                  )
                  return (
                    <span key={item.keyword} title={inProfile ? 'Found in profile' : 'Missing in profile'}>
                      <span
                        className={cn(
                          'text-[11px] px-2.5 py-1 rounded-full border font-medium',
                          inProfile
                            ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-700 dark:text-emerald-300'
                            : 'bg-destructive/10 border-destructive/30 text-destructive',
                        )}
                      >
                        {item.keyword}
                      </span>
                    </span>
                  )
                })}
              </div>
            ) : (
              <p className="text-sm text-muted-foreground">No leading keywords available.</p>
            )}
          </section>

          {profile && excludedSkillsForCv.length > 0 && (
            <details className="rounded-lg border bg-card p-4">
              <summary className="cursor-pointer text-sm font-semibold select-none">
                Excluded Skills
              </summary>
              <p className="text-xs text-muted-foreground mt-2 mb-2 leading-snug">
                These profile skills are omitted from this tailored CV because they are not relevant to this role.
              </p>
              <div className="flex flex-wrap gap-1.5 pb-1">
                {excludedSkillsForCv.map((name) => (
                  <span
                    key={name}
                    className="text-[10px] px-2 py-0.5 rounded-full border border-border/80 bg-muted/50 text-muted-foreground"
                  >
                    {name}
                  </span>
                ))}
              </div>
            </details>
          )}

          {!enhancedInsightsEnabled && (
            <section className="rounded-lg border bg-card p-4">
              <JobFocusDisplay job={job} />
            </section>
          )}

          <section className="rounded-lg border bg-card p-4">
            <p className="text-sm font-semibold mb-1.5">Job Offer Summary</p>
            <p className="text-sm text-muted-foreground leading-relaxed">
              {job.rawDescription.slice(0, 700)}{job.rawDescription.length > 700 ? '…' : ''}
            </p>
          </section>
        </div>
      </div>

      {/* Focus Mode overlay */}
      {focusModeOn && (
        <FocusMode
          markdown={cvMarkdown}
          onMarkdownChange={(v) => {
            setCvMarkdown(v)
            if (job?.id) updateJob(job.id, { generatedCV: v })
          }}
          profile={profile ?? undefined}
          jobTitle={job.jobTitle}
          companyName={job.companyName}
          jobOffer={job}
          onClose={() => setFocusModeOn(false)}
        />
      )}
    </div>
  )
}
