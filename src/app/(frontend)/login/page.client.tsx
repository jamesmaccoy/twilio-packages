'use client'

import React from 'react'
import EmailAuthForm from './_components/EmailAuthForm'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { CheckCircle2Icon, Command, Quote } from 'lucide-react'
import Link from 'next/link'
import { useSearchParams } from 'next/navigation'

export default function LoginPage() {
  const searchParams = useSearchParams()
  const registered = searchParams.get('registered') === 'true'

  return (
    <div className="w-full min-h-screen grid lg:grid-cols-2">
      {/* Left Side - Marketing / Hero */}
      <div className="hidden lg:flex flex-col justify-between bg-zinc-900 p-10 text-white relative overflow-hidden">
        {/* Background Image/Pattern */}
        <div className="absolute inset-0 bg-zinc-900">
          <img
            src="https://www.simpleplek.co.za/api/media/file/studio-2.jpg?q=80&w=2564&auto=format&fit=crop"
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
          <a href='https://aptunderwear.co.za/' className='text-white hover:text-zinc-400 transition-colors'>Apt underwear </a>and <a href='https://lush.co.za/' className='text-white hover:text-zinc-400 transition-colors'>LUSH</a> products on the shelf
        </div>

        {/* Testimonial */}
        <div className="relative z-10 max-w-md">
          <blockquote className="space-y-2">
            <div className="flex gap-2 text-zinc-400 mb-4">
              <Quote className="h-8 w-8 rotate-180 opacity-50" />
            </div>
            <p className="text-xl font-medium leading-relaxed">
              "Quaint but fun.. especially for surf holiday.."
            </p>
            <footer className="text-sm text-zinc-400 mt-4">
              Vuyo
              <span className="block text-xs text-zinc-500 mt-1">
                ⭐️⭐️⭐️
              </span>
            </footer>
          </blockquote>
        </div>
      </div>

      {/* Right Side - Form */}
      <div className="relative flex flex-col items-center justify-center p-8 bg-white">
        {/* Top Right Register Link */}
        <div className="absolute right-8 top-8">
          <Link
            href="/register"
            className="text-sm font-medium hover:text-zinc-900 transition-colors text-zinc-900"
          >
            Register
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
              Welcome back
            </h1>
            <p className="text-zinc-500 text-base">
              Login to access your account
            </p>
          </div>

          {/* Success Alert */}
          {registered && (
            <Alert className="mb-6 border-green-500 bg-green-50 dark:bg-green-950/20">
              <CheckCircle2Icon className="h-4 w-4 text-green-600 dark:text-green-400" />
              <AlertDescription className="text-green-800 dark:text-green-200">
                Registration successful! Please log in with your email and password.
              </AlertDescription>
            </Alert>
          )}

          <EmailAuthForm />

          {/* Footer */}
          <div className="mt-6 space-y-3">
            <p className="text-center text-sm text-zinc-500">
              Don&apos;t have an account?{' '}
              <Link
                href="/register"
                className="font-medium text-zinc-900 hover:text-zinc-700 hover:underline"
              >
                Register now
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
