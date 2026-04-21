import { lineIsPageBreakMarkdown } from './mdcraftPdf'

export type CVTemplate = 'classic' | 'modern' | 'minimal'
export const HARD_PAGE_BREAK_TOKEN = '__HARD_PAGE_BREAK__'

export interface ParsedSection {
  heading: string
  content: string[]
}

export interface ParsedCV {
  name: string
  contactLines: string[]
  sections: ParsedSection[]
}

function normalizeLineForDedupe(line: string): string {
  return line
    .replace(/\*\*/g, '')
    .replace(/\s+/g, ' ')
    .trim()
    .toLowerCase()
}

function normalizeMarkdownLine(raw: string): string {
  const trimmed = raw.trim()
  if (!trimmed) return ''
  // Keep dividers out of content rendering. `---` is a visual separator in editor.
  if (/^-{3,}$/.test(trimmed)) return ''
  // Normalize unicode bullets to markdown bullets for consistent parsing across renderers.
  if (trimmed.startsWith('• ')) return `- ${trimmed.slice(2).trim()}`
  return trimmed
}

export function parseMarkdownCV(md: string): ParsedCV {
  const lines = md.split('\n')
  let name = ''
  const contactLines: string[] = []
  const sections: ParsedSection[] = []
  let currentSection: ParsedSection | null = null

  const pushContactLine = (line: string) => {
    if (!line) return
    const prev = contactLines[contactLines.length - 1]
    if (prev && normalizeLineForDedupe(prev) === normalizeLineForDedupe(line)) return
    contactLines.push(line)
  }

  const pushSectionLine = (line: string) => {
    if (!currentSection || !line) return
    if (line === HARD_PAGE_BREAK_TOKEN) {
      if (currentSection.content[currentSection.content.length - 1] !== HARD_PAGE_BREAK_TOKEN) {
        currentSection.content.push(line)
      }
      return
    }
    const prev = currentSection.content[currentSection.content.length - 1]
    if (prev && prev !== HARD_PAGE_BREAK_TOKEN && normalizeLineForDedupe(prev) === normalizeLineForDedupe(line)) {
      return
    }
    currentSection.content.push(line)
  }

  for (const line of lines) {
    const trimmed = normalizeMarkdownLine(line)
    if (!trimmed) continue

    if (/^<!--\s*pagebreak\s*-->$/i.test(trimmed) || lineIsPageBreakMarkdown(trimmed)) {
      if (currentSection) pushSectionLine(HARD_PAGE_BREAK_TOKEN)
      continue
    }

    if (trimmed.startsWith('# ')) {
      // Strip bold markers the LLM sometimes wraps around the name
      name = trimmed.slice(2).trim().replace(/\*\*/g, '')
    } else if (trimmed.startsWith('## ')) {
      if (currentSection) sections.push(currentSection)
      currentSection = { heading: trimmed.slice(3).trim(), content: [] }
    } else if (!currentSection) {
      pushContactLine(trimmed.replace(/\*\*/g, ''))
    } else {
      const exploded = trimmed.split(/(?=•\s)/g).map(normalizeMarkdownLine).filter(Boolean)
      if (exploded.length > 1) {
        exploded.forEach(pushSectionLine)
      } else {
        pushSectionLine(trimmed)
      }
    }
  }
  if (currentSection) sections.push(currentSection)

  // Deduplicate: remove contact lines that are just the name (LLM sometimes repeats it)
  // Handle: exact match, bold-wrapped match, or name-only line with no meaningful extra content
  const nameLower = name.toLowerCase().trim()
  const filteredContactLines = contactLines.filter((l) => {
    const ll = l.toLowerCase().trim()
    if (!nameLower) return true
    // Exact match
    if (ll === nameLower) return false
    // Line is name + only whitespace/separators (e.g. "NAME  " or "NAME | ")
    const remainder = ll.replace(nameLower, '').replace(/[\s|·•,\-–—]+/g, '')
    if (remainder === '') return false
    return true
  })

  return { name, contactLines: filteredContactLines, sections }
}
