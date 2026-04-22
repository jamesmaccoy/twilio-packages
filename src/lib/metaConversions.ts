/**
 * Meta Conversions API utility
 * Sends server-side events to Meta (Facebook) Conversions API
 * 
 * Environment variables required:
 * - META_PIXEL_ID: Your Meta Pixel ID
 * - META_ACCESS_TOKEN: Your Meta Conversions API access token
 * 
 * Documentation: https://developers.facebook.com/docs/marketing-api/conversions-api
 */

import { createHash } from 'crypto'

interface MetaEventData {
  eventName: string
  eventTime?: number
  eventId?: string
  userData?: {
    email?: string
    phone?: string
    firstName?: string
    lastName?: string
    externalId?: string
    clientIpAddress?: string
    clientUserAgent?: string
  }
  customData?: {
    value?: number
    currency?: string
    contentName?: string
    contentCategory?: string
    contentIds?: string[]
    contents?: Array<{
      id: string
      quantity?: number
      itemPrice?: number
    }>
    numItems?: number
    orderId?: string
  }
  eventSourceUrl?: string
  actionSource?: 'website' | 'email' | 'app' | 'phone_call' | 'chat' | 'physical_store' | 'system_generated' | 'other'
}

/**
 * Send an event to Meta Conversions API
 */
export async function sendMetaEvent(data: MetaEventData): Promise<void> {
  const pixelId = process.env.META_PIXEL_ID || process.env.NEXT_PUBLIC_META_PIXEL_ID
  const accessToken = process.env.META_ACCESS_TOKEN

  // Skip if not configured
  if (!pixelId) {
    console.warn('Meta Conversions API: Missing META_PIXEL_ID or NEXT_PUBLIC_META_PIXEL_ID')
    return
  }

  if (!accessToken) {
    console.warn('Meta Conversions API: Missing META_ACCESS_TOKEN. Events will not be sent server-side.')
    console.warn('To enable Conversions API, add META_ACCESS_TOKEN to your environment variables.')
    return
  }

  const eventTime = data.eventTime || Math.floor(Date.now() / 1000)
  const eventId = data.eventId || `${eventTime}-${Math.random().toString(36).substring(2, 15)}`

  const payload = {
    data: [
      {
        event_name: data.eventName,
        event_time: eventTime,
        event_id: eventId,
        event_source_url: data.eventSourceUrl,
        action_source: data.actionSource || 'website',
        user_data: data.userData
          ? {
            ...(data.userData.email && { em: hashData(data.userData.email) }),
            ...(data.userData.phone && { ph: hashData(data.userData.phone) }),
            ...(data.userData.firstName && { fn: hashData(data.userData.firstName) }),
            ...(data.userData.lastName && { ln: hashData(data.userData.lastName) }),
            ...(data.userData.externalId && { external_id: hashData(data.userData.externalId) }),
            ...(data.userData.clientIpAddress && { client_ip_address: data.userData.clientIpAddress }),
            ...(data.userData.clientUserAgent && { client_user_agent: data.userData.clientUserAgent }),
          }
          : undefined,
        custom_data: data.customData
          ? {
            ...(data.customData.value !== undefined && { value: data.customData.value }),
            ...(data.customData.currency && { currency: data.customData.currency }),
            ...(data.customData.contentName && { content_name: data.customData.contentName }),
            ...(data.customData.contentCategory && { content_category: data.customData.contentCategory }),
            ...(data.customData.contentIds && { content_ids: data.customData.contentIds }),
            ...(data.customData.contents && { contents: data.customData.contents }),
            ...(data.customData.numItems !== undefined && { num_items: data.customData.numItems }),
            ...(data.customData.orderId && { order_id: data.customData.orderId }),
          }
          : undefined,
      },
    ],
    access_token: accessToken,
  }

  try {
    const response = await fetch(`https://graph.facebook.com/v21.0/${pixelId}/events`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload),
    })

    if (!response.ok) {
      const errorText = await response.text()
      console.error('Meta Conversions API error:', {
        status: response.status,
        statusText: response.statusText,
        error: errorText,
      })
      return
    }

    const result = await response.json()
    if (result.errors && result.errors.length > 0) {
      console.error('Meta Conversions API errors:', {
        eventName: data.eventName,
        errors: result.errors,
        pixelId,
      })
    } else {
      console.log('Meta event sent successfully:', {
        eventName: data.eventName,
        eventId,
        eventsReceived: result.events_received,
      })
    }
  } catch (error) {
    console.error('Failed to send Meta event:', error)
    // Don't throw - we don't want tracking failures to break the app
  }
}

/**
 * Hash data using SHA-256 (required by Meta for PII)
 */
function hashData(data: string): string {
  // Meta requires PII data to be hashed with SHA-256
  // We normalize the data first (lowercase, trim whitespace)
  const normalized = data.toLowerCase().trim()

  // Use Node.js crypto module for SHA-256 hashing
  try {
    return createHash('sha256').update(normalized).digest('hex')
  } catch (error) {
    console.warn('Failed to hash data with crypto:', error)
    // Fallback: return normalized data (Meta will hash server-side if needed)
    return normalized
  }
}

/**
 * Helper: Track EstimateView event
 */
export async function trackEstimateView(params: {
  estimateId?: string
  estimateValue?: number
  postId?: string
  postTitle?: string
  packageType?: string
  userId?: string
  userEmail?: string
  clientIp?: string
  userAgent?: string
  eventSourceUrl?: string
}): Promise<void> {
  await sendMetaEvent({
    eventName: 'EstimateView',
    userData: {
      ...(params.userId && { externalId: params.userId }),
      ...(params.userEmail && { email: params.userEmail }),
      ...(params.clientIp && { clientIpAddress: params.clientIp }),
      ...(params.userAgent && { clientUserAgent: params.userAgent }),
    },
    customData: {
      ...(params.estimateValue !== undefined && {
        value: params.estimateValue,
        currency: 'ZAR',
      }),
      ...(params.postId && { contentIds: [params.postId] }),
      ...(params.postTitle && { contentName: params.postTitle }),
      ...(params.packageType && { contentCategory: params.packageType }),
      ...(params.estimateId && { orderId: params.estimateId }),
    },
    eventSourceUrl: params.eventSourceUrl,
    actionSource: 'website',
  })
}

/**
 * Helper: Track ImageView event (especially for restricted content)
 * This ties into estimate tracking - when non-subscribers view images, it's valuable conversion data
 */
export async function trackImageView(params: {
  postId?: string
  postTitle?: string
  imageId?: string
  isRestricted?: boolean
  userId?: string
  userEmail?: string
  clientIp?: string
  userAgent?: string
  eventSourceUrl?: string
}): Promise<void> {
  await sendMetaEvent({
    eventName: 'ViewContent',
    userData: {
      ...(params.userId && { externalId: params.userId }),
      ...(params.userEmail && { email: params.userEmail }),
      ...(params.clientIp && { clientIpAddress: params.clientIp }),
      ...(params.userAgent && { clientUserAgent: params.userAgent }),
    },
    customData: {
      ...(params.postId && { contentIds: [params.postId] }),
      ...(params.postTitle && { contentName: params.postTitle }),
      contentCategory: params.isRestricted ? 'restricted_image' : 'image',
      // Track restricted views as potential conversions (value 0 indicates interest without purchase)
      ...(params.isRestricted && { value: 0, currency: 'ZAR' }),
    },
    eventSourceUrl: params.eventSourceUrl,
    actionSource: 'website',
  })
}

/**
 * Helper: Track EstimateCreated event — fired server-side when a user submits a new estimate.
 * This adds the user to a Facebook Custom Audience for "estimate requesters".
 */
export async function trackEstimateCreated(params: {
  estimateId?: string
  estimateValue?: number
  postId?: string
  postTitle?: string
  packageType?: string
  userId?: string
  userEmail?: string
  clientIp?: string
  userAgent?: string
  eventSourceUrl?: string
}): Promise<void> {
  await sendMetaEvent({
    eventName: 'EstimateCreated',
    userData: {
      ...(params.userId && { externalId: params.userId }),
      ...(params.userEmail && { email: params.userEmail }),
      ...(params.clientIp && { clientIpAddress: params.clientIp }),
      ...(params.userAgent && { clientUserAgent: params.userAgent }),
    },
    customData: {
      ...(params.estimateValue !== undefined && {
        value: params.estimateValue,
        currency: 'ZAR',
      }),
      ...(params.postId && { contentIds: [params.postId] }),
      ...(params.postTitle && { contentName: params.postTitle }),
      ...(params.packageType && { contentCategory: params.packageType }),
      ...(params.estimateId && { orderId: params.estimateId }),
    },
    eventSourceUrl: params.eventSourceUrl,
    actionSource: 'website',
  })
}

/**
 * Helper: Track GuestJoined event — fired server-side when a guest accepts an invite
 * to an estimate or booking. Adds the guest to the same Facebook Custom Audience.
 */
export async function trackGuestJoined(params: {
  resourceId?: string
  resourceType?: 'estimate' | 'booking'
  userId?: string
  userEmail?: string
  clientIp?: string
  userAgent?: string
  eventSourceUrl?: string
}): Promise<void> {
  await sendMetaEvent({
    eventName: 'GuestJoined',
    userData: {
      ...(params.userId && { externalId: params.userId }),
      ...(params.userEmail && { email: params.userEmail }),
      ...(params.clientIp && { clientIpAddress: params.clientIp }),
      ...(params.userAgent && { clientUserAgent: params.userAgent }),
    },
    customData: {
      ...(params.resourceId && { orderId: params.resourceId }),
      ...(params.resourceType && { contentCategory: params.resourceType }),
      contentName: 'Guest Invite Accepted',
    },
    eventSourceUrl: params.eventSourceUrl,
    actionSource: 'website',
  })
}

/**
 * Helper: Track Purchase/Booking conversion event
 */
export async function trackBookingConversion(params: {
  bookingId: string
  bookingValue: number
  postId?: string
  postTitle?: string
  packageType?: string
  userId?: string
  userEmail?: string
  clientIp?: string
  userAgent?: string
  eventSourceUrl?: string
}): Promise<void> {
  await sendMetaEvent({
    eventName: 'Purchase',
    userData: {
      ...(params.userId && { externalId: params.userId }),
      ...(params.userEmail && { email: params.userEmail }),
      ...(params.clientIp && { clientIpAddress: params.clientIp }),
      ...(params.userAgent && { clientUserAgent: params.userAgent }),
    },
    customData: {
      value: params.bookingValue,
      currency: 'ZAR',
      ...(params.postId && { contentIds: [params.postId] }),
      ...(params.postTitle && { contentName: params.postTitle }),
      ...(params.packageType && { contentCategory: params.packageType }),
      orderId: params.bookingId,
      numItems: 1,
      contents: [
        {
          id: params.postId || params.bookingId,
          quantity: 1,
          itemPrice: params.bookingValue,
        },
      ],
    },
    eventSourceUrl: params.eventSourceUrl,
    actionSource: 'website',
  })
}

