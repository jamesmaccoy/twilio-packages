'use client'

import { useRouter, useSearchParams } from 'next/navigation'
import React from 'react'

export default function RegisterPage() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const next = searchParams.get('next')
  const redirectedRef = React.useRef(false)

  React.useEffect(() => {
    if (redirectedRef.current) return
    redirectedRef.current = true

    const params = new URLSearchParams()
    if (next) params.set('next', next)
    const query = params.toString()
    router.replace(query ? `/login?${query}` : '/login')
  }, [next, router])

  return null
}
