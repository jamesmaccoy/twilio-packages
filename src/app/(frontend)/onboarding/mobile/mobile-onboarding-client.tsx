'use client'

import React from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { InputOTP, InputOTPGroup, InputOTPSeparator, InputOTPSlot } from '@/components/ui/input-otp'
import { validateRedirect } from '@/utils/validateRedirect'
import { useUserContext } from '@/context/UserContext'

export default function MobileOnboardingClient() {
  const [mobileInput, setMobileInput] = React.useState('')
  const [countryCode, setCountryCode] = React.useState('+27')
  const [requestId, setRequestId] = React.useState('')
  const [otpValue, setOtpValue] = React.useState('')
  const [step, setStep] = React.useState<'mobile' | 'otp'>('mobile')
  const [loading, setLoading] = React.useState(false)
  const [error, setError] = React.useState<string | null>(null)

  const searchParams = useSearchParams()
  const router = useRouter()
  const { handleAuthChange } = useUserContext()

  const next = validateRedirect(searchParams.get('next')) || '/bookings'
  const normalizedMobile = `${countryCode}${mobileInput.replace(/\D/g, '').replace(/^0+/, '')}`

  const handleSendCode = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    setLoading(true)
    setError(null)

    try {
      const response = await fetch('/api/authRequests/magic', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ mobile: normalizedMobile }),
      })

      if (!response.ok) {
        const data = await response.json().catch(() => null)
        throw new Error(data?.message || 'Failed to send verification code')
      }

      const data = await response.json()
      setRequestId(data.authRequestId)
      setStep('otp')
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to send verification code')
    } finally {
      setLoading(false)
    }
  }

  const handleVerifyCode = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    setLoading(true)
    setError(null)

    try {
      const response = await fetch('/api/authRequests/verify-code', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          mobile: normalizedMobile,
          requestId,
          otp: otpValue,
          mode: 'onboarding',
        }),
      })

      if (!response.ok) {
        const data = await response.json().catch(() => null)
        throw new Error(data?.message || 'Failed to verify code')
      }

      handleAuthChange()
      router.push(`/onboarding/profile?next=${encodeURIComponent(next)}`)
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to verify code')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-white dark:bg-background px-6">
      <div className="w-full max-w-md space-y-6 border border-zinc-200 dark:border-border rounded-xl p-6 bg-white dark:bg-card">
        <div className="text-center space-y-2">
          <h1 className="text-2xl font-semibold text-zinc-900 dark:text-foreground">Verify your mobile number</h1>
          <p className="text-sm text-zinc-500 dark:text-muted-foreground">
            To continue, we need to verify a valid mobile number for your account.
          </p>
        </div>

        {error && (
          <div className="bg-red-100 text-red-700 dark:bg-red-950/30 dark:text-red-200 p-3 rounded-md text-sm">
            {error}
          </div>
        )}

        {step === 'mobile' && (
          <form onSubmit={handleSendCode} className="grid gap-4">
            <div className="grid gap-2">
              <label className="text-sm font-medium text-zinc-800 dark:text-foreground" htmlFor="mobile-number">
                Mobile number
              </label>
              <div className="flex gap-2">
                <select
                  aria-label="Country code"
                  className="h-10 rounded-md border border-zinc-200 dark:border-border bg-white dark:bg-card px-3 text-sm text-zinc-900 dark:text-foreground [color-scheme:light] dark:[color-scheme:dark]"
                  value={countryCode}
                  onChange={(event) => setCountryCode(event.target.value)}
                >
                  <option value="+27">South Africa (+27)</option>
                </select>
                <Input
                  id="mobile-number"
                  type="tel"
                  placeholder="82 123 4567"
                  value={mobileInput}
                  onChange={(event) => setMobileInput(event.target.value)}
                  autoComplete="tel"
                />
              </div>
            </div>

            <Button type="submit" disabled={loading || mobileInput.trim().length < 6}>
              {loading ? 'Sending code...' : 'Send verification code'}
            </Button>
          </form>
        )}

        {step === 'otp' && (
          <form onSubmit={handleVerifyCode} className="grid gap-4">
            <div className="text-sm text-zinc-600 dark:text-muted-foreground text-center">
              Enter the 6-digit code sent to <span className="font-medium">{normalizedMobile}</span>.
            </div>
            <div className="flex justify-center">
              <InputOTP maxLength={6} value={otpValue} onChange={setOtpValue}>
                <InputOTPGroup>
                  <InputOTPSlot index={0} />
                  <InputOTPSlot index={1} />
                  <InputOTPSlot index={2} />
                </InputOTPGroup>
                <InputOTPSeparator />
                <InputOTPGroup>
                  <InputOTPSlot index={3} />
                  <InputOTPSlot index={4} />
                  <InputOTPSlot index={5} />
                </InputOTPGroup>
              </InputOTP>
            </div>
            <Button type="submit" disabled={loading || otpValue.length < 6}>
              {loading ? 'Verifying...' : 'Verify and continue'}
            </Button>
            <Button
              type="button"
              variant="outline"
              onClick={() => {
                setStep('mobile')
                setOtpValue('')
                setRequestId('')
              }}
              disabled={loading}
            >
              Change mobile number
            </Button>
          </form>
        )}
      </div>
    </div>
  )
}
