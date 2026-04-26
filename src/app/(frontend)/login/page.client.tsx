'use client'

import React from 'react'
import EmailAuthForm from './_components/EmailAuthForm'
import { Command, Quote } from 'lucide-react'
import Link from 'next/link'

export default function LoginPage() {
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
              Vuyo Radebe
              <span className="block text-xs text-zinc-500 mt-1">
                ⭐️⭐️⭐️
              </span>
            </footer>
          </blockquote>
        </div>
      </div>

      {/* Right Side - Form */}
      <div className="relative flex flex-col items-center justify-center p-8 bg-white dark:bg-background">
        {/* Mobile Logo (visible only on small screens) */}
        <div className="lg:hidden absolute top-8 left-8 flex items-center gap-2 font-medium text-zinc-900 dark:text-zinc-100">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-zinc-900 text-white dark:bg-zinc-100 dark:text-zinc-900">
            <Command className="h-4 w-4" />
          </div>
          SimplePlek
        </div>

        <div className="w-full max-w-[450px] space-y-8">
          {/* Header */}
          <div className="mb-8 text-center">
            <h1 className="text-3xl font-bold tracking-tight text-zinc-900 dark:text-zinc-100 mb-2">
              Sign in or create your account
            </h1>
            <p className="text-zinc-500 dark:text-zinc-400 text-base">
              Use your email, mobile, password, or Google in one flow
            </p>
          </div>

          <EmailAuthForm />

          {/* Footer */}
          <div className="mt-6 space-y-3">
            <p className="text-center text-sm text-zinc-500 dark:text-zinc-400">
              New here? Continue with email, mobile, or Google and we&apos;ll create your account if needed.
            </p>
            <p className="text-center text-xs text-zinc-400 dark:text-zinc-500">
              By continuing, you agree to our{' '}
              <Link
                href="/terms-of-service"
                className="text-zinc-500 dark:text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-200 underline underline-offset-2"
              >
                Terms of Service
              </Link>
              {' '}and{' '}
              <Link
                href="/privacy-policy"
                className="text-zinc-500 dark:text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-200 underline underline-offset-2"
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
