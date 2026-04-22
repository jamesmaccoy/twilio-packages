import { cookies, headers } from 'next/headers'
import { redirect } from 'next/navigation'
import jwt from 'jsonwebtoken'

import type { User } from '../payload-types'
import { getPayload } from 'payload'
import configPromise from '@/payload.config'

export const getMeUser = async (args?: {
  nullUserRedirect?: string
  validUserRedirect?: string
}): Promise<{
  token: string
  user: User
}> => {
  const { nullUserRedirect, validUserRedirect } = args || {}
  const cookieStore = await cookies()
  const prefixToken = cookieStore.getAll().find((c) => c.name.endsWith('-token'))?.value
  const legacyToken = cookieStore.get('payload-token')?.value
  const authTokens = [prefixToken, legacyToken].filter(
    (cookieToken, index, self): cookieToken is string =>
      Boolean(cookieToken) && self.indexOf(cookieToken) === index,
  )
  let token = authTokens[0] || ''

  let user: User | null = null
  let ok = false

  try {
    const payload = await getPayload({ config: configPromise })
    const requestHeaders = await headers()
    const authResult = await payload.auth({ headers: requestHeaders })
    user = (authResult.user as User) || null
    ok = Boolean(user)

    if (!user && authTokens.length > 0) {
      for (const authToken of authTokens) {
        const forwardedHeaders = new Headers(requestHeaders)
        forwardedHeaders.set('authorization', `JWT ${authToken}`)
        const tokenAuthResult = await payload.auth({ headers: forwardedHeaders })

        if (tokenAuthResult.user) {
          user = tokenAuthResult.user as User
          ok = true
          token = authToken
          break
        }
      }
    }

    if (!user && authTokens.length > 0) {
      for (const authToken of authTokens) {
        try {
          const decoded = jwt.verify(authToken, payload.secret) as unknown
          const id =
            typeof decoded === 'object' && decoded !== null && 'id' in decoded
              ? (decoded as { id?: unknown }).id
              : null

          if (typeof id === 'string' && id.length > 0) {
            const fallbackUser = await payload.findByID({
              collection: 'users',
              id,
              overrideAccess: true,
            })

            if (fallbackUser) {
              user = fallbackUser as User
              ok = true
              token = authToken
              break
            }
          }
        } catch {
          continue
        }
      }
    }
  } catch (error) {
    console.error('Error getting current user:', error)
  }

  if (validUserRedirect && ok && user) {
    redirect(validUserRedirect)
  }

  if (nullUserRedirect && (!ok || !user)) {
    redirect(nullUserRedirect)
  }

  // Token will exist here because if it doesn't the user will be redirected
  return {
    token: token || '',
    user: user!,
  }
}
