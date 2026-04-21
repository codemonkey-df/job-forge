import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { PlusCircle, ExternalLink, Trash2, FileDown, Loader2, RefreshCw } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { AnalyzeJobModal } from '@/components/job/AnalyzeJobModal'

import { useJobStore } from '@/store/jobStore'
import { useProfileStore } from '@/store/profileStore'
import { computeMatchPercentage } from '@/lib/utils/skillMatcher'
import { computeCVKeywordMatch } from '@/lib/utils/atsChecks'
import { downloadCVAsPDF } from '@/lib/pdf/generator'
import { useToast } from '@/hooks/use-toast'
import { cn } from '@/lib/utils'
import type { ApplicationStatus } from '@/types/job'

const statuses: ApplicationStatus[] = ['bookmarked', 'applied', 'interviewing', 'offer', 'rejected', 'withdrawn']

const statusConfig: Record<ApplicationStatus, { label: string; dot: string; pill: string }> = {
  bookmarked: { label: 'Bookmarked', dot: 'bg-primary', pill: 'bg-primary/10 text-primary' },
  applied:    { label: 'Applied',    dot: 'bg-amber-500', pill: 'bg-amber-500/10 text-amber-500' },
  interviewing: { label: 'Interview', dot: 'bg-emerald-500', pill: 'bg-emerald-500/10 text-emerald-500' },
  offer:      { label: 'Offer',      dot: 'bg-emerald-500', pill: 'bg-emerald-500/10 text-emerald-500' },
  rejected:   { label: 'Rejected',   dot: 'bg-destructive', pill: 'bg-destructive/10 text-destructive' },
  withdrawn:  { label: 'Withdrawn',  dot: 'bg-muted-foreground', pill: 'bg-muted/50 text-muted-foreground' },
}

type FilterKey = 'all' | 'bookmarked' | 'applied' | 'interviewing' | 'rejected'
const filterTabs: { key: FilterKey; label: string }[] = [
  { key: 'all', label: 'All' },
  { key: 'bookmarked', label: 'Bookmarked' },
  { key: 'applied', label: 'Applied' },
  { key: 'interviewing', label: 'Interview' },
  { key: 'rejected', label: 'Rejected' },
]

function MatchRing({ pct, label, title }: { pct: number; label: string; title?: string }) {
  const r = 14
  const circ = 2 * Math.PI * r // 87.96
  const offset = circ * (1 - pct / 100)
  const color = pct >= 70 ? 'var(--color-emerald-500, #22c55e)' : pct >= 40 ? 'var(--color-amber-500, #f59e0b)' : 'var(--color-destructive, #ef4444)'
  const textClass = pct >= 70 ? 'text-emerald-500' : pct >= 40 ? 'text-amber-500' : 'text-destructive'

  return (
    <div className="flex items-center gap-2" title={title}>
      <div className="relative w-9 h-9 shrink-0">
        <svg width="36" height="36" viewBox="0 0 36 36" className="-rotate-90">
          <circle cx="18" cy="18" r={r} fill="none" stroke="currentColor" strokeWidth="3" className="text-muted/40" />
          <circle
            cx="18" cy="18" r={r}
            fill="none"
            stroke={color}
            strokeWidth="3"
            strokeLinecap="round"
            strokeDasharray={circ}
            strokeDashoffset={offset}
          />
        </svg>
      </div>
      <div className="flex flex-col leading-tight">
        <span className={cn('font-mono text-sm font-medium', textClass)}>{pct}%</span>
        <span className="text-[10px] text-muted-foreground">{label}</span>
      </div>
    </div>
  )
}

export default function Dashboard() {
  const navigate = useNavigate()
  const { jobs, isLoading, loadJobs, updateJobStatus, deleteJob } = useJobStore()
  const { profile } = useProfileStore()
  const { toast } = useToast()
  const [activeFilter, setActiveFilter] = useState<FilterKey>('all')
  const [analyzeModalOpen, setAnalyzeModalOpen] = useState(false)

  useEffect(() => { loadJobs() }, [loadJobs])

  async function handleExportPDF(jobId: number) {
    const job = jobs.find((j) => j.id === jobId)
    if (!job?.generatedCV || !profile) {
      toast({ title: 'No CV available', description: 'Open the job and generate a CV first.', variant: 'destructive' })
      return
    }
    try {
      await downloadCVAsPDF(job.generatedCV, profile)
    } catch {
      toast({ title: 'Export failed', variant: 'destructive' })
    }
  }

  async function handleDelete(jobId: number) {
    await deleteJob(jobId)
    toast({ title: 'Job deleted' })
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="size-6 animate-spin text-muted-foreground" />
      </div>
    )
  }

  if (jobs.length === 0) {
    return (
      <>
        <div className="flex flex-col items-center justify-center h-64 gap-4">
          <p className="text-muted-foreground">No job analyses yet.</p>
          <Button onClick={() => setAnalyzeModalOpen(true)}>
            <PlusCircle className="size-4" /> Analyze Your First Job
          </Button>
        </div>
        <AnalyzeJobModal
          open={analyzeModalOpen}
          onOpenChange={setAnalyzeModalOpen}
          onSuccess={(id) => { setAnalyzeModalOpen(false); navigate(`/jobs/${id}`) }}
        />
      </>
    )
  }

  // Stats
  const totalTracked = jobs.length
  const appliedCount = jobs.filter(j => ['applied', 'interviewing', 'offer'].includes(j.status)).length
  const interviewCount = jobs.filter(j => j.status === 'interviewing').length
  const avgMatch = Math.round(
    jobs.reduce((sum, j) => sum + computeMatchPercentage([...j.mandatorySkills, ...j.niceToHaveSkills]), 0) / jobs.length
  )

  // Filtered jobs
  const filteredJobs = activeFilter === 'all'
    ? jobs
    : jobs.filter(j => {
        if (activeFilter === 'applied') return ['applied', 'interviewing', 'offer'].includes(j.status)
        return j.status === activeFilter
      })

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h2 className="text-sm text-muted-foreground">{totalTracked} job{totalTracked !== 1 ? 's' : ''} tracked</h2>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={() => loadJobs()}>
            <RefreshCw className="size-3.5" /> Refresh
          </Button>
          <Button size="sm" onClick={() => setAnalyzeModalOpen(true)}>
            <PlusCircle className="size-4" /> Analyze Job
          </Button>
        </div>
      </div>

      {/* Stats row */}
      <div className="grid grid-cols-4 gap-3">
        <StatCard label="Total tracked" value={totalTracked} sub="jobs in pipeline" accent="border-t-primary" valueClass="text-primary" />
        <StatCard label="Applied" value={appliedCount} sub="awaiting response" accent="border-t-amber-500" valueClass="text-amber-500" />
        <StatCard label="Interviews" value={interviewCount} sub="scheduled" accent="border-t-emerald-500" valueClass="text-emerald-500" />
        <StatCard label="Avg. match" value={`${avgMatch}%`} sub="across all jobs" accent="" valueClass="" />
      </div>

      {/* Table */}
      <div className="rounded-xl border overflow-hidden bg-card">
        <div className="flex items-center justify-between px-5 py-3.5 border-b bg-muted/30">
          <h2 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Job Pipeline</h2>
          <div className="flex gap-1 bg-muted rounded-lg p-0.5">
            {filterTabs.map(tab => (
              <button
                key={tab.key}
                onClick={() => setActiveFilter(tab.key)}
                className={cn(
                  'px-3 py-1 rounded-md text-xs font-medium transition-all',
                  activeFilter === tab.key
                    ? 'bg-background text-foreground shadow-sm'
                    : 'text-muted-foreground hover:text-foreground',
                )}
              >
                {tab.label}
              </button>
            ))}
          </div>
        </div>

        <table className="w-full text-sm">
          <thead className="bg-muted/20">
            <tr>
              <th className="text-left px-5 py-2.5 text-xs font-semibold uppercase tracking-wider text-muted-foreground/60">Position</th>
              <th className="text-left px-5 py-2.5 text-xs font-semibold uppercase tracking-wider text-muted-foreground/60">Profile Match</th>
              <th className="text-left px-5 py-2.5 text-xs font-semibold uppercase tracking-wider text-muted-foreground/60">CV ATS</th>
              <th className="text-left px-5 py-2.5 text-xs font-semibold uppercase tracking-wider text-muted-foreground/60">Date</th>
              <th className="text-left px-5 py-2.5 text-xs font-semibold uppercase tracking-wider text-muted-foreground/60">Status</th>
              <th className="px-5 py-2.5" />
            </tr>
          </thead>
          <tbody>
            {filteredJobs.length === 0 ? (
              <tr>
                <td colSpan={6} className="text-center py-12 text-muted-foreground text-sm">No jobs match this filter.</td>
              </tr>
            ) : (
              filteredJobs.map((job) => {
                const profileMatchPct = computeMatchPercentage([...job.mandatorySkills, ...job.niceToHaveSkills])
                const hasGeneratedCv = Boolean(job.generatedCV?.trim())
                const cvAtsPct = hasGeneratedCv
                  ? computeCVKeywordMatch(job.generatedCV ?? '', {
                    mandatorySkills: job.mandatorySkills,
                    niceToHaveSkills: job.niceToHaveSkills,
                  })
                  : 0
                const date = new Date(job.analyzedAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
                const cfg = statusConfig[job.status]
                return (
                  <tr key={job.id} className="border-t hover:bg-muted/20 transition-colors cursor-pointer group">
                    <td className="px-5 py-3.5" onClick={() => navigate(`/jobs/${job.id}`)}>
                      <div className="flex flex-col gap-0.5">
                        <span className="font-semibold text-sm">{job.jobTitle}</span>
                        <span className="text-xs text-muted-foreground">{job.companyName}</span>
                      </div>
                    </td>
                    <td className="px-5 py-3.5">
                      <MatchRing
                        pct={profileMatchPct}
                        label="Profile"
                        title="Profile match score: current profile skills vs job requirements."
                      />
                    </td>
                    <td className="px-5 py-3.5">
                      {hasGeneratedCv ? (
                        <MatchRing
                          pct={cvAtsPct}
                          label="CV ATS"
                          title="CV ATS score: actual detected keyword coverage in generated CV text."
                        />
                      ) : (
                        <span className="text-[10px] text-muted-foreground">-</span>
                      )}
                    </td>
                    <td className="px-5 py-3.5">
                      <span className="font-mono text-xs text-muted-foreground">{date}</span>
                    </td>
                    <td className="px-5 py-3.5">
                      <Select
                        value={job.status}
                        onValueChange={(v) => updateJobStatus(job.id!, v as ApplicationStatus)}
                      >
                        <SelectTrigger className={cn('h-7 w-auto border-0 shadow-none text-xs font-medium px-2.5 py-0 gap-1.5 rounded-full', cfg.pill)}>
                          <span className={cn('w-1.5 h-1.5 rounded-full shrink-0', cfg.dot)} />
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {statuses.map((s) => (
                            <SelectItem key={s} value={s} className="capitalize text-xs">{statusConfig[s].label}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </td>
                    <td className="px-5 py-3.5">
                      <div className="flex items-center gap-1 justify-end opacity-0 group-hover:opacity-100 transition-opacity">
                        {job.originalUrl && (
                          <a href={job.originalUrl} target="_blank" rel="noopener noreferrer" onClick={e => e.stopPropagation()}>
                            <Button variant="ghost" size="icon" className="size-7">
                              <ExternalLink className="size-3.5" />
                            </Button>
                          </a>
                        )}
                        <Button variant="ghost" size="icon" className="size-7" onClick={(e) => { e.stopPropagation(); handleExportPDF(job.id!) }} title="Export PDF">
                          <FileDown className="size-3.5" />
                        </Button>
                        <Button variant="ghost" size="icon" className="size-7 text-destructive hover:text-destructive" onClick={(e) => { e.stopPropagation(); handleDelete(job.id!) }} title="Delete">
                          <Trash2 className="size-3.5" />
                        </Button>
                      </div>
                    </td>
                  </tr>
                )
              })
            )}
          </tbody>
        </table>
      </div>

      <AnalyzeJobModal
        open={analyzeModalOpen}
        onOpenChange={setAnalyzeModalOpen}
        onSuccess={(id) => { setAnalyzeModalOpen(false); navigate(`/jobs/${id}`) }}
      />
    </div>
  )
}

function StatCard({ label, value, sub, accent, valueClass }: { label: string; value: string | number; sub: string; accent: string; valueClass: string }) {
  return (
    <div className={cn('bg-card border rounded-xl p-4 relative overflow-hidden border-t-2', accent || 'border-t-border')}>
      <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-2">{label}</p>
      <p className={cn('font-mono text-3xl font-medium leading-none mb-1', valueClass || 'text-foreground')}>{value}</p>
      <p className="text-xs text-muted-foreground">{sub}</p>
    </div>
  )
}
