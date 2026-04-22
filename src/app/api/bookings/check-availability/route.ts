import { NextRequest, NextResponse } from 'next/server'
import { getPayload } from 'payload'
import configPromise from '@/payload.config'
import { getMeUser } from '@/utilities/getMeUser'

// This route proxies to Payload's check-availability endpoint
// It's needed because /api/bookings/[bookingId]/route.ts catches all paths under /api/bookings/
export async function GET(request: NextRequest) {
  try {
    const payload = await getPayload({ config: configPromise })
    const { searchParams } = new URL(request.url)
    
    // Extract query parameters
    const slug = searchParams.get('slug')
    const postId = searchParams.get('postId')
    const startDate = searchParams.get('startDate')
    const endDate = searchParams.get('endDate')
    const bookingId = searchParams.get('bookingId')
    const packageId = searchParams.get('packageId')

    if ((!slug && !postId) || !startDate || !endDate) {
      return NextResponse.json(
        {
          message: 'Post slug/ID and date range (startDate, endDate) are required',
        },
        { status: 400 },
      )
    }

    // Get user if available (for auth context, though endpoint doesn't require it)
    const { user } = await getMeUser()

    // Import and use the Payload endpoint handler
    const { checkAvailability } = await import('@/collections/Bookings/endpoints/check-availability')
    
    // Create a request object that matches Payload's endpoint handler signature
    const mockReq = {
      query: {
        slug: slug || undefined,
        postId: postId || undefined,
        startDate: startDate || undefined,
        endDate: endDate || undefined,
        bookingId: bookingId || undefined,
        packageId: packageId || undefined,
      },
      payload,
      user: user || undefined,
    } as any

    // Call the Payload endpoint handler
    const response = await checkAvailability.handler(mockReq)
    return response
  } catch (error) {
    console.error('Error checking availability:', error)
    return NextResponse.json({ message: 'Error checking availability' }, { status: 500 })
  }
}

