import { NextRequest, NextResponse } from 'next/server'
import { getPayload } from 'payload'
import configPromise from '@payload-config'

type IncomingEvent = {
  event: 'RENEWED' | 'CANCELED' | 'TRIAL_ENDED' | 'INITIAL_PURCHASE' | 'EXPIRED'
  userId: string
  transactionId?: string
  plan?: 'standard' | 'pro' | 'free' | 'basic' | 'enterprise'
  entitlement?: 'none' | 'standard' | 'pro'
  expiresAt?: string
}

export async function POST(request: NextRequest) {
  try {
    const payload = await getPayload({ config: configPromise })
    const body = (await request.json()) as IncomingEvent | IncomingEvent[]

    const events = Array.isArray(body) ? body : [body]

    await Promise.all(
      events.map(async (event) => {
        if (!event.event || !event.userId) {
          throw new Error('Invalid event payload: missing event or userId')
        }

        const normalizedPlan: 'free' | 'basic' | 'pro' | 'enterprise' | undefined = event.plan
          ? event.plan === 'pro'
            ? 'pro'
            : event.plan === 'standard'
              ? 'basic'
              : event.plan === 'basic' || event.plan === 'enterprise' || event.plan === 'free'
                ? event.plan
                : 'free'
          : event.entitlement === 'pro'
            ? 'pro'
            : event.entitlement === 'standard'
              ? 'basic'
              : undefined

        await payload.jobs.queue({
          task: 'handleSubscriptionEvent',
          queue: 'subscription-events',
          input: {
            event: event.event,
            userId: event.userId,
            transactionId: event.transactionId,
            plan: normalizedPlan,
            entitlement: event.entitlement,
            expiresAt: event.expiresAt,
          },
        })
      }),
    )

    return NextResponse.json({ queued: events.length }, { status: 202 })
  } catch (error) {
    console.error('[webhooks:yoco-subscription] Failed to queue job', error)
    return NextResponse.json(
      { error: 'Failed to queue subscription job' },
      { status: 500 },
    )
  }
}


