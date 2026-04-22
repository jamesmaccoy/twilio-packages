import { NextRequest, NextResponse } from 'next/server'
import { getPayload } from 'payload'
import configPromise from '@/payload.config'

export async function POST(request: NextRequest) {
  try {
    const payload = await getPayload({ config: configPromise })

    // Create response
    const response = NextResponse.json({
      message: 'Logout successful'
    })

    const collectionConfig = payload.collections['users']?.config
    const sameSite =
      typeof collectionConfig?.auth.cookies.sameSite === 'string'
        ? (collectionConfig.auth.cookies.sameSite.toLowerCase() as 'lax' | 'strict' | 'none')
        : collectionConfig?.auth.cookies.sameSite || 'lax'
    const secure = collectionConfig?.auth.cookies.secure ?? process.env.NODE_ENV === 'production'
    const domain = collectionConfig?.auth.cookies.domain

    const clearCookieOptions = {
      httpOnly: true,
      secure,
      sameSite,
      path: '/',
      maxAge: 0,
      domain,
    } as const

    response.cookies.set(`${payload.config.cookiePrefix}-token`, '', clearCookieOptions)
    response.cookies.set('payload-token', '', clearCookieOptions)

    return response
  } catch (error) {
    console.error('Error during logout:', error)
    return NextResponse.json(
      { error: 'Logout failed' },
      { status: 500 }
    )
  }
} 