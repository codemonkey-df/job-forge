import { Plus, Trash2, ChevronDown, ChevronUp } from 'lucide-react'
import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Label } from '@/components/ui/label'
import type { WorkExperience } from '@/types/profile'

interface Props {
  items: WorkExperience[]
  onChange: (items: WorkExperience[]) => void
}

function emptyExperience(): WorkExperience {
  return { company: '', title: '', startDate: '', endDate: '', description: '' }
}

export function ExperienceEditor({ items, onChange }: Props) {
  const [expandedIndex, setExpandedIndex] = useState<number | null>(items.length > 0 ? 0 : null)

  function add() {
    const next = [...items, emptyExperience()]
    onChange(next)
    setExpandedIndex(next.length - 1)
  }

  function remove(index: number) {
    onChange(items.filter((_, i) => i !== index))
    setExpandedIndex(null)
  }

  function update(index: number, field: keyof WorkExperience, value: string) {
    onChange(items.map((item, i) => (i === index ? { ...item, [field]: value } : item)))
  }

  return (
    <div className="space-y-3">
      {items.map((item, index) => (
        <div key={index} className="border rounded-lg overflow-hidden">
          <div
            className="flex items-center justify-between px-4 py-3 cursor-pointer hover:bg-muted/50"
            onClick={() => setExpandedIndex(expandedIndex === index ? null : index)}
          >
            <div>
              <p className="font-medium text-sm">{item.title || 'New Position'}</p>
              <p className="text-xs text-muted-foreground">{item.company || 'Company'}</p>
            </div>
            <div className="flex items-center gap-2">
              <Button variant="ghost" size="icon" onClick={(e) => { e.stopPropagation(); remove(index) }}>
                <Trash2 className="size-4 text-destructive" />
              </Button>
              {expandedIndex === index ? <ChevronUp className="size-4" /> : <ChevronDown className="size-4" />}
            </div>
          </div>

          {expandedIndex === index && (
            <div className="px-4 pb-4 pt-2 space-y-3 border-t">
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <Label className="text-xs">Job Title</Label>
                  <Input value={item.title} onChange={(e) => update(index, 'title', e.target.value)} placeholder="Software Engineer" />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">Company</Label>
                  <Input value={item.company} onChange={(e) => update(index, 'company', e.target.value)} placeholder="Acme Corp" />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <Label className="text-xs">Start Date</Label>
                  <Input value={item.startDate} onChange={(e) => update(index, 'startDate', e.target.value)} placeholder="Jan 2022" />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">End Date</Label>
                  <Input value={item.endDate ?? ''} onChange={(e) => update(index, 'endDate', e.target.value)} placeholder="Present" />
                </div>
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Description (use bullet points with -)</Label>
                <Textarea
                  value={item.description}
                  onChange={(e) => update(index, 'description', e.target.value)}
                  placeholder="- Led development of...&#10;- Reduced latency by 30%..."
                  rows={4}
                />
              </div>
            </div>
          )}
        </div>
      ))}

      <Button type="button" variant="outline" className="w-full" onClick={add}>
        <Plus className="size-4" /> Add Position
      </Button>
    </div>
  )
}
