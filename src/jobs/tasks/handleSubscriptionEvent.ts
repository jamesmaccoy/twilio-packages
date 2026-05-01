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
  plan?: 'free' | 'basic' | 'pro' | 'enterprise'
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

function toRoleArray(role: unknown): string[] {
  if (Array.isArray(role)) return role.filter((r): r is string => typeof r === 'string')
  if (typeof role === 'string' && role.trim()) return [role.trim()]
  return []
}

function normalizeUserPlan(
  plan?: SubscriptionJobInput['plan'],
  entitlement?: SubscriptionJobInput['entitlement'],
): 'free' | 'basic' | 'pro' | 'enterprise' {
  if (plan === 'pro' || entitlement === 'pro') return 'pro'
  if (plan === 'basic' || entitlement === 'standard') return 'basic'
  if (plan === 'enterprise') return 'enterprise'
  if (plan === 'free') return 'free'
  return 'free'
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
        const resolvedPlan = normalizeUserPlan(plan, entitlement)
        const isPro = resolvedPlan === 'pro' || entitlement === 'pro'

        let nextRole: string | undefined
        if (isPro) {
          const existing = await payload.findByID({
            collection: 'users',
            id: userId,
            depth: 0,
            req,
          })
          const roles = toRoleArray((existing as { role?: unknown }).role)
          if (!roles.includes('admin') && !roles.includes('host')) {
            nextRole = 'host'
          }
        }

        await payload.update({
          collection: 'users',
          id: userId,
          req,
          data: {
            subscriptionStatus: {
              status: 'active',
              plan: resolvedPlan,
              expiresAt: expiresAtDate.toISOString(),
            },
            paymentValidation: {
              lastPaymentDate: now.toISOString(),
              paymentStatus: 'completed',
              paymentMethod: 'credit_card',
            },
            ...(nextRole ? { role: nextRole } : {}),
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
              entitlement: entitlement || (resolvedPlan === 'pro' || resolvedPlan === 'enterprise' ? 'pro' : 'standard'),
              plan:
                resolvedPlan === 'pro' || resolvedPlan === 'enterprise'
                  ? 'pro'
                  : resolvedPlan === 'basic'
                    ? 'standard'
                    : 'free',
            },
          })
        }
        break
      }

      case 'CANCELED':
      case 'EXPIRED': {
        const resolvedPlan = normalizeUserPlan(plan, entitlement)
        await payload.update({
          collection: 'users',
          id: userId,
          req,
          data: {
            subscriptionStatus: {
              status: event === 'EXPIRED' ? 'canceled' : 'past_due',
              plan: resolvedPlan,
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
        const resolvedPlan = normalizeUserPlan(plan, entitlement)
        await payload.update({
          collection: 'users',
          id: userId,
          req,
          data: {
            subscriptionStatus: {
              status: 'past_due',
              plan: resolvedPlan,
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


