import { NextRequest, NextResponse } from 'next/server'
import { sendMetaEvent } from '@/lib/metaConversions'

/**
 * Proxy endpoint for Meta Pixel events
 * Meta Pixel may try to POST to /events/[hash] when using custom domain
 * This endpoint proxies those requests to Meta's Conversions API
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ path: string[] }> }
) {
  try {
    const { path } = await params
    const pathString = path.join('/')
    
    // Get origin to handle CORS properly for both www and non-www
    const origin = request.headers.get('origin') || request.headers.get('referer') || '*'
    const allowedOrigins = [
      'https://www.simpleplek.co.za',
      'https://simpleplek.co.za',
      'http://localhost:3000',
      'http://localhost:3001',
    ]
    const corsOrigin = allowedOrigins.includes(origin) ? origin : '*'
    
    // Get request body
    let body: any = {}
    try {
      body = await request.json()
    } catch {
      // If body parsing fails, try to get it as text
      const text = await request.text()
      if (text) {
        try {
          body = JSON.parse(text)
        } catch {
          // Ignore parsing errors
        }
      }
    }

    // Extract event data from Meta Pixel request
    // Meta Pixel sends events in a specific format
    const events = body.events || body.data || [body]
    
    // Process each event and send to Meta Conversions API
    const results = await Promise.all(
      events.map(async (event: any) => {
        try {
          // Map Meta Pixel event format to our API format
          const eventName = event.eventName || event.name || 'PageView'
          const eventData = event.eventData || event.data || {}
          
          await sendMetaEvent({
            eventName,
            eventId: event.eventID || event.event_id,
            eventTime: event.eventTime || event.timestamp,
            userData: {
              ...(eventData.email && { email: eventData.email }),
              ...(eventData.phone && { phone: eventData.phone }),
              ...(eventData.firstName && { firstName: eventData.firstName }),
              ...(eventData.lastName && { lastName: eventData.lastName }),
              ...(eventData.externalId && { externalId: eventData.externalId }),
              clientIpAddress: request.headers.get('x-forwarded-for')?.split(',')[0] || 
                               request.headers.get('x-real-ip') || 
                               undefined,
              clientUserAgent: request.headers.get('user-agent') || undefined,
            },
            customData: {
              ...(eventData.value && { value: eventData.value }),
              ...(eventData.currency && { currency: eventData.currency }),
              ...(eventData.contentName && { contentName: eventData.contentName }),
              ...(eventData.contentCategory && { contentCategory: eventData.contentCategory }),
              ...(eventData.contentIds && { contentIds: eventData.contentIds }),
            },
            eventSourceUrl: request.headers.get('referer') || request.url,
            actionSource: 'website',
          })
          
          return { success: true }
        } catch (error) {
          console.error('Error processing Meta Pixel event:', error)
          return { success: false, error: error instanceof Error ? error.message : 'Unknown error' }
        }
      })
    )

    // Return success response with CORS headers
    return NextResponse.json(
      { 
        success: true, 
        eventsReceived: results.filter(r => r.success).length,
        eventsProcessed: results.length 
      },
      {
        status: 200,
        headers: {
          'Access-Control-Allow-Origin': corsOrigin,
          'Access-Control-Allow-Methods': 'POST, OPTIONS',
          'Access-Control-Allow-Headers': 'Content-Type',
          'Access-Control-Allow-Credentials': 'true',
          'Access-Control-Max-Age': '86400',
        },
      }
    )
  } catch (error) {
    console.error('Error in /events endpoint:', error)
    
    // Get origin for CORS
    const origin = request.headers.get('origin') || request.headers.get('referer') || '*'
    const allowedOrigins = [
      'https://www.simpleplek.co.za',
      'https://simpleplek.co.za',
      'http://localhost:3000',
      'http://localhost:3001',
    ]
    const corsOrigin = allowedOrigins.includes(origin) ? origin : '*'
    
    // Return error response with CORS headers
    return NextResponse.json(
      { 
        success: false, 
        error: error instanceof Error ? error.message : 'Unknown error' 
      },
      {
        status: 200, // Return 200 to prevent Meta Pixel from retrying
        headers: {
          'Access-Control-Allow-Origin': corsOrigin,
          'Access-Control-Allow-Methods': 'POST, OPTIONS',
          'Access-Control-Allow-Headers': 'Content-Type',
          'Access-Control-Allow-Credentials': 'true',
        },
      }
    )
  }
}

/**
 * Handle OPTIONS request for CORS preflight
 */
export async function OPTIONS(request: NextRequest) {
  const origin = request.headers.get('origin') || '*'
  const allowedOrigins = [
    'https://www.simpleplek.co.za',
    'https://simpleplek.co.za',
    'http://localhost:3000',
    'http://localhost:3001',
  ]
  const corsOrigin = allowedOrigins.includes(origin) ? origin : '*'
  
  return NextResponse.json(
    {},
    {
      status: 200,
      headers: {
        'Access-Control-Allow-Origin': corsOrigin,
        'Access-Control-Allow-Methods': 'POST, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type',
        'Access-Control-Allow-Credentials': 'true',
        'Access-Control-Max-Age': '86400',
      },
    }
  )
}

