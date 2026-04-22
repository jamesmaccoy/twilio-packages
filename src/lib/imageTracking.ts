/**
 * Image View Tracking Utilities
 * Tracks when users view images, especially restricted content for non-subscribers
 * Provides valuable analytics data for Meta Pixel and Google Ads
 */

import { trackEstimateViewGoogleAds } from './googleAdsTracking'

/**
 * Track image view event for Meta Pixel (client-side)
 */
export function trackImageViewMetaPixel(params: {
  postId?: string
  postTitle?: string
  imageId?: string
  isRestricted?: boolean
  userId?: string
  userEmail?: string
}) {
  if (typeof window === 'undefined' || !(window as any).fbq) {
    return
  }

  try {
    // Track ViewContent event for image views
    // This is especially valuable for restricted content views (non-subscribers)
    ;(window as any).fbq('track', 'ViewContent', {
      content_name: params.postTitle || 'Post Image',
      content_category: params.isRestricted ? 'restricted_image' : 'image',
      content_ids: params.postId ? [params.postId] : params.imageId ? [params.imageId] : [],
      content_type: 'image',
      ...(params.isRestricted && { value: 0, currency: 'ZAR' }), // Track restricted views as potential conversions
    })

    console.log('Meta Pixel: Image view tracked', {
      postId: params.postId,
      isRestricted: params.isRestricted,
    })
  } catch (error) {
    console.warn('Meta Pixel image tracking error:', error)
  }
}

/**
 * Track image view event for Google Ads (client-side)
 */
export function trackImageViewGoogleAds(params: {
  postId?: string
  postTitle?: string
  imageId?: string
  isRestricted?: boolean
}) {
  if (typeof window === 'undefined' || !(window as any).gtag) {
    return
  }

  try {
    // Track view_item event for image views
    ;(window as any).gtag('event', 'view_item', {
      currency: 'ZAR',
      value: params.isRestricted ? 0 : undefined, // Track restricted views
      items: [
        {
          item_id: params.postId || params.imageId || 'unknown',
          item_name: params.postTitle || 'Post Image',
          item_category: params.isRestricted ? 'restricted_image' : 'image',
          price: params.isRestricted ? 0 : undefined,
          quantity: 1,
        },
      ],
    })

    // Also track as custom event for restricted content
    if (params.isRestricted) {
      ;(window as any).gtag('event', 'restricted_content_view', {
        content_id: params.postId || params.imageId,
        content_name: params.postTitle,
        content_type: 'image',
      })
    }

    console.log('Google Ads: Image view tracked', {
      postId: params.postId,
      isRestricted: params.isRestricted,
    })
  } catch (error) {
    console.warn('Google Ads image tracking error:', error)
  }
}

/**
 * Track image view (both Meta Pixel and Google Ads)
 * This is called when an image is viewed, especially for restricted content
 */
export function trackImageView(params: {
  postId?: string
  postTitle?: string
  imageId?: string
  isRestricted?: boolean
  userId?: string
  userEmail?: string
}) {
  // Track with Meta Pixel
  trackImageViewMetaPixel(params)

  // Track with Google Ads
  trackImageViewGoogleAds(params)

  // If this is a restricted view, also track as estimate view (potential conversion)
  // This ties into the estimate tracking system mentioned by the user
  if (params.isRestricted && params.postId) {
    trackEstimateViewGoogleAds({
      postId: params.postId,
      postTitle: params.postTitle,
      estimateValue: 0, // No value yet, but tracking interest
    })
  }
}

