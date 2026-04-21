import { useRef, useState } from 'react'
import { Loader2, Upload, FileText, CheckCircle2, AlertCircle, Zap } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog'
import { useSettingsStore } from '@/store/settingsStore'
import { useProfileStore } from '@/store/profileStore'
import { extractTextFromPDF } from '@/lib/utils/cvUploader'
import { extractStructured } from '@/lib/llm/client'
import { UserProfileDraftSchema } from '@/lib/llm/schemas'
import { profileExtractionSystem } from '@/lib/llm/prompts/profileExtraction'
import { LLMConfig } from '@/components/onboarding/LLMConfig'
import type { Skill, WorkExperience, Education } from '@/types/profile'

type EntryStage = 'choice' | 'processing' | 'no-llm' | 'error' | 'success'

interface PrefillData {
  fullName?: string
  email?: string
  phone?: string
  location?: string
  linkedinUrl?: string
  portfolioUrl?: string
  summary?: string
  skills?: Skill[]
  experience?: WorkExperience[]
  education?: Education[]
  projects?: any[]
}

interface ProfileCreationEntryProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  onManual: (prefill?: PrefillData) => void
  onComplete: () => void
}

export function ProfileCreationEntry({ open, onOpenChange, onComplete, onManual }: ProfileCreationEntryProps) {
  const { llm } = useSettingsStore()
  const { saveProfile } = useProfileStore()
  const pdfInputRef = useRef<HTMLInputElement>(null)
  const [stage, setStage] = useState<EntryStage>('choice')
  const [errorMessage, setErrorMessage] = useState('')
  const [isDragOver, setIsDragOver] = useState(false)
  const [showLLMConfig, setShowLLMConfig] = useState(false)
  const [pendingFile, setPendingFile] = useState<File | null>(null)

  function hasLLMConfigured(): boolean {
    if (llm.provider === 'anthropic' || llm.provider === 'google') {
      return !!(llm.apiKey && llm.model)
    }
    if (llm.provider === 'ollama' || llm.provider === 'proxy') {
      return !!(llm.baseUrl && llm.model)
    }
    return false
  }

  async function handleFile(file: File) {
    if (!file || file.type !== 'application/pdf') {
      setErrorMessage('Please upload a valid PDF file.')
      setStage('error')
      return
    }

    if (!hasLLMConfigured()) {
      setPendingFile(file)
      setStage('no-llm')
      return
    }

    await processFile(file)
  }

  async function processFile(file: File) {
    setStage('processing')
    try {
      const text = await extractTextFromPDF(file)

      const draft = await extractStructured({
        prompt: `Extract all profile information from the following CV text:\n\n${text}`,
        schema: UserProfileDraftSchema,
        systemPrompt: profileExtractionSystem,
      })

      await saveProfile({
        fullName: draft.fullName ?? '',
        email: draft.email ?? '',
        phone: draft.phone,
        location: draft.location,
        linkedinUrl: draft.linkedinUrl,
        portfolioUrl: draft.portfolioUrl,
        summary: draft.summary,
        skills: draft.skills ?? [],
        experience: draft.experience ?? [],
        education: draft.education ?? [],
        projects: draft.projects ?? [],
      })

      setStage('success')
    } catch (err) {
      const message = err instanceof Error ? err.message : 'An unexpected error occurred'
      setErrorMessage(message)
      setStage('error')
    }
  }

  function handleDragOver(e: React.DragEvent) {
    e.preventDefault()
    setIsDragOver(true)
  }

  function handleDragLeave() {
    setIsDragOver(false)
  }

  function handleDrop(e: React.DragEvent) {
    e.preventDefault()
    setIsDragOver(false)
    const file = e.dataTransfer.files[0]
    if (file) handleFile(file)
  }

  function handleInputChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (file) handleFile(file)
    e.target.value = ''
  }

  function resetToChoice() {
    setStage('choice')
    setErrorMessage('')
    setPendingFile(null)
  }

  function handleLLMConfigComplete() {
    setShowLLMConfig(false)
    if (pendingFile) {
      // User configured LLM — retry with the pending file
      processFile(pendingFile)
      setPendingFile(null)
    } else {
      setStage('choice')
    }
  }

  return (
    <>
      <Dialog open={open} onOpenChange={(isOpen) => {
        if (!isOpen) return
        onOpenChange(isOpen)
      }}>
        <DialogContent className="sm:max-w-lg">
          {stage === 'choice' && (
            <>
              <DialogHeader>
                <DialogTitle>Create Your Profile</DialogTitle>
                <DialogDescription>
                  Choose how you'd like to set up your professional profile.
                </DialogDescription>
              </DialogHeader>

              <div className="grid grid-cols-2 gap-4 py-2">
                {/* PDF upload option */}
                <div
                  className={`border-2 border-dashed rounded-lg p-6 flex flex-col items-center gap-3 cursor-pointer transition-colors ${
                    isDragOver
                      ? 'border-primary bg-primary/5'
                      : 'border-muted-foreground/30 hover:border-primary/50 hover:bg-muted/30'
                  }`}
                  onDragOver={handleDragOver}
                  onDragLeave={handleDragLeave}
                  onDrop={handleDrop}
                  onClick={() => pdfInputRef.current?.click()}
                >
                  <Upload className="size-8 text-muted-foreground" />
                  <div className="text-center">
                    <p className="text-sm font-medium">Upload CV (PDF)</p>
                    <p className="text-xs text-muted-foreground mt-1">
                      Drop your PDF here or click to browse
                    </p>
                    {hasLLMConfigured() ? (
                      <p className="text-xs text-emerald-600 dark:text-emerald-400 mt-2">
                        AI extraction available
                      </p>
                    ) : (
                      <p className="text-xs text-amber-600 dark:text-amber-400 mt-2">
                        Requires AI provider
                      </p>
                    )}
                  </div>
                  <input
                    ref={pdfInputRef}
                    type="file"
                    accept=".pdf"
                    className="hidden"
                    onChange={handleInputChange}
                  />
                </div>

                {/* Manual option */}
                <div
                  className="border-2 border-dashed rounded-lg p-6 flex flex-col items-center gap-3 cursor-pointer transition-colors border-muted-foreground/30 hover:border-primary/50 hover:bg-muted/30"
                  onClick={() => onManual()}
                >
                  <FileText className="size-8 text-muted-foreground" />
                  <div className="text-center">
                    <p className="text-sm font-medium">Create Manually</p>
                    <p className="text-xs text-muted-foreground mt-1">
                      Fill in your details step by step
                    </p>
                  </div>
                </div>
              </div>

              <p className="text-xs text-center text-muted-foreground">
                Profile creation is required to use job matching features.
              </p>
            </>
          )}

          {stage === 'no-llm' && (
            <>
              <DialogHeader>
                <DialogTitle>AI Provider Required</DialogTitle>
              </DialogHeader>
              <div className="flex flex-col items-center gap-4 py-4 text-center">
                <Zap className="size-12 text-amber-500" />
                <div>
                  <p className="font-medium">PDF extraction requires an AI provider</p>
                  <p className="text-sm text-muted-foreground mt-2">
                    Configure an AI provider to automatically extract your profile data from the CV.
                    Your PDF is ready — just set up your provider first.
                  </p>
                </div>
                <div className="flex flex-col gap-2 w-full">
                  <Button
                    onClick={() => setShowLLMConfig(true)}
                    className="w-full"
                  >
                    Configure AI Provider
                  </Button>
                  <Button
                    variant="outline"
                    onClick={() => onManual()}
                    className="w-full"
                  >
                    Create Manually Instead
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={resetToChoice}
                    className="text-muted-foreground"
                  >
                    Back
                  </Button>
                </div>
              </div>
            </>
          )}

          {stage === 'processing' && (
            <div className="flex flex-col items-center justify-center py-12 gap-4 text-center">
              <Loader2 className="size-12 animate-spin text-primary" />
              <div>
                <p className="font-medium">Processing your CV...</p>
                <p className="text-sm text-muted-foreground mt-1">
                  Extracting and analysing your profile with AI
                </p>
              </div>
            </div>
          )}

          {stage === 'error' && (
            <>
              <DialogHeader>
                <DialogTitle>Processing Failed</DialogTitle>
              </DialogHeader>
              <div className="flex flex-col items-center gap-4 py-4 text-center">
                <AlertCircle className="size-12 text-destructive" />
                <p className="text-sm text-muted-foreground">{errorMessage}</p>
                <div className="flex gap-3">
                  <Button variant="outline" onClick={resetToChoice}>
                    Try Again
                  </Button>
                  <Button onClick={() => onManual()}>
                    Create Manually
                  </Button>
                </div>
              </div>
            </>
          )}

          {stage === 'success' && (
            <div className="flex flex-col items-center justify-center py-12 gap-6 text-center">
              <CheckCircle2 className="size-16 text-emerald-500" />
              <div>
                <h2 className="text-2xl font-bold mb-2">Profile Created!</h2>
                <p className="text-muted-foreground">
                  Your profile has been extracted from your CV. You can always modify it under My Profile.
                </p>
              </div>
              <Button onClick={onComplete} size="lg">
                Go to Dashboard
              </Button>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* LLM config modal — opened from "no-llm" state */}
      <LLMConfig
        open={showLLMConfig}
        onOpenChange={setShowLLMConfig}
        onComplete={handleLLMConfigComplete}
      />
    </>
  )
}
