import type { TaskHandler } from 'payload/types'

type SubscriptionEvent =
  | 'RENEWED'
  | 'CANCELED'
  | 'TRIAL_ENDED'
  | 'INITIAL_PURCHASE'
  | 'EXPIRED'

export type SubscriptionJobInput = {
  event: SubscriptionEvent
  userId: string
  transactionId?: string
  plan?: 'standard' | 'pro'
  entitlement?: 'none' | 'standard' | 'pro'
  expiresAt?: string
}

const THIRTY_DAYS = 30 * 24 * 60 * 60 * 1000

const calculateNewExpiry = (input: SubscriptionJobInput) => {
  if (input.expiresAt) {
    return new Date(input.expiresAt)
  }

  const now = new Date()
  return new Date(now.getTime() + THIRTY_DAYS)
}

export const handleSubscriptionEvent: TaskHandler<SubscriptionJobInput> = async ({
  input,
  req,
}) => {
  const { event, userId, transactionId, plan, entitlement } = input
  const payload = req.payload

  req.payload.logger.info(
    `[jobs:handleSubscriptionEvent] Processing ${event} for user ${userId} transaction ${transactionId || 'n/a'}`,
  )

  const now = new Date()
  const expiresAtDate = calculateNewExpiry(input)

  try {
    switch (event) {
      case 'RENEWED':
      case 'INITIAL_PURCHASE': {
        await payload.update({
          collection: 'users',
          id: userId,
          req,
          data: {
            subscriptionStatus: {
              status: 'active',
              plan: plan || (entitlement === 'pro' ? 'pro' : 'standard'),
              expiresAt: expiresAtDate.toISOString(),
            },
            paymentValidation: {
              lastPaymentDate: now.toISOString(),
              paymentStatus: 'completed',
              paymentMethod: 'credit_card',
            },
          },
        })

        if (transactionId) {
          await payload.update({
            collection: 'yoco-transactions',
            id: transactionId,
            req,
            data: {
              status: 'completed',
              completedAt: now.toISOString(),
              expiresAt: expiresAtDate.toISOString(),
              entitlement: entitlement || (plan === 'pro' ? 'pro' : 'standard'),
              plan: plan || (entitlement === 'pro' ? 'pro' : 'standard'),
            },
          })
        }
        break
      }

      case 'CANCELED':
      case 'EXPIRED': {
        await payload.update({
          collection: 'users',
          id: userId,
          req,
          data: {
            subscriptionStatus: {
              status: event === 'EXPIRED' ? 'canceled' : 'past_due',
              plan: plan || 'free',
              expiresAt: expiresAtDate.toISOString(),
            },
            paymentValidation: {
              paymentStatus: 'failed',
            },
          },
        })
        if (transactionId) {
          await payload.update({
            collection: 'yoco-transactions',
            id: transactionId,
            req,
            data: {
              status: event === 'EXPIRED' ? 'cancelled' : 'pending',
            },
          })
        }
        break
      }

      case 'TRIAL_ENDED': {
        req.payload.logger.warn(
          `[jobs:handleSubscriptionEvent] Trial ended for user ${userId}. Marking subscriptionStatus to trial-ended.`,
        )
        await payload.update({
          collection: 'users',
          id: userId,
          req,
          data: {
            subscriptionStatus: {
              status: 'past_due',
              plan: plan || 'free',
              expiresAt: expiresAtDate.toISOString(),
            },
          },
        })
        break
      }

      default:
        req.payload.logger.info(`[jobs:handleSubscriptionEvent] Ignoring unknown event ${event}`)
        break
    }
  } catch (error) {
    req.payload.logger.error('[jobs:handleSubscriptionEvent] Failed processing subscription event', error)
    throw error
  }

  return {
    status: 'Success',
    message: `Handled ${event} for user ${userId}`,
  }
}


