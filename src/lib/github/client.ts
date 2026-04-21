/**
 * Public GitHub REST API helpers (no auth; rate limit applies).
 */

export interface GitHubRepo {
  name: string
  full_name: string
  description: string | null
  html_url: string
  language: string | null
  languages_url: string
  stargazers_count: number
  pushed_at: string
  fork: boolean
  archived: boolean
}

/** Trimmed username or null if input is empty / invalid */
export function parseGitHubUsername(input: string): string | null {
  const raw = input.trim()
  if (!raw) return null

  try {
    if (raw.includes('github.com')) {
      const u = new URL(raw.startsWith('http') ? raw : `https://${raw}`)
      const parts = u.pathname.split('/').filter(Boolean)
      if (parts.length === 0) return null
      return parts[0] ?? null
    }
  } catch {
    return null
  }

  const bare = raw.replace(/^@/, '')
  if (!/^[a-zA-Z0-9](?:[a-zA-Z0-9]|-(?=[a-zA-Z0-9])){0,38}$/.test(bare)) return null
  return bare
}

export function normalizeGitHubRepoUrl(url: string): string {
  return url.replace(/\/+$/, '').toLowerCase()
}

export function repoUrlsEqual(a: string | undefined, b: string | undefined): boolean {
  if (!a || !b) return false
  return normalizeGitHubRepoUrl(a) === normalizeGitHubRepoUrl(b)
}

export async function fetchPublicRepos(
  username: string,
  options: { includeForks?: boolean; includeArchived?: boolean } = {},
): Promise<GitHubRepo[]> {
  const { includeForks = false, includeArchived = false } = options
  const url = `https://api.github.com/users/${encodeURIComponent(username)}/repos?per_page=100&sort=pushed`
  const res = await fetch(url, {
    headers: { Accept: 'application/vnd.github+json' },
  })
  if (res.status === 403) {
    const remaining = res.headers.get('x-ratelimit-remaining')
    throw new Error(
      remaining === '0'
        ? 'GitHub API rate limit reached. Try again in an hour or use a GitHub token later.'
        : 'GitHub API refused the request (403).',
    )
  }
  if (!res.ok) {
    const text = await res.text().catch(() => '')
    throw new Error(res.status === 404 ? `User "${username}" not found on GitHub.` : `GitHub API error ${res.status}: ${text.slice(0, 120)}`)
  }
  const data = (await res.json()) as GitHubRepo[]
  if (!Array.isArray(data)) throw new Error('Unexpected GitHub API response')
  return data.filter((r) => (includeForks || !r.fork) && (includeArchived || !r.archived))
}

export async function fetchRepoLanguages(languagesUrl: string): Promise<string[]> {
  const res = await fetch(languagesUrl, {
    headers: { Accept: 'application/vnd.github+json' },
  })
  if (!res.ok) {
    throw new Error(`Failed to load languages (${res.status})`)
  }
  const obj = (await res.json()) as Record<string, number>
  if (!obj || typeof obj !== 'object') return []
  return Object.entries(obj)
    .sort(([, a], [, b]) => b - a)
    .map(([lang]) => lang)
}
