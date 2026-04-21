import { useMemo } from 'react'
import {
  DEFAULT_MDCRAFT_CONFIG,
  mergeMdcraftConfig,
  buildScreenPreviewHtml,
} from '@/lib/pdf/mdcraftPdf'
import type { CVTemplate } from '@/lib/pdf/parseMarkdownCV'
import type { UserProfile } from '@/types/profile'

interface Props {
  markdown: string
  profile: UserProfile
  template: CVTemplate
  jobTitle?: string
  companyName?: string
}

/**
 * Dialog preview: same mdcraft HTML as Focus Mode preview / print export.
 */
export default function PDFPreviewContent({ markdown, template }: Props) {
  const srcDoc = useMemo(
    () => buildScreenPreviewHtml(markdown, mergeMdcraftConfig(DEFAULT_MDCRAFT_CONFIG, template)),
    [markdown, template],
  )

  return (
    <iframe
      title="CV Preview"
      srcDoc={srcDoc}
      className="h-full w-full min-h-0 border-0"
    />
  )
}
