import { useState } from 'react'
import { Globe, FileText } from 'lucide-react'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Label } from '@/components/ui/label'

interface Props {
  onSubmit: (text: string, url?: string) => void
  isLoading: boolean
}

export function JobInput({ onSubmit, isLoading }: Props) {
  const [url, setUrl] = useState('')
  const [text, setText] = useState('')

  async function handleUrlSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!url.trim()) return
    onSubmit('', url.trim())
  }

  function handleTextSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!text.trim()) return
    onSubmit(text.trim())
  }

  return (
    <Tabs defaultValue="url">
      <TabsList className="mb-4">
        <TabsTrigger value="url"><Globe className="size-4" /> Paste URL</TabsTrigger>
        <TabsTrigger value="text"><FileText className="size-4" /> Paste Text</TabsTrigger>
      </TabsList>

      <TabsContent value="url">
        <form onSubmit={handleUrlSubmit} className="space-y-3">
          <div className="space-y-1">
            <Label>Job Posting URL</Label>
            <Input
              type="url"
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              placeholder="https://jobs.company.com/position-123"
              disabled={isLoading}
            />
            <p className="text-xs text-muted-foreground">
              The page will be fetched via a CORS proxy. If it fails, paste the text manually.
            </p>
          </div>
          <Button type="submit" disabled={isLoading || !url.trim()}>
            Analyze Job
          </Button>
        </form>
      </TabsContent>

      <TabsContent value="text">
        <form onSubmit={handleTextSubmit} className="space-y-3">
          <div className="space-y-1">
            <Label>Job Description</Label>
            <Textarea
              value={text}
              onChange={(e) => setText(e.target.value)}
              placeholder="Paste the full job description here..."
              rows={12}
              disabled={isLoading}
            />
          </div>
          <Button type="submit" disabled={isLoading || !text.trim()}>
            Analyze Job
          </Button>
        </form>
      </TabsContent>
    </Tabs>
  )
}
