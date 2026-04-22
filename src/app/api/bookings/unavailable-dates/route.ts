import { NextRequest, NextResponse } from 'next/server'
import { getPayload } from 'payload'
import configPromise from '@/payload.config'
import { getMeUser } from '@/utilities/getMeUser'

// This route proxies to Payload's unavailable-dates endpoint
// It's needed because /api/bookings/[bookingId]/route.ts catches all paths under /api/bookings/
export async function GET(request: NextRequest) {
  try {
    const payload = await getPayload({ config: configPromise })
    const { searchParams } = new URL(request.url)
    
    // Extract query parameters
    const slug = searchParams.get('slug')
    const postId = searchParams.get('postId')

    if (!slug && !postId) {
      return NextResponse.json({ message: 'Post slug or ID is required' }, { status: 400 })
    }

    // Get user for authentication (endpoint requires auth)
    const { user } = await getMeUser()
    
    if (!user) {
      return NextResponse.json({ message: 'Unauthorized' }, { status: 401 })
    }

    // Import and use the Payload endpoint handler
    const { unavailableDates } = await import('@/collections/Bookings/endpoints/unavailable-dates')
    
    // Create a request object that matches Payload's endpoint handler signature
    const mockReq = {
      query: {
        slug: slug || undefined,
        postId: postId || undefined,
      },
      payload,
      user: user || undefined,
    } as any

    // Call the Payload endpoint handler
    const response = await unavailableDates.handler(mockReq)
    return response
  } catch (error) {
    console.error('Error fetching unavailable dates:', error)
    return NextResponse.json({ message: 'Error fetching unavailable dates' }, { status: 500 })
  }
}

