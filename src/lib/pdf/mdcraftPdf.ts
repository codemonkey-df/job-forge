/**
 * Markdown → HTML → print/PDF pipeline (marked GFM + page breaks).
 * Preview and export share the same buildHTML body + CSS for WYSIWYG.
 */
import { marked } from 'marked'
import type { CVTemplate } from './parseMarkdownCV'
import { kvGet, kvSet } from '../db/kv'

export type PageSizeKey = 'A4' | 'letter' | 'A5'

export interface MdcraftPdfConfig {
  pageSize: PageSizeKey
  marginMm: number
  fontSizePx: number
  lineHeight: number
  bodyFont: string
  headingFont: string
  accentHex: string
  customCss: string
}

const KV_KEY = 'pdf-config'
const LEGACY_LS_KEY = 'job-forge-mdcraft-pdf-config'

export const DEFAULT_MDCRAFT_CONFIG: MdcraftPdfConfig = {
  pageSize: 'A4',
  marginMm: 20,
  fontSizePx: 15,
  lineHeight: 1.8,
  bodyFont: "'DM Sans', sans-serif",
  headingFont: "'Lora', serif",
  accentHex: '#334155',
  customCss: '',
}

const PAGE_SIZE_MAP: Record<PageSizeKey, string> = {
  A4: '210mm 297mm',
  letter: '215mm 279mm',
  A5: '148mm 210mm',
}

/** Printable body height (mm) for rough line-capacity estimates. */
const PAGE_BODY_HEIGHT_MM: Record<PageSizeKey, number> = {
  A4: 297,
  letter: 279,
  A5: 210,
}

/** CSS px to mm at 96dpi (for line-height vs @page margin math). */
const MM_PER_CSS_PX = 25.4 / 96

/** Hyphen / unicode dashes treated like `-` in page-break tokens. */
const DASH_CLASS = '[\\-\\u2010\\u2011\\u2012\\u2013\\u2014\\u2015]'

/** Matches <-new_page-> with flexible internal spacing and unicode dashes. */
function flexiblePageBreakSourceRe(flags: 'g' | 'gi' | 'i' = 'gi'): RegExp {
  return new RegExp(
    `<\\s*${DASH_CLASS}\\s*new\\s*_?\\s*page\\s*${DASH_CLASS}\\s*>`,
    flags,
  )
}

/** Pasted “arrow” forms sometimes seen in docs (not the real token). */
const ARROW_PAGE_FAKE_RE = /[←‹]\s*-?\s*new\s*_?\s*page\s*-?\s*[→›]/gi

/** Entire line is only a page-break token (after trim). */
const PAGE_BREAK_LINE_ONLY_RE = new RegExp(
  `^\\s*<\\s*${DASH_CLASS}\\s*new\\s*_?\\s*page\\s*${DASH_CLASS}\\s*>\\s*$`,
  'i',
)

/** Conservative: drop standalone instructional lines that leak into CV body from copy/paste. */
const INSTRUCTIONAL_LINE_RES: RegExp[] = [
  /^\s*\(?\s*optional:?\s*[^\n]{0,160}\bpage\s*break\b[^\n]{0,160}\)?\s*$/i,
  /^\s*insert\s+page\s+break\b[^\n]{0,120}\s*$/i,
  /^\s*manual\s+pdf\s+formatting\b[^\n]{0,160}\s*$/i,
]

export function lineIsPageBreakMarkdown(trimmedLine: string): boolean {
  return PAGE_BREAK_LINE_ONLY_RE.test(trimmedLine)
}

export function markdownContainsPageBreakToken(md: string): boolean {
  if (/<!--\s*pagebreak\s*-->/i.test(md)) return true
  return flexiblePageBreakSourceRe('i').test(md)
}

export function stripInstructionalCvLines(md: string): string {
  return md
    .split('\n')
    .filter((line) => {
      const t = line.trim()
      if (!t) return true
      if (t.length > 220) return true
      return !INSTRUCTIONAL_LINE_RES.some((re) => re.test(line))
    })
    .join('\n')
}

/**
 * Ensure markdown links survive print/PDF rendering as real anchor tags.
 * This is intentionally limited to absolute http(s) URLs used in CV content.
 */
export function preserveMarkdownLinks(md: string): string {
  return md.replace(
    /(^|[^!])\[([^\]]+)\]\((https?:\/\/[^\s)]+)\)/gm,
    '$1<a href="$3" target="_blank" rel="noopener noreferrer">$2</a>',
  )
}

/** ~How many body lines fit one printed page at current mdcraft settings (ignores wrap). */
export function estimatePrintLinesPerPage(config: MdcraftPdfConfig): number {
  const pageHmm = PAGE_BODY_HEIGHT_MM[config.pageSize] ?? PAGE_BODY_HEIGHT_MM.A4
  const contentMm = Math.max(24, pageHmm - 2 * config.marginMm)
  const linePx = config.fontSizePx * config.lineHeight
  const lineMm = linePx * MM_PER_CSS_PX
  return Math.max(8, Math.floor(contentMm / lineMm))
}

/** Rough page count from source line count vs print line capacity (heuristic). */
export function estimatePrintPagesFromLineCount(
  totalLines: number,
  config: MdcraftPdfConfig,
): number {
  if (totalLines <= 0) return 1
  const cap = estimatePrintLinesPerPage(config)
  return Math.max(1, Math.round((totalLines / cap) * 10) / 10)
}

/**
 * Normalize legacy + fuzzy page-break tokens to canonical `<-new_page->`, strip junk lines.
 * Call before split (preview) or before replacing with HTML (print).
 */
export function prepareMarkdownForMdcraft(md: string): string {
  let s = stripInstructionalCvLines(md)
  s = preserveMarkdownLinks(s)
  s = normalizePageBreakMarkers(s)
  s = s.replace(flexiblePageBreakSourceRe('gi'), '\n<-new_page->\n')
  s = s.replace(ARROW_PAGE_FAKE_RE, '\n<-new_page->\n')
  return s.replace(/\n{4,}/g, '\n\n\n')
}

/** Accent + typography presets aligned with former CVTemplate names (Modern / Classic / Minimal). */
export function mdcraftPresetFromTemplate(t: CVTemplate): Partial<MdcraftPdfConfig> {
  if (t === 'classic') {
    return {
      accentHex: '#1a1a1a',
      bodyFont: "'Georgia', serif",
      headingFont: "'Georgia', serif",
    }
  }
  if (t === 'minimal') {
    return {
      accentHex: '#888888',
      bodyFont: "'DM Sans', sans-serif",
      headingFont: "'DM Sans', sans-serif",
    }
  }
  return {
    accentHex: '#1d4ed8',
    bodyFont: "'DM Sans', sans-serif",
    headingFont: "'Lora', serif",
  }
}

/** Merge preset with defaults (template affects accent/fonts only). */
export function mergeMdcraftConfig(
  base: MdcraftPdfConfig,
  template: CVTemplate,
  overrides?: Partial<MdcraftPdfConfig>,
): MdcraftPdfConfig {
  return {
    ...base,
    ...mdcraftPresetFromTemplate(template),
    ...overrides,
  }
}

/**
 * Legacy HTML comment breaks → mdcraft token.
 */
export function normalizePageBreakMarkers(md: string): string {
  return md.replace(/<!--\s*pagebreak\s*-->/gi, '\n<-new_page->\n')
}

/** Canonical token after prepareMarkdownForMdcraft (split + replace target). */
export const PAGE_BREAK_MARKDOWN_TOKEN = '<-new_page->'

const PAGE_BREAK_HTML_BLOCK = '\n\n<div class="page-break"></div>\n\n'

/**
 * Replace canonical `<-new_page->` with an isolated block HTML block so marked does not merge it into a paragraph.
 */
export function processPageBreaksBeforeMarked(md: string): string {
  const parts = md.split(PAGE_BREAK_MARKDOWN_TOKEN)
  if (parts.length === 1) return md
  return parts.join(PAGE_BREAK_HTML_BLOCK)
}

let markedConfigured = false
function ensureMarkedOptions(): void {
  if (markedConfigured) return
  marked.setOptions({ gfm: true, breaks: true })
  markedConfigured = true
}

/** Body HTML only (marked output), for injection into shell. */
export function buildMarkedBody(markdown: string): string {
  ensureMarkedOptions()
  const prepared = prepareMarkdownForMdcraft(markdown)
  const processed = processPageBreaksBeforeMarked(prepared)
  return marked.parse(processed) as string
}

/**
 * Preview: split on raw `<-new_page->`, parse each chunk, join with dashed indicator.
 */
export function buildPreviewBodyHtml(markdown: string): string {
  ensureMarkedOptions()
  const prepared = prepareMarkdownForMdcraft(markdown)
  const parts = prepared.split(PAGE_BREAK_MARKDOWN_TOKEN)
  return parts
    .map((p) => marked.parse(p.trim() || '') as string)
    .reduce((acc, chunk, i) => {
      if (i === 0) return chunk
      const prev = i
      const next = i + 1
      const indicator = `<div class="page-break-indicator"><span>↑ Page ${prev} &nbsp;·&nbsp; Page ${next} ↓</span></div>`
      return acc + indicator + chunk
    }, '')
}

const GOOGLE_FONTS_LINK =
  'https://fonts.googleapis.com/css2?family=Lora:ital,wght@0,400;0,600;1,400&family=JetBrains+Mono:wght@400;500&family=DM+Sans:wght@300;400;500&display=swap'

function buildStylesheet(config: MdcraftPdfConfig, forPrint: boolean): string {
  const { pageSize, marginMm, fontSizePx, lineHeight, bodyFont, headingFont, accentHex, customCss } = config
  const pageDims = PAGE_SIZE_MAP[pageSize] ?? PAGE_SIZE_MAP.A4

  return `
@page { size: ${pageDims}; margin: ${marginMm}mm; }
/* Force "paper" rendering in app dark mode (iframes inherit color-scheme otherwise). */
html {
  color-scheme: light;
}
* { box-sizing: border-box; }
body {
  font-family: ${bodyFont};
  font-size: ${fontSizePx}px;
  line-height: ${lineHeight};
  background-color: #ffffff;
  color: #111111;
  max-width: ${forPrint ? '100%' : '740px'};
  margin: 0 auto;
  padding: ${forPrint ? '0' : '32px 40px 80px'};
}
h1, h2, h3, h4 {
  font-family: ${headingFont};
  font-weight: 600;
  margin: 0 0 0.5em;
  line-height: 1.3;
  color: #000;
}
h1 { font-size: 2em; margin-top: 0.8em; }
h2 {
  font-size: 1.4em;
  margin-top: 1.8em;
  color: ${accentHex};
  border-bottom: 1.5px solid ${accentHex}22;
  padding-bottom: 4px;
}
h3 { font-size: 1.1em; margin-top: 1.4em; }
p { margin: 0 0 0.9em; }
ul, ol { margin: 0 0 0.9em; padding-left: 1.5em; }
li { margin-bottom: 0.25em; }
blockquote {
  border-left: 3px solid ${accentHex};
  padding: 8px 16px;
  margin: 1.2em 0;
  color: #555;
  font-style: italic;
}
code {
  font-family: 'JetBrains Mono', monospace;
  font-size: 0.82em;
  background: #f4f4f4;
  padding: 2px 5px;
  border-radius: 3px;
}
pre {
  background: #f4f4f4;
  padding: 14px 16px;
  border-radius: 6px;
  overflow-x: auto;
  margin: 1em 0;
}
pre code { background: none; padding: 0; }
hr { border: none; border-top: 1px solid #e0e0e0; margin: 1.5em 0; }
table { width: 100%; border-collapse: collapse; margin: 1em 0; font-size: 0.88em; }
th {
  text-align: left;
  padding: 8px 12px;
  border-bottom: 2px solid ${accentHex};
  font-weight: 600;
}
td { padding: 7px 12px; border-bottom: 1px solid #eee; }
a { color: ${accentHex}; text-decoration: underline; text-decoration-thickness: 1px; }
.page-break {
  display: block;
  clear: both;
  height: 0;
  margin: 0;
  padding: 0;
  page-break-after: always;
  break-after: page;
  page-break-inside: avoid;
  break-inside: avoid;
}
.page-break-indicator {
  display: flex;
  align-items: center;
  gap: 10px;
  margin: 24px 0;
  color: #6366f1;
}
.page-break-indicator::before,
.page-break-indicator::after {
  content: '';
  flex: 1;
  border-top: 1.5px dashed #818cf8;
}
.page-break-indicator span {
  font-size: 11px;
  font-weight: 600;
  letter-spacing: 0.6px;
  white-space: nowrap;
  padding: 2px 10px;
  background: #f0f0ff;
  border: 1px solid #c7d2fe;
  border-radius: 20px;
  color: #6366f1;
}
${customCss || ''}
`.trim()
}

/**
 * Full HTML document for print dialog or iframe preview.
 * @param bodyInner - either full marked body (print) or preview body with indicators
 */
export function buildHTMLDocument(
  bodyInner: string,
  config: MdcraftPdfConfig,
  forPrint: boolean,
): string {
  const styles = buildStylesheet(config, forPrint)
  const previewPageOverlayScript = forPrint
    ? ''
    : `<script>
window.addEventListener('load', function() {
  var marginMm = ${config.marginMm};
  var pageH = (297 - marginMm * 2) * 96 / 25.4;
  var padTop = 32;
  var total = document.body.scrollHeight;
  document.body.style.position = 'relative';

  function line(y) {
    var el = document.createElement('div');
    el.setAttribute('aria-hidden', 'true');
    el.style.cssText = 'position:absolute;left:-40px;right:-40px;top:' + y + 'px;height:0;border-top:1.5px dashed rgba(129,140,248,0.45);pointer-events:none';
    document.body.appendChild(el);
  }

  function badge(y, n) {
    var el = document.createElement('div');
    el.setAttribute('aria-hidden', 'true');
    el.textContent = 'Page ' + n;
    el.style.cssText = 'position:absolute;right:0;top:' + (y + 3) + 'px;font-size:10px;font-weight:600;color:#6366f1;background:#f0f0ff;padding:1px 7px;border-radius:10px;border:1px solid #c7d2fe;font-family:sans-serif;pointer-events:none;opacity:0.85';
    document.body.appendChild(el);
  }

  badge(-padTop + 4, 1);
  var page = 1;
  for (var y = pageH - padTop; y < total; y += pageH) {
    line(y);
    badge(y + 4, page + 1);
    page++;
  }
});
</script>`
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <link href="${GOOGLE_FONTS_LINK}" rel="stylesheet" />
  <style>${styles}</style>
</head>
<body>${bodyInner}${previewPageOverlayScript}</body>
</html>`
}

/** Print/export: marked body with page-break divs. */
export function buildPrintHtml(markdown: string, config: MdcraftPdfConfig): string {
  const body = buildMarkedBody(markdown)
  return buildHTMLDocument(body, config, true)
}

/** Screen preview inside app: dashed breaks between chunks. */
export function buildScreenPreviewHtml(markdown: string, config: MdcraftPdfConfig): string {
  const body = buildPreviewBodyHtml(markdown)
  return buildHTMLDocument(body, config, false)
}

export async function printMdcraftPdf(markdown: string, config: MdcraftPdfConfig): Promise<void> {
  const html = buildPrintHtml(markdown, config)
  const iframe = document.createElement('iframe')
  iframe.style.position = 'fixed'
  iframe.style.right = '0'
  iframe.style.bottom = '0'
  iframe.style.width = '0'
  iframe.style.height = '0'
  iframe.style.border = '0'
  document.body.appendChild(iframe)
  const doc = iframe.contentDocument
  if (!doc) {
    document.body.removeChild(iframe)
    throw new Error('Unable to open print document.')
  }
  doc.open()
  doc.write(html)
  doc.close()
  await new Promise<void>((resolve) => {
    iframe.onload = () => resolve()
    setTimeout(() => resolve(), 400)
  })
  iframe.contentWindow?.focus()
  iframe.contentWindow?.print()
  setTimeout(() => {
    iframe.parentNode?.removeChild(iframe)
  }, 1000)
}

export async function copyMdcraftHtmlToClipboard(markdown: string, config: MdcraftPdfConfig): Promise<void> {
  const html = buildPrintHtml(markdown, config)
  await navigator.clipboard.writeText(html)
}

export async function loadMdcraftConfigFromStorage(): Promise<MdcraftPdfConfig | null> {
  try {
    const stored = await kvGet<Partial<MdcraftPdfConfig>>(KV_KEY)
    if (stored) return { ...DEFAULT_MDCRAFT_CONFIG, ...stored }
    const raw = localStorage.getItem(LEGACY_LS_KEY)
    if (raw) {
      const parsed = JSON.parse(raw) as Partial<MdcraftPdfConfig>
      const config = { ...DEFAULT_MDCRAFT_CONFIG, ...parsed }
      await kvSet(KV_KEY, config)
      localStorage.removeItem(LEGACY_LS_KEY)
      return config
    }
    return null
  } catch {
    return null
  }
}

export async function saveMdcraftConfigToStorage(config: MdcraftPdfConfig): Promise<void> {
  await kvSet(KV_KEY, config)
}
