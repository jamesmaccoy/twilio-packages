import type { Payload } from 'payload'

/**
 * Consolidated notification creation utility
 * Creates notifications as YocoTransactions records (merged collection)
 */
export interface CreateNotificationParams {
  payload: Payload
  userId: string
  type: 
    | 'booking_created'
    | 'booking_updated'
    | 'booking_cancelled'
    | 'booking_rescheduled'
    | 'addon_purchased'
    | 'payment_received'
    | 'estimate_created'
    | 'estimate_confirmed'
    | 'subscription_renewed'
    | 'subscription_cancelled'
  title: string
  description?: string
  metadata?: Record<string, any>
  relatedBooking?: string
  relatedEstimate?: string
  relatedTransaction?: string
  actionUrl?: string
  req?: any
}

/**
 * Creates a notification as a YocoTransaction record
 * Returns the transaction/notification ID
 */
export async function createNotification({
  payload,
  userId,
  type,
  title,
  description,
  metadata,
  relatedBooking,
  relatedEstimate,
  relatedTransaction,
  actionUrl,
  req,
}: CreateNotificationParams): Promise<string | null> {
  try {
    const notification = await payload.create({
      collection: 'yoco-transactions',
      data: {
        user: userId,
        type,
        title,
        description,
        read: false,
        intent: 'notification', // Mark as notification-only
        status: 'completed', // Notifications are considered "completed"
        metadata: metadata || {},
        ...(relatedBooking && { relatedBooking }),
        ...(relatedEstimate && { relatedEstimate }),
        ...(relatedTransaction && { relatedTransaction }),
        ...(actionUrl && { actionUrl }),
      },
      req,
    })

    return notification.id
  } catch (error) {
    console.error('❌ Failed to create notification:', error)
    return null
  }
}

/**
 * Creates a notification record linked to a transaction
 * The transaction itself serves as both transaction and notification
 */
export async function createTransactionNotification({
  payload,
  transaction,
  req,
}: {
  payload: Payload
  transaction: {
    id: string
    user: string | { id: string }
    intent: 'booking' | 'subscription' | 'product'
    status: string
    amount?: number
    currency?: string
    packageName: string
    plan?: string
    entitlement?: string
    expiresAt?: string
    metadata?: {
      bookingId?: string
      estimateId?: string
    }
  }
  req?: any
}): Promise<string | null> {
  const userId = typeof transaction.user === 'string' ? transaction.user : transaction.user?.id
  if (!userId) {
    console.warn('⚠️ Cannot create notification - no user ID')
    return null
  }

  // Determine notification type and details based on intent
  let notificationType: CreateNotificationParams['type']
  let title: string
  let description: string
  const metadata: Record<string, any> = {
    transactionId: transaction.id,
    amount: transaction.amount,
    currency: transaction.currency || 'ZAR',
    packageName: transaction.packageName,
  }

  if (transaction.intent === 'subscription') {
    notificationType = 'subscription_renewed'
    title = `Subscription ${transaction.plan || 'renewed'}`
    description = `Your ${transaction.plan || 'subscription'} has been renewed.`
    metadata.plan = transaction.plan
    metadata.entitlement = transaction.entitlement
    metadata.expiresAt = transaction.expiresAt
  } else if (transaction.intent === 'product' && transaction.metadata?.bookingId) {
    notificationType = 'addon_purchased'
    title = `Add-on purchased: ${transaction.packageName}`
    description = `You've successfully purchased ${transaction.packageName} for your booking.`
    metadata.bookingId = transaction.metadata.bookingId
  } else if (transaction.intent === 'booking') {
    notificationType = 'payment_received'
    title = `Payment received: ${transaction.packageName}`
    description = `Your payment of R${transaction.amount?.toLocaleString() || '0'} has been received.`
  } else {
    notificationType = 'payment_received'
    title = `Payment received: ${transaction.packageName}`
    description = `Your payment of R${transaction.amount?.toLocaleString() || '0'} has been received.`
  }

  // Determine action URL
  let actionUrl: string | undefined
  if (transaction.metadata?.bookingId) {
    actionUrl = `/bookings/${transaction.metadata.bookingId}`
  } else if (transaction.metadata?.estimateId) {
    actionUrl = `/estimate/${transaction.metadata.estimateId}`
  }

  // Update the transaction itself with notification fields
  try {
    await payload.update({
      collection: 'yoco-transactions',
      id: transaction.id,
      data: {
        type: notificationType,
        title,
        description,
        read: false,
        actionUrl,
        metadata: {
          ...(transaction.metadata || {}),
          ...metadata,
        },
      },
      req,
    })

    return transaction.id
  } catch (error) {
    console.error('❌ Failed to update transaction with notification fields:', error)
    // Fallback: create separate notification record
    return createNotification({
      payload,
      userId,
      type: notificationType,
      title,
      description,
      metadata,
      relatedTransaction: transaction.id,
      actionUrl,
      req,
    })
  }
}

