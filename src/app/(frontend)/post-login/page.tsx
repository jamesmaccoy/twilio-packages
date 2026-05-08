'use client'

import React from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { validateRedirect } from '@/utils/validateRedirect'
import { useSubscription } from '@/hooks/useSubscription'

type MeResponse = {
  user?: {
    id: string
    mobileVerified?: boolean | null
  }
}

function buildPostLoginPath(nextPath: string): string {
  const safeNext = validateRedirect(nextPath) || '/bookings'
  return `/post-login?next=${encodeURIComponent(safeNext)}`
}

export default function PostLoginPage() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const subscription = useSubscription()

  const nextFinal = validateRedirect(searchParams.get('next')) || '/bookings'

  const [meLoading, setMeLoading] = React.useState(true)
  const [mobileVerified, setMobileVerified] = React.useState<boolean | null>(null)

  React.useEffect(() => {
    let cancelled = false

    const run = async () => {
      setMeLoading(true)
      try {
        const res = await fetch('/api/users/me', { credentials: 'include' })
        const data = (await res.json().catch(() => ({}))) as MeResponse
        if (!res.ok || !data.user) {
          throw new Error('Not authenticated')
        }

        if (cancelled) return
        setMobileVerified(data.user.mobileVerified === null ? null : Boolean(data.user.mobileVerified))
      } catch {
        if (cancelled) return
        router.replace(`/login?next=${encodeURIComponent(nextFinal)}`)
      } finally {
        if (!cancelled) setMeLoading(false)
      }
    }

    run()
    return () => {
      cancelled = true
    }
  }, [nextFinal, router])

  React.useEffect(() => {
    if (meLoading) return
    if (mobileVerified === false) {
      const returnToGate = buildPostLoginPath(nextFinal)
      router.replace(`/onboarding/mobile?next=${encodeURIComponent(returnToGate)}`)
      return
    }
    if (subscription.isLoading) return

    if (subscription.isSubscribed) {
      router.replace(nextFinal)
      return
    }

    router.replace(`/subscribe?next=${encodeURIComponent(nextFinal)}`)
  }, [meLoading, mobileVerified, nextFinal, router, subscription.isLoading, subscription.isSubscribed])

  return <div className="min-h-screen bg-white" />
}

