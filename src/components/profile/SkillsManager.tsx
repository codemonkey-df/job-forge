import { useId, useMemo, useState } from 'react'
import { Plus, Trash2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Switch } from '@/components/ui/switch'
import { SKILL_CATEGORY_PRESETS } from '@/lib/profile/skillCategoryPresets'
import {
  buildSkillRows,
  distinctCategories,
  groupSkillRows,
  type CategoryFilter,
  type LevelFilter,
  type SkillSortMode,
} from '@/lib/profile/skillsView'
import type { Skill, SkillLevel } from '@/types/profile'

const levels: SkillLevel[] = ['basic', 'intermediate', 'advanced', 'expert']

const CATEGORY_FILTER_ALL = '__all__'
const CATEGORY_FILTER_UNCATEGORIZED = '__uncategorized__'

interface Props {
  skills: Skill[]
  onChange: (skills: Skill[]) => void
  pendingName: string
  pendingLevel: SkillLevel
  pendingCategory: string
  onPendingNameChange: (name: string) => void
  onPendingLevelChange: (level: SkillLevel) => void
  onPendingCategoryChange: (category: string) => void
  onAddPendingSkill: () => void
}

function parseCategoryFilter(selectValue: string): CategoryFilter {
  if (selectValue === CATEGORY_FILTER_ALL) return 'all'
  if (selectValue === CATEGORY_FILTER_UNCATEGORIZED) return 'uncategorized'
  return selectValue
}

function categoryFilterToSelectValue(filter: CategoryFilter): string {
  if (filter === 'all') return CATEGORY_FILTER_ALL
  if (filter === 'uncategorized') return CATEGORY_FILTER_UNCATEGORIZED
  return filter
}

function storedCategory(skill: Skill): string {
  return skill.category?.trim() ?? ''
}

export function SkillsManager({
  skills,
  onChange,
  pendingName,
  pendingLevel,
  pendingCategory,
  onPendingNameChange,
  onPendingLevelChange,
  onPendingCategoryChange,
  onAddPendingSkill,
}: Props) {
  const datalistId = useId()
  const [searchQuery, setSearchQuery] = useState('')
  const [levelFilter, setLevelFilter] = useState<LevelFilter>('all')
  const [categoryFilter, setCategoryFilter] = useState<CategoryFilter>('all')
  const [sortMode, setSortMode] = useState<SkillSortMode>('storage')
  const [groupByCategory, setGroupByCategory] = useState(false)

  const categoriesInProfile = useMemo(() => distinctCategories(skills), [skills])

  const viewRows = useMemo(
    () =>
      buildSkillRows(skills, {
        searchQuery,
        levelFilter,
        categoryFilter,
        sortMode,
      }),
    [skills, searchQuery, levelFilter, categoryFilter, sortMode],
  )

  const grouped = useMemo(() => (groupByCategory ? groupSkillRows(viewRows) : null), [groupByCategory, viewRows])

  function removeSkill(index: number) {
    onChange(skills.filter((_, i) => i !== index))
  }

  function updateLevel(index: number, level: SkillLevel) {
    onChange(skills.map((s, i) => (i === index ? { ...s, level } : s)))
  }

  function updateName(index: number, name: string) {
    onChange(skills.map((s, i) => (i === index ? { ...s, name } : s)))
  }

  function updateCategory(index: number, raw: string) {
    const trimmed = raw.trim()
    const category = trimmed ? trimmed : undefined
    onChange(skills.map((s, i) => (i === index ? { ...s, category } : s)))
  }

  function renderRow(index: number, skill: Skill) {
    return (
      <div key={index} className="flex flex-wrap items-center gap-2">
        <Input
          value={skill.name}
          onChange={(e) => updateName(index, e.target.value)}
          placeholder="Skill name"
          className="min-w-[8rem] flex-1"
          aria-label="Skill name"
        />
        <Input
          value={storedCategory(skill)}
          onChange={(e) => updateCategory(index, e.target.value)}
          placeholder="Category"
          className="w-40 min-w-[6rem]"
          list={datalistId}
          aria-label="Skill category"
        />
        <Select value={skill.level} onValueChange={(v) => updateLevel(index, v as SkillLevel)}>
          <SelectTrigger className="w-36 shrink-0">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {levels.map((l) => (
              <SelectItem key={l} value={l} className="capitalize">
                {l}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Button variant="ghost" size="icon" type="button" onClick={() => removeSkill(index)} aria-label="Remove skill">
          <Trash2 className="size-4 text-destructive" />
        </Button>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      <datalist id={datalistId}>
        {SKILL_CATEGORY_PRESETS.map((c) => (
          <option key={c} value={c} />
        ))}
      </datalist>

      {skills.length > 0 && (
        <div className="flex flex-col gap-4 rounded-lg border bg-muted/30 p-4">
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
            <div className="space-y-1.5 sm:col-span-2 lg:col-span-1 xl:col-span-2">
              <Label htmlFor="skills-search" className="text-xs">
                Search skills
              </Label>
              <Input
                id="skills-search"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Name or category…"
                className="h-9"
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Level</Label>
              <Select
                value={levelFilter}
                onValueChange={(v) => setLevelFilter(v === 'all' ? 'all' : (v as SkillLevel))}
              >
                <SelectTrigger className="h-9">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All levels</SelectItem>
                  {levels.map((l) => (
                    <SelectItem key={l} value={l} className="capitalize">
                      {l}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Category</Label>
              <Select
                value={categoryFilterToSelectValue(categoryFilter)}
                onValueChange={(v) => setCategoryFilter(parseCategoryFilter(v))}
              >
                <SelectTrigger className="h-9">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={CATEGORY_FILTER_ALL}>All categories</SelectItem>
                  <SelectItem value={CATEGORY_FILTER_UNCATEGORIZED}>Uncategorized</SelectItem>
                  {categoriesInProfile.map((c) => (
                    <SelectItem key={c} value={c}>
                      {c}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Sort</Label>
              <Select value={sortMode} onValueChange={(v) => setSortMode(v as SkillSortMode)}>
                <SelectTrigger className="h-9">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="storage">Storage order</SelectItem>
                  <SelectItem value="name-asc">Name (A–Z)</SelectItem>
                  <SelectItem value="name-desc">Name (Z–A)</SelectItem>
                  <SelectItem value="level-asc">Level (low → high)</SelectItem>
                  <SelectItem value="level-desc">Level (high → low)</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="flex items-end gap-2 pb-0.5 sm:col-span-2 lg:col-span-1 xl:col-span-1">
              <Switch
                id="skills-group-toggle"
                checked={groupByCategory}
                onCheckedChange={setGroupByCategory}
              />
              <Label htmlFor="skills-group-toggle" className="cursor-pointer text-xs font-normal leading-tight">
                Group by category
              </Label>
            </div>
          </div>
        </div>
      )}

      {skills.length > 0 && (
        <p className="text-xs text-muted-foreground">Edit skill names and categories in place.</p>
      )}

      {skills.length > 0 && viewRows.length === 0 && (
        <p className="text-sm text-muted-foreground">No skills match the current filters.</p>
      )}

      {grouped
        ? grouped.map((g) => (
            <div key={g.key} className="space-y-2">
              <h4 className="text-sm font-semibold text-foreground">{g.label}</h4>
              <div className="space-y-3 pl-0 sm:pl-1">{g.rows.map(({ index, skill }) => renderRow(index, skill))}</div>
            </div>
          ))
        : viewRows.length > 0 && (
            <div className="space-y-3">{viewRows.map(({ index, skill }) => renderRow(index, skill))}</div>
          )}

      <div className="flex flex-wrap items-center gap-2 border-t pt-4">
        <Input
          value={pendingName}
          onChange={(e) => onPendingNameChange(e.target.value)}
          placeholder="Add new skill..."
          className="min-w-[8rem] flex-1"
          onKeyDown={(e) => e.key === 'Enter' && (e.preventDefault(), onAddPendingSkill())}
          aria-label="New skill name"
        />
        <Input
          value={pendingCategory}
          onChange={(e) => onPendingCategoryChange(e.target.value)}
          placeholder="Category"
          className="w-40 min-w-[6rem]"
          list={datalistId}
          aria-label="New skill category"
        />
        <Select value={pendingLevel} onValueChange={(v) => onPendingLevelChange(v as SkillLevel)}>
          <SelectTrigger className="w-36 shrink-0">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {levels.map((l) => (
              <SelectItem key={l} value={l} className="capitalize">
                {l}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Button type="button" size="icon" onClick={onAddPendingSkill} aria-label="Add skill">
          <Plus className="size-4" />
        </Button>
      </div>
    </div>
  )
}
