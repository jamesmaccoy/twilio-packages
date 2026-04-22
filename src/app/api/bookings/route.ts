import { NextRequest, NextResponse } from 'next/server'
import { getPayload } from 'payload'
import configPromise from '@/payload.config'
import { getMeUser } from '@/utilities/getMeUser'
import { Where } from 'payload'

export async function GET(request: NextRequest) {
  try {
    const { user } = await getMeUser()
    
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const searchParams = request.nextUrl.searchParams
    const type = searchParams.get('type') as 'upcoming' | 'past' | null

    const payload = await getPayload({ config: configPromise })

    let whereQuery: Where

    if (type === 'upcoming') {
      whereQuery = {
        and: [
          {
            fromDate: {
              greater_than_equal: new Date(),
            },
          },
          {
            or: [
              {
                customer: {
                  equals: user.id,
                },
              },
              {
                guests: {
                  contains: user.id,
                },
              },
            ],
          },
        ],
      }
    } else if (type === 'past') {
      whereQuery = {
        and: [
          {
            fromDate: {
              less_than: new Date(),
            },
          },
          {
            or: [
              {
                customer: {
                  equals: user.id,
                },
              },
              {
                guests: {
                  contains: user.id,
                },
              },
            ],
          },
        ],
      }
    } else {
      // Get all bookings
      whereQuery = {
        or: [
          {
            customer: {
              equals: user.id,
            },
          },
          {
            guests: {
              contains: user.id,
            },
          },
        ],
      }
    }

    const bookings = await payload.find({
      collection: 'bookings',
      limit: 100,
      where: whereQuery,
      depth: 2, // Include addonTransactions and their details
      sort: '-fromDate',
    })

    return NextResponse.json({ bookings: bookings.docs })
  } catch (error) {
    console.error('Error fetching bookings:', error)
    return NextResponse.json(
      { error: 'Failed to fetch bookings', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    )
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const payload = await getPayload({ config: configPromise })
    
    // Try to get the user from the request
    let user = null
    try {
      const authResult = await payload.auth({ headers: request.headers })
      user = authResult.user
    } catch (authError) {
      console.log('Authentication failed, trying admin context:', authError)
      // If authentication fails, this might be an admin request
    }
    
    // Check if user has permission to delete bookings (admin or host)
    if (user) {
      const userRoles = Array.isArray(user.role) ? user.role : user.role ? [user.role] : []
      if (!userRoles.includes('admin') && !userRoles.includes('host')) {
        return NextResponse.json(
          { error: 'Insufficient permissions. Only admins and hosts can delete bookings.' },
          { status: 403 }
        )
      }
    }
    
    const { searchParams } = new URL(request.url)
    
    // Parse booking IDs from query parameters
    // Payload admin sends them as where[and][0][id][in][0], where[and][0][id][in][1], etc.
    // Or sometimes as where[id][in][0], where[id][in][1], etc.
    const bookingIds: string[] = []
    
    // Try different query parameter formats
    searchParams.forEach((value, key) => {
      // Handle where[and][0][id][in][0] format
      if (key.match(/where\[and\]\[\d+\]\[id\]\[in\]\[\d+\]/)) {
        bookingIds.push(value)
      }
      // Handle where[id][in][0] format
      else if (key.match(/where\[id\]\[in\]\[\d+\]/)) {
        bookingIds.push(value)
      }
      // Handle where[id][in][] format
      else if (key === 'where[id][in][]') {
        bookingIds.push(value)
      }
    })
    
    // Also try getAll for array format
    const arrayIds = searchParams.getAll('where[id][in][]')
    if (arrayIds.length > 0) {
      bookingIds.push(...arrayIds)
    }
    
    // Remove duplicates
    const uniqueIds = [...new Set(bookingIds)]
    
    console.log('DELETE request for bookings:', { ids: uniqueIds, user: user?.id ? '[REDACTED]' : 'admin' })
    
    if (uniqueIds.length === 0) {
      return NextResponse.json(
        { error: 'No booking IDs provided for deletion' },
        { status: 400 }
      )
    }
    
    // Delete bookings one by one
    const deletedBookings = []
    const failedBookings = []
    
    for (const id of uniqueIds) {
      try {
        console.log(`Attempting to delete booking: ${id}`)
        
        // For admin requests, we might not have a user object
        const deleteOptions: any = {
          collection: 'bookings',
          id,
        }
        
        if (user) {
          deleteOptions.user = user
        }
        
        const deletedBooking = await payload.delete(deleteOptions)
        deletedBookings.push(deletedBooking)
        console.log(`Successfully deleted booking: ${id}`)
      } catch (error) {
        console.error(`Error deleting booking ${id}:`, error)
        failedBookings.push({ 
          id, 
          error: error instanceof Error ? error.message : 'Unknown error' 
        })
        // Continue with other deletions even if one fails
      }
    }
    
    const response = {
      message: `Successfully deleted ${deletedBookings.length} booking(s)${failedBookings.length > 0 ? `, ${failedBookings.length} failed` : ''}`,
      deletedBookings,
      failedBookings: failedBookings.length > 0 ? failedBookings : undefined,
    }
    
    console.log('DELETE response:', response)
    return NextResponse.json(response)
  } catch (error) {
    console.error('Error deleting bookings:', error)
    return NextResponse.json(
      { error: 'Failed to delete bookings', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    )
  }
}

