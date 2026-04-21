import { CVEditor } from '@/components/cv/CVEditor'
import { useProfileStore } from '@/store/profileStore'
import { calculateProfileCompleteness, isProfileComplete } from '@/lib/utils/auth'
import { Loader2 } from 'lucide-react'
import { cn } from '@/lib/utils'

function CompletenessRing({ pct }: { pct: number }) {
  const r = 36
  const circ = 2 * Math.PI * r
  const offset = circ * (1 - pct / 100)
  const color = pct >= 80 ? '#22c55e' : pct >= 40 ? '#f59e0b' : '#6b7280'
  const textClass = pct >= 80 ? 'text-emerald-500' : pct >= 40 ? 'text-amber-500' : 'text-muted-foreground'

  return (
    <div className="relative w-20 h-20 shrink-0">
      <svg width="80" height="80" viewBox="0 0 80 80" className="-rotate-90">
        <circle cx="40" cy="40" r={r} fill="none" stroke="currentColor" strokeWidth="5" className="text-muted/30" />
        <circle
          cx="40" cy="40" r={r}
          fill="none"
          stroke={color}
          strokeWidth="5"
          strokeLinecap="round"
          strokeDasharray={circ}
          strokeDashoffset={offset}
          style={{ transition: 'stroke-dashoffset 0.6s ease' }}
        />
      </svg>
      <div className="absolute inset-0 flex items-center justify-center">
        <span className={cn('font-mono text-sm font-bold', textClass)}>{pct}%</span>
      </div>
    </div>
  )
}

export default function Profile() {
  const { isLoading, profile } = useProfileStore()

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="size-6 animate-spin text-muted-foreground" />
      </div>
    )
  }

  const completeness = calculateProfileCompleteness(profile)
  const complete = isProfileComplete(profile)
  const skillCount = profile?.skills?.length ?? 0
  const expCount = profile?.experience?.length ?? 0
  const eduCount = profile?.education?.length ?? 0
  const displayName = profile?.fullName?.trim() || 'No name set'
  const displayEmail = profile?.email?.trim() || 'No email set'

  return (
    <div className="space-y-6">
      {/* Profile header */}
      <div className="flex items-center gap-6 p-6 rounded-xl border bg-card">
        <CompletenessRing pct={completeness} />

        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-0.5">
            <h2 className="font-semibold text-lg truncate">{displayName}</h2>
            <span className={cn(
              'inline-flex items-center gap-1.5 text-xs font-medium px-2 py-0.5 rounded-full border shrink-0',
              complete
                ? 'bg-emerald-500/10 text-emerald-500 border-emerald-500/20'
                : 'bg-amber-500/10 text-amber-500 border-amber-500/20',
            )}>
              <span className={cn('w-1.5 h-1.5 rounded-full', complete ? 'bg-emerald-500' : 'bg-amber-500')} />
              {complete ? 'Ready' : 'Incomplete'}
            </span>
          </div>
          <p className="text-sm text-muted-foreground truncate mb-3">{displayEmail}</p>

          <div className="flex items-center gap-4">
            <Stat value={skillCount} label="skills" />
            <div className="w-px h-3 bg-border" />
            <Stat value={expCount} label="experience" />
            <div className="w-px h-3 bg-border" />
            <Stat value={eduCount} label="education" />
          </div>
        </div>
      </div>

      <CVEditor />
    </div>
  )
}

function Stat({ value, label }: { value: number; label: string }) {
  return (
    <div className="flex items-baseline gap-1">
      <span className="font-mono text-sm font-semibold">{value}</span>
      <span className="text-xs text-muted-foreground">{label}</span>
    </div>
  )
}
