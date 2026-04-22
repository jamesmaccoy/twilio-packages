import { NextRequest, NextResponse } from 'next/server'
import { getPayload } from 'payload'
import configPromise from '@payload-config'

const DAY_IN_MS = 24 * 60 * 60 * 1000

export async function POST(request: NextRequest) {
  try {
    const payload = await getPayload({ config: configPromise })
    const { user } = await payload.auth({ headers: request.headers })

    if (!user) {
      return NextResponse.json({ error: 'Authentication required' }, { status: 401 })
    }

    const body = await request.json()
    const { transactionId, status = 'completed', force } = body

    if (!transactionId) {
      return NextResponse.json({ error: 'transactionId is required' }, { status: 400 })
    }

    const transaction = await payload.findByID({
      collection: 'yoco-transactions',
      id: transactionId,
    })

    if (!transaction) {
      return NextResponse.json({ error: 'Transaction not found' }, { status: 404 })
    }

    const isOwner = typeof transaction.user === 'string' ? transaction.user === user.id : transaction.user?.id === user.id
    const isAdmin = Array.isArray(user.role) ? user.role.includes('admin') : user.role === 'admin'

    if (!isOwner && !isAdmin) {
      return NextResponse.json({ error: 'Not authorized to update this transaction' }, { status: 403 })
    }

    const now = new Date()
    let expiresAt: Date | undefined

    if (transaction.periodDays) {
      expiresAt = new Date(now.getTime() + Number(transaction.periodDays) * DAY_IN_MS)
    } else if (transaction.expiresAt) {
      expiresAt = new Date(transaction.expiresAt)
    }

    const updatedTransaction = await payload.update({
      collection: 'yoco-transactions',
      id: transactionId,
      data: {
        status,
        completedAt: now.toISOString(),
        expiresAt: expiresAt?.toISOString(),
      },
    })

    if (transaction.intent === 'subscription') {
      const plan =
        transaction.plan || (transaction.entitlement === 'pro' ? 'pro' : 'standard')

      if (status === 'completed') {
        await payload.jobs.queue({
          task: 'handleSubscriptionEvent',
          queue: 'subscription-events',
          input: {
            event: 'RENEWED',
            userId: typeof transaction.user === 'string' ? transaction.user : transaction.user?.id,
            subscriptionId: transactionId,
            plan,
            entitlement: transaction.entitlement || (plan === 'pro' ? 'pro' : 'standard'),
            expiresAt: expiresAt?.toISOString(),
          },
        })
      } else if (status === 'failed' || status === 'cancelled') {
        await payload.jobs.queue({
          task: 'handleSubscriptionEvent',
          queue: 'subscription-events',
          input: {
            event: status === 'failed' ? 'TRIAL_ENDED' : 'CANCELED',
            userId: typeof transaction.user === 'string' ? transaction.user : transaction.user?.id,
            subscriptionId: transactionId,
            plan,
            entitlement: transaction.entitlement || (plan === 'pro' ? 'pro' : 'standard'),
          },
        })
      }
    }

    return NextResponse.json({ transaction: updatedTransaction })
  } catch (error) {
    console.error('Error updating Yoco transaction:', error)
    return NextResponse.json(
      { error: 'Failed to update transaction', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 },
    )
  }
}

