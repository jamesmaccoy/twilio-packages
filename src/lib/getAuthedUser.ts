import type { NextRequest } from 'next/server'
import jwt from 'jsonwebtoken'

/** Resolve the current user from Payload auth headers and session cookies. */
export async function getAuthedUser(payload: any, request: NextRequest): Promise<any | null> {
  let user: any = null
  try {
    const authResult = await payload.auth({ headers: request.headers })
    user = authResult.user
  } catch {
    user = null
  }

  const prefixToken = request.cookies.get(`${payload.config.cookiePrefix}-token`)?.value
  const legacyToken = request.cookies.get('payload-token')?.value
  const authTokens = [prefixToken, legacyToken].filter(
    (token, index, self): token is string => Boolean(token) && self.indexOf(token) === index,
  )

  if (!user && authTokens.length > 0) {
    for (const token of authTokens) {
      try {
        const headersWithToken = new Headers(request.headers)
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
          typeof decoded === 'object' && decoded !== null && 'id' in decoded
            ? (decoded as { id?: string }).id
            : null
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
