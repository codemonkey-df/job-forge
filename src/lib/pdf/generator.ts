import type { UserProfile } from '@/types/profile'
import type { CVTemplate } from './parseMarkdownCV'
import {
  DEFAULT_MDCRAFT_CONFIG,
  loadMdcraftConfigFromStorage,
  mdcraftPresetFromTemplate,
  printMdcraftPdf,
  type MdcraftPdfConfig,
} from './mdcraftPdf'

export type { MdcraftPdfConfig }

export async function downloadCVAsPDF(
  markdown: string,
  _profile: UserProfile,
  options: {
    template?: CVTemplate
    jobTitle?: string
    companyName?: string
    /** @deprecated Ignored; PDF uses mdcraft layout. */
    fontScale?: number
    /** @deprecated Ignored; PDF uses mdcraft line height. */
    lineSpacingMultiplier?: number
    /** Full or partial mdcraft settings from Focus Mode / UI. */
    mdcraft?: Partial<MdcraftPdfConfig>
  } = {}
): Promise<void> {
  const { template = 'modern', mdcraft: mdcraftOverrides } = options
  const stored = await loadMdcraftConfigFromStorage()
  const config: MdcraftPdfConfig = {
    ...DEFAULT_MDCRAFT_CONFIG,
    ...(stored ?? {}),
    ...mdcraftPresetFromTemplate(template),
    ...(mdcraftOverrides ?? {}),
  }
  await printMdcraftPdf(markdown, config)
}
