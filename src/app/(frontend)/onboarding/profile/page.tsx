import { Suspense } from 'react'
import ProfileOnboardingClient from './profile-client'

export default function ProfileOnboardingPage() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-white" />}>
      <ProfileOnboardingClient />
    </Suspense>
  )
}

