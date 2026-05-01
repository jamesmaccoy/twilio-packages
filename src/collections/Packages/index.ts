import type { CollectionConfig } from 'payload'
import { hostOwnsPackage } from '../../access/hostOwnsPackage'
import { adminOrHostOwnPackage } from '../../access/adminOrHostOwnPackage'
import { adminOrHostCreatePackage } from '../../access/adminOrHostCreatePackage'

const Packages: CollectionConfig = {
  slug: 'packages',
  access: {
    create: adminOrHostCreatePackage,
    read: hostOwnsPackage,
    update: adminOrHostOwnPackage,
    delete: adminOrHostOwnPackage,
  },
  admin: {
    useAsTitle: 'name',
    defaultColumns: ['name', 'post', 'category', 'isEnabled'],
  },
  hooks: {
    beforeChange: [
      async ({ data, req }) => {
        // Prevent unwanted default value overrides during updates
        // Only apply defaults for new documents (no id) and when values are actually undefined
        // Also pin host ownership based on the related post (or current host).
        try {
          const user = (req as any)?.user
          const role = (user as any)?.role
          const roleArray = Array.isArray(role) ? role : role ? [role] : []
          const isAdmin = roleArray.includes('admin')
          const isHost = roleArray.includes('host')

          if (user && (isAdmin || isHost)) {
            const postValue = (data as any)?.post
            const postId =
              typeof postValue === 'string'
                ? postValue
                : typeof postValue === 'object' && postValue
                  ? postValue?.id
                  : null

            const payload = (req as any)?.payload
            if (postId && payload && typeof payload.findByID === 'function') {
              const post = await payload.findByID({
                collection: 'posts',
                id: String(postId),
                depth: 0,
                overrideAccess: false,
                user,
              })

              const hostId =
                typeof (post as any)?.host === 'string' ? (post as any).host : (post as any)?.host?.id
              if (isHost && !isAdmin && hostId && String(hostId) !== String(user.id)) {
                throw new Error('You cannot attach a package to another host’s property.')
              }
              if (hostId) {
                ;(data as any).host = String(hostId)
              } else if (isHost && user?.id) {
                ;(data as any).host = String(user.id)
              }
            } else if (isHost && user?.id) {
              ;(data as any).host = String(user.id)
            }

            // Hosts cannot change package host ownership away from themselves.
            if (isHost && !isAdmin && user?.id) {
              ;(data as any).host = String(user.id)
            }
          }
        } catch {
          // ignore
        }
        return data
      }
    ]
  },
  fields: [
    {
      name: 'host',
      type: 'relationship',
      relationTo: 'users',
      admin: { position: 'sidebar', readOnly: true },
      access: {
        create: () => false,
        update: () => false,
      },
    },
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
        { label: 'None', value: 'none' },
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