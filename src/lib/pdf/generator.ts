import { pdf } from '@react-pdf/renderer'
import React from 'react'
import { CVDocument } from './CVDocument'
import type { UserProfile } from '@/types/profile'

export async function downloadCVAsPDF(markdown: string, profile: UserProfile): Promise<void> {
  // @react-pdf/renderer needs a React element with the Document type
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const element = React.createElement(CVDocument as any, { markdown, profile })
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const blob = await pdf(element as any).toBlob()
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `${profile.fullName.replace(/\s+/g, '_')}_CV.pdf`
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
  URL.revokeObjectURL(url)
}
