import { Suspense } from 'react'
import ResetPasswordForm from './_components/ResetPasswordForm'

function ResetPasswordFormFallback() {
  return (
    <div className="grid gap-4">
      <div className="bg-zinc-50 border border-zinc-200 p-4 rounded-md">
        <p className="text-sm text-zinc-600">Loading...</p>
      </div>
    </div>
  )
}

export default function ResetPasswordPage() {
  return (
    <div className="container mx-auto px-4 py-16">
      <div className="max-w-md mx-auto">
        <h1 className="text-2xl font-bold mb-6">Set New Password</h1>
        <Suspense fallback={<ResetPasswordFormFallback />}>
          <ResetPasswordForm />
        </Suspense>
      </div>
    </div>
  )
}

