'use client'

import React from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { useForm } from 'react-hook-form'
import { useRouter, useSearchParams } from 'next/navigation'
import { InputOTP, InputOTPGroup, InputOTPSeparator, InputOTPSlot } from '@/components/ui/input-otp'
import { useUserContext } from '@/context/UserContext'
import { validateRedirect } from '@/utils/validateRedirect'
import { useSubscription } from '@/hooks/useSubscription'
import Link from 'next/link'

type IdentifierFormValues = {
  identifier: string
  countryCode: string
}

function isEmailIdentifier(value: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)
}

function OtpInput({ onSubmit, loading }: { onSubmit: (otp: string) => void; loading: boolean }) {
  const [value, setValue] = React.useState('')

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()

    onSubmit(value)
  }

  return (
    <form onSubmit={handleSubmit} className="grid gap-4">
      <div className="flex justify-center">
        <InputOTP maxLength={6} onChange={(v) => setValue(v)}>
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
      <Button
        type="submit"
        className="w-full h-10"
        disabled={loading || value.length < 6}
        variant="default"
      >
        {loading ? (
          <span className="flex items-center gap-2">
            <span className="h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent" />
            Verifying...
          </span>
        ) : (
          'Verify OTP'
        )}
      </Button>
    </form>
  )
}

export default function EmailAuthForm() {
  const [step, setStep] = React.useState<'identifier' | 'password' | 'otp' | 'emailSent'>(
    'identifier',
  )
  const [email, setEmail] = React.useState('')
  const [mobile, setMobile] = React.useState('')
  const [authRequestId, setAuthRequestId] = React.useState('')
  const [loading, setLoading] = React.useState(false)
  const [error, setError] = React.useState<string | null>(null)
  const [password, setPassword] = React.useState('')
  const router = useRouter()
  const searchParams = useSearchParams()
  const next = searchParams.get('next') || searchParams.get('redirect')

  const { handleAuthChange } = useUserContext()
  const { isSubscribed, isLoading: isSubscriptionLoading } = useSubscription()

  const form = useForm<IdentifierFormValues>({
    defaultValues: { identifier: '', countryCode: '+27' },
  })

  const identifierValue = form.watch('identifier')
  const showCountryCode =
    typeof identifierValue === 'string' &&
    !isEmailIdentifier(identifierValue.trim()) &&
    identifierValue.replace(/\D/g, '').length >= 4

  const handleIdentifier = async (values: IdentifierFormValues) => {
    const identifier = values.identifier.trim()
    const isEmail = isEmailIdentifier(identifier)

    if (isEmail) {
      setLoading(true)
      setError(null)
      try {
        const normalizedEmail = identifier.toLowerCase()
        setEmail(normalizedEmail)

        const validatedNext = validateRedirect(next)

        const res = await fetch('/api/authRequests/magic-email', {
          method: 'POST',
          body: JSON.stringify({ email: normalizedEmail, next: validatedNext || undefined }),
          headers: { 'Content-Type': 'application/json' },
        })

        if (!res.ok) {
          const data = await res.json().catch(() => null)
          throw new Error(data?.message || 'Failed to send magic link')
        }

        setStep('emailSent')
      } catch (err: unknown) {
        setError(err instanceof Error ? err.message : 'Failed to send magic link')
      } finally {
        setLoading(false)
      }

      return
    }

    setLoading(true)
    setError(null)
    try {
      const localMobileDigits = identifier.replace(/\D/g, '')
      const normalizedMobile = `${values.countryCode}${localMobileDigits.replace(/^0+/, '')}`

      const res = await fetch('/api/authRequests/magic', {
        method: 'POST',
        body: JSON.stringify({ mobile: normalizedMobile }),
        headers: { 'Content-Type': 'application/json' },
      })
      if (!res.ok) {
        const data = await res.json().catch(() => null)
        throw new Error(data?.message || 'Failed to send OTP')
      }

      const data = await res.json()

      setMobile(data.mobile)
      setAuthRequestId(data.authRequestId)
      setStep('otp')
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to send OTP')
    } finally {
      setLoading(false)
    }
  }

  const handlePasswordLogin = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    setLoading(true)
    setError(null)

    try {
      const res = await fetch('/api/users/login', {
        method: 'POST',
        credentials: 'include',
        body: JSON.stringify({ email, password }),
        headers: {
          'Content-Type': 'application/json',
        },
      })

      if (!res.ok) {
        throw new Error('Invalid email or password')
      }

      const data = await res.json().catch(() => null)
      handleAuthChange()

      const validatedNext = validateRedirect(next)
      if (data?.user && data.user.mobileVerified === false) {
        const mobileOnboardingPath = validatedNext
          ? `/onboarding/mobile?next=${encodeURIComponent(validatedNext)}`
          : '/onboarding/mobile?next=%2Fbookings'
        router.push(mobileOnboardingPath)
        return
      }

      if (validatedNext) {
        router.push(validatedNext)
        return
      }

      if (!isSubscribed && !isSubscriptionLoading) {
        router.push('/subscribe')
      } else {
        router.push('/bookings')
      }
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'An error occurred')
    } finally {
      setLoading(false)
    }
  }

  const handleVerifyOtp = async (otp: string) => {
    setLoading(true)
    setError(null)
    try {
      const res = await fetch('/api/authRequests/verify-code', {
        method: 'POST',
        body: JSON.stringify({ mobile, otp, requestId: authRequestId }),
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
      })
      if (!res.ok) throw new Error('Invalid OTP')
      const data = await res.json().catch(() => null)
      // Optionally: handleAuthChange()
      // Optionally: validateRedirect
      handleAuthChange()
      const validatedNext = validateRedirect(next)
      if (data?.mobileVerified === false) {
        const mobileOnboardingPath = validatedNext
          ? `/onboarding/mobile?next=${encodeURIComponent(validatedNext)}`
          : '/onboarding/mobile?next=%2Fbookings'
        router.push(mobileOnboardingPath)
        return
      }
      router.push(validatedNext || '/bookings')
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Invalid OTP')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div>
      {step === 'identifier' && (
        <form onSubmit={form.handleSubmit(handleIdentifier)} className="grid gap-4">
          {error && <div className="bg-red-100 text-red-700 p-3 rounded-md">{error}</div>}
         

          <Button
            type="button"
            className="w-full h-10"
            onClick={() => {
              const validatedNext = validateRedirect(next)
              const redirect = validatedNext ? `?next=${encodeURIComponent(validatedNext)}` : ''
              window.location.href = `/api/auth/google${redirect}`
            }}
          >
            <svg className="mr-2 h-4 w-4" viewBox="0 0 24 24" aria-hidden="true">
              <path
                d="M21.35 11.1H12v2.98h5.35c-.23 1.5-1.76 4.4-5.35 4.4-3.22 0-5.85-2.67-5.85-5.96s2.63-5.96 5.85-5.96c1.84 0 3.07.79 3.77 1.47l2.58-2.5C16.74 3.99 14.58 3 12 3 7.03 3 3 7.03 3 12s4.03 9 9 9c5.2 0 8.64-3.65 8.64-8.8 0-.59-.06-1.04-.14-1.1z"
                fill="currentColor"
              />
            </svg>
            Continue with Google
          </Button>

          <div className="relative my-1">
            <div className="absolute inset-0 flex items-center">
              <span className="w-full border-t border-zinc-200" />
            </div>
            <div className="relative flex justify-center text-xs uppercase">
              <span className="bg-white px-2 text-zinc-500">or use email / mobile</span>
            </div>
          </div>

          <div className="grid gap-2">
           
           <div className="flex gap-2">
             {showCountryCode && (
               <select
                 aria-label="Country code"
                 {...form.register('countryCode', { required: true })}
                 className="h-10 rounded-md border border-zinc-200 bg-white px-3 text-sm text-zinc-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-zinc-950 focus-visible:ring-offset-2"
               >
                 <option value="+27">South Africa (+27)</option>
                 <option value="+1">United States / Canada (+1)</option>
                 <option value="+44">United Kingdom (+44)</option>
                 <option value="+49">Germany (+49)</option>
                 <option value="+33">France (+33)</option>
                 <option value="+34">Spain (+34)</option>
                 <option value="+39">Italy (+39)</option>
                 <option value="+31">Netherlands (+31)</option>
                 <option value="+61">Australia (+61)</option>
                 <option value="+353">Ireland (+353)</option>
               </select>
             )}
             <Input
               id="identifier"
               type="text"
               placeholder="Phone number or email"
               autoComplete="username"
               autoCapitalize="none"
               autoCorrect="off"
               {...form.register('identifier', { required: true })}
               className="flex h-10 w-full rounded-md border border-zinc-200 bg-white px-3 py-2 text-sm text-zinc-900 ring-offset-white file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-zinc-500 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-zinc-950 focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
             />
           </div>
         </div>

          <Button
            className="w-full h-10"
            type="submit"
            disabled={loading}
            variant="outline"
          >
            {loading ? (
              <span className="flex items-center gap-2">
                <span className="h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent" />
                Sending...
              </span>
            ) : (
              'Continue'
            )}
          </Button>
        </form>
      )}

      {step === 'emailSent' && (
        <div className="grid gap-4">
          <div className="text-center space-y-2">
            <p className="text-sm font-medium text-zinc-900">Check your email</p>
            <p className="text-sm text-zinc-500">
              We sent a sign-in link to <span className="font-medium text-zinc-900">{email}</span>.
            </p>
            <p className="text-xs text-zinc-400">The link expires in 15 minutes.</p>
          </div>
          {error && <div className="bg-red-100 text-red-700 p-3 rounded-md">{error}</div>}
          <div className="grid gap-2">
            <Button type="button" variant="outline" onClick={() => setStep('identifier')}>
              Back
            </Button>
          </div>
        </div>
      )}

      {step === 'password' && (
        <form onSubmit={handlePasswordLogin} className="grid gap-4">
          {error && <div className="bg-red-100 text-red-700 p-3 rounded-md">{error}</div>}
          <div className="grid gap-2">
            <label className="text-sm font-medium leading-none">Email</label>
            <Input value={email} readOnly className="h-10" />
          </div>
          <div className="grid gap-2">
            <div className="flex items-center justify-between">
              <label className="text-sm font-medium leading-none" htmlFor="password">
                Password
              </label>
              <Link href="/forgot-password" className="text-xs text-zinc-500 hover:text-zinc-900 hover:underline">
                Forgot password?
              </Link>
            </div>
            <Input
              id="password"
              type="password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              placeholder="••••••••"
              autoComplete="current-password"
              className="h-10"
            />
          </div>
          <div className="grid grid-cols-2 gap-2">
            <Button type="button" variant="outline" onClick={() => setStep('identifier')}>
              Back
            </Button>
            <Button className="h-10" type="submit" disabled={loading}>
              {loading ? 'Signing in...' : 'Sign in'}
            </Button>
          </div>
        </form>
      )}

      {step === 'otp' && (
        <div className="grid gap-4">
          <div className="text-center space-y-2">
            <p className="text-sm font-medium text-zinc-900">
              We&apos;ve sent a one time pin to:
            </p>
            <p className="text-sm font-mono text-primary font-semibold">{mobile}</p>
            <p className="text-sm text-zinc-500 mt-3">
              Enter the 6-digit code from your SMS to continue.
            </p>
          </div>
          {error && <div className="bg-red-100 text-red-700 p-3 rounded-md">{error}</div>}
          <OtpInput onSubmit={handleVerifyOtp} loading={loading} />
          <Button type="button" variant="outline" onClick={() => setStep('identifier')}>
            Back
          </Button>
        </div>
      )}
    </div>
  )
}
