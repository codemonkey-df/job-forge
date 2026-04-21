import { useState, useCallback, useEffect } from 'react'
import { Loader2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Checkbox } from '@/components/ui/checkbox'
import {
  fetchPublicRepos,
  fetchRepoLanguages,
  normalizeGitHubRepoUrl,
  parseGitHubUsername,
  repoUrlsEqual,
  type GitHubRepo,
} from '@/lib/github/client'
import type { Project } from '@/types/profile'
import { useToast } from '@/hooks/use-toast'

export interface GitHubImportProps {
  projects: Project[]
  onProjectsChange: (projects: Project[]) => void
  githubUsername: string
  onGithubUsernameChange: (username: string) => void
}

export function GitHubImport({
  projects,
  onProjectsChange,
  githubUsername,
  onGithubUsernameChange,
}: GitHubImportProps) {
  const { toast } = useToast()
  const [input, setInput] = useState(githubUsername)
  const [repos, setRepos] = useState<GitHubRepo[]>([])
  const [selected, setSelected] = useState<Set<string>>(() => new Set())
  const [loadingRepos, setLoadingRepos] = useState(false)
  const [importing, setImporting] = useState(false)

  useEffect(() => {
    setInput(githubUsername)
  }, [githubUsername])

  const toggle = useCallback((fullName: string) => {
    setSelected((prev) => {
      const next = new Set(prev)
      if (next.has(fullName)) next.delete(fullName)
      else next.add(fullName)
      return next
    })
  }, [])

  async function handleFetch() {
    const user = parseGitHubUsername(input)
    if (!user) {
      toast({ title: 'Invalid username', description: 'Enter a GitHub username or profile URL.', variant: 'destructive' })
      return
    }
    setLoadingRepos(true)
    setRepos([])
    setSelected(new Set())
    try {
      const list = await fetchPublicRepos(user)
      setRepos(list)
      onGithubUsernameChange(user)
      if (list.length >= 100) {
        toast({
          title: 'Showing latest 100 repos',
          description: 'GitHub returns at most 100 per request; some older repos may be missing.',
        })
      }
    } catch (e) {
      toast({
        title: 'Could not load repos',
        description: e instanceof Error ? e.message : 'Unknown error',
        variant: 'destructive',
      })
    } finally {
      setLoadingRepos(false)
    }
  }

  async function handleImportSelected() {
    const chosen = repos.filter((r) => selected.has(r.full_name))
    if (chosen.length === 0) {
      toast({ title: 'Select repos', description: 'Choose at least one repository to import.', variant: 'destructive' })
      return
    }
    const user = parseGitHubUsername(input) ?? parseGitHubUsername(githubUsername)
    if (!user) {
      toast({ title: 'Username missing', description: 'Fetch repos first.', variant: 'destructive' })
      return
    }

    setImporting(true)
    try {
      const incoming: Project[] = []
      for (const repo of chosen) {
        let technologies: string[] = []
        try {
          technologies = await fetchRepoLanguages(repo.languages_url)
        } catch {
          if (repo.language) technologies = [repo.language]
        }
        incoming.push({
          name: repo.name,
          description: repo.description ?? '',
          url: repo.html_url,
          githubUrl: repo.html_url,
          technologies,
          source: 'github',
        })
      }

      const existingUrls = new Set(
        projects.map((p) => p.githubUrl).filter(Boolean).map((u) => normalizeGitHubRepoUrl(u!)),
      )
      const merged = [...projects]
      for (const p of incoming) {
        if (!p.githubUrl) continue
        const norm = normalizeGitHubRepoUrl(p.githubUrl)
        if (existingUrls.has(norm)) continue
        if (merged.some((x) => x.githubUrl && repoUrlsEqual(x.githubUrl, p.githubUrl))) continue
        existingUrls.add(norm)
        merged.push(p)
      }
      onProjectsChange(merged)
      onGithubUsernameChange(user)
      toast({ title: 'Projects imported', description: `Added ${incoming.length} repo(s). Save profile to persist.` })
      setSelected(new Set())
    } catch (e) {
      toast({
        title: 'Import failed',
        description: e instanceof Error ? e.message : 'Unknown error',
        variant: 'destructive',
      })
    } finally {
      setImporting(false)
    }
  }

  return (
    <div className="mt-6 space-y-3 rounded-lg border border-dashed p-4">
      <h3 className="text-sm font-semibold">Import from GitHub</h3>
      <p className="text-xs text-muted-foreground">
        Public repositories only (no token). Rate limit: ~60 requests/hour per IP.
      </p>
      <div className="flex flex-col gap-2 sm:flex-row sm:items-end">
        <div className="flex-1 space-y-1">
          <Label className="text-xs">GitHub username or profile URL</Label>
          <Input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="octocat or https://github.com/octocat"
            disabled={loadingRepos || importing}
          />
        </div>
        <Button type="button" variant="secondary" disabled={loadingRepos || importing} onClick={handleFetch}>
          {loadingRepos ? <Loader2 className="size-4 animate-spin" /> : null}
          Fetch repos
        </Button>
      </div>

      {repos.length > 0 && (
        <div className="space-y-2">
          <div className="max-h-56 overflow-y-auto rounded-md border">
            <table className="w-full text-left text-xs">
              <thead className="sticky top-0 bg-muted/80 backdrop-blur">
                <tr>
                  <th className="w-8 p-2" />
                  <th className="p-2">Repository</th>
                  <th className="p-2 hidden sm:table-cell">Language</th>
                  <th className="p-2">Stars</th>
                  <th className="p-2 hidden md:table-cell">Pushed</th>
                </tr>
              </thead>
              <tbody>
                {repos.map((r) => (
                  <tr key={r.full_name} className="border-t border-border/60">
                    <td className="p-2 align-top">
                      <Checkbox
                        checked={selected.has(r.full_name)}
                        onCheckedChange={() => toggle(r.full_name)}
                        aria-label={`Select ${r.name}`}
                      />
                    </td>
                    <td className="p-2 align-top">
                      <p className="font-medium">{r.name}</p>
                      <p className="text-muted-foreground line-clamp-2">{r.description || '—'}</p>
                    </td>
                    <td className="p-2 align-top text-muted-foreground hidden sm:table-cell">{r.language ?? '—'}</td>
                    <td className="p-2 align-top">{r.stargazers_count}</td>
                    <td className="p-2 align-top text-muted-foreground hidden md:table-cell">
                      {r.pushed_at ? new Date(r.pushed_at).toLocaleDateString() : '—'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <Button type="button" disabled={importing || selected.size === 0} onClick={handleImportSelected}>
            {importing ? <Loader2 className="size-4 animate-spin" /> : null}
            Import selected
          </Button>
        </div>
      )}
    </div>
  )
}
