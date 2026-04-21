import { CheckCircle2, XCircle, MinusCircle } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Checkbox } from '@/components/ui/checkbox'
import { cn } from '@/lib/utils'
import type { JobSkill } from '@/types/job'

interface Props {
  skill: JobSkill
  checked?: boolean        // for nice-to-have: include in CV checkbox
  onToggle?: () => void    // for nice-to-have: toggle include in CV
}

const levelColors: Record<string, string> = {
  basic: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200',
  intermediate: 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200',
  advanced: 'bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-200',
  expert: 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200',
}

export function SkillCard({ skill, checked, onToggle }: Props) {
  return (
    <div className={cn(
      'flex items-center justify-between px-3 py-2 rounded-md border text-sm',
      skill.userHasSkill
        ? 'bg-green-50 border-green-200 dark:bg-green-950 dark:border-green-800'
        : 'bg-red-50 border-red-200 dark:bg-red-950 dark:border-red-800',
      onToggle && checked === false && 'opacity-50',
    )}>
      <div className="flex items-center gap-2">
        {onToggle !== undefined ? (
          <Checkbox
            checked={checked}
            onCheckedChange={onToggle}
            className="shrink-0"
          />
        ) : skill.userHasSkill ? (
          <CheckCircle2 className="size-4 text-green-600 dark:text-green-400 shrink-0" />
        ) : skill.mandatory ? (
          <XCircle className="size-4 text-red-500 shrink-0" />
        ) : (
          <MinusCircle className="size-4 text-muted-foreground shrink-0" />
        )}
        <div>
          <span className={cn(
            'font-medium',
            skill.userHasSkill ? 'text-green-900 dark:text-green-100' : 'text-red-900 dark:text-red-100',
          )}>
            {skill.name}
          </span>
          {skill.aliasedFrom && (
            <span className="ml-1 text-xs text-muted-foreground">
              (via {skill.aliasedFrom})
            </span>
          )}
        </div>
      </div>
      {skill.userHasSkill && skill.userLevel ? (
        <span className={cn('text-xs px-2 py-0.5 rounded-full font-medium capitalize', levelColors[skill.userLevel])}>
          {skill.userLevel}
        </span>
      ) : !skill.userHasSkill ? (
        <Badge variant="outline" className="text-xs text-muted-foreground">To learn</Badge>
      ) : null}
    </div>
  )
}
