'use client'

import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { useState } from 'react'

export default function PreviewBookingTool({ bookingId }: { bookingId: string }) {
  const [email, setEmail] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [lastUrl, setLastUrl] = useState<string | null>(null)

  const openPreview = async () => {
    setLoading(true)
    setError(null)
    try {
      const res = await fetch('/api/admin/booking-preview-token', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ bookingId, email }),
      })
      const data = await res.json()
      if (!res.ok) {
        throw new Error(data?.error || 'Failed to create preview URL')
      }
      const url = String(data.url)
      setLastUrl(url)
      window.open(url, '_blank', 'noopener,noreferrer')
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
          <CardTitle>Preview booking as customer</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <div className="text-sm text-muted-foreground">
              Enter a customer email (must be the booking customer or a guest). We’ll open a read-only preview in a new
              tab.
            </div>
            <Input
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="customer@example.com"
              autoComplete="email"
            />
          </div>
          <div className="flex items-center gap-3">
            <Button onClick={openPreview} disabled={loading || !email.trim()}>
              {loading ? 'Creating preview…' : 'Open preview'}
            </Button>
            {lastUrl ? (
              <Button
                variant="outline"
                onClick={() => {
                  navigator.clipboard.writeText(new URL(lastUrl, window.location.origin).toString())
                }}
              >
                Copy link
              </Button>
            ) : null}
          </div>
          {error ? <div className="text-sm text-red-600">{error}</div> : null}
        </CardContent>
      </Card>
    </div>
  )
}

