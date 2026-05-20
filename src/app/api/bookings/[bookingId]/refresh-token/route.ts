import { NextRequest, NextResponse } from 'next/server'
import { getPayload } from 'payload'
import configPromise from '@/payload.config'
import { getMeUser } from '@/utilities/getMeUser'
import { generateShortToken } from '@/utilities/token'

export async function POST(
  _request: NextRequest,
  { params }: { params: Promise<{ bookingId: string }> },
) {
  try {
    const { user } = await getMeUser()

    if (!user) {
      return NextResponse.json({ message: 'Unauthorized' }, { status: 401 })
    }

    const { bookingId } = await params

    if (!bookingId) {
      return NextResponse.json({ message: 'Booking ID not provided' }, { status: 400 })
    }

    const payload = await getPayload({ config: configPromise })

    const bookings = await payload.find({
      collection: 'bookings',
      where: {
        and: [
          { id: { equals: bookingId } },
          { customer: { equals: user.id } },
        ],
      },
      limit: 1,
      pagination: false,
      depth: 0,
    })

    if (bookings.docs.length === 0) {
      return NextResponse.json({ message: 'Booking not found' }, { status: 404 })
    }

    const token = generateShortToken(10)

    await payload.update({
      collection: 'bookings',
      id: bookingId,
      overrideAccess: true,
      data: { token },
    })

    return NextResponse.json({ token })
  } catch (error) {
    console.error('Error refreshing booking token:', error)
    return NextResponse.json({ message: 'Failed to refresh token' }, { status: 500 })
  }
}
