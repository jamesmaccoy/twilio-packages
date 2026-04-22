import { NextRequest, NextResponse } from 'next/server'
import { getPayload } from 'payload'
import configPromise from '@/payload.config'
import { getMeUser } from '@/utilities/getMeUser'

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ bookingId: string }> }
) {
  try {
    const { bookingId } = await params
    
    // Redirect calendar.ics requests to the new route
    if (bookingId === 'calendar.ics') {
      const url = new URL(request.url)
      const searchParams = url.searchParams.toString()
      return NextResponse.redirect(
        new URL(`/api/bookings-calendar.ics${searchParams ? `?${searchParams}` : ''}`, request.url),
        301
      )
    }
    
    const payload = await getPayload({ config: configPromise })
    
    // Get depth from query params, default to 0
    const searchParams = new URL(request.url).searchParams
    const depth = parseInt(searchParams.get('depth') || '0', 10)
    
    // Fetch the booking
    const booking = await payload.findByID({
      collection: 'bookings',
      id: bookingId,
      depth: depth,
    })
    
    if (!booking) {
      return NextResponse.json({ error: 'Booking not found' }, { status: 404 })
    }
    
    return NextResponse.json(booking)
  } catch (error) {
    console.error('Error fetching booking:', error)
    return NextResponse.json(
      { error: 'Failed to fetch booking', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    )
  }
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ bookingId: string }> }
) {
  try {
    const { user } = await getMeUser()
    
    if (!user) {
      return NextResponse.json({ error: 'Authentication required' }, { status: 401 })
    }

    const { bookingId } = await params
    
    // Parse request body with better error handling
    let body: any = {}
    const contentType = request.headers.get('content-type') || ''
    
    try {
      // Clone request to read body without consuming the stream
      const clonedRequest = request.clone()
      
      if (contentType.includes('application/json')) {
        const rawBody = await clonedRequest.text()
        if (rawBody && rawBody.trim()) {
          body = JSON.parse(rawBody)
        }
      } else if (contentType.includes('application/x-www-form-urlencoded') || contentType.includes('multipart/form-data')) {
        const formData = await clonedRequest.formData()
        body = {} as any
        
        // Convert FormData to regular object, handling nested fields
        for (const [key, value] of formData.entries()) {
          if (key.includes('[') && key.includes(']')) {
            // Handle nested form fields like "fromDate[value]" or "fromDate"
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
        // Try JSON as fallback
        const rawBody = await clonedRequest.text()
        if (rawBody && rawBody.trim()) {
          body = JSON.parse(rawBody)
        }
      }
      
      // Handle Payload admin format - data might be in _payload field or nested in data
      if (body._payload && typeof body._payload === 'string') {
        try {
          const payloadData = JSON.parse(body._payload)
          body = { ...body, ...payloadData }
          delete body._payload
        } catch (err) {
          console.warn('Could not parse _payload field:', err)
        }
      }
      
      // Handle nested data field (common in Payload admin requests)
      if (body.data && typeof body.data === 'object' && !Array.isArray(body.data)) {
        body = { ...body, ...body.data }
        delete body.data
      }
      
      // Handle Payload date field format (fromDate: { value: "2024-12-19T10:00:00.000Z" })
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
        { error: 'Invalid request body', details: parseError instanceof Error ? parseError.message : 'Failed to parse body' },
        { status: 400 }
      )
    }
    
    const { fromDate, toDate } = body
    
    console.log('PATCH booking request:', {
      bookingId,
      fromDate,
      toDate,
      bodyKeys: Object.keys(body),
    })

    if (!fromDate) {
      return NextResponse.json({ error: 'fromDate is required' }, { status: 400 })
    }

    const payload = await getPayload({ config: configPromise })

    // Find the booking
    const booking = await payload.findByID({
      collection: 'bookings',
      id: bookingId,
      depth: 0,
    })

    if (!booking) {
      return NextResponse.json({ error: 'Booking not found' }, { status: 404 })
    }

    // Check if user is authorized (admin, host, booking owner, or guest)
    const role = user.role
    const roleArray = Array.isArray(role) ? role : role ? [role] : []
    const isAdmin = roleArray.includes('admin')
    const isHost = roleArray.includes('host')
    const isAdminOrHost = isAdmin || isHost
    
    const bookingCustomerId = typeof booking.customer === 'string' ? booking.customer : booking.customer?.id
    const isOwner = bookingCustomerId === user.id

    // Also check if user is a guest
    const isGuest = booking.guests?.some(
      (guest) => (typeof guest === 'string' ? guest : guest?.id) === user.id
    )

    if (!isAdminOrHost && !isOwner && !isGuest) {
      return NextResponse.json({ error: 'Not authorized to update this booking' }, { status: 403 })
    }

    // Build update data object
    const updateData: any = {}

    // Only admin/host can update customer field
    if (body.customer !== undefined) {
      if (!isAdminOrHost) {
        return NextResponse.json({ 
          error: 'Only administrators and hosts can change the customer on a booking' 
        }, { status: 403 })
      }
      updateData.customer = body.customer
    }

    // Validate and update dates (allowed for admin/host/owner/guest)
    if (fromDate !== undefined) {
      updateData.fromDate = fromDate
    }
    
    if (toDate !== undefined) {
      updateData.toDate = toDate || null
    }

    // Validate date range if both dates are provided
    if (updateData.fromDate && updateData.toDate && updateData.fromDate >= updateData.toDate) {
      return NextResponse.json({ error: 'Start date must be before end date' }, { status: 400 })
    }

    // If no valid updates, return error
    if (Object.keys(updateData).length === 0) {
      return NextResponse.json({ error: 'No valid fields to update' }, { status: 400 })
    }

    const updatedBooking = await payload.update({
      collection: 'bookings',
      id: bookingId,
      data: updateData,
    })

    return NextResponse.json({ booking: updatedBooking })
  } catch (error) {
    console.error('Error updating booking dates:', error)
    return NextResponse.json(
      { error: 'Failed to update booking dates', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    )
  }
}

