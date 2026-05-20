import { NextRequest, NextResponse } from 'next/server'
import { getPayload } from 'payload'
import configPromise from '@/payload.config'
import { getMeUser } from '@/utilities/getMeUser'
import { generateShortToken } from '@/utilities/token'

export async function POST(
  _request: NextRequest,
  { params }: { params: Promise<{ estimateId: string }> },
) {
  try {
    const { user } = await getMeUser()

    if (!user) {
      return NextResponse.json({ message: 'Unauthorized' }, { status: 401 })
    }

    const { estimateId } = await params

    if (!estimateId) {
      return NextResponse.json({ message: 'Estimate ID not provided' }, { status: 400 })
    }

    const payload = await getPayload({ config: configPromise })

    const estimate = await payload
      .findByID({
        collection: 'estimates',
        id: estimateId,
        depth: 2, // include post.host + relationships for authorization checks
        overrideAccess: true,
      })
      .catch(() => null)

    if (!estimate) {
      return NextResponse.json({ message: 'Estimate not found' }, { status: 404 })
    }

    const role = (user as any)?.role
    const roleArray = Array.isArray(role) ? role : role ? [role] : []
    const isAdmin = roleArray.includes('admin')
    const isHost = roleArray.includes('host')

    if (!isAdmin) {
      const customerId =
        typeof (estimate as any).customer === 'string' ? (estimate as any).customer : (estimate as any).customer?.id
      const isCustomer = Boolean(customerId && String(customerId) === String(user.id))

      const guests: any[] = Array.isArray((estimate as any).guests) ? (estimate as any).guests : []
      const guestIds = guests.map((g) => (typeof g === 'string' ? g : g?.id)).filter(Boolean)
      const isInvitedGuest = guestIds.some((id) => String(id) === String(user.id))

      const post: any = (estimate as any).post
      const hostId =
        typeof post?.host === 'string'
          ? post.host
          : typeof post?.host === 'object' && post?.host
            ? post.host?.id
            : null
      const isOwningHost = isHost && hostId && String(hostId) === String(user.id)

      if (!isCustomer && !isInvitedGuest && !isOwningHost) {
        return NextResponse.json({ message: 'Unauthorized' }, { status: 401 })
      }
    }

    if ((estimate as any).token) {
      return NextResponse.json({ token: (estimate as any).token })
    }

    const token = generateShortToken(10)

    await payload.update({
      collection: 'estimates',
      id: estimateId,
      overrideAccess: true,
      data: { token },
    })

    return NextResponse.json({ token })
  } catch (error) {
    console.error('Error generating estimate token:', error)
    return NextResponse.json({ message: 'Failed to generate token' }, { status: 500 })
  }
}

