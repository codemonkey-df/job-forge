import { useEffect, useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { Loader2, ArrowLeft, RefreshCw } from 'lucide-react'
import { SkillList } from '@/components/job/SkillList'
import { CVPreview } from '@/components/cv/CVPreview'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { useJobStore } from '@/store/jobStore'
import { useProfileStore } from '@/store/profileStore'
import { streamMarkdown } from '@/lib/llm/client'
import { cvGenerationSystem, buildCVGenerationPrompt } from '@/lib/llm/prompts/cvGeneration'
import { downloadCVAsPDF } from '@/lib/pdf/generator'
import { computeMatchPercentage } from '@/lib/utils/skillMatcher'
import { useToast } from '@/hooks/use-toast'
import type { JobOffer } from '@/types/job'

const statusColors: Record<string, 'default' | 'secondary' | 'success' | 'warning' | 'destructive' | 'info'> = {
  bookmarked: 'secondary',
  applied: 'info',
  interviewing: 'warning',
  offer: 'success',
  rejected: 'destructive',
  withdrawn: 'outline' as never,
}

export default function JobAnalysis() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const { jobs, updateJob } = useJobStore()
  const { profile } = useProfileStore()
  const { toast } = useToast()

  const [job, setJob] = useState<JobOffer | null>(null)
  const [cvMarkdown, setCvMarkdown] = useState('')
  const [isGenerating, setIsGenerating] = useState(false)
  const [isExportingPDF, setIsExportingPDF] = useState(false)

  useEffect(() => {
    if (!id) return
    const found = jobs.find((j) => j.id === Number(id))
    if (found) {
      setJob(found)
      setCvMarkdown(found.generatedCV ?? '')
    }
  }, [id, jobs])

  async function handleRegenerate() {
    if (!job || !profile) return
    setIsGenerating(true)
    setCvMarkdown('')
    await streamMarkdown({
      systemPrompt: cvGenerationSystem,
      prompt: buildCVGenerationPrompt({
        jobTitle: job.jobTitle,
        companyName: job.companyName,
        matchedMandatorySkills: job.mandatorySkills.filter((s) => s.userHasSkill).map((s) => s.name),
        missingMandatorySkills: job.mandatorySkills.filter((s) => !s.userHasSkill).map((s) => s.name),
        niceToHaveSkills: job.niceToHaveSkills.map((s) => s.name),
        profile,
      }),
      onChunk: (chunk) => setCvMarkdown((prev) => prev + chunk),
      onFinish: async (full) => {
        setIsGenerating(false)
        if (job.id) await updateJob(job.id, { generatedCV: full })
      },
      onError: (err) => {
        setIsGenerating(false)
        toast({ title: 'Regeneration failed', description: err.message, variant: 'destructive' })
      },
    })
  }

  async function handleExportPDF() {
    if (!cvMarkdown || !profile) return
    setIsExportingPDF(true)
    try {
      await downloadCVAsPDF(cvMarkdown, profile)
    } catch (err) {
      toast({ title: 'PDF export failed', description: err instanceof Error ? err.message : 'Unknown', variant: 'destructive' })
    } finally {
      setIsExportingPDF(false)
    }
  }

  if (!job) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="size-6 animate-spin text-muted-foreground" />
      </div>
    )
  }

  const matchPct = computeMatchPercentage([...job.mandatorySkills, ...job.niceToHaveSkills])

  return (
    <div className="max-w-4xl space-y-6">
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="icon" onClick={() => navigate('/')}>
          <ArrowLeft className="size-4" />
        </Button>
        <div className="flex-1">
          <h2 className="font-semibold">{job.jobTitle}</h2>
          <p className="text-sm text-muted-foreground">{job.companyName}</p>
        </div>
        <Badge variant={statusColors[job.status] ?? 'secondary'} className="capitalize">{job.status}</Badge>
        <div className="text-right">
          <div className="text-xl font-bold text-primary">{matchPct}%</div>
          <div className="text-xs text-muted-foreground">match</div>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Skill Analysis</CardTitle>
        </CardHeader>
        <CardContent>
          <SkillList mandatorySkills={job.mandatorySkills} niceToHaveSkills={job.niceToHaveSkills} />
        </CardContent>
      </Card>

      {cvMarkdown ? (
        <CVPreview
          markdown={cvMarkdown}
          isStreaming={isGenerating}
          onMarkdownChange={(v) => setCvMarkdown(v)}
          onExportPDF={handleExportPDF}
          isExporting={isExportingPDF}
        />
      ) : (
        <Card>
          <CardContent className="pt-6 flex flex-col items-center gap-4">
            <p className="text-sm text-muted-foreground">No CV generated yet for this job.</p>
            <Button onClick={handleRegenerate} disabled={isGenerating || !profile}>
              {isGenerating ? <Loader2 className="size-4 animate-spin" /> : <RefreshCw className="size-4" />}
              Generate CV
            </Button>
          </CardContent>
        </Card>
      )}

      {cvMarkdown && (
        <div className="flex justify-end">
          <Button variant="outline" onClick={handleRegenerate} disabled={isGenerating}>
            <RefreshCw className="size-4" />
            Regenerate CV
          </Button>
        </div>
      )}

      {job.missingSkillsReport && (
        <Card>
          <CardHeader>
            <CardTitle>Missing Skills Guide</CardTitle>
          </CardHeader>
          <CardContent>
            <div
              className="text-sm prose prose-sm max-w-none dark:prose-invert"
              dangerouslySetInnerHTML={{
                __html: job.missingSkillsReport
                  .replace(/^## (.+)$/gm, '<h3 class="font-semibold mt-4 mb-2">$1</h3>')
                  .replace(/^- (.+)$/gm, '<li class="ml-4">$1</li>')
                  .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
                  .replace(/^(?!<[h|u|l|s])(.+)$/gm, '<p>$1</p>')
              }}
            />
          </CardContent>
        </Card>
      )}
    </div>
  )
}
