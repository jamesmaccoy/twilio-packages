'use client'

import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { CopyIcon, Loader2Icon } from 'lucide-react'
import React, { FC, useCallback, useEffect } from 'react'

type Props = {
  trigger: React.ReactNode
  bookingId: string
}

const InviteUrlDialog: FC<Props> = ({ trigger, bookingId }) => {
  const [token, setToken] = React.useState<string | null>(null)
  const [copied, setCopied] = React.useState(false)
  const [tokenUrl, setTokenUrl] = React.useState<string>('')
  const [isLoading, setIsLoading] = React.useState(false)

  //? Fetch the token from the server.
  useEffect(() => {
    const fetchToken = async () => {
      try {
        setIsLoading(true)
        const res = await fetch(`/api/bookings/${bookingId}/token`, {
          method: 'POST',
          credentials: 'include',
        })

        if (!res.ok) {
          throw new Error('Failed to fetch token')
        }

        const data = await res.json()
        setToken(data.token)
      } catch (error) {
        console.error('Error fetching token:', error)
      } finally {
        setIsLoading(false)
      }
    }

    fetchToken()
  }, [bookingId])

  //? When the tokenUrl is copied, set the copied state to false after a certain duration.
  useEffect(() => {
    if (copied) {
      const timer = setTimeout(() => {
        setCopied(false)
      }, 2000)

      return () => clearTimeout(timer)
    }
  }, [copied])

  //? Set the token URL when the token is available.
  useEffect(() => {
    if (token) {
      // Use shorter URL path for better social media compatibility
      const url = `${window.location.origin}/i/${token}`
      setTokenUrl(url)
    }
  }, [token])

  //? Copy the token URL to the clipboard.
  const copyTextHandler = () => {
    if (tokenUrl) {
      navigator.clipboard.writeText(tokenUrl)
      setCopied(true)
    }
  }

  const refreshTokenHandler = async () => {
    try {
      setIsLoading(true)
      const res = await fetch(`/api/bookings/${bookingId}/refresh-token`, {
        method: 'POST',
        credentials: 'include',
      })

      if (!res.ok) {
        throw new Error('Failed to refresh token')
      }

      const data = await res.json()
      setToken(data.token)
    } catch (error) {
      console.error('Error refreshing token:', error)
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <Dialog>
      <DialogTrigger asChild>{trigger}</DialogTrigger>

      <DialogContent>
        <DialogHeader>
          <DialogTitle>Invite Guests</DialogTitle>
          <DialogDescription>
            Share this link with your guests to invite them to the booking.
          </DialogDescription>
        </DialogHeader>

        {isLoading ? (
          <div className="flex items-center justify-center gap-2">
            <Loader2Icon className="text-muted-foreground size-6 animate-spin" />
            <span className="text-muted-foreground">Generating link...</span>
          </div>
        ) : (
          <div>
            <div className="flex items-center gap-2">
              <Input value={tokenUrl} readOnly className="flex-1" />
              <Button size="sm" onClick={copyTextHandler}>
                <CopyIcon className="size-4 mr-2" />
                <span>{copied ? 'Copied!' : 'Copy'}</span>
              </Button>
            </div>
            <div className="text-sm mt-1 px-2 h-max">
              To make the current link invalid.{' '}
              <Button variant="link" className="px-0 py-0 underline" onClick={refreshTokenHandler}>
                Click here to generate a new link
              </Button>
            </div>
          </div>
        )}

        <DialogFooter>
          <DialogClose asChild>
            <Button variant="outline" className="mt-4">
              Close
            </Button>
          </DialogClose>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

export default InviteUrlDialog
