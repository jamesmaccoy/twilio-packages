import { NextRequest, NextResponse } from 'next/server'
import { getPayload } from 'payload'
import configPromise from '@payload-config'

export async function GET(request: NextRequest) {
  try {
    const payload = await getPayload({ config: configPromise })
    const { user } = await payload.auth({ headers: request.headers })

    if (!user) {
      return NextResponse.json({ error: 'Authentication required' }, { status: 401 })
    }

    const limit = Number(request.nextUrl.searchParams.get('limit') || 25)

    const transactions = await payload.find({
      collection: 'yoco-transactions',
      where: {
        user: {
          equals: user.id,
        },
      },
      sort: '-createdAt',
      limit,
      depth: 2, // Include relationships
    })

    // For each transaction, find bookings that reference it as an addon
    const transactionsWithBookings = await Promise.all(
      transactions.docs.map(async (transaction) => {
        // Find bookings that have this transaction in their addonTransactions
        const bookingsWithThisAddon = await payload.find({
          collection: 'bookings',
          where: {
            addonTransactions: {
              contains: transaction.id,
            },
          },
          limit: 10,
          depth: 1,
        })

        return {
          ...transaction,
          linkedBookings: bookingsWithThisAddon.docs.map((booking) => ({
            id: booking.id,
            title: booking.title,
            fromDate: booking.fromDate,
            toDate: booking.toDate,
            post: typeof booking.post === 'object' ? {
              id: booking.post.id,
              title: booking.post.title,
              slug: booking.post.slug,
            } : null,
          })),
        }
      })
    )

    return NextResponse.json({ transactions: transactionsWithBookings })
  } catch (error) {
    console.error('Error fetching Yoco transactions:', error)
    return NextResponse.json(
      { error: 'Failed to fetch transactions', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 },
    )
  }
}

