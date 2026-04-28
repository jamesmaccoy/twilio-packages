import { NextRequest, NextResponse } from 'next/server'
import { getPayload } from 'payload'
import configPromise from '@/payload.config'

const COOKIE_NAME = 'user-preview-token'

export async function POST(request: NextRequest) {
  try {
    const payload = await getPayload({ config: configPromise })
    const { user } = await payload.auth({ headers: request.headers })

    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const roleValue = (user as any).role
    const roleArray = Array.isArray(roleValue) ? roleValue : roleValue ? [roleValue] : []
    if (!roleArray.includes('admin') && !roleArray.includes('host')) {
      return NextResponse.json({ error: 'Admin or host access required' }, { status: 403 })
    }

    const res = NextResponse.json({ ok: true })
    res.cookies.set({
      name: COOKIE_NAME,
      value: '',
      httpOnly: true,
      sameSite: 'lax',
      secure: process.env.NODE_ENV === 'production',
      path: '/',
      maxAge: 0,
    })
    return res
  } catch (error) {
    console.error('[user-preview/stop] error:', error)
    return NextResponse.json(
      { error: 'Failed to stop user preview', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 },
    )
  }
}

