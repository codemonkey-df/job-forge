import { Plus, Trash2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import type { Skill, SkillLevel } from '@/types/profile'

const levels: SkillLevel[] = ['basic', 'intermediate', 'advanced', 'expert']

interface Props {
  skills: Skill[]
  onChange: (skills: Skill[]) => void
  pendingName: string
  pendingLevel: SkillLevel
  onPendingNameChange: (name: string) => void
  onPendingLevelChange: (level: SkillLevel) => void
  onAddPendingSkill: () => void
}

export function SkillsManager({
  skills,
  onChange,
  pendingName,
  pendingLevel,
  onPendingNameChange,
  onPendingLevelChange,
  onAddPendingSkill,
}: Props) {

  function removeSkill(index: number) {
    onChange(skills.filter((_, i) => i !== index))
  }

  function updateLevel(index: number, level: SkillLevel) {
    onChange(skills.map((s, i) => (i === index ? { ...s, level } : s)))
  }

  function updateName(index: number, name: string) {
    onChange(skills.map((s, i) => (i === index ? { ...s, name } : s)))
  }

  return (
    <div className="space-y-3">
      {skills.length > 0 && (
        <p className="text-xs text-muted-foreground">Click any skill name to rename it.</p>
      )}
      {skills.map((skill, index) => (
        <div key={index} className="flex items-center gap-2">
          <Input
            value={skill.name}
            onChange={(e) => updateName(index, e.target.value)}
            placeholder="Skill name"
            className="flex-1"
          />
          <Select value={skill.level} onValueChange={(v) => updateLevel(index, v as SkillLevel)}>
            <SelectTrigger className="w-36">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {levels.map((l) => (
                <SelectItem key={l} value={l} className="capitalize">{l}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Button variant="ghost" size="icon" onClick={() => removeSkill(index)}>
            <Trash2 className="size-4 text-destructive" />
          </Button>
        </div>
      ))}

      <div className="flex items-center gap-2 pt-2 border-t">
        <Input
          value={pendingName}
          onChange={(e) => onPendingNameChange(e.target.value)}
          placeholder="Add new skill..."
          className="flex-1"
          onKeyDown={(e) => e.key === 'Enter' && (e.preventDefault(), onAddPendingSkill())}
        />
        <Select value={pendingLevel} onValueChange={(v) => onPendingLevelChange(v as SkillLevel)}>
          <SelectTrigger className="w-36">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {levels.map((l) => (
              <SelectItem key={l} value={l} className="capitalize">{l}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Button type="button" size="icon" onClick={onAddPendingSkill}>
          <Plus className="size-4" />
        </Button>
      </div>
    </div>
  )
}
