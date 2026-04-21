import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { useToast } from '@/hooks/use-toast'
import { useAuthStore } from '@/store/authStore'

const schema = z.object({
  email: z.string().email('Invalid email address'),
  name: z.string().min(1, 'Name is required'),
  password: z.string().min(1, 'Password is required'),
})

type FormValues = z.infer<typeof schema>

interface LoginFormProps {
  open: boolean
  onOpenChange: (open: boolean) => void
}

export function LoginForm({ open, onOpenChange }: LoginFormProps) {
  const { login, isLoading } = useAuthStore()
  const { toast } = useToast()
  const [error, setError] = useState<string>('')

  const { register, handleSubmit, formState: { errors } } = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: {
      email: '',
      name: '',
      password: '',
    },
  })

  async function onSubmit(data: FormValues) {
    try {
      setError('')
      await login(data.name)
      onOpenChange(false)
      toast({ title: 'Login successful', variant: 'success' })
    } catch (err) {
      console.error('Login error:', err)
      setError('Failed to login. Please try again.')
      toast({ title: 'Login failed', variant: 'destructive' })
    }
  }

  function handleGuestLogin() {
    const guestName = 'Guest User'
    login(guestName)
    onOpenChange(false)
    toast({ title: 'Continued as guest', description: 'You can update your profile later.' })
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Welcome to JobForge</DialogTitle>
          <DialogDescription>
            Please sign in to continue or use guest mode to get started.
          </DialogDescription>
        </DialogHeader>
        
        {error && (
          <div className="rounded-md bg-destructive/15 p-3 text-sm text-destructive">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="email">Email</Label>
            <Input id="email" type="email" {...register('email')} placeholder="you@example.com" />
            {errors.email && <p className="text-xs text-destructive">{errors.email.message}</p>}
          </div>

          <div className="space-y-2">
            <Label htmlFor="name">Full Name</Label>
            <Input id="name" {...register('name')} placeholder="John Doe" />
            {errors.name && <p className="text-xs text-destructive">{errors.name.message}</p>}
          </div>

          <div className="space-y-2">
            <Label htmlFor="password">Password</Label>
            <Input id="password" type="password" {...register('password')} placeholder="••••••••" />
            {errors.password && <p className="text-xs text-destructive">{errors.password.message}</p>}
          </div>

          <div className="flex gap-3 pt-4">
            <Button type="submit" className="flex-1" disabled={isLoading}>
              {isLoading ? 'Logging in...' : 'Login'}
            </Button>
            <Button type="button" variant="outline" onClick={handleGuestLogin}>
              Guest
            </Button>
          </div>
        </form>

        <div className="text-xs text-center text-muted-foreground pt-2">
          Your data is stored locally in your browser.
        </div>
      </DialogContent>
    </Dialog>
  )
}
