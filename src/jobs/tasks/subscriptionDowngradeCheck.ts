import type { TaskHandler } from 'payload/types'

export const subscriptionDowngradeCheck: TaskHandler = async ({ req }) => {
  const payload = req.payload
  const now = new Date().toISOString()

  req.payload.logger.info('[jobs:subscriptionDowngradeCheck] Starting nightly downgrade audit')

  try {
    const expiredUsers = await payload.find({
      collection: 'users',
      req,
      where: {
        and: [
          {
            'subscriptionStatus.status': {
              equals: 'active',
            },
          },
          {
            'subscriptionStatus.expiresAt': {
              lessThan: now,
            },
          },
        ],
      },
      limit: 500,
    })

    req.payload.logger.info(
      `[jobs:subscriptionDowngradeCheck] Found ${expiredUsers.docs.length} users with expired subscriptions`,
    )

    for (const user of expiredUsers.docs) {
      await payload.update({
        collection: 'users',
        id: user.id,
        req,
        data: {
          subscriptionStatus: {
            status: 'none',
            plan: 'free',
            expiresAt: null,
          },
        },
      })
    }

    const staleTransactions = await payload.find({
      collection: 'yoco-transactions',
      req,
      where: {
        and: [
          {
            intent: {
              equals: 'subscription',
            },
          },
          {
            status: {
              equals: 'completed',
            },
          },
          {
            expiresAt: {
              less_than: now,
            },
          },
        ],
      },
      limit: 500,
    })

    let reconciled = 0
    for (const tx of staleTransactions.docs) {
      const userId = typeof tx.user === 'string' ? tx.user : tx.user?.id
      if (!userId) continue
      try {
        const user = await payload.findByID({
          collection: 'users',
          id: userId,
          req,
        })
        if (user?.subscriptionStatus?.status === 'active') {
          await payload.update({
            collection: 'users',
            id: userId,
            req,
            data: {
              subscriptionStatus: {
                status: 'none',
                plan: 'free',
                expiresAt: null,
              },
            },
          })
          reconciled++
        }
      } catch (error) {
        req.payload.logger.warn('[jobs:subscriptionDowngradeCheck] failed reconciling user', {
          userId,
          error,
        })
      }
    }

    return {
      status: 'Success',
      message: `Processed ${expiredUsers.docs.length} user expiries, reconciled ${reconciled} stale transactions`,
    }
  } catch (error) {
    req.payload.logger.error('[jobs:subscriptionDowngradeCheck] Failed to process expired subscriptions', error)
    throw error
  }
}


