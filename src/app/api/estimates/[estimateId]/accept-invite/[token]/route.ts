import { NextRequest, NextResponse } from 'next/server'
import { getPayload } from 'payload'
import configPromise from '@/payload.config'
import { getMeUser } from '@/utilities/getMeUser'
import { trackGuestJoined } from '@/lib/metaConversions'

export async function POST(
  _request: NextRequest,
  { params }: { params: Promise<{ estimateId: string; token: string }> },
) {
  try {
    const { user } = await getMeUser()

    if (!user) {
      return NextResponse.json({ message: 'Unauthorized' }, { status: 401 })
    }

    const { estimateId, token } = await params

    if (!estimateId) {
      return NextResponse.json({ message: 'Estimate ID not provided' }, { status: 400 })
    }

    if (!token) {
      return NextResponse.json({ message: 'Token not provided' }, { status: 400 })
    }

    const payload = await getPayload({ config: configPromise })

    const estimates = await payload.find({
      collection: 'estimates',
      where: {
        and: [{ id: { equals: estimateId } }, { token: { equals: token } }],
      },
      limit: 1,
      pagination: false,
      depth: 0,
    })

    if (estimates.docs.length === 0) {
      return NextResponse.json({ message: 'Estimate not found' }, { status: 404 })
    }

    const estimate = estimates.docs[0]
    if (!estimate) {
      return NextResponse.json({ message: 'Estimate not found' }, { status: 404 })
    }

    // Block accepting invites for expired/past-date estimates
    if (estimate.toDate) {
      const toDate = new Date(estimate.toDate as any)
      if (!Number.isNaN(toDate.getTime()) && toDate.getTime() < Date.now()) {
        return NextResponse.json({ message: 'Estimate has expired' }, { status: 410 })
      }
    }

    const alreadyGuest = estimate.guests?.some((guest) =>
      typeof guest === 'string' ? guest === user.id : guest?.id === user.id,
    )
    const isCustomer =
      typeof estimate.customer === 'string' ? estimate.customer === user.id : estimate.customer?.id === user.id

    if (alreadyGuest || isCustomer) {
      return NextResponse.json({ message: 'User already in estimate' })
    }

    await payload.update({
      collection: 'estimates',
      id: estimateId,
      data: {
        guests: [...(estimate.guests || []), user.id],
      },
    })

    try {
      await trackGuestJoined({
        resourceId: estimateId,
        resourceType: 'estimate',
        userId: user.id,
        userEmail: (user as any).email || undefined,
      })
    } catch {}

    return NextResponse.json({ message: 'Estimate updated' })
  } catch (error) {
    console.error('Error accepting estimate invite:', error)
    return NextResponse.json({ message: 'Failed to accept invite' }, { status: 500 })
  }
}

