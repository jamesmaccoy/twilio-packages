import { Suspense } from 'react'
import MobileOnboardingClient from './mobile-onboarding-client'

export default function MobileOnboardingPage() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-white" />}>
      <MobileOnboardingClient />
    </Suspense>
  )
}
