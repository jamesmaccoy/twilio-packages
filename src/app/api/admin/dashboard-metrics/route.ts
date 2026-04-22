import { NextRequest, NextResponse } from 'next/server'
import { getPayload } from 'payload'
import configPromise from '@payload-config'

const DAYS_30_MS = 30 * 24 * 60 * 60 * 1000

export async function GET(request: NextRequest) {
  try {
    const payload = await getPayload({ config: configPromise })
    const { user } = await payload.auth({ headers: request.headers })

    if (!user) {
      return NextResponse.json({ error: 'Authentication required' }, { status: 401 })
    }

    const roleValue = user.role
    const roleArray = Array.isArray(roleValue) ? roleValue : roleValue ? [roleValue] : []
    if (!roleArray.includes('admin')) {
      return NextResponse.json({ error: 'Admin access required' }, { status: 403 })
    }

    const now = new Date()
    const yearStart = new Date(now.getFullYear(), 0, 1).toISOString()

    const subscriptionTransactions = await payload.find({
      collection: 'yoco-transactions',
      where: {
        and: [
          { intent: { equals: 'subscription' } },
          { createdAt: { greater_than_equal: yearStart } },
        ],
      },
      limit: 1000,
      sort: '-createdAt',
    })

    const docs = subscriptionTransactions.docs || []
    const completedInYear = docs.filter(
      (tx) =>
        tx.status === 'completed' &&
        tx.completedAt &&
        new Date(tx.completedAt).getFullYear() === now.getFullYear(),
    )
    const activeSubscriptions = docs.filter(
      (tx) =>
        tx.status === 'completed' && (!tx.expiresAt || new Date(tx.expiresAt) > now),
    )
    const upcomingExpirations = docs.filter((tx) => {
      if (tx.status !== 'completed' || !tx.expiresAt) return false
      const expiresAt = new Date(tx.expiresAt).getTime()
      const distance = expiresAt - now.getTime()
      return distance > 0 && distance <= DAYS_30_MS
    })

    const yearlyGoal = 12
    const yearCompletedCount = completedInYear.length
    const goalRemaining = Math.max(0, yearlyGoal - yearCompletedCount)
    const failedCount = docs.filter((tx) => tx.status === 'failed').length
    const pendingCount = docs.filter((tx) => tx.status === 'pending').length

    const staleTransactions = []
    for (const tx of docs) {
      if (tx.status !== 'completed' || !tx.expiresAt) continue
      if (new Date(tx.expiresAt) > now) continue
      const userId = typeof tx.user === 'string' ? tx.user : tx.user?.id
      if (!userId) continue
      try {
        const user = await payload.findByID({
          collection: 'users',
          id: userId,
        })
        const subscriptionStatus = user?.subscriptionStatus
        if (subscriptionStatus?.status === 'active') {
          staleTransactions.push({
            transactionId: tx.id,
            userId,
            expiresAt: tx.expiresAt,
            plan: tx.plan || 'standard',
          })
        }
      } catch (error) {
        req.payload.logger.warn('[admin/dashboard-metrics] unable to load user for stale check', {
          userId,
          error,
        })
      }
    }

    const listJobs =
      payload.jobs && typeof (payload.jobs as any).list === 'function'
        ? ((payload.jobs as any).list as (args: { queue: string; limit: number }) => Promise<any>)
        : null

    let subscriptionQueue: any = null
    let nightlyQueue: any = null
    if (listJobs) {
      try {
        subscriptionQueue = await listJobs({ queue: 'subscription-events', limit: 100 })
      } catch (err) {
        console.warn('[admin/dashboard-metrics] unable to list subscription-events queue', err)
      }
      try {
        nightlyQueue = await listJobs({ queue: 'nightly-cron', limit: 25 })
      } catch (err) {
        console.warn('[admin/dashboard-metrics] unable to list nightly-cron queue', err)
      }
    }

    const reduceJobStatus = (items: any[] = []) =>
      items.reduce<Record<string, number>>((acc, job) => {
        const status = job.status || 'unknown'
        acc[status] = (acc[status] || 0) + 1
        return acc
      }, {})

    const subscriptionDocs = subscriptionQueue?.docs || subscriptionQueue || []
    const nightlyDocs = nightlyQueue?.docs || nightlyQueue || []
    const subscriptionJobStats = reduceJobStatus(subscriptionDocs)
    const nightlyJobStats = reduceJobStatus(nightlyDocs)

    return NextResponse.json({
      jobMetrics: {
        subscriptionEvents: {
          total:
            subscriptionQueue?.totalDocs ??
            (Array.isArray(subscriptionDocs) ? subscriptionDocs.length : 0),
          queued: subscriptionJobStats.queued || 0,
          processing:
            (subscriptionJobStats.processing || subscriptionJobStats.running || 0) as number,
          failed: subscriptionJobStats.failed || 0,
          completed: subscriptionJobStats.completed || 0,
        },
        nightlyCron: {
          total:
            nightlyQueue?.totalDocs ??
            (Array.isArray(nightlyDocs) ? nightlyDocs.length : 0),
          queued: nightlyJobStats.queued || 0,
          failed: nightlyJobStats.failed || 0,
          completed: nightlyJobStats.completed || 0,
        },
      },
      subscriptionMetrics: {
        activeCount: activeSubscriptions.length,
        totalYearTransactions: yearCompletedCount,
        goalRemaining,
        yearlyGoal,
        failedCount,
        pendingCount,
        upcomingExpiring: upcomingExpirations.length,
        staleActiveCount: staleTransactions.length,
      },
    })
  } catch (error) {
    console.error('[admin/dashboard-metrics] error', error)
    return NextResponse.json(
      { error: 'Failed to load dashboard metrics' },
      { status: 500 },
    )
  }
}


