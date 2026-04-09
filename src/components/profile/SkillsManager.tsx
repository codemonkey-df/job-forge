import { useState } from 'react'
import { Plus, Trash2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import type { Skill, SkillLevel } from '@/types/profile'

const levels: SkillLevel[] = ['basic', 'intermediate', 'advanced', 'expert']

interface Props {
  skills: Skill[]
  onChange: (skills: Skill[]) => void
}

export function SkillsManager({ skills, onChange }: Props) {
  const [newName, setNewName] = useState('')
  const [newLevel, setNewLevel] = useState<SkillLevel>('intermediate')

  function addSkill() {
    if (!newName.trim()) return
    onChange([...skills, { name: newName.trim(), level: newLevel }])
    setNewName('')
    setNewLevel('intermediate')
  }

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
          value={newName}
          onChange={(e) => setNewName(e.target.value)}
          placeholder="Add new skill..."
          className="flex-1"
          onKeyDown={(e) => e.key === 'Enter' && (e.preventDefault(), addSkill())}
        />
        <Select value={newLevel} onValueChange={(v) => setNewLevel(v as SkillLevel)}>
          <SelectTrigger className="w-36">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {levels.map((l) => (
              <SelectItem key={l} value={l} className="capitalize">{l}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Button type="button" size="icon" onClick={addSkill}>
          <Plus className="size-4" />
        </Button>
      </div>
    </div>
  )
}
