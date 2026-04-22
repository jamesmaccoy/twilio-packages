import { NextRequest, NextResponse } from 'next/server'
import { getPayload } from 'payload'
import configPromise from '@/payload.config'

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ bookingId: string }> }
) {
  try {
    const payload = await getPayload({ config: configPromise })
    const { user } = await payload.auth({ headers: request.headers })

    if (!user) {
      return NextResponse.json({ error: 'Authentication required' }, { status: 401 })
    }

    const { bookingId } = await params
    const body = await request.json()
    const { cleaningSchedule, cleaningSource } = body

    if (!cleaningSchedule) {
      return NextResponse.json({ error: 'cleaningSchedule is required' }, { status: 400 })
    }

    // Find the booking
    const booking = await payload.findByID({
      collection: 'bookings',
      id: bookingId,
    })

    if (!booking) {
      return NextResponse.json({ error: 'Booking not found' }, { status: 404 })
    }

    // Check if user is authorized (admin or booking owner)
    const isAdmin = Array.isArray(user.role) ? user.role.includes('admin') : user.role === 'admin'
    const bookingCustomerId = typeof booking.customer === 'string' ? booking.customer : booking.customer?.id
    const isOwner = bookingCustomerId === user.id

    if (!isAdmin && !isOwner) {
      return NextResponse.json({ error: 'Not authorized to update this booking' }, { status: 403 })
    }

    // Update the booking with cleaning schedule
    const updatedBooking = await payload.update({
      collection: 'bookings',
      id: bookingId,
      data: {
        cleaningSchedule,
        cleaningSource: cleaningSource || null,
      },
    })

    return NextResponse.json({ booking: updatedBooking })
  } catch (error) {
    console.error('Error attaching cleaning schedule to booking:', error)
    return NextResponse.json(
      { error: 'Failed to attach cleaning schedule', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    )
  }
}

