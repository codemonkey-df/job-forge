import { SkillCard } from './SkillCard'
import type { JobSkill } from '@/types/job'

interface Props {
  mandatorySkills: JobSkill[]
  niceToHaveSkills: JobSkill[]
  onToggleNiceToHave?: (name: string) => void
}

export function SkillList({ mandatorySkills, niceToHaveSkills, onToggleNiceToHave }: Props) {
  const mandatoryMatched = mandatorySkills.filter((s) => s.userHasSkill).length
  const niceMatched = niceToHaveSkills.filter((s) => s.userHasSkill).length

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
      <div>
        <div className="flex items-center justify-between mb-3">
          <h3 className="font-semibold text-sm">Required Skills</h3>
          <span className="text-xs text-muted-foreground">
            {mandatoryMatched}/{mandatorySkills.length} matched
          </span>
        </div>
        <div className="space-y-2">
          {mandatorySkills.length === 0 && (
            <p className="text-sm text-muted-foreground">No required skills found.</p>
          )}
          {mandatorySkills.map((skill) => (
            <SkillCard key={skill.name} skill={skill} />
          ))}
        </div>
      </div>

      <div>
        <div className="flex items-center justify-between mb-3">
          <h3 className="font-semibold text-sm">Nice to Have</h3>
          <span className="text-xs text-muted-foreground">
            {niceMatched}/{niceToHaveSkills.length} matched
          </span>
        </div>
        {onToggleNiceToHave && niceToHaveSkills.length > 0 && (
          <p className="text-xs text-muted-foreground mb-2">
            Check skills to include in the generated CV.
          </p>
        )}
        <div className="space-y-2">
          {niceToHaveSkills.length === 0 && (
            <p className="text-sm text-muted-foreground">No bonus skills found.</p>
          )}
          {niceToHaveSkills.map((skill) => (
            <SkillCard
              key={skill.name}
              skill={skill}
              checked={onToggleNiceToHave ? skill.includeInCV !== false : undefined}
              onToggle={onToggleNiceToHave ? () => onToggleNiceToHave(skill.name) : undefined}
            />
          ))}
        </div>
      </div>
    </div>
  )
}
