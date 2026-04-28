import { NextRequest, NextResponse } from 'next/server'
import { getPayload } from 'payload'
import configPromise from '@/payload.config'
import jwt from 'jsonwebtoken'

export const dynamic = 'force-dynamic'

type UserPreviewTokenPayload = {
  type: 'user-preview'
  userId: string
  email: string
}

const PREVIEW_COOKIE_NAME = 'user-preview-token'

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

    // Optional preview-as-user mode (admin/host only)
    let actorUser: any = user
    let isPreview = false
    let previewEmail: string | undefined

    try {
      const previewToken = request.cookies.get(PREVIEW_COOKIE_NAME)?.value
      if (previewToken) {
        const roleValue = (actorUser as any).role
        const roleArray = Array.isArray(roleValue) ? roleValue : roleValue ? [roleValue] : []
        const canPreview = roleArray.includes('admin') || roleArray.includes('host')
        if (canPreview) {
          const secret = process.env.JWT_SECRET || payload.secret
          const decoded = jwt.verify(previewToken, secret) as UserPreviewTokenPayload
          if (decoded?.type === 'user-preview' && decoded.userId) {
            const previewUser = await payload.findByID({
              collection: 'users',
              id: String(decoded.userId),
              overrideAccess: true,
              depth: 0,
            })
            if (previewUser) {
              user = previewUser
              isPreview = true
              previewEmail = decoded.email
            }
          }
        }
      }
    } catch (e) {
      console.warn('[api/users/me] preview token ignored:', e)
    }

    // Remove sensitive fields from response
    const { password: _, salt: __, hash: ___, ...safeUser } = user
    const { password: a_, salt: a__, hash: a___, ...safeActor } = actorUser || {}

    return NextResponse.json({
      user: safeUser,
      actorUser: isPreview ? safeActor : undefined,
      isPreview,
      previewEmail,
    }, { headers: { 'Cache-Control': 'no-store, max-age=0' } })
  } catch (error) {
    console.error('Error getting current user:', error)
    return NextResponse.json(
      { error: 'Failed to get current user' },
      { status: 500, headers: { 'Cache-Control': 'no-store, max-age=0' } }
    )
  }
} 