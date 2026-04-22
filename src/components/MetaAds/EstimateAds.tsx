'use client'

import { useEffect } from 'react'
import Script from 'next/script'

interface EstimateAdsProps {
  estimate?: {
    id: string
    total?: number
    title?: string
    post?: {
      id?: string
      title?: string
      slug?: string
      meta?: {
        image?: {
          url?: string
        }
      }
    } | string
    packageType?: string
  } | null
}

/**
 * Meta Ads Component for Estimates
 * Tracks estimate views for Meta Dynamic Product Ads
 * 
 * This component:
 * 1. Tracks ViewContent event for the estimate
 * 2. Enables Meta Pixel to show Dynamic Product Ads based on estimate data
 */
export function EstimateAds({ estimate }: EstimateAdsProps) {
  useEffect(() => {
    if (!estimate || typeof window === 'undefined') {
      return
    }

    // Wait for Meta Pixel to be initialized (from cookie consent)
    const checkPixel = setInterval(() => {
      if ((window as any).fbq) {
        clearInterval(checkPixel)
        trackEstimateView(estimate)
      }
    }, 100)

    // Cleanup after 5 seconds if pixel doesn't load
    setTimeout(() => {
      clearInterval(checkPixel)
    }, 5000)

    return () => {
      clearInterval(checkPixel)
    }
  }, [estimate])

  return null
}

function trackEstimateView(estimate: EstimateAdsProps['estimate']) {
  if (!estimate || typeof window === 'undefined' || !(window as any).fbq) {
    return
  }

  const post = typeof estimate.post === 'object' ? estimate.post : null
  const postId = typeof estimate.post === 'string' ? estimate.post : post?.id
  const postTitle = post?.title || estimate.title || 'Property'
  const estimateId = estimate.id

  // Track ViewContent event - this enables Dynamic Product Ads
  ;(window as any).fbq('track', 'ViewContent', {
    content_name: postTitle,
    content_ids: [postId || estimateId],
    content_type: 'product',
    value: estimate.total || 0,
    currency: 'ZAR',
    content_category: estimate.packageType || 'standard',
  })

  console.log('Meta Pixel ViewContent tracked for estimate:', {
    estimateId,
    postTitle,
    value: estimate.total,
  })
}

