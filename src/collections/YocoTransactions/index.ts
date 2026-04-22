import type { CollectionConfig } from 'payload'
import { isAdmin } from '../../access/isAdmin'
import { createTransactionNotificationHook } from './hooks/createNotification'

/**
 * Consolidated YocoTransactions & Notifications collection
 * Handles both payment transactions and user notifications as the same concept
 * Transaction fields are optional for notification-only records
 */
export const YocoTransactions: CollectionConfig = {
  slug: 'yoco-transactions',
  labels: {
    singular: 'Transaction / Notification',
    plural: 'Transactions / Notifications',
  },
  admin: {
    useAsTitle: 'title', // Falls back to packageName if title is empty
    defaultColumns: ['title', 'packageName', 'type', 'status', 'user', 'read', 'amount', 'createdAt'],
  },
  access: {
    create: () => true,
    read: ({ req }) => {
      const role = req.user?.role
      const isAdminRole = Array.isArray(role) ? role.includes('admin') : role === 'admin'
      if (isAdminRole) return true
      if (!req.user) return false
      return {
        user: {
          equals: req.user.id,
        },
      }
    },
    update: ({ req }) => {
      const role = req.user?.role
      const isAdminRole = Array.isArray(role) ? role.includes('admin') : role === 'admin'
      if (isAdminRole) return true
      if (!req.user) return false
      return {
        user: {
          equals: req.user.id,
        },
      }
    },
    delete: isAdmin,
  },
  fields: [
    {
      name: 'user',
      type: 'relationship',
      relationTo: 'users',
      required: true,
      index: true,
    },
    // Notification fields (for all records)
    {
      name: 'type',
      type: 'select',
      options: [
        { label: 'Booking Created', value: 'booking_created' },
        { label: 'Booking Updated', value: 'booking_updated' },
        { label: 'Booking Cancelled', value: 'booking_cancelled' },
        { label: 'Booking Rescheduled', value: 'booking_rescheduled' },
        { label: 'Add-on Purchased', value: 'addon_purchased' },
        { label: 'Payment Received', value: 'payment_received' },
        { label: 'Estimate Created', value: 'estimate_created' },
        { label: 'Estimate Confirmed', value: 'estimate_confirmed' },
        { label: 'Subscription Renewed', value: 'subscription_renewed' },
        { label: 'Subscription Cancelled', value: 'subscription_cancelled' },
      ],
      admin: {
        description: 'Notification type (required for notifications)',
      },
    },
    {
      name: 'title',
      type: 'text',
      admin: {
        description: 'Notification title (required for notifications)',
      },
    },
    {
      name: 'description',
      type: 'textarea',
      admin: {
        description: 'Notification description',
      },
    },
    {
      name: 'read',
      type: 'checkbox',
      defaultValue: false,
      admin: {
        description: 'Whether the notification has been read',
        position: 'sidebar',
      },
    },
    {
      name: 'actionUrl',
      type: 'text',
      admin: {
        description: 'URL to navigate to when notification is clicked',
      },
    },
    // Transaction fields (optional, for payment transactions)
    {
      name: 'intent',
      type: 'select',
      options: [
        { label: 'Booking', value: 'booking' },
        { label: 'Subscription', value: 'subscription' },
        { label: 'Product', value: 'product' },
        { label: 'Notification Only', value: 'notification' },
      ],
      defaultValue: 'product',
      admin: {
        description: 'Transaction intent (optional for notification-only records)',
      },
    },
    {
      name: 'status',
      type: 'select',
      options: [
        { label: 'Pending', value: 'pending' },
        { label: 'Completed', value: 'completed' },
        { label: 'Failed', value: 'failed' },
        { label: 'Cancelled', value: 'cancelled' },
      ],
      defaultValue: 'pending',
      admin: {
        description: 'Transaction status (optional for notification-only records)',
      },
    },
    {
      name: 'productId',
      type: 'text',
    },
    {
      name: 'packageName',
      type: 'text',
      admin: {
        description: 'Package name (used for both transactions and notifications)',
      },
    },
    {
      name: 'amount',
      type: 'number',
      admin: {
        step: 0.01,
        description: 'Transaction amount (optional for notification-only records)',
      },
    },
    {
      name: 'currency',
      type: 'text',
      defaultValue: 'ZAR',
    },
    {
      name: 'paymentLinkId',
      type: 'text',
    },
    {
      name: 'paymentUrl',
      type: 'text',
    },
    {
      name: 'entitlement',
      type: 'select',
      options: [
        { label: 'None', value: 'none' },
        { label: 'Standard', value: 'standard' },
        { label: 'Pro', value: 'pro' },
      ],
      defaultValue: 'none',
    },
    {
      name: 'plan',
      type: 'select',
      options: [
        { label: 'Free', value: 'free' },
        { label: 'Standard', value: 'standard' },
        { label: 'Pro', value: 'pro' },
      ],
    },
    {
      name: 'periodDays',
      type: 'number',
      admin: {
        step: 1,
      },
    },
    {
      name: 'expiresAt',
      type: 'date',
    },
    {
      name: 'completedAt',
      type: 'date',
    },
    // Relationships (for notifications)
    {
      name: 'relatedBooking',
      type: 'relationship',
      relationTo: 'bookings',
      required: false,
      admin: {
        position: 'sidebar',
      },
    },
    {
      name: 'relatedEstimate',
      type: 'relationship',
      relationTo: 'estimates',
      required: false,
      admin: {
        position: 'sidebar',
      },
    },
    {
      name: 'relatedTransaction',
      type: 'relationship',
      relationTo: 'yoco-transactions',
      required: false,
      admin: {
        description: 'Related transaction (for notification records)',
        position: 'sidebar',
      },
    },
    {
      name: 'metadata',
      type: 'json',
      admin: {
        description: 'Additional metadata (package info, changes, etc.)',
      },
    },
  ],
  hooks: {
    afterChange: [createTransactionNotificationHook],
  },
  timestamps: true,
  indexes: [
    {
      fields: ['user', 'createdAt'],
    },
    {
      fields: ['user', 'read'],
    },
    {
      fields: ['type'],
    },
    {
      fields: ['status'],
    },
  ],
  versions: {
    drafts: false,
    maxPerDoc: 20, // Keep transaction/notification history
  },
}

export default YocoTransactions

