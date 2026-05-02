import type { NextRequest } from 'next/server'
import type { Payload } from 'payload'
import type { User } from '@/payload-types'
import jwt from 'jsonwebtoken'

/**
 * Resolves the current user the same way as GET /api/users/me:
 * payload.auth, then JWT from prefixed / legacy cookies, then verify JWT + findByID.
 */
export async function resolvePayloadUserFromRequest(
  request: NextRequest,
  payload: Payload,
): Promise<User | null> {
  let user = (await payload.auth({ headers: request.headers })).user as User | null

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
        user = authResult.user as User
        break
      }
    }
  }

  if (!user && authTokens.length > 0) {
    for (const token of authTokens) {
      try {
        const decoded = jwt.verify(token, payload.secret) as unknown
        const id =
          typeof decoded === 'object' && decoded !== null && 'id' in decoded
            ? (decoded as { id?: unknown }).id
            : null

        if (typeof id === 'string' && id.length > 0) {
          user = (await payload.findByID({
            collection: 'users',
            id,
            overrideAccess: true,
          })) as User
          break
        }
      } catch {
        continue
      }
    }
  }

  return user && typeof user.id === 'string' ? user : null
}
