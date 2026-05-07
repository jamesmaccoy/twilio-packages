import { NextRequest, NextResponse } from 'next/server'
import { getPayload } from 'payload'
import configPromise from '@/payload.config'
import jwt from 'jsonwebtoken'

async function getAuthedUser(payload: any, req: NextRequest): Promise<any | null> {
  let user: any = null
  try {
    const authResult = await payload.auth({ headers: req.headers })
    user = authResult.user
  } catch {
    user = null
  }

  const prefixToken = req.cookies.get(`${payload.config.cookiePrefix}-token`)?.value
  const legacyToken = req.cookies.get('payload-token')?.value
  const authTokens = [prefixToken, legacyToken].filter(
    (token, index, self): token is string => Boolean(token) && self.indexOf(token) === index,
  )

  if (!user && authTokens.length > 0) {
    for (const token of authTokens) {
      try {
        const headersWithToken = new Headers(req.headers)
        headersWithToken.set('authorization', `JWT ${token}`)
        const tokenAuthResult = await payload.auth({ headers: headersWithToken })
        if (tokenAuthResult.user) {
          user = tokenAuthResult.user
          break
        }
      } catch {
        continue
      }
    }
  }

  if (!user && authTokens.length > 0) {
    for (const token of authTokens) {
      try {
        const decoded = jwt.verify(token, payload.secret) as unknown
        const id =
          typeof decoded === 'object' && decoded !== null && 'id' in decoded ? (decoded as any).id : null
        if (typeof id === 'string' && id.length > 0) {
          user = await payload.findByID({ collection: 'users', id, overrideAccess: true, depth: 0 })
          break
        }
      } catch {
        continue
      }
    }
  }

  return user || null
}

export async function GET(req: NextRequest, { params }: { params: Promise<{ estimateId: string }> }) {
  try {
    const { estimateId } = await params
    const payload = await getPayload({ config: configPromise })

    const user = await getAuthedUser(payload, req)
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const role = (user as any)?.role
    const roleArray = Array.isArray(role) ? role : role ? [role] : []
    const isAdmin = roleArray.includes('admin')
    const isHost = roleArray.includes('host')

    // First fetch by id; then enforce access rules in code (lets us support host ownership).
    const estimate = await payload
      .findByID({
        collection: 'estimates',
        id: estimateId,
        depth: 2, // Include post data with baseRate + host relationship
        overrideAccess: isAdmin, // allow admin to bypass access rules
        user,
      })
      .catch(() => null)

    if (!estimate) {
      return NextResponse.json({ error: 'Estimate not found' }, { status: 404 })
    }

    // Access rules:
    // - admin: always
    // - customer: if estimate.customer === user.id
    // - invited guest: if estimate.guests contains user.id
    // - host: if estimate.post.host === user.id
    if (!isAdmin) {
      const customerId = typeof (estimate as any).customer === 'string' ? (estimate as any).customer : (estimate as any).customer?.id
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
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
      }
    }

    // Guests should not be able to view expired/past-date estimates
    const customerId = typeof (estimate as any).customer === 'string' ? (estimate as any).customer : (estimate as any).customer?.id
    const isCustomer = Boolean(customerId && String(customerId) === String(user.id))
    if (!isCustomer && (estimate as any).toDate) {
      const toDate = new Date(estimate.toDate as any)
      if (!Number.isNaN(toDate.getTime()) && toDate.getTime() < Date.now()) {
        return NextResponse.json({ error: 'Estimate has expired' }, { status: 410 })
      }
    }

    // Ensure the estimate has proper pricing information
    const post = estimate.post
    if (typeof post === 'object' && post) {
      // If the estimate total is NaN or 0, recalculate it using the post's baseRate
      if (!estimate.total || isNaN(Number(estimate.total)) || Number(estimate.total) === 0) {
        const baseRate = post.baseRate || 150 // Default fallback
        const duration = estimate.fromDate && estimate.toDate 
          ? Math.ceil((new Date(estimate.toDate).getTime() - new Date(estimate.fromDate).getTime()) / (1000 * 60 * 60 * 24))
          : 1
        
        // Update the estimate with the correct total
        const correctedEstimate = await payload.update({
          collection: 'estimates',
          id: estimateId,
          data: {
            total: baseRate * duration
          }
        })
        
        return NextResponse.json(correctedEstimate)
      }
    }

    return NextResponse.json(estimate)
  } catch (error) {
    console.error('Error fetching estimate:', error)
    return NextResponse.json(
      { error: 'Failed to fetch estimate' },
      { status: 500 }
    )
  }
}
