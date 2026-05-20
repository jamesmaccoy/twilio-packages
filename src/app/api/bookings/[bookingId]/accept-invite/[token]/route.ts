import { NextRequest, NextResponse } from 'next/server'
import { getPayload } from 'payload'
import configPromise from '@/payload.config'
import { getMeUser } from '@/utilities/getMeUser'
import { trackGuestJoined } from '@/lib/metaConversions'

export async function POST(
  _request: NextRequest,
  { params }: { params: Promise<{ bookingId: string; token: string }> },
) {
  try {
    const { user } = await getMeUser()

    if (!user) {
      return NextResponse.json({ message: 'Unauthorized' }, { status: 401 })
    }

    const { bookingId, token } = await params

    if (!bookingId) {
      return NextResponse.json({ message: 'Booking ID not provided' }, { status: 400 })
    }

    if (!token) {
      return NextResponse.json({ message: 'Token not provided' }, { status: 400 })
    }

    const payload = await getPayload({ config: configPromise })

    const bookings = await payload.find({
      collection: 'bookings',
      where: {
        and: [{ id: { equals: bookingId } }, { token: { equals: token } }],
      },
      limit: 1,
      pagination: false,
      depth: 0,
    })

    if (bookings.docs.length === 0) {
      return NextResponse.json({ message: 'Booking not found' }, { status: 404 })
    }

    const booking = bookings.docs[0]
    if (!booking) {
      return NextResponse.json({ message: 'Booking not found' }, { status: 404 })
    }

    const alreadyGuest = booking.guests?.some((guest) =>
      typeof guest === 'string' ? guest === user.id : guest?.id === user.id,
    )
    const isCustomer =
      typeof booking.customer === 'string' ? booking.customer === user.id : booking.customer?.id === user.id

    if (alreadyGuest || isCustomer) {
      return NextResponse.json({ message: 'User already in booking' })
    }

    await payload.update({
      collection: 'bookings',
      id: bookingId,
      data: {
        guests: [...(booking.guests || []), user.id],
      },
    })

    try {
      await trackGuestJoined({
        resourceId: bookingId,
        resourceType: 'booking',
        userId: user.id,
        userEmail: (user as any).email || undefined,
      })
    } catch {}

    return NextResponse.json({ message: 'Booking updated' })
  } catch (error) {
    console.error('Error accepting booking invite:', error)
    return NextResponse.json({ message: 'Failed to accept invite' }, { status: 500 })
  }
}

