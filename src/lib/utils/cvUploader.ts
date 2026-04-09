import * as pdfjs from 'pdfjs-dist'
import workerUrl from 'pdfjs-dist/build/pdf.worker.min.mjs?url'

// Use the local worker bundled by Vite — avoids CDN 404 errors and keeps processing client-side
pdfjs.GlobalWorkerOptions.workerSrc = workerUrl

export async function extractTextFromPDF(file: File): Promise<string> {
  try {
    const arrayBuffer = await file.arrayBuffer()
    const pdf = await pdfjs.getDocument({ data: arrayBuffer }).promise
    const pageTexts = await Promise.all(
      Array.from({ length: pdf.numPages }, (_, i) =>
        pdf.getPage(i + 1).then((page) => page.getTextContent()),
      ),
    )
    return pageTexts
      .flatMap((p) => p.items)
      .map((item) => ('str' in item ? item.str : ''))
      .join(' ')
      .replace(/\s{3,}/g, '\n')
      .trim()
  } catch (error) {
    console.error('PDF parsing error:', error)
    throw new Error(`Failed to parse PDF: ${error instanceof Error ? error.message : 'Unknown error'}`)
  }
}
