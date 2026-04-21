import React from 'react'
import { cn } from '@/lib/utils'

interface Props {
  content: string
  className?: string
}

/**
 * Renders a subset of markdown: headings (##, ###), bullet lists, bold (**text**),
 * inline links ([text](url)), and paragraphs. No dependencies.
 */
export function MarkdownRenderer({ content, className }: Props) {
  const lines = content.split('\n')
  const elements: React.ReactNode[] = []
  let i = 0

  while (i < lines.length) {
    const raw = lines[i]
    const line = raw.trim()

    // Skip empty lines (treat as spacing)
    if (!line) {
      i++
      continue
    }

    // H2: ## Heading
    if (line.startsWith('## ')) {
      elements.push(
        <h3 key={i} className="font-semibold text-sm mt-5 mb-1 first:mt-0">
          {renderInline(line.slice(3))}
        </h3>,
      )
      i++
      continue
    }

    // H3: ### Heading
    if (line.startsWith('### ')) {
      elements.push(
        <h4 key={i} className="font-medium text-sm mt-3 mb-1 text-foreground/80">
          {renderInline(line.slice(4))}
        </h4>,
      )
      i++
      continue
    }

    // Bullet list: collect consecutive bullets into a <ul>
    if (line.startsWith('- ') || line.startsWith('* ')) {
      const items: React.ReactNode[] = []
      while (i < lines.length && (lines[i].trim().startsWith('- ') || lines[i].trim().startsWith('* '))) {
        const item = lines[i].trim().slice(2)
        items.push(<li key={i} className="ml-4 text-sm leading-relaxed">{renderInline(item)}</li>)
        i++
      }
      elements.push(<ul key={`ul-${i}`} className="space-y-1 mb-2 list-disc list-inside">{items}</ul>)
      continue
    }

    // Paragraph
    elements.push(
      <p key={i} className="text-sm leading-relaxed mb-2">
        {renderInline(line)}
      </p>,
    )
    i++
  }

  return <div className={cn('prose-none', className)}>{elements}</div>
}

/** Render inline markdown: **bold** and [link](url) */
function renderInline(text: string): React.ReactNode {
  // Tokenise: bold (**...**) and links ([label](url))
  const parts: React.ReactNode[] = []
  const pattern = /(\*\*(.+?)\*\*|\[([^\]]+)\]\(([^)]+)\))/g
  let last = 0
  let match: RegExpExecArray | null

  while ((match = pattern.exec(text)) !== null) {
    if (match.index > last) {
      parts.push(text.slice(last, match.index))
    }

    if (match[0].startsWith('**')) {
      // Bold
      parts.push(<strong key={match.index}>{match[2]}</strong>)
    } else {
      // Link
      parts.push(
        <a
          key={match.index}
          href={match[4]}
          target="_blank"
          rel="noopener noreferrer"
          className="text-primary underline-offset-2 hover:underline"
        >
          {match[3]}
        </a>,
      )
    }
    last = match.index + match[0].length
  }

  if (last < text.length) {
    parts.push(text.slice(last))
  }

  return parts.length === 1 ? parts[0] : <>{parts}</>
}
