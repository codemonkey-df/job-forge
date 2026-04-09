import { useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { PlusCircle, ExternalLink, Trash2, FileDown, Loader2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'

import { useJobStore } from '@/store/jobStore'
import { useProfileStore } from '@/store/profileStore'
import { computeMatchPercentage } from '@/lib/utils/skillMatcher'
import { downloadCVAsPDF } from '@/lib/pdf/generator'
import { useToast } from '@/hooks/use-toast'
import type { ApplicationStatus } from '@/types/job'

const statuses: ApplicationStatus[] = ['bookmarked', 'applied', 'interviewing', 'offer', 'rejected', 'withdrawn']

const statusColors: Record<ApplicationStatus, string> = {
  bookmarked: 'bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300',
  applied: 'bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-300',
  interviewing: 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900 dark:text-yellow-300',
  offer: 'bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300',
  rejected: 'bg-red-100 text-red-700 dark:bg-red-900 dark:text-red-300',
  withdrawn: 'bg-gray-100 text-gray-500 dark:bg-gray-800 dark:text-gray-500',
}

export default function Dashboard() {
  const navigate = useNavigate()
  const { jobs, isLoading, loadJobs, updateJobStatus, deleteJob } = useJobStore()
  const { profile } = useProfileStore()
  const { toast } = useToast()

  useEffect(() => {
    loadJobs()
  }, [loadJobs])

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
      <div className="flex flex-col items-center justify-center h-64 gap-4">
        <p className="text-muted-foreground">No job analyses yet.</p>
        <Button onClick={() => navigate('/jobs/new')}>
          <PlusCircle className="size-4" /> Analyze Your First Job
        </Button>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground">{jobs.length} job{jobs.length !== 1 ? 's' : ''} tracked</p>
        <Button size="sm" onClick={() => navigate('/jobs/new')}>
          <PlusCircle className="size-4" /> Analyze Job
        </Button>
      </div>

      <div className="rounded-lg border overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-muted/50">
            <tr>
              <th className="text-left px-4 py-3 font-medium">Position</th>
              <th className="text-left px-4 py-3 font-medium">Company</th>
              <th className="text-left px-4 py-3 font-medium">Match</th>
              <th className="text-left px-4 py-3 font-medium">Date</th>
              <th className="text-left px-4 py-3 font-medium">Status</th>
              <th className="px-4 py-3" />
            </tr>
          </thead>
          <tbody>
            {jobs.map((job) => {
              const matchPct = computeMatchPercentage([...job.mandatorySkills, ...job.niceToHaveSkills])
              const date = new Date(job.analyzedAt).toLocaleDateString()
              return (
                <tr key={job.id} className="border-t hover:bg-muted/30 transition-colors">
                  <td className="px-4 py-3">
                    <button
                      className="font-medium text-left hover:underline text-primary"
                      onClick={() => navigate(`/jobs/${job.id}`)}
                    >
                      {job.jobTitle}
                    </button>
                    {job.originalUrl && (
                      <a href={job.originalUrl} target="_blank" rel="noopener noreferrer" className="ml-1 text-muted-foreground hover:text-primary">
                        <ExternalLink className="size-3 inline" />
                      </a>
                    )}
                  </td>
                  <td className="px-4 py-3 text-muted-foreground">{job.companyName}</td>
                  <td className="px-4 py-3">
                    <span className={`font-bold ${matchPct >= 70 ? 'text-green-600' : matchPct >= 40 ? 'text-yellow-600' : 'text-red-600'}`}>
                      {matchPct}%
                    </span>
                  </td>
                  <td className="px-4 py-3 text-muted-foreground whitespace-nowrap">{date}</td>
                  <td className="px-4 py-3">
                    <Select
                      value={job.status}
                      onValueChange={(v) => updateJobStatus(job.id!, v as ApplicationStatus)}
                    >
                      <SelectTrigger className={`w-36 h-7 text-xs border-0 ${statusColors[job.status]}`}>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {statuses.map((s) => (
                          <SelectItem key={s} value={s} className="capitalize text-xs">{s}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-1 justify-end">
                      <Button variant="ghost" size="icon" className="size-7" onClick={() => handleExportPDF(job.id!)} title="Export PDF">
                        <FileDown className="size-3.5" />
                      </Button>
                      <Button variant="ghost" size="icon" className="size-7 text-destructive" onClick={() => handleDelete(job.id!)} title="Delete">
                        <Trash2 className="size-3.5" />
                      </Button>
                    </div>
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
    </div>
  )
}
