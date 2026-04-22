'use client'

import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import React from 'react'
import { useForm } from 'react-hook-form'
import { useRouter } from 'next/navigation'
import Link from 'next/link'

type FormValues = {
  email: string
}

export default function ForgotPasswordForm() {
  const form = useForm<FormValues>({
    defaultValues: {
      email: '',
    },
  })

  const router = useRouter()
  const [error, setError] = React.useState<string | null>(null)
  const [success, setSuccess] = React.useState(false)
  const [isLoading, setIsLoading] = React.useState(false)

  const handleSubmit = async (values: FormValues) => {
    setIsLoading(true)
    setError(null)
    setSuccess(false)

    try {
      const res = await fetch(`/api/users/forgot-password`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(values),
      })

      const data = await res.json()

      if (!res.ok) {
        throw new Error(data.error || 'Failed to send password reset email')
      }

      setSuccess(true)
    } catch (err: unknown) {
      console.error(err)
      setError(err instanceof Error ? err.message : 'An error occurred')
    } finally {
      setIsLoading(false)
    }
  }

  if (success) {
    return (
      <div className="grid gap-4">
        <div className="bg-green-50 border border-green-200 text-green-800 p-4 rounded-md">
          <p className="font-medium mb-2">Check your email</p>
          <p className="text-sm">
            If an account exists with this email address, we&apos;ve sent you a password reset link.
            Please check your inbox and follow the instructions to reset your password.
          </p>
        </div>
        <Link
          href="/login"
          className="text-sm text-zinc-500 hover:text-zinc-900 hover:underline text-center"
        >
          Back to login
        </Link>
      </div>
    )
  }

  return (
    <form onSubmit={form.handleSubmit(handleSubmit)} className="grid gap-4">
      {error && <div className="bg-red-100 text-red-700 p-3 rounded-md text-sm">{error}</div>}
      
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
          {...form.register('email', {
            required: 'Email is required',
            pattern: {
              value: /^[^\s@]+@[^\s@]+\.[^\s@]+$/,
              message: 'Please enter a valid email address',
            },
          })}
          className="flex h-10 w-full rounded-md border border-zinc-200 bg-white px-3 py-2 text-sm text-zinc-900 ring-offset-white file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-zinc-500 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-zinc-950 focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
        />
        {form.formState.errors.email && (
          <p className="text-sm text-red-600">{form.formState.errors.email.message}</p>
        )}
      </div>

      <Button
        className="w-full mt-2 h-10"
        type="submit"
        variant="default"
        disabled={isLoading}
      >
        {isLoading ? 'Sending...' : 'Send Reset Link'}
      </Button>

      <Link
        href="/login"
        className="text-sm text-zinc-500 hover:text-zinc-900 hover:underline text-center"
      >
        Back to login
      </Link>
    </form>
  )
}

