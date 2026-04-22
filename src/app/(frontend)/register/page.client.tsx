'use client'

import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { useUserContext } from '@/context/UserContext'
import { validateRedirect } from '@/utils/validateRedirect'
import Link from 'next/link'
import { useRouter, useSearchParams } from 'next/navigation'
import React from 'react'
import { useForm } from 'react-hook-form'
import { Eye, EyeOff, Command, Quote } from 'lucide-react'

type FormValues = {
  email: string
  mobile: string
  password: string
  name: string
  role: string
}

export default function RegisterPage() {
  const form = useForm<FormValues>({
    defaultValues: {
      email: '',
      mobile: '',
      password: '',
      name: '',
      role: 'customer',
    },
  })

  const router = useRouter()

  const [error, setError] = React.useState<string | null>(null)
  const [showPassword, setShowPassword] = React.useState(false)

  const searchParams = useSearchParams()

  const next = searchParams.get('next')
  
  // If registering from a guest invite URL, automatically set role to 'guest'
  // Support both old format (/guest/invite) and new short format (/i/)
  const isGuestInvite = Boolean(next?.includes('/guest/invite') || next?.startsWith('/i/'))
  
  // Set default role based on whether this is a guest invite
  React.useEffect(() => {
    form.setValue('role', isGuestInvite ? 'guest' : 'customer')
  }, [isGuestInvite, form])

  const { handleAuthChange } = useUserContext()

  const handleRegister = async (values: FormValues) => {
    try {
      const res = await fetch(`/api/users/register`, {
        method: 'POST',
        credentials: 'include',
        body: JSON.stringify(values),
        headers: {
          'Content-Type': 'application/json',
        },
      })

      if (!res.ok) {
        const errorData = await res.json().catch(() => ({}))
        throw new Error(errorData.error || 'Registration failed')
      }

      const validatedNext = validateRedirect(next)

      if (validatedNext) {
        router.push(`/login?next=${validatedNext}&registered=true`)
        return
      }

      handleAuthChange()
      router.push('/login?registered=true')
    } catch (err) {
      console.error(err)
      setError(err instanceof Error ? err.message : 'An error occurred during registration')
    }
  }

  return (
    <div className="w-full min-h-screen grid lg:grid-cols-2">
      {/* Left Side - Marketing / Hero */}
      <div className="hidden lg:flex flex-col justify-between bg-zinc-900 p-10 text-white relative overflow-hidden">
        {/* Background Image/Pattern */}
        <div className="absolute inset-0 bg-zinc-900">
          <img
            src="https://www.simpleplek.co.za/api/media/file/sport.jpg?q=80&w=2564&auto=format&fit=crop"
            alt="Abstract background"
            className="w-full h-full object-cover opacity-100"
          />
          <div className="absolute inset-0 bg-gradient-to-t from-zinc-900 via-zinc-900/50 to-transparent" />
        </div>

        {/* Logo */}
        <div className="relative z-10 flex items-center gap-2 text-lg font-medium">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-white/10 backdrop-blur-sm">
            <Command className="h-5 w-5" />
          </div>
          SimplePlek
        </div>

        {/* Testimonial */}
        <div className="relative z-10 max-w-md">
          <blockquote className="space-y-2">
            <div className="flex gap-2 text-zinc-400 mb-4">
              <Quote className="h-8 w-8 rotate-180 opacity-50" />
            </div>
            <p className="text-xl font-medium leading-relaxed">
              "What a dream! From the sounds of the ocean, to the birds in the morning, what a peaceful and grounding place. It was such a treat having the beach right on the door step, and being able to take a hot shower outside to warm up! I had such a wholesome weekend at the shack and definitely be back sometime soon! :"
            </p>
            <footer className="text-sm text-zinc-400 mt-4">
              Anonymous Guest
              <span className="block text-xs text-zinc-500 mt-1">
                Photographer from Portugal
              </span>
            </footer>
          </blockquote>
        </div>
      </div>

      {/* Right Side - Form */}
      <div className="relative flex flex-col items-center justify-center p-8 bg-white">
        {/* Top Right Login Link */}
        <div className="absolute right-8 top-8">
          <Link
            href="/login"
            className="text-sm font-medium hover:text-zinc-900 transition-colors text-zinc-900"
          >
            Login
          </Link>
        </div>

        {/* Mobile Logo (visible only on small screens) */}
        <div className="lg:hidden absolute top-8 left-8 flex items-center gap-2 font-medium">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-zinc-900 text-white">
            <Command className="h-4 w-4" />
          </div>
          SimplePlek
        </div>

        <div className="w-full max-w-[450px] space-y-8">
          {/* Header */}
          <div className="mb-8 text-center">
            <h1 className="text-3xl font-bold tracking-tight text-zinc-900 mb-2">
              Create an account
            </h1>
            <p className="text-zinc-500 text-base">
              Register to get started
            </p>
          </div>

          {/* Error Alert */}
          {error && <div className="mb-6 bg-red-100 text-red-700 p-3 rounded-md">{error}</div>}

          {/* Form */}
          <form onSubmit={form.handleSubmit(handleRegister)} className="grid gap-4">
            <div className="grid gap-2">
              <label
                className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
                htmlFor="name"
              >
                Name
              </label>
              <Input
                id="name"
                type="text"
                placeholder="John Doe"
                autoComplete="name"
                {...form.register('name')}
                className="flex h-10 w-full rounded-md border border-zinc-200 bg-white px-3 py-2 text-sm text-zinc-900 ring-offset-white file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-zinc-500 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-zinc-950 focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
              />
            </div>
            <div className="grid gap-2">
              <label
                className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
                htmlFor="email"
              >
                Email
              </label>
              <Input
                id="email"
                type="email"
                placeholder="name@example.com"
                autoComplete="email"
                autoCapitalize="none"
                autoCorrect="off"
                {...form.register('email')}
                className="flex h-10 w-full rounded-md border border-zinc-200 bg-white px-3 py-2 text-sm text-zinc-900 ring-offset-white file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-zinc-500 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-zinc-950 focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
              />
            </div>
            <div className="grid gap-2">
              <label
                className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
                htmlFor="mobile"
              >
                Mobile Number
              </label>
              <Input
                id="mobile"
                type="tel"
                placeholder="+27821234567"
                autoComplete="tel"
                autoCapitalize="none"
                autoCorrect="off"
                {...form.register('mobile', { required: true })}
                className="flex h-10 w-full rounded-md border border-zinc-200 bg-white px-3 py-2 text-sm text-zinc-900 ring-offset-white file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-zinc-500 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-zinc-950 focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
              />
            </div>
            <div className="grid gap-2">
              <label
                className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
                htmlFor="password"
              >
                Password
              </label>
              <div className="relative">
                <Input
                  id="password"
                  type={showPassword ? 'text' : 'password'}
                  placeholder="••••••••"
                  autoComplete="new-password"
                  autoCapitalize="none"
                  {...form.register('password')}
                  className="flex h-10 w-full rounded-md border border-zinc-200 bg-white px-3 py-2 pr-10 text-sm text-zinc-900 ring-offset-white file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-zinc-500 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-zinc-950 focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-zinc-500 hover:text-zinc-900 transition-colors"
                  aria-label={showPassword ? 'Hide password' : 'Show password'}
                >
                  {showPassword ? (
                    <EyeOff className="h-4 w-4" />
                  ) : (
                    <Eye className="h-4 w-4" />
                  )}
                </button>
              </div>
            </div>

            <Button
              className="w-full mt-2 h-10"
              type="submit"
              variant="default"
            >
              Create Account
            </Button>
          </form>

          {/* Footer */}
          <div className="mt-6 space-y-3">
            <p className="text-center text-sm text-zinc-500">
              Already have an account?{' '}
              <Link
                href="/login"
                className="font-medium text-zinc-900 hover:text-zinc-700 hover:underline"
              >
                Log in
              </Link>
            </p>
            <p className="text-center text-xs text-zinc-400">
              By continuing, you agree to our{' '}
              <Link
                href="/terms-of-service"
                className="hover:text-zinc-600 underline underline-offset-2"
              >
                Terms of Service
              </Link>
              {' '}and{' '}
              <Link
                href="/privacy-policy"
                className="hover:text-zinc-600 underline underline-offset-2"
              >
                Privacy Policy
              </Link>
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}
