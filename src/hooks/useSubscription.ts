'use client'

import { useCallback, useEffect, useState } from 'react'
import { useYoco } from '@/providers/Yoco'

export type SubscriptionStatus = {
  isSubscribed: boolean
  entitlements: string[]
  expirationDate: Date | null
  isLoading: boolean
  error: Error | null
}

export const useSubscription = (entitlementId?: string): SubscriptionStatus => {
  const { customerInfo, isLoading: isYocoLoading, error: yocoError } = useYoco()
  const [subscriptionStatus, setSubscriptionStatus] = useState<SubscriptionStatus>({
    isSubscribed: false,
    entitlements: [],
    expirationDate: null,
    isLoading: true,
    error: null,
  })

  const checkSubscription = useCallback(async () => {
    try {
      // First check with Yoco client-side
      if (customerInfo) {
        const entitlements = customerInfo.entitlements?.active || {}
        const activeEntitlementKeys = Object.keys(entitlements)

        const isCurrentlySubscribed = entitlementId
          ? activeEntitlementKeys.includes(entitlementId)
          : activeEntitlementKeys.length > 0

        if (isCurrentlySubscribed) {
          let expirationDate: Date | null = null
          if (entitlementId && entitlements[entitlementId]?.expirationDate) {
            expirationDate = new Date(entitlements[entitlementId].expirationDate)
          } else if (activeEntitlementKeys.length > 0) {
            const firstKey = activeEntitlementKeys[0]
            if (firstKey && entitlements[firstKey]?.expirationDate) {
              expirationDate = new Date(entitlements[firstKey].expirationDate)
            }
          }
          setSubscriptionStatus({
            isSubscribed: true,
            entitlements: activeEntitlementKeys,
            expirationDate,
            isLoading: false,
            error: null,
          })
          return
        }
      }

      // If not subscribed client-side, check with the API
      const response = await fetch('/api/check-subscription', {
        credentials: 'include',
      })

      const responseData = await response.json()

      if (response.status === 401) {
        // User is not authenticated
        setSubscriptionStatus({
          isSubscribed: false,
          entitlements: [],
          expirationDate: null,
          isLoading: false,
          error: new Error('User not authenticated'),
        })
        return
      }

      if (responseData.error) {
        console.error('useSubscription - API Error:', responseData.error)
        throw new Error(responseData.error)
      }

      const expirationDate = responseData.transactions?.[0]?.expiresAt
        ? new Date(responseData.transactions[0].expiresAt)
        : null

      setSubscriptionStatus({
        isSubscribed: responseData.hasActiveSubscription,
        entitlements: responseData.activeEntitlements || [],
        expirationDate,
        isLoading: false,
        error: null,
      })

    } catch (err) {
      console.error('useSubscription - Error in checkSubscription:', err)
      setSubscriptionStatus({
        isSubscribed: false,
        entitlements: [],
        expirationDate: null,
        isLoading: false,
        error: err instanceof Error ? err : new Error('Unknown error checking subscription'),
      })
    }
  }, [customerInfo, entitlementId])

  useEffect(() => {
    checkSubscription()
  }, [checkSubscription])

  useEffect(() => {
    const handler = () => {
      try {
        checkSubscription()
      } catch (error) {
        console.error('Failed to refresh subscription status:', error)
      }
    }

    if (typeof window !== 'undefined') {
      window.addEventListener('yoco:subscription-updated', handler)
    }

    return () => {
      if (typeof window !== 'undefined') {
        window.removeEventListener('yoco:subscription-updated', handler)
      }
    }
  }, [checkSubscription])

  return subscriptionStatus;
} 