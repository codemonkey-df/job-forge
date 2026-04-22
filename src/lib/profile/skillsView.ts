import type { Skill, SkillLevel } from '@/types/profile'

export const UNCATEGORIZED_KEY = '__uncategorized__'

const LEVEL_ORDER: Record<SkillLevel, number> = {
  basic: 0,
  intermediate: 1,
  advanced: 2,
  expert: 3,
}

export type LevelFilter = 'all' | SkillLevel

export type CategoryFilter = 'all' | 'uncategorized' | string

export type SkillSortMode =
  | 'storage'
  | 'name-asc'
  | 'name-desc'
  | 'level-asc'
  | 'level-desc'

export interface SkillViewOptions {
  searchQuery: string
  levelFilter: LevelFilter
  categoryFilter: CategoryFilter
  sortMode: SkillSortMode
}

export interface SkillRow {
  index: number
  skill: Skill
}

export interface SkillGroup {
  key: string
  label: string
  rows: SkillRow[]
}

function normalizeCategory(skill: Skill): string | undefined {
  const c = skill.category?.trim()
  return c || undefined
}

function matchesSearch(skill: Skill, q: string): boolean {
  const s = q.trim().toLowerCase()
  if (!s) return true
  if (skill.name.toLowerCase().includes(s)) return true
  const cat = normalizeCategory(skill)
  return cat ? cat.toLowerCase().includes(s) : false
}

function matchesLevel(skill: Skill, levelFilter: LevelFilter): boolean {
  if (levelFilter === 'all') return true
  return skill.level === levelFilter
}

function matchesCategoryFilter(skill: Skill, categoryFilter: CategoryFilter): boolean {
  if (categoryFilter === 'all') return true
  const cat = normalizeCategory(skill)
  if (categoryFilter === 'uncategorized') return !cat
  return cat === categoryFilter
}

function compareByName(a: SkillRow, b: SkillRow): number {
  return a.skill.name.localeCompare(b.skill.name, undefined, { sensitivity: 'base' })
}

function compareByLevel(a: SkillRow, b: SkillRow): number {
  return LEVEL_ORDER[a.skill.level] - LEVEL_ORDER[b.skill.level]
}

function sortRows(rows: SkillRow[], sortMode: SkillSortMode): SkillRow[] {
  if (sortMode === 'storage') return rows
  const copy = [...rows]
  switch (sortMode) {
    case 'name-asc':
      copy.sort(compareByName)
      break
    case 'name-desc':
      copy.sort((a, b) => -compareByName(a, b))
      break
    case 'level-asc':
      copy.sort(compareByLevel)
      break
    case 'level-desc':
      copy.sort((a, b) => -compareByLevel(a, b))
      break
    default:
      break
  }
  return copy
}

/**
 * Filter and sort skills for display. Indices refer to the original `skills` array.
 */
export function buildSkillRows(skills: Skill[], options: SkillViewOptions): SkillRow[] {
  const { searchQuery, levelFilter, categoryFilter, sortMode } = options
  const rows: SkillRow[] = []
  for (let index = 0; index < skills.length; index++) {
    const skill = skills[index]
    if (!matchesSearch(skill, searchQuery)) continue
    if (!matchesLevel(skill, levelFilter)) continue
    if (!matchesCategoryFilter(skill, categoryFilter)) continue
    rows.push({ index, skill })
  }
  return sortRows(rows, sortMode)
}

function groupKey(skill: Skill): string {
  return normalizeCategory(skill) ?? UNCATEGORIZED_KEY
}

function groupLabel(key: string): string {
  return key === UNCATEGORIZED_KEY ? 'Uncategorized' : key
}

/**
 * Partition rows into category buckets. Bucket order: alphabetical by label, Uncategorized last.
 */
export function groupSkillRows(rows: SkillRow[]): SkillGroup[] {
  const map = new Map<string, SkillRow[]>()
  for (const row of rows) {
    const key = groupKey(row.skill)
    const list = map.get(key)
    if (list) list.push(row)
    else map.set(key, [row])
  }
  const keys = [...map.keys()].sort((a, b) => {
    if (a === UNCATEGORIZED_KEY) return 1
    if (b === UNCATEGORIZED_KEY) return -1
    return groupLabel(a).localeCompare(groupLabel(b), undefined, { sensitivity: 'base' })
  })
  return keys.map((key) => ({
    key,
    label: groupLabel(key),
    rows: map.get(key) ?? [],
  }))
}

/**
 * Distinct non-empty categories from skills, sorted A–Z.
 */
export function distinctCategories(skills: Skill[]): string[] {
  const set = new Set<string>()
  for (const s of skills) {
    const c = normalizeCategory(s)
    if (c) set.add(c)
  }
  return [...set].sort((a, b) => a.localeCompare(b, undefined, { sensitivity: 'base' }))
}
