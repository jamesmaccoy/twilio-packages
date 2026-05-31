'use client'

import { useEffect, useState } from 'react'

/**
 * Whether a post has an enabled non-addon package with entitlement "none"
 * (public / guest bookable). Used to skip image throttling for non-subscribers.
 */
export function usePostGuestBookable(
  postId?: string,
  initialGuestBookable?: boolean,
): { guestBookable: boolean; isLoading: boolean } {
  const [guestBookable, setGuestBookable] = useState(initialGuestBookable ?? false)
  const [isLoading, setIsLoading] = useState(
    initialGuestBookable === undefined && Boolean(postId),
  )

  useEffect(() => {
    if (initialGuestBookable === true) {
      setGuestBookable(true)
      setIsLoading(false)
      return
    }

    if (!postId) {
      setGuestBookable(false)
      setIsLoading(false)
      return
    }

    let cancelled = false
    setIsLoading(true)

    fetch(`/api/packages/post/${encodeURIComponent(postId)}`, { credentials: 'include' })
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (cancelled) return
        setGuestBookable(Boolean(data?.access?.guestBookable))
      })
      .catch(() => {
        if (!cancelled) setGuestBookable(false)
      })
      .finally(() => {
        if (!cancelled) setIsLoading(false)
      })

    return () => {
      cancelled = true
    }
  }, [postId, initialGuestBookable])

  return { guestBookable, isLoading }
}
