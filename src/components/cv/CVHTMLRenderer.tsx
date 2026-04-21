import { useMemo } from 'react'
import { buildScreenPreviewHtml, type MdcraftPdfConfig } from '@/lib/pdf/mdcraftPdf'

interface Props {
  markdown: string
  mdcraftConfig: MdcraftPdfConfig
}

/**
 * WYSIWYG preview: same HTML + print CSS as PDF export (mdcraft pipeline).
 */
export function CVHTMLRenderer({ markdown, mdcraftConfig }: Props) {
  const srcDoc = useMemo(
    () => buildScreenPreviewHtml(markdown, mdcraftConfig),
    [markdown, mdcraftConfig],
  )

  return (
    <iframe
      title="CV preview"
      srcDoc={srcDoc}
      className="h-full w-full min-h-[320px] border-0 bg-muted/20"
    />
  )
}
