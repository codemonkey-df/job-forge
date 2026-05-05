import { Plus, Trash2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import type { LanguageLevel, LanguageProficiency } from '@/types/profile'

const CEFR_LEVELS: { value: LanguageLevel; label: string }[] = [
  { value: 'A1', label: 'A1 — Beginner' },
  { value: 'A2', label: 'A2 — Elementary' },
  { value: 'B1', label: 'B1 — Intermediate' },
  { value: 'B2', label: 'B2 — Upper Intermediate' },
  { value: 'C1', label: 'C1 — Advanced' },
  { value: 'C2', label: 'C2 — Mastery' },
  { value: 'native', label: 'Native' },
]

interface Props {
  languages: LanguageProficiency[]
  onChange: (languages: LanguageProficiency[]) => void
  pendingLanguage: string
  pendingLevel: LanguageLevel
  onPendingLanguageChange: (name: string) => void
  onPendingLevelChange: (level: LanguageLevel) => void
  onAddPendingLanguage: () => void
}

export function LanguagesManager({
  languages,
  onChange,
  pendingLanguage,
  pendingLevel,
  onPendingLanguageChange,
  onPendingLevelChange,
  onAddPendingLanguage,
}: Props) {
  function remove(index: number) {
    onChange(languages.filter((_, i) => i !== index))
  }

  function updateLanguage(index: number, value: string) {
    onChange(languages.map((l, i) => (i === index ? { ...l, language: value } : l)))
  }

  function updateLevel(index: number, level: LanguageLevel) {
    onChange(languages.map((l, i) => (i === index ? { ...l, level } : l)))
  }

  return (
    <div className="space-y-3">
      {languages.map((lang, index) => (
        <div key={index} className="flex items-center gap-2">
          <Input
            value={lang.language}
            onChange={(e) => updateLanguage(index, e.target.value)}
            placeholder="Language"
            className="flex-1 min-w-[8rem]"
            aria-label="Language name"
          />
          <Select value={lang.level} onValueChange={(v) => updateLevel(index, v as LanguageLevel)}>
            <SelectTrigger className="w-52 shrink-0">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {CEFR_LEVELS.map((l) => (
                <SelectItem key={l.value} value={l.value}>
                  {l.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Button variant="ghost" size="icon" type="button" onClick={() => remove(index)} aria-label="Remove language">
            <Trash2 className="size-4 text-destructive" />
          </Button>
        </div>
      ))}

      <div className="flex items-center gap-2 border-t pt-3">
        <Input
          value={pendingLanguage}
          onChange={(e) => onPendingLanguageChange(e.target.value)}
          placeholder="Add language..."
          className="flex-1 min-w-[8rem]"
          onKeyDown={(e) => e.key === 'Enter' && (e.preventDefault(), onAddPendingLanguage())}
          aria-label="New language name"
        />
        <Select value={pendingLevel} onValueChange={(v) => onPendingLevelChange(v as LanguageLevel)}>
          <SelectTrigger className="w-52 shrink-0">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {CEFR_LEVELS.map((l) => (
              <SelectItem key={l.value} value={l.value}>
                {l.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Button type="button" size="icon" onClick={onAddPendingLanguage} aria-label="Add language">
          <Plus className="size-4" />
        </Button>
      </div>
    </div>
  )
}
