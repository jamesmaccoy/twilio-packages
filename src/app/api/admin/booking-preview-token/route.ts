import { NextRequest, NextResponse } from 'next/server'
import { getPayload } from 'payload'
import configPromise from '@/payload.config'
import jwt from 'jsonwebtoken'

type PreviewTokenPayload = {
  type: 'booking-preview'
  bookingId: string
  userId: string
  email: string
}

const SECRET_KEY = process.env.JWT_SECRET || process.env.PAYLOAD_SECRET || ''

export async function POST(request: NextRequest) {
  try {
    if (!SECRET_KEY) {
      return NextResponse.json({ error: 'Server misconfigured: missing JWT/PAYLOAD secret' }, { status: 500 })
    }

    const payload = await getPayload({ config: configPromise })
    const { user } = await payload.auth({ headers: request.headers })

    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const roleValue = (user as any).role
    const roleArray = Array.isArray(roleValue) ? roleValue : roleValue ? [roleValue] : []
    if (!roleArray.includes('admin') && !roleArray.includes('host')) {
      return NextResponse.json({ error: 'Admin or host access required' }, { status: 403 })
    }

    const { bookingId, email } = (await request.json().catch(() => ({}))) as {
      bookingId?: string
      email?: string
    }

    if (!bookingId || !email) {
      return NextResponse.json({ error: 'bookingId and email are required' }, { status: 400 })
    }

    const users = await payload.find({
      collection: 'users',
      where: { email: { equals: email.toLowerCase().trim() } } as any,
      limit: 1,
      depth: 0,
    })

    const targetUser = users.docs?.[0]
    if (!targetUser) {
      return NextResponse.json({ error: 'No user found for that email' }, { status: 404 })
    }

    const tokenPayload: PreviewTokenPayload = {
      type: 'booking-preview',
      bookingId: String(bookingId),
      userId: String((targetUser as any).id),
      email: String((targetUser as any).email || email),
    }

    const token = jwt.sign(tokenPayload, SECRET_KEY, { expiresIn: '10m' })
    const url = `/preview/bookings/${encodeURIComponent(String(bookingId))}?token=${encodeURIComponent(token)}`

    return NextResponse.json({ url, expiresInSeconds: 600 })
  } catch (error) {
    console.error('[booking-preview-token] error:', error)
    return NextResponse.json(
      { error: 'Failed to create preview token', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 },
    )
  }
}

