import type { CollectionAfterChangeHook } from 'payload'
import { createTransactionNotification } from '@/lib/notificationUtils'

/**
 * Consolidated transaction notification hook
 * Updates transaction with notification fields when status changes to completed
 */
export const createTransactionNotificationHook: CollectionAfterChangeHook = async ({
  doc,
  operation,
  previousDoc,
  req,
}) => {
  // Only add notification fields when transaction status changes to completed
  if (operation !== 'update' || doc.status !== 'completed') {
    return doc
  }

  // Skip if notification fields already exist
  if (doc.type && doc.title) {
    return doc
  }

  // Skip if it was already completed (notification already added)
  if (previousDoc?.status === 'completed') {
    return doc
  }

  try {
    const payload = req.payload

    // Add notification fields to the transaction itself
    await createTransactionNotification({
      payload,
      transaction: {
        id: doc.id,
        user: doc.user,
        intent: doc.intent || 'product',
        status: doc.status,
        amount: doc.amount,
        currency: doc.currency,
        packageName: doc.packageName || 'Transaction',
        plan: doc.plan,
        entitlement: doc.entitlement,
        expiresAt: doc.expiresAt,
        metadata: doc.metadata as any,
      },
      req,
    })

    console.log(`✅ Notification fields added to transaction ${doc.id}`)
  } catch (error) {
    console.error('❌ Failed to add notification fields to transaction:', error)
    // Don't throw - transaction processing should continue even if notification fails
  }

  return doc
}

