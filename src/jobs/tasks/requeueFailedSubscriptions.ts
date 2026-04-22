import type { TaskHandler } from 'payload/types'

export const requeueFailedSubscriptions: TaskHandler = async ({ req }) => {
  const payload = req.payload
  req.payload.logger.info('[jobs:requeueFailedSubscriptions] scanning for failed subscription jobs')

  const listJobs =
    payload.jobs && typeof (payload.jobs as any).list === 'function'
      ? ((payload.jobs as any).list as (args: { queue: string; limit: number; status?: string }) => Promise<any>)
      : null

  if (!listJobs) {
    req.payload.logger.warn('[jobs:requeueFailedSubscriptions] queue list API unavailable')
    return { status: 'Skipped', message: 'Queue API unavailable' }
  }

  const failed = await listJobs({ queue: 'subscription-events', status: 'failed', limit: 100 })
  const failedJobs = failed?.docs || failed || []

  if (!failedJobs.length) {
    return { status: 'Success', message: 'No failed subscription jobs found' }
  }

  let requeued = 0
  for (const job of failedJobs) {
    try {
      if (!job.input?.userId) continue
      await payload.jobs.queue({
        task: 'handleSubscriptionEvent',
        queue: 'subscription-events',
        input: job.input,
      })
      await payload.jobs.remove(job.id)
      requeued++
    } catch (error) {
      req.payload.logger.error('[jobs:requeueFailedSubscriptions] failed requeue', { jobId: job.id, error })
    }
  }

  return {
    status: 'Success',
    message: `Requeued ${requeued} subscription event jobs`,
  }
}


