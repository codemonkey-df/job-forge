function parseHtml(html: string): string {
  const div = document.createElement('div')
  div.innerHTML = html
  div.querySelectorAll('script, style, nav, footer, header').forEach((el) => el.remove())
  return div.innerText.replace(/\s{3,}/g, '\n\n').trim()
}

export async function fetchJobDescription(url: string): Promise<string> {
  // Try CORS proxy
  try {
    const proxyUrl = `https://api.allorigins.win/get?url=${encodeURIComponent(url)}`
    const resp = await fetch(proxyUrl, { signal: AbortSignal.timeout(6000) })
    if (resp.ok) {
      const json = (await resp.json()) as { contents: string }
      const text = parseHtml(json.contents)
      if (text.length > 100) return text
    }
  } catch {
    // Fall through to error
  }

  throw new Error(
    'Could not fetch the job page — the site may block automated access. ' +
    'Please copy and paste the job description text directly using the Text tab.',
  )
}
