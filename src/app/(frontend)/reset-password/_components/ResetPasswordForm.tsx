'use client'

import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import React from 'react'
import { useForm } from 'react-hook-form'
import { useRouter, useSearchParams } from 'next/navigation'
import { Eye, EyeOff } from 'lucide-react'
import Link from 'next/link'

type FormValues = {
  password: string
  confirmPassword: string
}

export default function ResetPasswordForm() {
  const form = useForm<FormValues>({
    defaultValues: {
      password: '',
      confirmPassword: '',
    },
  })

  const router = useRouter()
  const searchParams = useSearchParams()
  const token = searchParams.get('token')
  const [error, setError] = React.useState<string | null>(null)
  const [success, setSuccess] = React.useState(false)
  const [isLoading, setIsLoading] = React.useState(false)
  const [showPassword, setShowPassword] = React.useState(false)
  const [showConfirmPassword, setShowConfirmPassword] = React.useState(false)

  React.useEffect(() => {
    if (!token) {
      setError('Invalid or missing reset token. Please request a new password reset link.')
    }
  }, [token])

  const handleSubmit = async (values: FormValues) => {
    if (!token) {
      setError('Invalid or missing reset token')
      return
    }

    if (values.password !== values.confirmPassword) {
      setError('Passwords do not match')
      return
    }

    setIsLoading(true)
    setError(null)
    setSuccess(false)

    try {
      const res = await fetch(`/api/users/reset-password`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          token,
          password: values.password,
        }),
      })

      const data = await res.json()

      if (!res.ok) {
        throw new Error(data.error || 'Failed to reset password')
      }

      setSuccess(true)
      
      // Redirect to login after 3 seconds
      setTimeout(() => {
        router.push('/login?reset=success')
      }, 3000)
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
          <p className="font-medium mb-2">Password reset successful!</p>
          <p className="text-sm">
            Your password has been reset. You will be redirected to the login page shortly.
          </p>
        </div>
        <Link
          href="/login"
          className="text-sm text-center text-zinc-500 hover:text-zinc-900 hover:underline"
        >
          Go to login now
        </Link>
      </div>
    )
  }

  if (!token) {
    return (
      <div className="grid gap-4">
        <div className="bg-red-100 text-red-700 p-4 rounded-md">
          <p className="font-medium mb-2">Invalid Reset Link</p>
          <p className="text-sm">
            This password reset link is invalid or has expired. Please request a new one.
          </p>
        </div>
        <Link
          href="/forgot-password"
          className="text-sm text-center text-zinc-500 hover:text-zinc-900 hover:underline"
        >
          Request new reset link
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
          htmlFor="password"
        >
          New Password
        </label>
        <div className="relative">
          <Input
            id="password"
            type={showPassword ? 'text' : 'password'}
            placeholder="••••••••"
            autoComplete="new-password"
            autoCapitalize="none"
            {...form.register('password', {
              required: 'Password is required',
              minLength: {
                value: 8,
                message: 'Password must be at least 8 characters long',
              },
            })}
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
        {form.formState.errors.password && (
          <p className="text-sm text-red-600">{form.formState.errors.password.message}</p>
        )}
      </div>

      <div className="grid gap-2">
        <label
          className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
          htmlFor="confirmPassword"
        >
          Confirm Password
        </label>
        <div className="relative">
          <Input
            id="confirmPassword"
            type={showConfirmPassword ? 'text' : 'password'}
            placeholder="••••••••"
            autoComplete="new-password"
            autoCapitalize="none"
            {...form.register('confirmPassword', {
              required: 'Please confirm your password',
              validate: (value) =>
                value === form.getValues('password') || 'Passwords do not match',
            })}
            className="flex h-10 w-full rounded-md border border-zinc-200 bg-white px-3 py-2 pr-10 text-sm text-zinc-900 ring-offset-white file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-zinc-500 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-zinc-950 focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
          />
          <button
            type="button"
            onClick={() => setShowConfirmPassword(!showConfirmPassword)}
            className="absolute right-3 top-1/2 -translate-y-1/2 text-zinc-500 hover:text-zinc-900 transition-colors"
            aria-label={showConfirmPassword ? 'Hide password' : 'Show password'}
          >
            {showConfirmPassword ? (
              <EyeOff className="h-4 w-4" />
            ) : (
              <Eye className="h-4 w-4" />
            )}
          </button>
        </div>
        {form.formState.errors.confirmPassword && (
          <p className="text-sm text-red-600">{form.formState.errors.confirmPassword.message}</p>
        )}
      </div>

      <Button
        className="w-full mt-2 h-10"
        type="submit"
        variant="default"
        disabled={isLoading}
      >
        {isLoading ? 'Resetting...' : 'Reset Password'}
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

