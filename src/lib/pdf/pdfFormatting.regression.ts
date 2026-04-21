import { buildPreviewBodyHtml, buildPrintHtml, DEFAULT_MDCRAFT_CONFIG } from './mdcraftPdf'
import { HARD_PAGE_BREAK_TOKEN, parseMarkdownCV } from './parseMarkdownCV'
import {
  dividerAndBulletFixture,
  mdcraftPageBreakFixture,
  mdcraftTightBreakBetweenHeadings,
  mdcraftWithInstructionalLineFixture,
  paginationStressFixture,
} from './pdfFormatting.fixtures'

/**
 * Lightweight regression checks for PDF formatting inputs.
 * These checks are deterministic and can be run in a console/test harness.
 */
export function runPdfFormattingRegressionChecks(): string[] {
  const failures: string[] = []

  const parsed = parseMarkdownCV(paginationStressFixture)
  const experience = parsed.sections.find((s) => s.heading.toLowerCase() === 'experience')
  const education = parsed.sections.find((s) => s.heading.toLowerCase() === 'education')

  if (!experience) failures.push('missing experience section')
  if (!education) failures.push('missing education section')

  if (experience?.content.some((line) => line === '---')) {
    failures.push('divider artifact leaked to parsed content')
  }

  if (!experience?.content.some((line) => line.startsWith('- Collaborated'))) {
    failures.push('unicode bullet was not normalized')
  }

  const duplicatedDegreeLines = education?.content.filter(
    (line) => line.toLowerCase().replace(/\*\*/g, '').trim() === 'automation and robotics engineer',
  ) ?? []
  if (duplicatedDegreeLines.length > 1) {
    failures.push('adjacent semantic dedupe failed for education degree')
  }

  if (!experience?.content.includes(HARD_PAGE_BREAK_TOKEN)) {
    failures.push('page break marker not captured in parser')
  }

  const normalized = parseMarkdownCV(dividerAndBulletFixture)
  const summary = normalized.sections.find((s) => s.heading.toLowerCase() === 'summary')
  const exp = normalized.sections.find((s) => s.heading.toLowerCase() === 'experience')
  if (summary?.content.some((line) => line === '---')) {
    failures.push('divider artifact remained after normalization')
  }
  if (!exp?.content.some((line) => line.startsWith('- Automated'))) {
    failures.push('bullet normalization failed in divider fixture')
  }

  const printHtml = buildPrintHtml(mdcraftPageBreakFixture, DEFAULT_MDCRAFT_CONFIG)
  if (printHtml.includes('<-new_page->')) {
    failures.push('mdcraft: raw page-break token leaked into print HTML')
  }
  if (!printHtml.includes('class="page-break"')) {
    failures.push('mdcraft: <-new_page-> did not produce page-break div in print HTML')
  }
  if (!printHtml.includes('<h2')) {
    failures.push('mdcraft: marked output missing section headings in print HTML')
  }

  const tightPrint = buildPrintHtml(mdcraftTightBreakBetweenHeadings, DEFAULT_MDCRAFT_CONFIG)
  if (tightPrint.includes('<-new_page->')) {
    failures.push('mdcraft: tight fixture leaked raw token into print HTML')
  }
  const brIdx = tightPrint.indexOf('page-break')
  const betaIdx = tightPrint.search(/<h2[^>]*>\s*Beta\s*<\/h2>/i)
  if (brIdx === -1 || betaIdx === -1 || brIdx > betaIdx) {
    failures.push('mdcraft: page-break div should appear before second H2 in tight fixture')
  }

  const instructionalPrint = buildPrintHtml(mdcraftWithInstructionalLineFixture, DEFAULT_MDCRAFT_CONFIG)
  if (instructionalPrint.toLowerCase().includes('optional:')) {
    failures.push('mdcraft: instructional Optional page-break line should be stripped before print')
  }

  const legacyBreakHtml = buildPrintHtml(
    '## A\n<!-- pagebreak -->\n## B',
    DEFAULT_MDCRAFT_CONFIG,
  )
  if (!legacyBreakHtml.includes('class="page-break"')) {
    failures.push('mdcraft: legacy <!-- pagebreak --> did not normalize to page-break div')
  }

  const previewBody = buildPreviewBodyHtml('## One\n\n<-new_page->\n\n## Two')
  if (!previewBody.includes('page-break-indicator')) {
    failures.push('mdcraft: preview missing dashed page-break indicator')
  }
  if (!previewBody.includes('<h2')) {
    failures.push('mdcraft: preview marked output missing headings')
  }

  const parsedMdcraft = parseMarkdownCV(mdcraftPageBreakFixture)
  const expM = parsedMdcraft.sections.find((s) => s.heading.toLowerCase() === 'experience')
  const eduM = parsedMdcraft.sections.find((s) => s.heading.toLowerCase() === 'education')
  if (!expM?.content.includes(HARD_PAGE_BREAK_TOKEN) || !eduM) {
    failures.push('parser: <-new_page-> not captured as hard page break between sections')
  }

  return failures
}
