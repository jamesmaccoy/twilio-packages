import { NextRequest, NextResponse } from 'next/server'
import { getPayload } from 'payload'
import configPromise from '@payload-config'

export async function GET(request: NextRequest) {
  try {
    const payload = await getPayload({ config: configPromise })
    const { user } = await payload.auth({ headers: request.headers })

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