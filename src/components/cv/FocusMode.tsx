import { useRef, useState, useEffect, useCallback, useMemo } from 'react'
import { ArrowLeft, RotateCcw, RotateCw, Loader2, Bold, Heading2, Heading3, List, Minus, RefreshCw, WandSparkles, ShieldCheck, Download } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { CVHTMLRenderer } from './CVHTMLRenderer'
import { cn } from '@/lib/utils'
import type { CVTemplate } from '@/lib/pdf/parseMarkdownCV'
import {
  DEFAULT_MDCRAFT_CONFIG,
  estimatePrintLinesPerPage,
  estimatePrintPagesFromLineCount,
  loadMdcraftConfigFromStorage,
  mergeMdcraftConfig,
  saveMdcraftConfigToStorage,
  type MdcraftPdfConfig,
} from '@/lib/pdf/mdcraftPdf'
import { downloadCVAsPDF } from '@/lib/pdf/generator'
import type { UserProfile } from '@/types/profile'
import type { JobOffer, JobSkill } from '@/types/job'
import { extractStructured } from '@/lib/llm/client'
import { buildCVRewritePrompt, cvRewriteSystem } from '@/lib/llm/prompts/cvGeneration'
import { CVRewriteResultSchema } from '@/lib/llm/schemas'
import { reviewATSIssues, splitMatchedSkills, hasSkillInMarkdown } from '@/lib/utils/atsChecks'
import { trackRewrite } from '@/lib/utils/telemetry'

interface Props {
  markdown: string
  onMarkdownChange: (value: string) => void
  profile?: UserProfile
  jobTitle?: string
  companyName?: string
  jobOffer?: JobOffer
  onClose: () => void
}

// Build a header block from profile data
function buildProfileHeader(profile: UserProfile): string {
  const contacts = [profile.email, profile.phone, profile.location].filter(Boolean).join(' · ')
  const links = [profile.linkedinUrl, profile.portfolioUrl].filter(Boolean).join(' · ')
  const lines = [`# ${profile.fullName || 'Your Name'}`, '']
  if (contacts) lines.push(contacts)
  if (links) lines.push(links)
  return lines.join('\n').trimEnd()
}

// Replace everything before the first ## with a fresh profile header
function syncHeader(md: string, profile: UserProfile): string {
  const firstSection = md.indexOf('\n## ')
  const header = buildProfileHeader(profile)
  if (firstSection === -1) return header + '\n\n' + md.trimStart()
  return header + '\n\n' + md.slice(firstSection + 1)
}

// ─── ATS helpers ──────────────────────────────────────────────────────────────

interface ATSResult {
  score: number
  foundMandatory: JobSkill[]
  missingMandatory: JobSkill[]
  foundNiceToHave: JobSkill[]
  missingNiceToHave: JobSkill[]
}

function computeATS(markdown: string, jobOffer: JobOffer): ATSResult {
  const mandatory = jobOffer.mandatorySkills
  const niceToHave = jobOffer.niceToHaveSkills

  const mandatoryMatches = splitMatchedSkills(markdown, mandatory)
  const niceMatches = splitMatchedSkills(markdown, niceToHave)
  const foundMandatory = mandatoryMatches.found
  const missingMandatory = mandatoryMatches.missing
  const foundNiceToHave = niceMatches.found
  const missingNiceToHave = niceMatches.missing

  const mandatoryScore = mandatory.length > 0 ? (foundMandatory.length / mandatory.length) * 70 : 70
  const niceScore = niceToHave.length > 0 ? (foundNiceToHave.length / niceToHave.length) * 30 : 30
  const score = Math.round(mandatoryScore + niceScore)

  return { score, foundMandatory, missingMandatory, foundNiceToHave, missingNiceToHave }
}

function summarizeAutoFixChanges(before: string, after: string): string[] {
  const changes: string[] = []
  const starredBullets = before.match(/^(\s*)\*\s+/gm)?.length ?? 0
  if (starredBullets > 0) {
    changes.push(`Converted ${starredBullets} "*" bullets to "-" format.`)
  }
  const tablesRemoved = before.match(/<table[\s\S]*?<\/table>/gi)?.length ?? 0
  if (tablesRemoved > 0) {
    changes.push(`Removed ${tablesRemoved} HTML table block${tablesRemoved > 1 ? 's' : ''}.`)
  }
  const inlineHtmlRemoved = before.match(/<\/?(div|span|section|article|font)[^>]*>/gi)?.length ?? 0
  if (inlineHtmlRemoved > 0) {
    changes.push(`Removed ${inlineHtmlRemoved} inline HTML tag${inlineHtmlRemoved > 1 ? 's' : ''}.`)
  }
  if (/\n{3,}/.test(before) && !/\n{3,}/.test(after)) {
    changes.push('Collapsed excessive blank lines.')
  }
  return changes
}

// ─── Score ring ───────────────────────────────────────────────────────────────

function ScoreRing({ score }: { score: number }) {
  const color = score >= 80 ? '#16a34a' : score >= 60 ? '#d97706' : '#dc2626'
  return (
    <div
      style={{
        width: 44, height: 44, borderRadius: '50%', flexShrink: 0,
        background: `conic-gradient(${color} ${score}%, #e5e7eb ${score}%)`,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
      }}
    >
      <div
        style={{
          width: 32, height: 32, borderRadius: '50%',
          backgroundColor: 'var(--background)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontSize: 9, fontWeight: 700, color,
        }}
      >
        {score}%
      </div>
    </div>
  )
}

// ─── Main component ───────────────────────────────────────────────────────────

export function FocusMode({
  markdown: initialMarkdown,
  onMarkdownChange,
  profile,
  jobTitle,
  companyName,
  jobOffer,
  onClose,
}: Props) {
  const [selectedTemplate, setSelectedTemplate] = useState<CVTemplate>('modern')
  const [fontScale, setFontScale] = useState(1.0)
  const [spacingMode, setSpacingMode] = useState<'compact' | 'normal' | 'relaxed'>('normal')

  const [mdcraftConfig, setMdcraftConfig] = useState<MdcraftPdfConfig>(() =>
    mergeMdcraftConfig(DEFAULT_MDCRAFT_CONFIG, 'modern')
  )
  const [mdcraftConfigReady, setMdcraftConfigReady] = useState(false)

  useEffect(() => {
    loadMdcraftConfigFromStorage().then((stored) => {
      if (stored) setMdcraftConfig(mergeMdcraftConfig(stored, 'modern'))
      setMdcraftConfigReady(true)
    })
  }, [])

  useEffect(() => {
    if (!mdcraftConfigReady) return
    saveMdcraftConfigToStorage(mdcraftConfig).catch(() => {})
  }, [mdcraftConfig, mdcraftConfigReady])

  // Current markdown in textarea (live)
  const [markdown, setMarkdown] = useState(() => {
    if (profile && !initialMarkdown.trimStart().startsWith('# ')) {
      return buildProfileHeader(profile) + '\n\n' + initialMarkdown
    }
    return initialMarkdown
  })

  const textareaRef = useRef<HTMLTextAreaElement>(null)
  const historyRef = useRef<string[]>([markdown])
  const cursorRef = useRef(0)
  const historyDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const pendingCursorRef = useRef<{ start: number; end: number } | null>(null)
  const [activeSection, setActiveSection] = useState<string | null>(null)
  const [toolStatus, setToolStatus] = useState('')
  const [atsFixFeedback, setAtsFixFeedback] = useState<{
    reviewed: number
    autoFixed: number
    manual: number
    autoFixedIssues: string[]
    manualIssues: string[]
  } | null>(null)
  const [mandatorySkillWarning, setMandatorySkillWarning] = useState<string[] | null>(null)
  const [isRewriting, setIsRewriting] = useState(false)
  const [isExportingPDF, setIsExportingPDF] = useState(false)
  const [rewritePreview, setRewritePreview] = useState<{
    source: string
    rewritten: string
    start: number
    end: number
    droppedTerms: string[]
  } | null>(null)
  const atsFeedbackTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const mandatorySkillWarningTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const lastFoundMandatoryRef = useRef<string[]>([])
  const lastMissingMandatoryRef = useRef<string[]>([])

  // Apply pending cursor after state update
  useEffect(() => {
    if (pendingCursorRef.current && textareaRef.current) {
      const { start, end } = pendingCursorRef.current
      textareaRef.current.setSelectionRange(start, end)
      textareaRef.current.focus()
      pendingCursorRef.current = null
    }
  })

  useEffect(() => () => {
    if (atsFeedbackTimerRef.current) {
      clearTimeout(atsFeedbackTimerRef.current)
    }
    if (mandatorySkillWarningTimerRef.current) {
      clearTimeout(mandatorySkillWarningTimerRef.current)
    }
  }, [])

  const applyEdit = useCallback((newValue: string, cursorAfter?: number) => {
    setMarkdown(newValue)
    onMarkdownChange(newValue)

    if (cursorAfter !== undefined) {
      pendingCursorRef.current = { start: cursorAfter, end: cursorAfter }
    }

    // Debounce history (500ms)
    if (historyDebounceRef.current) clearTimeout(historyDebounceRef.current)
    historyDebounceRef.current = setTimeout(() => {
      historyRef.current = historyRef.current.slice(0, cursorRef.current + 1)
      historyRef.current.push(newValue)
      cursorRef.current = historyRef.current.length - 1
    }, 500)
  }, [onMarkdownChange])

  const handleUndo = useCallback(() => {
    if (cursorRef.current > 0) {
      cursorRef.current--
      const val = historyRef.current[cursorRef.current]
      setMarkdown(val)
      onMarkdownChange(val)
    }
  }, [onMarkdownChange])

  const handleRedo = useCallback(() => {
    if (cursorRef.current < historyRef.current.length - 1) {
      cursorRef.current++
      const val = historyRef.current[cursorRef.current]
      setMarkdown(val)
      onMarkdownChange(val)
    }
  }, [onMarkdownChange])

  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      if ((e.ctrlKey || e.metaKey) && e.key === 'z' && !e.shiftKey) {
        e.preventDefault(); handleUndo()
      } else if ((e.ctrlKey || e.metaKey) && (e.key === 'y' || (e.key === 'z' && e.shiftKey))) {
        e.preventDefault(); handleRedo()
      } else if (e.key === 'Escape') {
        onClose()
      }
    }
    document.addEventListener('keydown', onKeyDown)
    return () => document.removeEventListener('keydown', onKeyDown)
  }, [handleUndo, handleRedo, onClose])

  // --- Formatting toolbar helpers ---
  function insertAtCursor(prefix: string, suffix = '', placeholder = '') {
    const el = textareaRef.current
    if (!el) return
    const start = el.selectionStart
    const end = el.selectionEnd
    const selected = el.value.slice(start, end) || placeholder
    const newVal = el.value.slice(0, start) + prefix + selected + suffix + el.value.slice(end)
    const cursorPos = start + prefix.length + selected.length + suffix.length
    applyEdit(newVal, cursorPos)
  }

  function handleBold() {
    const el = textareaRef.current
    if (!el) return
    const selected = el.value.slice(el.selectionStart, el.selectionEnd)
    if (selected) {
      insertAtCursor('**', '**')
    } else {
      insertAtCursor('**', '**', 'bold text')
    }
  }

  function handleSyncHeader() {
    if (!profile) return
    const newVal = syncHeader(markdown, profile)
    applyEdit(newVal)
  }

  function resolveRewriteTarget(value: string): { type: 'selection' | 'none'; start: number; end: number; text: string } {
    const el = textareaRef.current
    if (!el) return { type: 'none', start: 0, end: 0, text: '' }
    if (el.selectionEnd > el.selectionStart) {
      return { type: 'selection', start: el.selectionStart, end: el.selectionEnd, text: value.slice(el.selectionStart, el.selectionEnd) }
    }
    return { type: 'none', start: 0, end: 0, text: '' }
  }

  function getCurrentSectionHeading(value: string, index: number): string | undefined {
    const before = value.slice(0, index)
    const headings = before.match(/^##\s+.+$/gim)
    if (!headings || headings.length === 0) return activeSection ?? undefined
    return headings[headings.length - 1].replace(/^##\s+/i, '').trim()
  }

  function buildProfileSummary(profileData?: UserProfile): string {
    if (!profileData) return ''
    const skills = (profileData.skills ?? []).slice(0, 8).map((s) => s.name).join(', ')
    const experienceTitles = (profileData.experience ?? []).slice(0, 3).map((e) => e.title).join(', ')
    const summaryParts = [profileData.summary, experienceTitles ? `Experience: ${experienceTitles}` : '', skills ? `Skills: ${skills}` : ''].filter(Boolean)
    return summaryParts.join(' | ')
  }

  async function rewriteCurrentBullet() {
    const el = textareaRef.current
    if (!el || isRewriting) return
    const value = el.value
    const target = resolveRewriteTarget(value)
    if (target.type === 'none') {
      setToolStatus('Select text first to rewrite with AI.')
      return
    }
    const selectedText = target.text.trim()
    if (selectedText.length < 8) {
      setToolStatus('Selected text is too short to rewrite.')
      return
    }
    if (!jobOffer) {
      setToolStatus('Job analysis is required for contextual rewrite.')
      return
    }
    const mandatorySkillNames = jobOffer.mandatorySkills.map((s) => s.name)
    const mandatoryInSource = mandatorySkillNames.filter((term) => hasSkillInMarkdown(selectedText, term))
    setIsRewriting(true)
    setToolStatus('Rewriting selected text...')
    try {
      const rewrite = await extractStructured({
        schema: CVRewriteResultSchema,
        systemPrompt: cvRewriteSystem,
        prompt: buildCVRewritePrompt({
          selectedText,
          jobTitle: jobOffer.jobTitle,
          companyName: jobOffer.companyName,
          mandatorySkills: mandatorySkillNames,
          niceToHaveSkills: jobOffer.niceToHaveSkills.map((s) => s.name),
          jobDescriptionExcerpt: jobOffer.rawDescription.slice(0, 550),
          profileSummary: buildProfileSummary(profile),
          currentSectionHeading: getCurrentSectionHeading(value, target.start),
        }),
      })
      const rewritten = rewrite.rewrittenText.trim()
      if (!rewritten) throw new Error('Model returned empty rewrite.')
      const droppedTerms = mandatoryInSource.filter((term) => !hasSkillInMarkdown(rewritten, term))
      setRewritePreview({
        source: selectedText,
        rewritten,
        start: target.start,
        end: target.end,
        droppedTerms,
      })
      trackRewrite(true)
      setToolStatus('Rewrite ready. Review and accept or reject.')
    } catch (error) {
      trackRewrite(false)
      setToolStatus(error instanceof Error ? `Rewrite failed: ${error.message}` : 'Rewrite failed.')
    } finally {
      setIsRewriting(false)
    }
  }

  function acceptRewritePreview() {
    if (!rewritePreview) return
    const newVal = markdown.slice(0, rewritePreview.start) + rewritePreview.rewritten + markdown.slice(rewritePreview.end)
    applyEdit(newVal, rewritePreview.start + rewritePreview.rewritten.length)
    setRewritePreview(null)
    setToolStatus('Rewrite applied.')
  }

  function rejectRewritePreview() {
    if (!rewritePreview) return
    setRewritePreview(null)
    setToolStatus('Rewrite discarded.')
  }

  async function handleExportPDF() {
    if (!profile) {
      setToolStatus('Profile is required to export PDF.')
      return
    }
    if (isExportingPDF) return
    setIsExportingPDF(true)
    setToolStatus('Exporting PDF...')
    try {
      await downloadCVAsPDF(markdown, profile, {
        template: selectedTemplate,
        jobTitle,
        companyName,
        mdcraft: mdcraftConfig,
      })
      setToolStatus('PDF downloaded.')
    } catch (error) {
      setToolStatus(error instanceof Error ? `PDF export failed: ${error.message}` : 'PDF export failed.')
    } finally {
      setIsExportingPDF(false)
    }
  }

  function fixATSConsistency() {
    if (!jobOffer) {
      setToolStatus('ATS review requires a job offer.')
      return
    }
    const review = reviewATSIssues(markdown, jobOffer)
    const changeDetails = summarizeAutoFixChanges(markdown, review.autoFixMarkdown)
    if (review.autoFixMarkdown !== markdown) {
      applyEdit(review.autoFixMarkdown)
    }
    const autoFixedIssues = review.issues
      .filter((issue) => issue.autoFixable && issue.id !== 'ats-clean')
      .map((issue) => issue.message)
    const wasActuallyFixed = review.autoFixMarkdown !== markdown
    const formattedAutoFixDetails = changeDetails.length > 0
      ? changeDetails
      : (wasActuallyFixed ? autoFixedIssues : [])
    const manualIssues = review.issues
      .filter((issue) => !issue.autoFixable && issue.id !== 'ats-clean')
      .map((issue) => issue.message)
    setAtsFixFeedback({
      reviewed: review.issues.length,
      autoFixed: review.autoFixedCount,
      manual: review.manualCount,
      autoFixedIssues: formattedAutoFixDetails,
      manualIssues,
    })
    if (atsFeedbackTimerRef.current) {
      clearTimeout(atsFeedbackTimerRef.current)
    }
    atsFeedbackTimerRef.current = setTimeout(() => {
      setAtsFixFeedback(null)
    }, 5000)
    setToolStatus('')
  }

  // --- Section navigator ---
  const sections = useMemo(() =>
    (markdown.match(/^## .+$/gm) ?? ([] as string[])).map(l => l.replace(/^## /, '')),
    [markdown]
  )

  function jumpToSection(name: string) {
    const el = textareaRef.current
    if (!el) return
    const idx = el.value.indexOf(`## ${name}`)
    if (idx === -1) return
    const linesBefore = el.value.slice(0, idx).split('\n').length - 1
    el.focus()
    el.setSelectionRange(idx, idx + `## ${name}`.length)
    const lh = parseFloat(getComputedStyle(el).lineHeight) || 20
    el.scrollTop = Math.max(0, linesBefore * lh - 60)
    setActiveSection(name)
  }

  // --- Page break guide ---
  const totalLines = markdown.split('\n').length
  const printLinesPerPage = useMemo(
    () => estimatePrintLinesPerPage(mdcraftConfig),
    [mdcraftConfig],
  )
  const printPagesRough = useMemo(
    () => estimatePrintPagesFromLineCount(totalLines, mdcraftConfig),
    [totalLines, mdcraftConfig],
  )
  // --- ATS ---
  const ats = jobOffer ? computeATS(markdown, jobOffer) : null

  useEffect(() => {
    if (!jobOffer || !ats) {
      lastFoundMandatoryRef.current = []
      lastMissingMandatoryRef.current = []
      return
    }
    const currentFound = ats.foundMandatory.map((skill) => skill.name)
    const currentMissing = ats.missingMandatory.map((skill) => skill.name)
    if (lastFoundMandatoryRef.current.length === 0) {
      lastFoundMandatoryRef.current = currentFound
      lastMissingMandatoryRef.current = currentMissing
      return
    }
    const removed = lastFoundMandatoryRef.current.filter((name) => !currentFound.includes(name))
    const newlyMissing = currentMissing.filter((name) => !lastMissingMandatoryRef.current.includes(name))
    const warningSkills = Array.from(new Set([...removed, ...newlyMissing]))
    if (warningSkills.length > 0) {
      setMandatorySkillWarning(warningSkills)
      if (mandatorySkillWarningTimerRef.current) {
        clearTimeout(mandatorySkillWarningTimerRef.current)
      }
      mandatorySkillWarningTimerRef.current = setTimeout(() => {
        setMandatorySkillWarning(null)
      }, 6000)
    }
    lastFoundMandatoryRef.current = currentFound
    lastMissingMandatoryRef.current = currentMissing
  }, [ats, jobOffer])

  // --- PDF sidebar (mdcraft) ---
  const templates: { value: CVTemplate; label: string }[] = [
    { value: 'modern', label: 'Modern' },
    { value: 'classic', label: 'Classic' },
    { value: 'minimal', label: 'Minimal' },
  ]

  const accentSwatches = [
    { name: 'Slate', hex: '#334155' },
    { name: 'Rose', hex: '#e11d48' },
    { name: 'Indigo', hex: '#4338ca' },
    { name: 'Emerald', hex: '#059669' },
    { name: 'Amber', hex: '#d97706' },
    { name: 'Sky', hex: '#0284c7' },
    { name: 'Violet', hex: '#7c3aed' },
    { name: 'Black', hex: '#000000' },
  ]

  function selectTemplate(value: CVTemplate) {
    setSelectedTemplate(value)
    setMdcraftConfig((prev) => mergeMdcraftConfig(prev, value))
  }

  const editorFontSize = Math.round(fontScale * 13)

  return (
    <div className="fixed inset-0 z-50 bg-background flex flex-col">
      {/* Unified tools panel */}
      <div className="border-b px-3 py-2 shrink-0 bg-background space-y-2">
        <div className="flex flex-wrap items-center gap-1.5">
          <Button variant="ghost" size="sm" onClick={onClose} className="gap-1.5">
            <ArrowLeft className="size-4" />
            Exit Focus Mode
          </Button>
          <div className="w-px h-5 bg-border mx-1" />
          <Button variant="ghost" size="sm" onClick={handleUndo} title="Undo (Ctrl+Z)" className="gap-1.5">
            <RotateCcw className="size-3.5" />
            Undo
          </Button>
          <Button variant="ghost" size="sm" onClick={handleRedo} title="Redo (Ctrl+Y)" className="gap-1.5">
            <RotateCw className="size-3.5" />
            Redo
          </Button>
          {ats && (
            <>
              <div className="w-px h-5 bg-border mx-1 hidden lg:block" />
              <div className="flex items-center gap-1.5">
                <ScoreRing score={ats.score} />
                <span className="text-[10px] text-muted-foreground">ATS</span>
              </div>
            </>
          )}
          <div className="flex-1" />
          <Button
            size="sm"
            onClick={handleExportPDF}
            disabled={!profile || isExportingPDF}
            className="gap-1.5"
            title={profile ? 'Download PDF with current template and formatting' : 'Profile is required to export PDF'}
          >
            {isExportingPDF ? <Loader2 className="size-3.5 animate-spin" /> : <Download className="size-3.5" />}
            {isExportingPDF ? 'Exporting…' : 'Export PDF'}
          </Button>
        </div>
        <div className="flex flex-wrap items-center gap-2 text-[10px]">
          <div className="flex items-center gap-1 rounded border bg-muted/20 px-2 py-1">
            <span className="uppercase tracking-wide text-muted-foreground">Edit</span>
            <button
              onClick={() => insertAtCursor('\n\n## ', '', 'Section Name')}
              title="Insert H2 section heading"
              className="flex items-center gap-1 px-2 py-1 rounded text-muted-foreground hover:text-foreground hover:bg-muted/60 transition-colors"
            >
              <Heading2 className="size-3.5" />
              <span>Section</span>
            </button>
            <button
              onClick={() => insertAtCursor('\n\n### ', '', 'Job Title | Company · Jan 2020 – Dec 2023')}
              title="Insert H3 job entry"
              className="flex items-center gap-1 px-2 py-1 rounded text-muted-foreground hover:text-foreground hover:bg-muted/60 transition-colors"
            >
              <Heading3 className="size-3.5" />
              <span>Entry</span>
            </button>
            <button
              onClick={() => insertAtCursor('\n\n---\n\n')}
              title="Insert divider"
              className="flex items-center gap-1 px-2 py-1 rounded text-muted-foreground hover:text-foreground hover:bg-muted/60 transition-colors"
            >
              <Minus className="size-3.5" />
              <span>Divider</span>
            </button>
            <button
              onClick={() => insertAtCursor('\n<-new_page->\n')}
              title="Inserts exact token <-new_page-> on its own line. Leave blank lines around it for reliable PDF pagination."
              className="flex items-center gap-1 px-2 py-1 rounded text-muted-foreground hover:text-foreground hover:bg-muted/60 transition-colors"
            >
              <span className="font-semibold">PB</span>
              <span>Page break</span>
            </button>
            <button
              onClick={handleBold}
              title="Bold (wraps selection)"
              className="flex items-center gap-1 px-2 py-1 rounded text-muted-foreground hover:text-foreground hover:bg-muted/60 transition-colors font-bold"
            >
              <Bold className="size-3.5" />
            </button>
            <button
              onClick={() => insertAtCursor('\n- ', '', 'Bullet point')}
              title="Insert bullet point"
              className="flex items-center gap-1 px-2 py-1 rounded text-muted-foreground hover:text-foreground hover:bg-muted/60 transition-colors"
            >
              <List className="size-3.5" />
              <span>Bullet</span>
            </button>
            {profile && (
              <button
                onClick={handleSyncHeader}
                title="Re-sync name & contact from profile"
                className="flex items-center gap-1 px-2 py-1 rounded text-muted-foreground hover:text-foreground hover:bg-muted/60 transition-colors"
              >
                <RefreshCw className="size-3" />
                <span>Sync header</span>
              </button>
            )}
            <button
              onClick={rewriteCurrentBullet}
              title="Rewrite selected text with job + profile context"
              disabled={isRewriting}
              className="flex items-center gap-1 px-2 py-1 rounded border border-violet-500/30 bg-violet-500/10 text-violet-700 dark:text-violet-300 hover:bg-violet-500/20 hover:text-violet-800 dark:hover:text-violet-200 transition-colors disabled:opacity-60"
            >
              {isRewriting ? <Loader2 className="size-3.5 animate-spin" /> : <WandSparkles className="size-3.5" />}
              <span>Rewrite</span>
            </button>
            <button
              onClick={fixATSConsistency}
              title="Review ATS issues and apply safe auto-fixes"
              className="flex items-center gap-1 px-2 py-1 rounded border border-emerald-500/30 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 hover:bg-emerald-500/20 hover:text-emerald-800 dark:hover:text-emerald-200 transition-colors"
            >
              <ShieldCheck className="size-3.5" />
              <span>Fix ATS</span>
            </button>
          </div>
          {sections.length > 0 && (
            <div className="flex items-center gap-1 rounded border bg-muted/20 px-2 py-1 overflow-x-auto max-w-full">
              <span className="uppercase tracking-wide text-muted-foreground shrink-0">Jump</span>
              {sections.map((sec) => (
                <button
                  key={sec}
                  onClick={() => jumpToSection(sec)}
                  className="shrink-0 px-2 py-0.5 rounded-full border border-border bg-muted/30 text-muted-foreground hover:text-foreground hover:bg-muted/60 transition-colors"
                >
                  {sec}
                </button>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Body */}
        <div className="flex flex-1 overflow-hidden min-h-0">
        {/* Left: editor panel */}
        <div className="flex-1 flex flex-col border-r overflow-hidden min-w-0">
          <div className="shrink-0 border-b bg-background">
            {atsFixFeedback && (
              <div className="px-3 py-2 border-t bg-muted/10 text-[10px] space-y-1.5">
                <p className="text-muted-foreground/90">
                  <span className="font-semibold text-foreground">ATS review:</span> {atsFixFeedback.reviewed} issues reviewed, {atsFixFeedback.autoFixed} auto-fixed, {atsFixFeedback.manual} manual.
                </p>
                {atsFixFeedback.autoFixedIssues.length > 0 && (
                  <p className="text-emerald-600 dark:text-emerald-400 line-clamp-2">
                    <span className="font-semibold">Auto-fixed:</span> {atsFixFeedback.autoFixedIssues.join(' | ')}
                  </p>
                )}
                {atsFixFeedback.manualIssues.length > 0 && (
                  <p className="text-amber-600 dark:text-amber-400 line-clamp-2">
                    <span className="font-semibold">Needs manual check:</span> {atsFixFeedback.manualIssues.join(' | ')}
                  </p>
                )}
              </div>
            )}
            {mandatorySkillWarning && (
              <div className="px-3 py-2 border-t bg-amber-50 dark:bg-amber-950/25 text-[10px] text-amber-700 dark:text-amber-300">
                You removed mandatory skill{mandatorySkillWarning.length > 1 ? 's' : ''}: {mandatorySkillWarning.join(', ')}. Are you sure?
              </div>
            )}
            {toolStatus && !atsFixFeedback && (
              <div className="px-3 py-1.5 border-t bg-muted/5 text-[10px] text-muted-foreground/85">
                {toolStatus}
              </div>
            )}
            {rewritePreview && (
              <div className="px-3 py-2 border-t bg-violet-500/5 space-y-2">
                <div className="text-[10px] font-semibold uppercase tracking-wide text-violet-700/90 dark:text-violet-300/90">
                  Rewrite Preview
                </div>
                <div className="rounded border bg-background/80 px-2 py-1.5 space-y-1">
                  <p className="text-[10px] font-semibold text-muted-foreground/80">Original</p>
                  <p className="text-[11px] text-muted-foreground leading-relaxed line-clamp-3">{rewritePreview.source}</p>
                </div>
                <div className="rounded border border-violet-500/30 bg-violet-500/10 px-2 py-1.5 space-y-1">
                  <p className="text-[10px] font-semibold text-violet-700 dark:text-violet-300">Suggested rewrite</p>
                  <p className="text-[11px] text-foreground leading-relaxed line-clamp-4">{rewritePreview.rewritten}</p>
                </div>
                {rewritePreview.droppedTerms.length > 0 && (
                  <p className="text-[10px] text-amber-600 dark:text-amber-400">
                    Warning: dropped required terms: {rewritePreview.droppedTerms.join(', ')}
                  </p>
                )}
                <div className="flex items-center gap-1.5">
                  <Button size="sm" variant="outline" className="h-7 text-[10px]" onClick={acceptRewritePreview}>
                    Accept
                  </Button>
                  <Button size="sm" variant="ghost" className="h-7 text-[10px]" onClick={rejectRewritePreview}>
                    Reject
                  </Button>
                </div>
              </div>
            )}
          </div>

          {/* Markdown textarea */}
          <div className="flex-1 overflow-hidden relative">
            <Textarea
              ref={textareaRef}
              value={markdown}
              onChange={(e) => applyEdit(e.target.value)}
              className="absolute inset-0 w-full h-full rounded-none border-0 font-mono resize-none focus-visible:ring-0 focus-visible:ring-offset-0 bg-transparent"
              style={{ fontSize: `${editorFontSize}px`, lineHeight: '1.6' }}
              spellCheck={false}
            />
          </div>

          {/* Status bar */}
          <div className="px-3 py-1 border-t bg-muted/10 shrink-0 flex items-center justify-between gap-2">
            <span className="text-[10px] text-muted-foreground/60">
              {markdown.length.toLocaleString()} chars · {totalLines} lines
            </span>
            <div
              className="text-[10px] text-muted-foreground/60 text-right leading-tight"
              title={`Print estimate uses sidebar margin, font size, and line height (~${printLinesPerPage} lines/page at current settings). Browser PDF may still differ from this rough guide.`}
            >
              <div>~{(totalLines / printLinesPerPage).toFixed(1)} page guides (editor)</div>
              <div>~{printPagesRough.toFixed(1)} print est. · ~{printLinesPerPage} ln/pg</div>
            </div>
          </div>
        </div>

        {/* Center: HTML preview (mdcraft = print) */}
        <div className={cn('flex-1 flex flex-col overflow-hidden min-w-0', !profile && 'hidden')}>
          <div className="px-3 py-1.5 border-b bg-muted/20 shrink-0 flex items-center justify-between">
            <span className="text-[10px] uppercase tracking-widest font-semibold text-muted-foreground">Preview</span>
            <span className="text-[10px] text-muted-foreground/40 italic capitalize">{selectedTemplate}</span>
          </div>
          {profile ? (
            <div className="flex-1 min-h-0 overflow-hidden">
              <CVHTMLRenderer markdown={markdown} mdcraftConfig={mdcraftConfig} />
            </div>
          ) : (
            <div className="flex items-center justify-center h-full text-sm text-muted-foreground">
              Profile required for preview
            </div>
          )}
        </div>

        {/* Right: mdcraft PDF / layout */}
        <div className="w-[min(100%,340px)] shrink-0 border-l flex flex-col overflow-y-auto bg-muted/15 text-[11px]">
          <div className="px-3 py-2 border-b font-semibold uppercase tracking-wide text-muted-foreground">Page</div>
          <div className="px-3 py-2 space-y-2 border-b border-border/60">
            <label className="block text-muted-foreground">Size</label>
            <select
              className="w-full rounded-md border border-input bg-background px-2 py-1.5 text-xs"
              value={mdcraftConfig.pageSize}
              onChange={(e) =>
                setMdcraftConfig((c) => ({ ...c, pageSize: e.target.value as MdcraftPdfConfig['pageSize'] }))
              }
            >
              <option value="A4">A4</option>
              <option value="letter">US Letter</option>
              <option value="A5">A5</option>
            </select>
            <div className="flex justify-between gap-2">
              <span className="text-muted-foreground">Margin (mm)</span>
              <span className="font-mono">{mdcraftConfig.marginMm}</span>
            </div>
            <input
              type="range"
              min={8}
              max={40}
              value={mdcraftConfig.marginMm}
              onChange={(e) =>
                setMdcraftConfig((c) => ({ ...c, marginMm: Number(e.target.value) }))
              }
              className="w-full accent-primary"
            />
            <div className="flex justify-between gap-2">
              <span className="text-muted-foreground">Font (px)</span>
              <span className="font-mono">{mdcraftConfig.fontSizePx}</span>
            </div>
            <input
              type="range"
              min={10}
              max={22}
              value={mdcraftConfig.fontSizePx}
              onChange={(e) =>
                setMdcraftConfig((c) => ({ ...c, fontSizePx: Number(e.target.value) }))
              }
              className="w-full accent-primary"
            />
            <div className="flex justify-between gap-2">
              <span className="text-muted-foreground">Line height</span>
              <span className="font-mono">{mdcraftConfig.lineHeight.toFixed(1)}</span>
            </div>
            <input
              type="range"
              min={12}
              max={30}
              value={Math.round(mdcraftConfig.lineHeight * 10)}
              onChange={(e) =>
                setMdcraftConfig((c) => ({ ...c, lineHeight: Number(e.target.value) / 10 }))
              }
              className="w-full accent-primary"
            />
          </div>

          <div className="px-3 py-2 border-b font-semibold uppercase tracking-wide text-muted-foreground">Preset</div>
          <div className="px-3 py-2 flex flex-wrap gap-1 border-b border-border/60">
            {templates.map(({ value, label }) => (
              <button
                key={value}
                type="button"
                onClick={() => selectTemplate(value)}
                className={cn(
                  'px-2 py-1 rounded-md border text-[10px] capitalize',
                  selectedTemplate === value
                    ? 'border-primary bg-primary/10 text-foreground'
                    : 'border-border text-muted-foreground hover:bg-muted/50',
                )}
              >
                {label}
              </button>
            ))}
          </div>

          <div className="px-3 py-2 border-b font-semibold uppercase tracking-wide text-muted-foreground">Typography</div>
          <div className="px-3 py-2 space-y-2 border-b border-border/60">
            <label className="text-muted-foreground">Body</label>
            <select
              className="w-full rounded-md border border-input bg-background px-2 py-1.5 text-xs"
              value={mdcraftConfig.bodyFont}
              onChange={(e) => setMdcraftConfig((c) => ({ ...c, bodyFont: e.target.value }))}
            >
              <option value="'DM Sans', sans-serif">DM Sans</option>
              <option value="'Lora', serif">Lora</option>
              <option value="'Georgia', serif">Georgia</option>
              <option value="system-ui, sans-serif">System UI</option>
            </select>
            <label className="text-muted-foreground">Headings</label>
            <select
              className="w-full rounded-md border border-input bg-background px-2 py-1.5 text-xs"
              value={mdcraftConfig.headingFont}
              onChange={(e) => setMdcraftConfig((c) => ({ ...c, headingFont: e.target.value }))}
            >
              <option value="'Lora', serif">Lora</option>
              <option value="'DM Sans', sans-serif">DM Sans</option>
              <option value="'Georgia', serif">Georgia</option>
              <option value="system-ui, sans-serif">System UI</option>
            </select>
            <div className="text-muted-foreground pt-1">Accent</div>
            <div className="grid grid-cols-4 gap-1.5">
              {accentSwatches.map((sw) => (
                <button
                  key={sw.hex}
                  type="button"
                  title={sw.name}
                  className={cn(
                    'aspect-square rounded-md border-2 transition-transform hover:scale-105',
                    mdcraftConfig.accentHex === sw.hex ? 'border-foreground ring-1 ring-offset-1' : 'border-transparent',
                  )}
                  style={{ backgroundColor: sw.hex }}
                  onClick={() => setMdcraftConfig((c) => ({ ...c, accentHex: sw.hex }))}
                />
              ))}
            </div>
          </div>

          <div className="px-3 py-2 border-b font-semibold uppercase tracking-wide text-muted-foreground">Custom CSS</div>
          <div className="px-3 py-2 border-b border-border/60">
            <Textarea
              value={mdcraftConfig.customCss}
              onChange={(e) => setMdcraftConfig((c) => ({ ...c, customCss: e.target.value }))}
              placeholder="/* print overrides */"
              className="min-h-[100px] resize-y font-mono text-[10px]"
              spellCheck={false}
            />
          </div>

          <div className="px-3 py-2 border-b font-semibold uppercase tracking-wide text-muted-foreground">Snippets</div>
          <p className="px-3 py-1.5 text-[9px] text-muted-foreground/80 leading-snug border-b border-border/60">
            Page break token: <span className="font-mono text-foreground/90">&lt;-new_page-&gt;</span> on its own line. Blank lines around it help print layout match the preview.
          </p>
          <div className="px-3 py-2 grid grid-cols-2 gap-1.5 pb-4">
            <button
              type="button"
              className="rounded-md border border-border bg-background px-2 py-1.5 text-left text-[10px] hover:bg-muted/50"
              title="Inserts <-new_page-> with surrounding newlines"
              onClick={() => insertAtCursor('\n<-new_page->\n')}
            >
              Page break
            </button>
            <button
              type="button"
              className="rounded-md border border-border bg-background px-2 py-1.5 text-left text-[10px] hover:bg-muted/50"
              onClick={() => insertAtCursor('\n\n---\n\n')}
            >
              Divider
            </button>
            <button
              type="button"
              className="rounded-md border border-border bg-background px-2 py-1.5 text-left text-[10px] hover:bg-muted/50"
              onClick={() => insertAtCursor('> ')}
            >
              Blockquote
            </button>
            <button
              type="button"
              className="rounded-md border border-border bg-background px-2 py-1.5 text-left text-[10px] hover:bg-muted/50"
              onClick={() => insertAtCursor('| Col | Col |\n|---|---|\n| val | val |')}
            >
              Table
            </button>
            <button
              type="button"
              className="rounded-md border border-border bg-background px-2 py-1.5 text-left text-[10px] hover:bg-muted/50"
              onClick={() => insertAtCursor('```\ncode\n```')}
            >
              Code block
            </button>
            <button
              type="button"
              className="rounded-md border border-border bg-background px-2 py-1.5 text-left text-[10px] hover:bg-muted/50"
              onClick={() => insertAtCursor('**bold** _italic_')}
            >
              Inline fmt
            </button>
          </div>

          <div className="px-3 py-2 border-b font-semibold uppercase tracking-wide text-muted-foreground">Editor</div>
          <div className="px-3 py-2 space-y-2 pb-4">
            <div className="flex justify-between text-muted-foreground">
              <span>Monospace size</span>
              <span className="font-mono">{Math.round(fontScale * 100)}%</span>
            </div>
            <input
              type="range"
              min={0.8}
              max={1.2}
              step={0.05}
              value={fontScale}
              onChange={(e) => setFontScale(Number(e.target.value))}
              className="w-full accent-primary"
            />
            <div className="flex gap-1">
              {(['compact', 'normal', 'relaxed'] as const).map((mode) => (
                <button
                  key={mode}
                  type="button"
                  onClick={() => setSpacingMode(mode)}
                  className={cn(
                    'flex-1 rounded border px-1 py-1 text-[10px] capitalize',
                    spacingMode === mode
                      ? 'border-primary bg-primary/15 text-foreground'
                      : 'border-border text-muted-foreground',
                  )}
                >
                  {mode === 'compact' ? 'Tight' : mode === 'normal' ? 'Normal' : 'Loose'}
                </button>
              ))}
            </div>
          </div>
        </div>

      </div>
    </div>
  )
}
