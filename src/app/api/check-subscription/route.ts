import { NextRequest, NextResponse } from 'next/server'
import { getPayload } from 'payload'
import configPromise from '@payload-config'
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

  // Try authenticating with cookies by injecting Authorization header.
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

  // Final fallback: verify JWT and load user directly.
  if (!user && authTokens.length > 0) {
    for (const token of authTokens) {
      try {
        const decoded = jwt.verify(token, payload.secret) as unknown
        const id =
          typeof decoded === 'object' && decoded !== null && 'id' in decoded ? (decoded as any).id : null
        if (typeof id === 'string' && id.length > 0) {
          user = await payload.findByID({
            collection: 'users',
            id,
            overrideAccess: true,
            depth: 0,
          })
          break
        }
      } catch {
        continue
      }
    }
  }

  return user || null
}

export async function GET(request: NextRequest) {
  try {
    const payload = await getPayload({ config: configPromise })
    const user = await getAuthedUser(payload, request)

    if (!user) {
      return NextResponse.json({ hasActiveSubscription: false, activeEntitlements: [] }, { status: 200 })
    }

    const now = new Date()

    const transactions = await payload.find({
      collection: 'yoco-transactions',
      where: {
        and: [
          {
            user: {
              equals: user.id,
            },
          },
          {
            status: {
              equals: 'completed',
            },
          },
          {
            intent: {
              equals: 'subscription',
            },
          },
        ],
      },
      sort: '-completedAt',
      limit: 10,
    })

    const activeTransaction = transactions.docs.find((tx: any) => {
      if (!tx) return false
      if (!tx.expiresAt) return true
      return new Date(tx.expiresAt) > now
    })

    // Primary source of truth: subscription transactions
    let hasActiveSubscription = Boolean(activeTransaction)
    let activeEntitlements = activeTransaction?.entitlement ? [activeTransaction.entitlement] : []

    // Fallback: user.subscriptionStatus (e.g. legacy/manual subscription flag)
    // This prevents "paid but no yoco-transactions record" from being treated as unsubscribed.
    if (!hasActiveSubscription) {
      const sub = (user as any)?.subscriptionStatus
      const status = sub?.status
      const expiresAt = sub?.expiresAt
      const plan = String(sub?.plan || '').toLowerCase()

      const notExpired =
        !expiresAt || (typeof expiresAt === 'string' && expiresAt.length > 0 ? new Date(expiresAt) > now : false)

      if (status === 'active' && notExpired) {
        hasActiveSubscription = true
        const entitlement = plan === 'pro' ? 'pro' : 'standard'
        activeEntitlements = [entitlement]
      }
    }

    const response = NextResponse.json({
      hasActiveSubscription,
      activeEntitlements,
      transactions: transactions.docs,
    })

    return response
  } catch (error) {
    console.error('Error checking subscription:', error)
    return NextResponse.json({ 
      hasActiveSubscription: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 })
  }
} 