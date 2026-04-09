import { useEffect } from 'react'
import { CVEditor } from '@/components/cv/CVEditor'
import { useProfileStore } from '@/store/profileStore'
import { Loader2 } from 'lucide-react'

export default function Profile() {
  const { isLoading, loadProfile } = useProfileStore()

  useEffect(() => {
    loadProfile()
  }, [loadProfile])

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="size-6 animate-spin text-muted-foreground" />
      </div>
    )
  }

  return (
    <div className="max-w-3xl">
      <p className="text-sm text-muted-foreground mb-6">
        Your profile is the foundation for every tailored CV. Keep it up to date for best results.
      </p>
      <CVEditor />
    </div>
  )
}
