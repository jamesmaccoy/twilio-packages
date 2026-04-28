import { NextRequest, NextResponse } from 'next/server'
import { getPayload } from 'payload'
import configPromise from '@/payload.config'
import jwt from 'jsonwebtoken'

type UserPreviewTokenPayload = {
  type: 'user-preview'
  userId: string
  email: string
}

const SECRET_KEY = process.env.JWT_SECRET || process.env.PAYLOAD_SECRET || ''
const COOKIE_NAME = 'user-preview-token'

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

    const { email } = (await request.json().catch(() => ({}))) as { email?: string }
    const normalizedEmail = typeof email === 'string' ? email.toLowerCase().trim() : ''
    if (!normalizedEmail) {
      return NextResponse.json({ error: 'email is required' }, { status: 400 })
    }

    const users = await payload.find({
      collection: 'users',
      where: { email: { equals: normalizedEmail } } as any,
      limit: 1,
      depth: 0,
    })

    const targetUser = users.docs?.[0]
    if (!targetUser) {
      return NextResponse.json({ error: 'No user found for that email' }, { status: 404 })
    }

    const tokenPayload: UserPreviewTokenPayload = {
      type: 'user-preview',
      userId: String((targetUser as any).id),
      email: String((targetUser as any).email || normalizedEmail),
    }

    const token = jwt.sign(tokenPayload, SECRET_KEY, { expiresIn: '10m' })

    const res = NextResponse.json({ ok: true, expiresInSeconds: 600 })
    res.cookies.set({
      name: COOKIE_NAME,
      value: token,
      httpOnly: true,
      sameSite: 'lax',
      secure: process.env.NODE_ENV === 'production',
      path: '/',
      maxAge: 60 * 10,
    })
    return res
  } catch (error) {
    console.error('[user-preview/start] error:', error)
    return NextResponse.json(
      { error: 'Failed to start user preview', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 },
    )
  }
}

