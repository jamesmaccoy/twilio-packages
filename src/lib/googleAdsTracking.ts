/**
 * Google Ads Conversion Tracking Utility
 * Tracks conversions and events for Google Ads retargeting
 * 
 * Tag ID: AW-684914935
 */

/**
 * Track a conversion event for Google Ads
 */
export function trackGoogleAdsConversion(
  conversionLabel: string,
  value?: number,
  currency: string = 'ZAR'
) {
  if (typeof window === 'undefined' || !(window as any).gtag) {
    console.warn('Google Ads gtag not available')
    return
  }

  const params: any = {
    send_to: `AW-684914935/${conversionLabel}`,
  }

  if (value !== undefined) {
    params.value = value
    params.currency = currency
  }

  ;(window as any).gtag('event', 'conversion', params)
  console.log('Google Ads conversion tracked:', conversionLabel, params)
}

/**
 * Track a custom event for Google Ads
 */
export function trackGoogleAdsEvent(
  eventName: string,
  parameters?: Record<string, any>
) {
  if (typeof window === 'undefined' || !(window as any).gtag) {
    console.warn('Google Ads gtag not available')
    return
  }

  ;(window as any).gtag('event', eventName, {
    ...parameters,
    send_to: 'AW-684914935',
  })
  console.log('Google Ads event tracked:', eventName, parameters)
}

/**
 * Track EstimateView event
 */
export function trackEstimateViewGoogleAds(params: {
  estimateId?: string
  estimateValue?: number
  postId?: string
  postTitle?: string
  packageType?: string
}) {
  trackGoogleAdsEvent('estimate_view', {
    estimate_id: params.estimateId,
    value: params.estimateValue,
    currency: 'ZAR',
    post_id: params.postId,
    post_title: params.postTitle,
    package_type: params.packageType,
  })
}

/**
 * Track Purchase/Booking conversion
 */
export function trackBookingConversionGoogleAds(params: {
  bookingId: string
  bookingValue: number
  postId?: string
  postTitle?: string
  packageType?: string
}) {
  // Track as conversion event
  trackGoogleAdsConversion('booking_conversion', params.bookingValue, 'ZAR')
  
  // Also track as custom event with details
  trackGoogleAdsEvent('purchase', {
    transaction_id: params.bookingId,
    value: params.bookingValue,
    currency: 'ZAR',
    items: [
      {
        item_id: params.postId || params.bookingId,
        item_name: params.postTitle,
        item_category: params.packageType,
        price: params.bookingValue,
        quantity: 1,
      },
    ],
  })
}

/**
 * Track Booking Reschedule event
 */
export function trackBookingRescheduleGoogleAds(params: {
  bookingId: string
  bookingValue: number
  postId?: string
  postTitle?: string
  packageType?: string
  oldFromDate?: string
  oldToDate?: string
  newFromDate?: string
  newToDate?: string
}) {
  // Track as custom event for reschedule
  trackGoogleAdsEvent('booking_reschedule', {
    transaction_id: params.bookingId,
    value: params.bookingValue,
    currency: 'ZAR',
    post_id: params.postId,
    post_title: params.postTitle,
    package_type: params.packageType,
    old_from_date: params.oldFromDate,
    old_to_date: params.oldToDate,
    new_from_date: params.newFromDate,
    new_to_date: params.newToDate,
  })
  
  // Also track as conversion event (reschedule is still a valuable action)
  trackGoogleAdsConversion('booking_reschedule', params.bookingValue, 'ZAR')
}

/**
 * Track page view (if needed for specific pages)
 */
export function trackPageViewGoogleAds(pagePath?: string) {
  if (typeof window === 'undefined' || !(window as any).gtag) {
    return
  }

  ;(window as any).gtag('config', 'AW-684914935', {
    page_path: pagePath || window.location.pathname,
  })
}

