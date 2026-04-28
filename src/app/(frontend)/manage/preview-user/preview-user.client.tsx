'use client'

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { useState } from 'react'

export default function PreviewUserClient() {
  const [email, setEmail] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const start = async () => {
    setLoading(true)
    setError(null)
    try {
      const res = await fetch('/api/admin/user-preview/start', {
        method: 'POST',
        credentials: 'include',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ email }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data?.error || 'Failed to start preview')
      window.location.assign('/bookings')
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Unknown error')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="container mx-auto max-w-xl px-4 py-10">
      <Card>
        <CardHeader>
          <CardTitle>Preview site as user (read-only)</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="text-sm text-muted-foreground">
            This temporarily changes how the site resolves <code>currentUser</code> for browsing pages like bookings and
            posts. It does not log you out.
          </div>
          <Input
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="customer@example.com"
            autoComplete="email"
          />
          <div className="flex items-center gap-3">
            <Button onClick={start} disabled={loading || !email.trim()}>
              {loading ? 'Starting…' : 'Start preview'}
            </Button>
          </div>
          {error ? <div className="text-sm text-red-600">{error}</div> : null}
        </CardContent>
      </Card>
    </div>
  )
}

