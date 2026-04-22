import { NextRequest, NextResponse } from 'next/server'
import { getPayload } from 'payload'
import configPromise from '@payload-config'

export async function POST(request: NextRequest) {
  try {
    const payload = await getPayload({ config: configPromise })
    const { user } = await payload.auth({ headers: request.headers })

    if (!user) {
      return NextResponse.json({ error: 'Authentication required' }, { status: 401 })
    }

    const body = await request.json().catch(() => ({}))
    const transactionId = body.transactionId as string | undefined

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

    const transactionUserId =
      typeof transaction.user === 'string' ? transaction.user : transaction.user?.id

    const role = user.role
    const isAdmin = Array.isArray(role) ? role.includes('admin') : role === 'admin'

    if (!isAdmin && transactionUserId !== user.id) {
      return NextResponse.json({ error: 'Not authorized to cancel this subscription' }, { status: 403 })
    }

    if (transaction.intent !== 'subscription') {
      return NextResponse.json({ error: 'Transaction is not a subscription' }, { status: 400 })
    }

    const now = new Date()

    await payload.update({
      collection: 'yoco-transactions',
      id: transactionId,
      data: {
        status: 'cancelled',
        expiresAt: transaction.expiresAt || now.toISOString(),
      },
    })

    const userId = transactionUserId || user.id

    await payload.update({
      collection: 'users',
      id: userId,
      data: {
        subscriptionStatus: {
          status: 'canceled',
          plan: 'free',
          expiresAt: now.toISOString(),
        },
      },
    })

    if (payload.jobs && typeof (payload.jobs as any).queue === 'function') {
      await (payload.jobs as any).queue({
        task: 'handleSubscriptionEvent',
        queue: 'subscription-events',
        input: {
          event: 'CANCELED',
          userId,
          subscriptionId: transactionId,
          plan: transaction.plan || 'standard',
          entitlement: transaction.entitlement || 'standard',
          expiresAt: now.toISOString(),
        },
      })
    }

    return NextResponse.json({ cancelled: true })
  } catch (error) {
    console.error('[yoco/subscriptions/cancel] failed to cancel subscription', error)
    return NextResponse.json(
      { error: 'Failed to cancel subscription' },
      { status: 500 },
    )
  }
}


