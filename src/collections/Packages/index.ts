import type { CollectionConfig } from 'payload'
import { authenticated } from '../../access/authenticated'
import { adminOrSelf } from '../../access/adminOrSelf'
import { adminOrHost } from '../../access/adminOrHost'

const Packages: CollectionConfig = {
  slug: 'packages',
  access: {
    create: adminOrHost,
    read: authenticated,
    update: adminOrHost,
    delete: adminOrHost,
  },
  admin: {
    useAsTitle: 'name',
    defaultColumns: ['name', 'post', 'category', 'isEnabled'],
  },
  hooks: {
    beforeChange: [
      ({ data }) => {
        // Prevent unwanted default value overrides during updates
        // Only apply defaults for new documents (no id) and when values are actually undefined
        return data
      }
    ]
  },
  fields: [
    {
      name: 'post',
      type: 'relationship',
      relationTo: 'posts',
      required: true,
      admin: { position: 'sidebar' },
    },
    { name: 'name', type: 'text', required: true },
    { name: 'description', type: 'textarea' },
    { 
      name: 'multiplier', 
      type: 'number', 
      required: false, // Changed to false to prevent forced defaults
      defaultValue: 1, 
      min: 0.1, 
      max: 3.0, 
      admin: { step: 0.01 } 
    },
    {
      name: 'features',
      type: 'array',
      fields: [{ name: 'feature', type: 'text' }],
    },
    {
      name: 'category',
      type: 'select',
      options: [
        { label: 'Standard', value: 'standard' },
        { label: 'Hosted', value: 'hosted' },
        { label: 'Add-on', value: 'addon' },
        { label: 'Special', value: 'special' },
      ],
      required: false, // Changed to false to prevent forced defaults
      defaultValue: 'standard',
    },
    {
      name: 'entitlement',
      type: 'select',
      options: [
        { label: 'Standard', value: 'standard' },
        { label: 'Pro', value: 'pro' },
      ],
      required: false,
      defaultValue: 'standard',
    },
    { 
      name: 'minNights', 
      type: 'number', 
      required: false, // Changed to false to prevent forced defaults
      defaultValue: 1, 
      min: 0.5, // Allow 0.5 for hourly packages (half-day), 1 for nightly
      admin: {
        description: 'Minimum nights. Use 0.5 for hourly/half-day packages, 1 for nightly packages.'
      }
    },
    { 
      name: 'maxNights', 
      type: 'number', 
      required: false, // Changed to false to prevent forced defaults
      defaultValue: 7, 
      min: 0.5 
    },
    {
      name: 'maxConcurrentBookings',
      label: 'Simultaneous bookings allowed',
      type: 'number',
      required: false,
      defaultValue: 1,
      min: 1,
      admin: {
        position: 'sidebar',
        description:
          'Number of bookings allowed for the same dates with this package. Leave at 1 to block overlaps.',
      },
    },
    { 
      name: 'revenueCatId', 
      type: 'text',
      admin: {
        description: 'Legacy RevenueCat product ID (deprecated, use yocoId instead)'
      }
    },
    { 
      name: 'yocoId', 
      type: 'text',
      admin: {
        description: 'Yoco product ID for payment processing'
      }
    },
    {
      name: 'relatedPage',
      type: 'relationship',
      relationTo: 'pages',
      required: false,
      hasMany: false,
      admin: { 
        position: 'sidebar',
        description: 'Link to a page containing sensitive information like check-in instructions or house manual'
      },
    },
    { name: 'isEnabled', type: 'checkbox', defaultValue: true },
    {
      name: 'baseRate',
      type: 'number',
      required: false,
      min: 0,
      validate: (val) => {
        if (val === null || val === undefined || val === '') return true
        const n = typeof val === 'number' ? val : Number(val)
        if (!Number.isFinite(n)) return 'Base rate must be a number'
        if (n < 0) return 'Base rate must be 0 or greater'
        if (!Number.isInteger(n)) return 'Base rate must be a whole number of rands'
        return true
      },
      admin: { step: 1 },
    },
  ],
}

export default Packages 