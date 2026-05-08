import { Suspense } from 'react'
import PostLoginClient from './post-login-client'

export default function PostLoginPage() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-white" />}>
      <PostLoginClient />
    </Suspense>
  )
}

