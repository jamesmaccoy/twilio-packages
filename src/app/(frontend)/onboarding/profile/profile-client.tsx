'use client'

import React from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { validateRedirect } from '@/utils/validateRedirect'

type MeResponse = {
  user?: {
    id: string
    name?: string | null
    email?: string | null
    mobile?: string | null
    mobileVerified?: boolean | null
  }
}

function isPlaceholderMobileEmail(email: string | null | undefined): boolean {
  return Boolean(email && email.endsWith('@phone.simpleplek.invalid'))
}

export default function ProfileOnboardingClient() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const next = validateRedirect(searchParams.get('next')) || '/bookings'

  const [loading, setLoading] = React.useState(true)
  const [saving, setSaving] = React.useState(false)
  const [error, setError] = React.useState<string | null>(null)

  const [name, setName] = React.useState('')
  const [email, setEmail] = React.useState('')
  const [mobile, setMobile] = React.useState('')
  const [mobileVerified, setMobileVerified] = React.useState(false)

  React.useEffect(() => {
    let cancelled = false
    const run = async () => {
      setLoading(true)
      setError(null)
      try {
        const res = await fetch('/api/users/me', { credentials: 'include' })
        const data = (await res.json().catch(() => ({}))) as MeResponse
        if (!res.ok || !data.user) {
          throw new Error('Please sign in again to continue.')
        }

        if (cancelled) return

        setName(String(data.user.name || ''))
        setEmail(String(data.user.email || ''))
        setMobile(String(data.user.mobile || ''))
        setMobileVerified(Boolean(data.user.mobileVerified))
      } catch (e: unknown) {
        if (cancelled) return
        setError(e instanceof Error ? e.message : 'Failed to load your profile')
      } finally {
        if (!cancelled) setLoading(false)
      }
    }
    run()
    return () => {
      cancelled = true
    }
  }, [])

  const missingName = name.trim().length === 0
  const missingEmail = email.trim().length === 0 || isPlaceholderMobileEmail(email)
  const missingMobile = mobile.trim().length === 0 || !mobileVerified
  const canSubmitProfile = !missingName && !missingEmail

  const handleSave = async (event: React.FormEvent) => {
    event.preventDefault()
    setSaving(true)
    setError(null)

    try {
      const res = await fetch('/api/users/profile', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          name: name.trim(),
          email: email.trim(),
        }),
      })

      const data = await res.json().catch(() => null)
      if (!res.ok) {
        throw new Error(data?.error || data?.message || 'Failed to save profile')
      }

      if (mobile.trim().length === 0 || !mobileVerified) {
        router.replace(`/onboarding/mobile?next=${encodeURIComponent(next)}&skipProfileWrap=1`)
        return
      }

      router.replace(next)
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Failed to save profile')
    } finally {
      setSaving(false)
    }
  }

  if (loading) {
    return <div className="min-h-screen bg-white" />
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-white px-6">
      <div className="w-full max-w-md space-y-6 border border-zinc-200 rounded-xl p-6">
        <div className="text-center space-y-2">
          <h1 className="text-2xl font-semibold text-zinc-900">Complete your profile</h1>
          <p className="text-sm text-zinc-500">We need these details for legal and booking purposes.</p>
        </div>

        {error && <div className="bg-red-100 text-red-700 p-3 rounded-md text-sm">{error}</div>}

        {missingMobile && (
          <div className="bg-amber-50 text-amber-900 border border-amber-200 p-3 rounded-md text-sm">
            Save your name and email below first. If your number is not verified yet, we will take you to verify it
            before returning to your account.{' '}
            <button
              type="button"
              className="underline underline-offset-2 font-medium"
              onClick={() => router.push(`/onboarding/mobile?next=${encodeURIComponent(next)}&skipProfileWrap=1`)}
            >
              Verify mobile now
            </button>
          </div>
        )}

        <form onSubmit={handleSave} className="grid gap-4">
          <div className="grid gap-2">
            <label className="text-sm font-medium text-zinc-800" htmlFor="name">
              Full name
            </label>
            <Input
              id="name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Jane Doe"
              autoComplete="name"
            />
          </div>

          <div className="grid gap-2">
            <label className="text-sm font-medium text-zinc-800" htmlFor="email">
              Email address
            </label>
            <Input
              id="email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@example.com"
              autoComplete="email"
            />
            {isPlaceholderMobileEmail(email) && (
              <p className="text-xs text-zinc-500">
                This account was created with a temporary email. Please add your real email.
              </p>
            )}
          </div>

          <div className="rounded-md border border-zinc-200 p-3 text-sm text-zinc-700">
            <div className="flex items-center justify-between">
              <div>
                <div className="font-medium text-zinc-900">Mobile</div>
                <div className="text-zinc-600">{mobile || 'Not set'}</div>
              </div>
              <div className="text-xs font-medium">
                {mobileVerified ? (
                  <span className="text-emerald-700">Verified</span>
                ) : (
                  <span className="text-amber-700">Not verified</span>
                )}
              </div>
            </div>
          </div>

          <Button type="submit" disabled={saving || !canSubmitProfile}>
            {saving ? 'Saving...' : 'Save and continue'}
          </Button>
        </form>
      </div>
    </div>
  )
}

