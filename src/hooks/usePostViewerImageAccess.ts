'use client'

import { useEffect, useMemo, useState } from 'react'

import { useUserContext } from '@/context/UserContext'
import { useSubscription } from '@/hooks/useSubscription'
import { getCustomerEntitlementFromUser } from '@/utils/packageSuggestions'

/**
 * Whether the viewer may see full-quality post hero/card images.
 * Combines Payload user profile, /api/check-subscription, and optional server guestBookable.
 */
export function usePostViewerImageAccess(
  postId?: string,
  guestBookableFromServer?: boolean,
) {
  const { currentUser } = useUserContext()
  const { isSubscribed, isLoading: isSubscriptionLoading } = useSubscription()

  const [guestBookableFromApi, setGuestBookableFromApi] = useState<boolean | null>(null)

  const hasSubscriptionFromProfile = useMemo(() => {
    if (!currentUser) return false
    return getCustomerEntitlementFromUser(currentUser) !== 'none'
  }, [currentUser])

  const guestBookable =
    guestBookableFromServer === true ||
    guestBookableFromApi === true

  const canViewFullImage =
    isSubscribed || hasSubscriptionFromProfile || guestBookable

  useEffect(() => {
    if (guestBookableFromServer === true) {
      setGuestBookableFromApi(true)
      return
    }
    if (!postId) {
      setGuestBookableFromApi(null)
      return
    }

    let cancelled = false

    fetch(`/api/packages/post/${encodeURIComponent(postId)}`, { credentials: 'include' })
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (cancelled) return
        setGuestBookableFromApi(Boolean(data?.access?.guestBookable))
      })
      .catch(() => {
        if (!cancelled) setGuestBookableFromApi(false)
      })

    return () => {
      cancelled = true
    }
  }, [postId, guestBookableFromServer])

  const isAccessPending =
    isSubscriptionLoading &&
    !hasSubscriptionFromProfile &&
    guestBookableFromServer !== true &&
    guestBookableFromApi === null &&
    Boolean(postId)

  const showRestrictedPlaceholder =
    !canViewFullImage && !isAccessPending

  return {
    canViewFullImage,
    hasSubscriptionFromProfile,
    guestBookable,
    isAccessPending,
    showRestrictedPlaceholder,
    isSubscriptionLoading,
  }
}
