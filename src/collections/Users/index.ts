import type { CollectionConfig } from 'payload'
import { isAdmin } from '../../access/isAdmin'
import { adminOrSelf } from '../../access/adminOrSelf'

export const Users: CollectionConfig = {
  slug: 'users',
  auth: true,
  admin: {
    useAsTitle: 'name',
    defaultColumns: ['name', 'role', 'email', 'subscriptionStatus'],
  },
  access: {
    create: isAdmin,
    read: adminOrSelf('id'),
    update: adminOrSelf('id'),
    delete: isAdmin,
  },
  fields: [
    {
      name: 'name',
      type: 'text',
      required: true,
    },
    {
      name: 'email',
      type: 'email',
      required: true,
      unique: true,
    },
    {
      name: 'mobile',
      type: 'text',
      required: true,
      unique: true,
    },
    {
      name: 'role',
      type: 'select',
      options: [
        { label: 'Guest', value: 'guest' },
        { label: 'Customer', value: 'customer' },
        { label: 'Host', value: 'host' },
        { label: 'Admin', value: 'admin' },
      ],
      defaultValue: 'guest',
      required: true,
    },
    {
      name: 'subscriptionStatus',
      type: 'group',
      fields: [
        {
          name: 'status',
          type: 'select',
          options: [
            { label: 'None', value: 'none' },
            { label: 'Trial', value: 'trial' },
            { label: 'Active', value: 'active' },
            { label: 'Past Due', value: 'past_due' },
            { label: 'Canceled', value: 'canceled' },
          ],
          defaultValue: 'none',
        },
        {
          name: 'plan',
          type: 'select',
          options: [
            { label: 'Free', value: 'free' },
            { label: 'Basic', value: 'basic' },
            { label: 'Pro', value: 'pro' },
            { label: 'Enterprise', value: 'enterprise' },
          ],
          defaultValue: 'free',
        },
        {
          name: 'expiresAt',
          type: 'date',
        },
        {
          name: 'revenueCatCustomerId',
          type: 'text',
        },
      ],
    },
    {
      name: 'paymentValidation',
      type: 'group',
      fields: [
        {
          name: 'lastPaymentDate',
          type: 'date',
        },
        {
          name: 'paymentMethod',
          type: 'select',
          options: [
            { label: 'None', value: 'none' },
            { label: 'Credit Card', value: 'credit_card' },
            { label: 'PayPal', value: 'paypal' },
            { label: 'Apple Pay', value: 'apple_pay' },
          ],
          defaultValue: 'none',
        },
        {
          name: 'paymentStatus',
          type: 'select',
          options: [
            { label: 'Pending', value: 'pending' },
            { label: 'Completed', value: 'completed' },
            { label: 'Failed', value: 'failed' },
            { label: 'Refunded', value: 'refunded' },
          ],
          defaultValue: 'pending',
        },
      ],
    },
    {
      name: 'hostProfile',
      type: 'group',
      fields: [
        {
          name: 'isVerified',
          type: 'checkbox',
          defaultValue: false,
        },
        {
          name: 'verificationDate',
          type: 'date',
        },
        {
          name: 'hostRating',
          type: 'number',
          min: 0,
          max: 5,
          admin: {
            step: 0.1,
          },
        },
        {
          name: 'totalBookings',
          type: 'number',
          defaultValue: 0,
        },
        {
          name: 'bio',
          type: 'textarea',
        },
        {
          name: 'specialties',
          type: 'array',
          fields: [
            {
              name: 'specialty',
              type: 'text',
            },
          ],
        },
      ],
      admin: {
        condition: (data) => data.role === 'host',
      },
    },
  ],
}
