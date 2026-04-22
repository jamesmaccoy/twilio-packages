import { NextRequest, NextResponse } from 'next/server'
import { getPayload } from 'payload'
import configPromise from '@/payload.config'
import jwt from 'jsonwebtoken'

export const dynamic = 'force-dynamic'

export async function GET(request: NextRequest) {
  try {
    const payload = await getPayload({ config: configPromise })
    
    // Get the authenticated user from the request
    let { user } = await payload.auth({ headers: request.headers })

    // Fallback: if Payload didn't pick up cookies, try JWT header auth using cookie token.
    // This helps in environments where cookie parsing differs between runtimes.
    const prefixToken = request.cookies.get(`${payload.config.cookiePrefix}-token`)?.value
    const legacyToken = request.cookies.get('payload-token')?.value
    const authTokens = [prefixToken, legacyToken].filter(
      (token, index, self): token is string => Boolean(token) && self.indexOf(token) === index,
    )

    if (!user && authTokens.length > 0) {
      for (const token of authTokens) {
        const headers = new Headers(request.headers)
        headers.set('authorization', `JWT ${token}`)
        const authResult = await payload.auth({ headers })
        if (authResult.user) {
          user = authResult.user
          break
        }
      }
    }

    // Final fallback: directly verify JWT and load user.
    // (If payload.auth fails due to runtime header/cookie differences, this still unblocks the app.)
    if (!user && authTokens.length > 0) {
      for (const token of authTokens) {
        try {
          const decoded = jwt.verify(token, payload.secret) as unknown
          const id =
            typeof decoded === 'object' && decoded !== null && 'id' in decoded
              ? (decoded as any).id
              : null

          if (typeof id === 'string' && id.length > 0) {
            user = await payload.findByID({
              collection: 'users',
              id,
              overrideAccess: true,
            })
            break
          }
        } catch {
          continue
        }
      }
    }
    
    if (!user) {
      return NextResponse.json({ 
        error: 'Not authenticated' 
      }, { status: 401, headers: { 'Cache-Control': 'no-store, max-age=0' } })
    }

    // Remove sensitive fields from response
    const { password: _, salt: __, hash: ___, ...safeUser } = user

    return NextResponse.json({
      user: safeUser
    }, { headers: { 'Cache-Control': 'no-store, max-age=0' } })
  } catch (error) {
    console.error('Error getting current user:', error)
    return NextResponse.json(
      { error: 'Failed to get current user' },
      { status: 500, headers: { 'Cache-Control': 'no-store, max-age=0' } }
    )
  }
} 