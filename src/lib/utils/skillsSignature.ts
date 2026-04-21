import type { Skill } from '@/types/profile'

function normalizeSkillName(name: string): string {
  return name.trim().toLowerCase().replace(/\s+/g, ' ')
}

export function computeSkillsSignature(skills: Skill[]): string {
  const normalized = [...new Set(skills.map((skill) => normalizeSkillName(skill.name)).filter(Boolean))]
  normalized.sort((a, b) => a.localeCompare(b))
  return normalized.join('|')
}
