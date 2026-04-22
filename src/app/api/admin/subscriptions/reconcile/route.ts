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

    const role = user.role
    const isAdmin = Array.isArray(role) ? role.includes('admin') : role === 'admin'
    if (!isAdmin) {
      return NextResponse.json({ error: 'Admin access required' }, { status: 403 })
    }

    await payload.jobs.queue({
      task: 'requeueFailedSubscriptions',
      queue: 'subscription-maintenance',
      input: {},
    })

    await payload.jobs.queue({
      task: 'subscriptionDowngradeCheck',
      queue: 'nightly-cron',
      input: {},
    })

    return NextResponse.json({ queued: true })
  } catch (error) {
    console.error('[admin/subscriptions/reconcile] failed to queue jobs', error)
    return NextResponse.json(
      { error: 'Failed to queue reconciliation jobs' },
      { status: 500 },
    )
  }
}


