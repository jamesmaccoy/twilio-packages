'use client'

import { useEffect } from 'react'
import { useSearchParams } from 'next/navigation'
import { trackBookingConversionGoogleAds, trackBookingRescheduleGoogleAds } from '@/lib/googleAdsTracking'

/**
 * Client-side Google Ads tracking component
 * Tracks conversions and events that need to happen in the browser
 * Must be wrapped in Suspense boundary
 */
export function GoogleAdsTracking() {
  const searchParams = useSearchParams()

  useEffect(() => {
    // Check for booking confirmation parameters
    const success = searchParams.get('success')
    const estimateId = searchParams.get('estimateId')
    const bookingId = searchParams.get('bookingId')
    const total = searchParams.get('total')
    const postId = searchParams.get('postId')
    const postTitle = searchParams.get('postTitle')
    const packageType = searchParams.get('packageType')
    const isReschedule = searchParams.get('isReschedule') === 'true'
    const oldFromDate = searchParams.get('oldFromDate')
    const oldToDate = searchParams.get('oldToDate')
    const newFromDate = searchParams.get('newFromDate')
    const newToDate = searchParams.get('newToDate')

    // Track reschedule if this is a rescheduled booking
    if (success === 'true' && isReschedule && (estimateId || bookingId) && total) {
      const bookingValue = parseFloat(total) || 0
      trackBookingRescheduleGoogleAds({
        bookingId: bookingId || estimateId || '',
        bookingValue,
        postId: postId || undefined,
        postTitle: postTitle || undefined,
        packageType: packageType || undefined,
        oldFromDate: oldFromDate || undefined,
        oldToDate: oldToDate || undefined,
        newFromDate: newFromDate || undefined,
        newToDate: newToDate || undefined,
      })
    }
    // Track regular booking conversion if this is a successful booking (not a reschedule)
    else if (success === 'true' && !isReschedule && estimateId && total) {
      const bookingValue = parseFloat(total) || 0
      trackBookingConversionGoogleAds({
        bookingId: estimateId,
        bookingValue,
        postId: postId || undefined,
        postTitle: postTitle || undefined,
        packageType: packageType || undefined,
      })
    }
  }, [searchParams])

  return null // This component doesn't render anything
}

/**
 * Hook to track estimate view (call from client components)
 */
export function useEstimateTracking() {
  const trackEstimate = (params: {
    estimateId?: string
    estimateValue?: number
    postId?: string
    postTitle?: string
    packageType?: string
  }) => {
    trackEstimateViewGoogleAds(params)
  }

  return { trackEstimate }
}

