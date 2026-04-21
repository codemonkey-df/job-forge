import type { UserProfile } from '@/types/profile'

export function generateSessionId(): string {
  return crypto.randomUUID()
}

export function getUserProfileSummary(profile: UserProfile | null): string {
  if (!profile) return 'No profile'
  
  const parts: string[] = []
  if (profile.fullName) parts.push(profile.fullName)
  if (profile.email) parts.push(profile.email)
  return parts.join(' - ') || 'Incomplete profile'
}

export function calculateProfileCompleteness(profile: UserProfile | null): number {
  if (!profile) return 0
  
  let score = 0
  let maxScore = 0
  
  // Personal info (max 20 points)
  maxScore += 20
  if (profile.fullName?.trim()) score += 10
  if (profile.email?.trim()) score += 10
  
  // Contact info (max 10 points)
  maxScore += 10
  if (profile.phone?.trim()) score += 5
  if (profile.location?.trim()) score += 5
  
  // URLs (max 10 points)
  maxScore += 10
  if (profile.linkedinUrl?.trim()) score += 5
  if (profile.portfolioUrl?.trim()) score += 5
  
  // Summary (max 10 points)
  maxScore += 10
  if (profile.summary && profile.summary.trim().length > 50) score += 10
  
  // Skills (max 20 points)
  maxScore += 20
  const skillScore = Math.min(profile.skills?.length || 0, 5) * 4
  score += skillScore
  
  // Experience (max 15 points)
  maxScore += 15
  const expScore = Math.min(profile.experience?.length || 0, 3) * 5
  score += expScore
  
  // Education (max 15 points)
  maxScore += 15
  const eduScore = Math.min(profile.education?.length || 0, 3) * 5
  score += eduScore
  
  return Math.round((score / maxScore) * 100)
}

export function isProfileComplete(profile: UserProfile | null): boolean {
  if (!profile) return false
  return (
    profile.fullName?.trim()?.length > 0 &&
    profile.email?.trim()?.length > 0 &&
    profile.skills?.length > 0
  )
}

export function isOnboarded(profile: UserProfile | null): boolean {
  if (!profile) return false
  // For now, we consider a profile complete if it has the required fields
  // In a real app, you might have a separate onboardedAt timestamp
  return isProfileComplete(profile)
}
