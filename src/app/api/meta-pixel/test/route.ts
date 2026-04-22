import { NextResponse } from 'next/server'
import { sendMetaEvent } from '@/lib/metaConversions'

/**
 * Test endpoint to verify Meta Pixel configuration
 * Visit /api/meta-pixel/test to check your setup
 * 
 * Add ?test=true to send a test event to Meta
 */
export async function GET(request: Request) {
  const pixelId = process.env.NEXT_PUBLIC_META_PIXEL_ID || '1102454273276257'
  const accessToken = process.env.META_ACCESS_TOKEN
  
  const url = new URL(request.url)
  const testEvent = url.searchParams.get('test') === 'true'

  const config = {
    pixelId: pixelId || 'NOT SET',
    accessToken: accessToken ? 'SET (hidden)' : 'NOT SET',
    pixelConfigured: !!pixelId,
    conversionsApiConfigured: !!accessToken,
    recommendations: [] as string[],
  }

  if (!pixelId) {
    config.recommendations.push('Set NEXT_PUBLIC_META_PIXEL_ID in your environment variables')
  }

  if (!accessToken) {
    config.recommendations.push('Set META_ACCESS_TOKEN in your environment variables to enable Conversions API')
    config.recommendations.push('Get your access token from: https://business.facebook.com/events_manager2')
  }

  if (pixelId && !accessToken) {
    config.recommendations.push('Client-side pixel will work, but server-side Conversions API events will not be sent')
  }

  let testResult = null
  if (testEvent && accessToken) {
    try {
      // Send a test event
      await sendMetaEvent({
        eventName: 'PageView',
        eventSourceUrl: request.url,
        actionSource: 'website',
        customData: {
          contentName: 'Test Event from API',
        },
      })
      testResult = {
        success: true,
        message: 'Test event sent successfully! Check Meta Events Manager → Test Events tab to verify.',
      }
    } catch (error) {
      testResult = {
        success: false,
        message: 'Failed to send test event',
        error: error instanceof Error ? error.message : String(error),
      }
    }
  }

  return NextResponse.json({
    status: 'ok',
    config,
    testResult,
    instructions: {
      pixelSetup: 'The pixel should be visible in your browser console. Check for "Meta Pixel initialized" message.',
      testPixel: 'Install Facebook Pixel Helper browser extension to verify pixel is firing',
      conversionsApi: 'Check server logs for "Meta event sent successfully" messages when events are triggered',
      testEvent: 'Add ?test=true to this URL to send a test event to Meta Conversions API',
      verifyEvents: 'Go to Meta Events Manager → Test Events tab to see events in real-time',
      audienceTracking: {
        howToVerify: 'To verify your audience is populating:',
        steps: [
          '1. Visit an estimate page: https://www.simpleplek.co.za/estimate/[estimateId]',
          '2. Open browser console and look for "Meta Pixel PageView tracked for estimate page" message',
          '3. Check Meta Events Manager → Test Events tab - you should see PageView events',
          '4. Wait 24-48 hours for audience to populate (Meta needs time to process)',
          '5. Go to Meta Ads Manager → Audiences → Check your audience size',
          '6. Your audience rule: "URL contains estimate" should match estimate pages',
        ],
        audienceUrl: 'https://adsmanager.facebook.com/adsmanager/audiences?act=10150271799221351',
        expectedBehavior: 'PageView events on /estimate/* pages should automatically include the URL, which Meta uses to match your audience rule.',
      },
    },
  })
}

