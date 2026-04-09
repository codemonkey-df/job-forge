import { useEffect, useRef, useState } from 'react'
import { Download, Edit2, Check } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { cn } from '@/lib/utils'

interface Props {
  markdown: string
  isStreaming?: boolean
  onMarkdownChange?: (value: string) => void
  onExportPDF?: () => void
  isExporting?: boolean
}

function renderMarkdown(md: string): string {
  return md
    .replace(/^## (.+)$/gm, '<h2 class="text-base font-bold mt-5 mb-2 pb-1 border-b">$1</h2>')
    .replace(/^### (.+)$/gm, '<h3 class="text-sm font-semibold mt-3 mb-1">$1</h3>')
    .replace(/^\*\*(.+)\*\*$/gm, '<strong>$1</strong>')
    .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
    .replace(/^- (.+)$/gm, '<li class="ml-4 text-sm leading-relaxed">$1</li>')
    .replace(/(<li.*<\/li>\n?)+/g, '<ul class="list-disc space-y-0.5 my-1">$&</ul>')
    .replace(/^(?!<[h|u|l])(.+)$/gm, '<p class="text-sm leading-relaxed">$1</p>')
    .replace(/<p class="text-sm leading-relaxed"><\/p>/g, '')
}

export function CVPreview({ markdown, isStreaming, onMarkdownChange, onExportPDF, isExporting }: Props) {
  const [isEditing, setIsEditing] = useState(false)
  const endRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (isStreaming) endRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [markdown, isStreaming])

  return (
    <div className="border rounded-lg overflow-hidden">
      <div className="flex items-center justify-between px-4 py-3 border-b bg-muted/30">
        <span className="text-sm font-medium">
          Generated CV {isStreaming && <span className="text-muted-foreground animate-pulse">● Generating…</span>}
        </span>
        <div className="flex items-center gap-2">
          {onMarkdownChange && (
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setIsEditing(!isEditing)}
            >
              {isEditing ? <Check className="size-4" /> : <Edit2 className="size-4" />}
              {isEditing ? 'Done' : 'Edit'}
            </Button>
          )}
          {onExportPDF && (
            <Button size="sm" onClick={onExportPDF} disabled={isStreaming || isExporting}>
              <Download className="size-4" />
              {isExporting ? 'Exporting…' : 'Export PDF'}
            </Button>
          )}
        </div>
      </div>

      {isEditing && onMarkdownChange ? (
        <Textarea
          value={markdown}
          onChange={(e) => onMarkdownChange(e.target.value)}
          className="min-h-[600px] rounded-none border-0 font-mono text-xs resize-none focus-visible:ring-0"
        />
      ) : (
        <div
          className={cn('p-6 max-w-none overflow-auto max-h-[700px]', isStreaming && 'opacity-90')}
          dangerouslySetInnerHTML={{ __html: renderMarkdown(markdown) || '<p class="text-muted-foreground text-sm">No content yet…</p>' }}
        />
      )}
      <div ref={endRef} />
    </div>
  )
}
