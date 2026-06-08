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

export async function POST(request: NextRequest) {
  try {
    const payload = await getPayload({ config: configPromise })

    // Prefer header-based auth (Payload admin uses cookies/headers)
    let user: any = null
    try {
      const authResult = await payload.auth({ headers: request.headers })
      user = authResult.user
    } catch (authError) {
      console.log('Authentication failed:', authError)
    }

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }


    // Parse request body (Payload admin may send multipart/form-data with `_payload`)
    let body: any = {}
    const contentType = request.headers.get('content-type') || ''

    try {
      const clonedRequest = request.clone()

      if (contentType.includes('application/json')) {
        const rawBody = await clonedRequest.text()
        if (rawBody && rawBody.trim()) body = JSON.parse(rawBody)
      } else if (
        contentType.includes('application/x-www-form-urlencoded') ||
        contentType.includes('multipart/form-data')
      ) {
        const formData = await clonedRequest.formData()
        body = {}

        for (const [key, value] of formData.entries()) {
          if (key.includes('[') && key.includes(']')) {
            const match = key.match(/^(\w+)\[(\w+)\]$/)
            if (match && match.length >= 3) {
              const parentKey = match[1]
              const childKey = match[2]
              if (parentKey && childKey) {
                if (!body[parentKey]) body[parentKey] = {}
                body[parentKey][childKey] = value
              }
            } else {
              body[key] = value
            }
          } else {
            body[key] = value
          }
        }
      } else {
        const rawBody = await clonedRequest.text()
        if (rawBody && rawBody.trim()) body = JSON.parse(rawBody)
      }

      if (body._payload && typeof body._payload === 'string') {
        try {
          const payloadData = JSON.parse(body._payload)
          body = { ...body, ...payloadData }
          delete body._payload
        } catch (err) {
          console.warn('Could not parse _payload field:', err)
        }
      }

      if (body.data && typeof body.data === 'object' && !Array.isArray(body.data)) {
        body = { ...body, ...body.data }
        delete body.data
      }

      if (body.fromDate && typeof body.fromDate === 'object' && 'value' in body.fromDate) {
        body.fromDate = body.fromDate.value
      }
      if (body.toDate && typeof body.toDate === 'object' && 'value' in body.toDate) {
        body.toDate = body.toDate.value
      }
    } catch (parseError) {
      console.error('Error parsing request body:', parseError)
      console.error('Content-Type:', contentType)
      console.error('Request URL:', request.url)
      return NextResponse.json(
        {
          error: 'Invalid request body',
          details: parseError instanceof Error ? parseError.message : 'Failed to parse body',
        },
        { status: 400 },
      )
    }

    // Normalize common Payload admin field shapes: { value: ... }
    const normalizeValue = (v: any) => (v && typeof v === 'object' && 'value' in v ? (v as any).value : v)
    body.title = normalizeValue(body.title)
    body.post = normalizeValue(body.post)
    body.customer = normalizeValue(body.customer)
    body.fromDate = normalizeValue(body.fromDate)
    body.toDate = normalizeValue(body.toDate)
    body.total = normalizeValue(body.total)
    body.paymentStatus = normalizeValue(body.paymentStatus)

    if (body.paymentStatus === 'pending') {
      body.paymentStatus = 'unpaid'
    }

    const userRoles = Array.isArray(user.role) ? user.role : user.role ? [user.role] : []
    const isAdminOrHost = userRoles.includes('admin') || userRoles.includes('host')
    const isCustomer = userRoles.includes('customer')

    if (isCustomer && !body.customer) {
      body.customer = user.id
    }

    const isCustomerSelfBooking =
      isCustomer &&
      body.customer === user.id &&
      (!body.paymentStatus || body.paymentStatus === 'unpaid')

    if (!isAdminOrHost && !isCustomerSelfBooking) {
      return NextResponse.json(
        {
          error:
            'Insufficient permissions. Only admins, hosts, or customers booking for themselves can create bookings.',
        },
        { status: 403 },
      )
    }



    const requiredFields = ['title', 'post', 'fromDate', 'total'] as const
    const missing = requiredFields.filter((f) => {
      const v = body[f]
      return v === undefined || v === null || v === ''
    })
    if (missing.length > 0) {
      return NextResponse.json(
        {
          error: 'Missing required fields',
          missing,
          receivedKeys: Object.keys(body),
          received: Object.fromEntries(requiredFields.map((f) => [f, body[f]])),
        },
        { status: 400 },
      )
    }

    // Coerce numeric fields Payload might receive as strings from form-data
    if (typeof body.total === 'string' && body.total.trim() !== '') {
      const parsed = Number(body.total)
      if (!Number.isNaN(parsed)) body.total = parsed
    }

    const created = await payload.create({
      collection: 'bookings',
      data: body,
      user,
    })

    return NextResponse.json(created, { status: 201 })
  } catch (error) {
    console.error('Error creating booking:', error)
    return NextResponse.json(
      {
        error: 'Failed to create booking',
        details: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 },
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
      const role = (user as any).role
      const userRoles = Array.isArray(role) ? role : role ? [role] : []
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

