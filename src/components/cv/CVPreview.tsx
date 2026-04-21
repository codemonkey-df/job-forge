import { useEffect, useRef, useState, lazy, Suspense } from 'react'
import { Download, Edit2, Check, Eye, Loader2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { cn } from '@/lib/utils'
import type { CVTemplate } from '@/lib/pdf/parseMarkdownCV'
import type { UserProfile } from '@/types/profile'

// Lazy-load heavy PDF components to avoid adding them to the main bundle eagerly
const PDFPreviewContent = lazy(() => import('./PDFPreviewContent'))

interface Props {
  markdown: string
  isStreaming?: boolean
  onMarkdownChange?: (value: string) => void
  onExportPDF?: (template: CVTemplate) => void
  isExporting?: boolean
  profile?: UserProfile
  jobTitle?: string
  companyName?: string
}

const LEVEL_BADGE: Record<string, string> = {
  Advanced:     'bg-emerald-100 text-emerald-800 dark:bg-emerald-900 dark:text-emerald-200',
  Intermediate: 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200',
  Basic:        'bg-amber-100 text-amber-800 dark:bg-amber-900 dark:text-amber-200',
}

function skillLine(category: string, skillsStr: string): string {
  const processedSkills = skillsStr
    .split(/,\s*/)
    .map((s) => {
      const trimmed = s.trim()
      const m = trimmed.match(/^(.+?)\s*\((\w+)\)$/)
      if (m) {
        const skillName = m[1].trim()
        const level = m[2]
        const cls = LEVEL_BADGE[level] ?? 'bg-muted text-muted-foreground'
        return `<strong>${skillName}</strong> <span class="text-[10px] px-1.5 py-0.5 rounded font-bold shadow-sm inline-block align-middle ${cls}">${level}</span>`
      }
      return trimmed
    })
    .join(', ')

  return `<div class="mb-5">
    <p class="text-sm font-bold uppercase tracking-wide mb-2">${category}</p>
    <div class="text-sm leading-relaxed">- ${processedSkills}</div>
  </div>`
}

export function renderMarkdown(md: string): string {
  return md
    .replace(/^## (.+)$/gm, '<h2 class="text-lg font-bold mt-6 mb-3 pb-2 border-b">$1</h2>')
    .replace(/^### (.+)$/gm, '<h3 class="text-base font-semibold mt-4 mb-2">$1</h3>')
    .replace(/^\*\*(.+?):\*\*\s*(.+)$/gm, (_, cat, skills) => skillLine(cat, skills))
    .replace(/^\*\*(.+)\*\*$/gm, '<strong>$1</strong>')
    .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
    .replace(
      /\[([^\]]+)\]\((https?:\/\/[^\s)]+)\)/g,
      '<a href="$2" target="_blank" rel="noopener noreferrer" class="text-primary underline-offset-2 hover:underline">$1</a>',
    )
    .replace(/^- (.+)$/gm, '<li class="ml-4 text-sm leading-relaxed">$1</li>')
    .replace(/(<li.*<\/li>\n?)+/g, '<ul class="list-disc space-y-1 my-2 pl-4">$&</ul>')
    .replace(/^(?!<[hdul])(.+)$/gm, '<p class="text-sm leading-relaxed">$1</p>')
    .replace(/<p class="text-sm leading-relaxed"><\/p>/g, '')
}

export function TemplateThumbnail({ variant }: { variant: CVTemplate }) {
  return (
    <div className="w-10 h-[52px] bg-white rounded-sm overflow-hidden flex flex-col gap-[2px] p-[3px] border border-gray-100">
      {variant === 'modern' ? (
        // Modern: blue header bar + two-column hint
        <>
          <div className="h-[10px] w-full rounded-sm bg-blue-500 flex flex-col justify-center px-1 gap-[2px]">
            <div className="h-[2px] w-2/3 bg-white rounded-sm opacity-90" />
            <div className="h-[1.5px] w-1/2 bg-white rounded-sm opacity-60" />
          </div>
          <div className="flex flex-1 gap-[2px] mt-[1px]">
            <div className="flex-1 flex flex-col gap-[2px]">
              <div className="h-[2px] w-3/4 bg-blue-400 rounded-sm" />
              <div className="h-[1.5px] w-full bg-gray-200 rounded-sm" />
              <div className="h-[1.5px] w-4/5 bg-gray-200 rounded-sm" />
              <div className="h-[2px] w-3/4 bg-blue-400 rounded-sm mt-[2px]" />
              <div className="h-[1.5px] w-full bg-gray-200 rounded-sm" />
              <div className="h-[1.5px] w-3/4 bg-gray-200 rounded-sm" />
            </div>
            <div className="w-[12px] bg-blue-50 rounded-sm flex flex-col gap-[2px] p-[1px]">
              <div className="h-[1.5px] w-full bg-blue-300 rounded-sm" />
              <div className="h-[1.5px] w-full bg-gray-200 rounded-sm" />
              <div className="h-[1.5px] w-4/5 bg-gray-200 rounded-sm" />
              <div className="h-[1.5px] w-full bg-gray-200 rounded-sm" />
            </div>
          </div>
        </>
      ) : variant === 'classic' ? (
        // Classic: dark header, full-width sections
        <>
          <div className="h-[5px] rounded-sm w-3/4 bg-gray-800" />
          <div className="h-[2px] rounded-sm w-1/2 bg-gray-400" />
          <div className="h-[2px] rounded-sm w-2/5 bg-gray-400" />
          <div className="h-px w-full bg-gray-800 mt-[1px]" />
          <div className="h-[3px] w-full bg-gray-700 mt-[3px]" />
          <div className="h-[2px] rounded-sm w-full bg-gray-200 mt-[1px]" />
          <div className="h-[2px] rounded-sm w-4/5 bg-gray-200" />
          <div className="h-[3px] w-full bg-gray-700 mt-[3px]" />
          <div className="h-[2px] rounded-sm w-full bg-gray-200 mt-[1px]" />
          <div className="h-[2px] rounded-sm w-3/4 bg-gray-200" />
        </>
      ) : (
        // Minimal: large name, no borders, generous spacing
        <>
          <div className="h-[6px] rounded-sm w-4/5 bg-gray-700 mt-[2px]" />
          <div className="h-[1.5px] rounded-sm w-1/2 bg-gray-300 mt-[1px]" />
          <div className="h-[1.5px] rounded-sm w-2/5 bg-gray-300" />
          <div className="h-[2px] rounded-sm w-1/2 bg-gray-400 mt-[4px]" />
          <div className="h-[1.5px] rounded-sm w-full bg-gray-200 mt-[2px]" />
          <div className="h-[1.5px] rounded-sm w-4/5 bg-gray-200" />
          <div className="h-[2px] rounded-sm w-1/2 bg-gray-400 mt-[4px]" />
          <div className="h-[1.5px] rounded-sm w-full bg-gray-200 mt-[2px]" />
          <div className="h-[1.5px] rounded-sm w-3/4 bg-gray-200" />
        </>
      )}
    </div>
  )
}

export function CVPreview({
  markdown,
  isStreaming,
  onMarkdownChange,
  onExportPDF,
  isExporting,
  profile,
  jobTitle,
  companyName,
}: Props) {
  const [isEditing, setIsEditing] = useState(false)
  const [selectedTemplate, setSelectedTemplate] = useState<CVTemplate>('modern')
  const [showPreview, setShowPreview] = useState(false)
  const endRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (isStreaming) endRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [markdown, isStreaming])

  const canPreview = Boolean(profile && markdown && !isStreaming)

  return (
    <div className="border rounded-lg overflow-hidden">
      <div className="flex items-center justify-between px-4 py-3 border-b bg-muted/30">
        <span className="text-sm font-medium">
          Generated CV {isStreaming && <span className="text-muted-foreground animate-pulse">● Generating…</span>}
        </span>
        <div className="flex items-center gap-2">
          {onMarkdownChange && (
            <Button variant="ghost" size="sm" onClick={() => setIsEditing(!isEditing)}>
              {isEditing ? <Check className="size-4" /> : <Edit2 className="size-4" />}
              {isEditing ? 'Done' : 'Edit'}
            </Button>
          )}
          {onExportPDF && (
            <>
              <div className="flex items-center gap-1">
                {(['classic', 'modern', 'minimal'] as CVTemplate[]).map((t) => (
                  <button
                    key={t}
                    onClick={() => setSelectedTemplate(t)}
                    title={t.charAt(0).toUpperCase() + t.slice(1)}
                    className={cn(
                      'flex flex-col items-center gap-0.5 p-1.5 rounded border transition-all',
                      selectedTemplate === t
                        ? 'border-primary bg-primary/5'
                        : 'border-border hover:border-muted-foreground/50'
                    )}
                  >
                    <TemplateThumbnail variant={t} />
                    <span className="text-[9px] text-muted-foreground capitalize">{t}</span>
                  </button>
                ))}
              </div>
              {canPreview && (
                <Button variant="outline" size="sm" onClick={() => setShowPreview(true)}>
                  <Eye className="size-4" />
                  Preview
                </Button>
              )}
              <Button size="sm" onClick={() => onExportPDF(selectedTemplate)} disabled={isStreaming || isExporting}>
                <Download className="size-4" />
                {isExporting ? 'Exporting…' : 'Export PDF'}
              </Button>
            </>
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
          dangerouslySetInnerHTML={{
            __html: renderMarkdown(markdown) || '<p class="text-muted-foreground text-sm">No content yet…</p>',
          }}
        />
      )}
      <div ref={endRef} />

      {/* PDF Preview Dialog */}
      {profile && (
        <Dialog open={showPreview} onOpenChange={setShowPreview}>
          <DialogContent className="max-w-4xl w-full h-[90vh] flex flex-col gap-0 p-0 overflow-hidden">
            <DialogHeader className="px-4 py-3 border-b shrink-0">
              <DialogTitle className="text-sm font-medium capitalize">
                Preview — {selectedTemplate} template
              </DialogTitle>
            </DialogHeader>
            <div className="flex-1 overflow-hidden">
              {showPreview && (
                <Suspense fallback={
                  <div className="flex items-center justify-center h-full gap-2 text-muted-foreground text-sm">
                    <Loader2 className="size-4 animate-spin" />
                    Loading preview…
                  </div>
                }>
                  <PDFPreviewContent
                    markdown={markdown}
                    profile={profile}
                    template={selectedTemplate}
                    jobTitle={jobTitle}
                    companyName={companyName}
                  />
                </Suspense>
              )}
            </div>
          </DialogContent>
        </Dialog>
      )}
    </div>
  )
}
