import { adminOrSelfField } from '@/access/adminOrSelfField'
import { isAdmin } from '@/access/isAdmin'
import { isAdminField } from '@/access/isAdminField'
import { slugField } from '@/fields/slug'
import type { CollectionConfig } from 'payload'
import { adminOrSelfOrGuests } from '../Bookings/access/adminOrSelfOrGuests'
import { generateJwtToken, verifyJwtToken, generateShortToken } from '@/utilities/token'
import { trackEstimateCreated, trackGuestJoined } from '@/lib/metaConversions'
import jwt from 'jsonwebtoken'

export const Estimate: CollectionConfig = {
  slug: 'estimates',
  labels: {
    singular: 'Estimate',
    plural: 'Estimates',
  },
  typescript: {
    interface: 'Estimate',
  },
  admin: {
    useAsTitle: 'id',
    defaultColumns: ['customer', 'post', 'fromDate', 'toDate', 'guests'],
  },
  endpoints: [
    // This endpoint is used to generate a token for the estimate
    // and return it to the customer
    {
      path: '/:estimateId/token',
      method: 'post',
      handler: async (req) => {
        const getCookieValue = (cookieHeader: string, name: string): string | null => {
          const parts = cookieHeader.split(';').map((p) => p.trim())
          for (const part of parts) {
            if (!part) continue
            const idx = part.indexOf('=')
            if (idx <= 0) continue
            const k = part.slice(0, idx).trim()
            const v = part.slice(idx + 1)
            if (k === name) return decodeURIComponent(v)
          }
          return null
        }

        // Some runtimes don't populate req.user for legacy cookies.
        // Fallback to reading the auth token cookie and loading the user.
        let actorUser = req.user
        if (!actorUser) {
          try {
            const cookieHeader = typeof req.headers?.get === 'function' ? req.headers.get('cookie') : null
            const cookiePrefix = (req.payload as any)?.config?.cookiePrefix
            const prefixToken =
              cookieHeader && cookiePrefix ? getCookieValue(cookieHeader, `${cookiePrefix}-token`) : null
            const legacyToken = cookieHeader ? getCookieValue(cookieHeader, 'payload-token') : null
            const token = prefixToken || legacyToken
            if (token) {
              const decoded = jwt.verify(token, req.payload.secret) as any
              const id = decoded && typeof decoded === 'object' ? decoded.id : null
              if (typeof id === 'string' && id.length > 0) {
                actorUser = await req.payload.findByID({
                  collection: 'users',
                  id,
                  overrideAccess: true,
                  depth: 0,
                })
              }
            }
          } catch {}
        }

        if (!actorUser) {
          return Response.json(
            {
              message: 'Unauthorized',
            },
            { status: 401 },
          )
        }

        const _estimateId =
          req.routeParams && 'estimateId' in req.routeParams && req.routeParams.estimateId

        if (!_estimateId || typeof _estimateId !== 'string') {
          return Response.json(
            {
              message: 'Estimate ID not provided',
            },
            { status: 400 },
          )
        }

        try {
          // Use findOneAndUpdate to handle concurrent requests
          const estimate = await req.payload.findByID({
            collection: 'estimates',
            id: _estimateId,
          })

          if (!estimate) {
            return Response.json(
              {
                message: 'Estimate not found',
              },
              { status: 404 },
            )
          }

          // Prevent generating share links for expired/past-date estimates
          if (estimate.toDate) {
            const toDate = new Date(estimate.toDate as any)
            if (!Number.isNaN(toDate.getTime()) && toDate.getTime() < Date.now()) {
              return Response.json(
                {
                  message: 'Estimate has expired',
                },
                { status: 410 },
              )
            }
          }

          const roleValue = (req.user as any)?.role
          const roleArray = Array.isArray(roleValue) ? roleValue : roleValue ? [roleValue] : []
          const isAdminOrHost = roleArray.includes('admin') || roleArray.includes('host')
          const isCustomer =
            typeof estimate.customer === 'string'
              ? estimate.customer === actorUser.id
              : estimate.customer?.id === actorUser.id

          // Check if user is authorized (customer OR admin/host)
          if (!isCustomer && !isAdminOrHost) {
            return Response.json(
              {
                message: 'Unauthorized',
              },
              { status: 401 },
            )
          }

          // If estimate already has a token, return it
          if (estimate.token) {
            return Response.json({
              token: estimate.token,
            })
          }

          // Generate short token for invite URL
          const token = generateShortToken(10)

          // Update estimate with new token
          await req.payload.update({
            collection: 'estimates',
            id: _estimateId,
            data: {
              token,
            },
          })

          return Response.json({
            token,
          })
        } catch (error) {
          console.error('Error generating token:', error)
          return Response.json(
            {
              message: 'Failed to generate token',
            },
            { status: 500 },
          )
        }
      },
    },
    // This endpoint is used to refresh the current token.
    {
      path: '/:estimateId/refresh-token',
      method: 'post',
      handler: async (req) => {
        const getCookieValue = (cookieHeader: string, name: string): string | null => {
          const parts = cookieHeader.split(';').map((p) => p.trim())
          for (const part of parts) {
            if (!part) continue
            const idx = part.indexOf('=')
            if (idx <= 0) continue
            const k = part.slice(0, idx).trim()
            const v = part.slice(idx + 1)
            if (k === name) return decodeURIComponent(v)
          }
          return null
        }

        let actorUser = req.user
        if (!actorUser) {
          try {
            const cookieHeader = typeof req.headers?.get === 'function' ? req.headers.get('cookie') : null
            const cookiePrefix = (req.payload as any)?.config?.cookiePrefix
            const prefixToken =
              cookieHeader && cookiePrefix ? getCookieValue(cookieHeader, `${cookiePrefix}-token`) : null
            const legacyToken = cookieHeader ? getCookieValue(cookieHeader, 'payload-token') : null
            const token = prefixToken || legacyToken
            if (token) {
              const decoded = jwt.verify(token, req.payload.secret) as any
              const id = decoded && typeof decoded === 'object' ? decoded.id : null
              if (typeof id === 'string' && id.length > 0) {
                actorUser = await req.payload.findByID({
                  collection: 'users',
                  id,
                  overrideAccess: true,
                  depth: 0,
                })
              }
            }
          } catch {}
        }

        if (!actorUser) {
          return Response.json(
            {
              message: 'Unauthorized',
            },
            { status: 401 },
          )
        }

        const _estimateId =
          req.routeParams && 'estimateId' in req.routeParams && req.routeParams.estimateId

        // This is not supposed to happen, but just in case
        if (!_estimateId || typeof _estimateId !== 'string') {
          return Response.json(
            {
              message: 'Estimate ID not provided',
            },
            { status: 400 },
          )
        }

        const roleValue = (actorUser as any)?.role
        const roleArray = Array.isArray(roleValue) ? roleValue : roleValue ? [roleValue] : []
        const isAdminOrHost = roleArray.includes('admin') || roleArray.includes('host')

        const estimates = await req.payload.find({
          collection: 'estimates',
          where: isAdminOrHost
            ? {
                id: {
                  equals: _estimateId,
                },
              }
            : {
                and: [
                  {
                    id: {
                      equals: _estimateId,
                    },
                  },
                  {
                    customer: {
                      equals: actorUser.id,
                    },
                  },
                ],
              },
          limit: 1,
          pagination: false,
        })

        if (estimates.docs.length === 0) {
          return Response.json(
            {
              message: 'Estimate not found',
            },
            { status: 404 },
          )
        }

        const estimate = estimates.docs[0]

        if (!estimate) {
          return Response.json(
            {
              message: 'Estimate not found',
            },
            { status: 404 },
          )
        }

        // Prevent refreshing share links for expired/past-date estimates
        if (estimate.toDate) {
          const toDate = new Date(estimate.toDate as any)
          if (!Number.isNaN(toDate.getTime()) && toDate.getTime() < Date.now()) {
            return Response.json(
              {
                message: 'Estimate has expired',
              },
              { status: 410 },
            )
          }
        }

        // Generate short token for invite URL
        const token = generateShortToken(10)

        await req.payload.update({
          collection: 'estimates',
          id: _estimateId,
          data: {
            token,
          },
        })
        return Response.json({
          token,
        })
      },
    },
    // This endpoint is used to accept the invite for the estimate
    // and add the user to the guests list
    {
      path: '/:estimateId/accept-invite/:token',
      method: 'post',
      handler: async (req) => {
        if (!req.user) {
          return Response.json(
            {
              message: 'Unauthorized',
            },
            { status: 401 },
          )
        }

        const _estimateId =
          req.routeParams && 'estimateId' in req.routeParams && req.routeParams.estimateId

        if (!_estimateId || typeof _estimateId !== 'string') {
          return Response.json(
            {
              message: 'Estimate ID not provided',
            },
            { status: 400 },
          )
        }

        const _token = req.routeParams && 'token' in req.routeParams && req.routeParams.token

        if (!_token || typeof _token !== 'string') {
          return Response.json(
            {
              message: 'Token not provided',
            },
            { status: 400 },
          )
        }

        const estimates = await req.payload.find({
          collection: 'estimates',
          where: {
            and: [
              {
                id: {
                  equals: _estimateId,
                },
              },
              {
                token: {
                  equals: _token,
                },
              },
            ],
          },
          limit: 1,
          pagination: false,
        })

        if (estimates.docs.length === 0) {
          return Response.json(
            {
              message: 'Estimate not found',
            },
            { status: 404 },
          )
        }

        const estimate = estimates.docs[0]

        if (!estimate) {
          return Response.json(
            {
              message: 'Estimate not found',
            },
            { status: 404 },
          )
        }

        // Block accepting invites for expired/past-date estimates
        if (estimate.toDate) {
          const toDate = new Date(estimate.toDate as any)
          if (!Number.isNaN(toDate.getTime()) && toDate.getTime() < Date.now()) {
            return Response.json(
              {
                message: 'Estimate has expired',
              },
              { status: 410 },
            )
          }
        }

        if (
          estimate.guests?.some((guest) =>
            typeof guest === 'string' ? guest === req.user?.id : guest.id === req.user?.id,
          ) ||
          (typeof estimate.customer === 'string'
            ? estimate.customer === req.user.id
            : estimate.customer?.id === req.user.id)
        ) {
          return Response.json({
            message: 'User already in estimate',
          })
        }

        await req.payload.update({
          collection: 'estimates',
          id: _estimateId,
          data: {
            guests: [...(estimate.guests || []), req.user.id],
          },
        })

        // Fire Meta Conversion event for Facebook Custom Audience (fire-and-forget)
        try {
          await trackGuestJoined({
            resourceId: _estimateId,
            resourceType: 'estimate',
            userId: req.user.id,
            userEmail: (req.user as any).email || undefined,
          })
        } catch (_) { }

        return Response.json({
          message: 'Estimate updated',
        })
      },
    },
  ],
  access: {
    // create: ({ req: { user } }) => {
    //   if (!user) return false
    //   const roles = (user as any).role || []
    //   return roles.includes('admin') || roles.includes('customer')
    // },
    // read: ({ req: { user } }) => {
    //   if (!user) return false
    //   if ((user as any).role?.includes('admin')) return true
    //   if ((user as any).role?.includes('customer')) {
    //     return { customer: { equals: user.id } }
    //   }
    //   return false
    // },
    // update: ({ req: { user } }) => {
    //   if (!user) return false
    //   if ((user as any).role?.includes('admin')) return true
    //   if ((user as any).role?.includes('customer')) {
    //     return { customer: { equals: user.id } }
    //   }
    //   return false
    // },
    // delete: ({ req: { user } }) => {
    //   if (!user) return false
    //   if ((user as any).role?.includes('admin')) return true
    //   if ((user as any).role?.includes('customer')) {
    //     return { customer: { equals: user.id } }
    //   }
    //   return false
    // },
  },
  fields: [
    {
      name: 'title',
      label: 'Title',
      type: 'text',
      required: true,
      access: {
        update: isAdminField,
      },
    },
    {
      name: 'customer',
      type: 'relationship',
      relationTo: 'users',
      required: true,
      access: {
        update: isAdminField,
      },
    },
    {
      name: 'token',
      label: 'Token',
      type: 'text',
      required: false,
      admin: {
        readOnly: true,
        hidden: true,
      },
    },
    {
      name: 'guests',
      type: 'relationship',
      hasMany: true,
      relationTo: 'users',
      access: {
        update: adminOrSelfField('customer'),
      },
      admin: {
        isSortable: true,
      },
    },
    {
      name: 'total',
      type: 'number',
      required: true,
      access: {
        update: isAdminField,
      },
    },
    {
      name: 'selectedPackage',
      type: 'group',
      fields: [
        {
          name: 'package',
          type: 'relationship',
          relationTo: 'packages',
          required: false,
        },
        {
          name: 'customName',
          type: 'text',
          required: false,
        },
        {
          name: 'enabled',
          type: 'checkbox',
          defaultValue: true,
        },
      ],
    },
    ...slugField('title', {
      checkboxOverrides: {
        access: {
          update: isAdminField,
        },
      },
      slugOverrides: {
        access: {
          update: isAdminField,
        },
      },
    }),
    {
      name: 'post',
      relationTo: 'posts',
      type: 'relationship',
      required: true,
      access: {
        update: isAdminField,
      },
    },
    {
      name: 'paymentStatus',
      label: 'Payment Status',
      type: 'select',
      admin: {
        position: 'sidebar',
      },
      options: [
        {
          label: 'Paid',
          value: 'paid',
        },
        {
          label: 'Unpaid',
          value: 'unpaid',
        },
      ],
      access: {
        update: isAdminField,
      },
    },
    {
      name: 'fromDate',
      type: 'date',
      required: true,
      index: true,
      label: 'Check-in Date',
      admin: {
        position: 'sidebar',
        date: {
          pickerAppearance: 'dayAndTime',
        },
      },
      access: {
        update: isAdminField,
      },
    },
    {
      name: 'toDate',
      type: 'date',
      required: true,
      label: 'Check-out Date',
      admin: {
        position: 'sidebar',
        date: {
          pickerAppearance: 'dayAndTime',
        },
      },
      access: {
        update: isAdminField,
      },
    },
    {
      name: 'packageType',
      type: 'text',
      required: false,
      admin: {
        position: 'sidebar',
      },
    },
    {
      name: 'status',
      type: 'select',
      options: [
        { label: 'Pending', value: 'pending' },
        { label: 'Approved', value: 'approved' },
        { label: 'Rejected', value: 'rejected' },
        { label: 'Completed', value: 'completed' },
      ],
      defaultValue: 'pending',
      admin: {
        position: 'sidebar',
      },
    },
    {
      name: 'requestType',
      type: 'select',
      options: [
        { label: 'Initial Request', value: 'initial' },
        { label: 'New Estimate', value: 'new_estimate' },
        { label: 'Modification', value: 'modification' },
      ],
      defaultValue: 'initial',
      admin: {
        position: 'sidebar',
      },
    },
    {
      name: 'originalBooking',
      type: 'relationship',
      relationTo: 'bookings',
      required: false,
      admin: {
        position: 'sidebar',
        description: 'Original booking this estimate request is based on'
      },
    },
    {
      name: 'customerName',
      type: 'text',
      required: false,
      admin: {
        position: 'sidebar',
      },
    },
    {
      name: 'customerEmail',
      type: 'email',
      required: false,
      admin: {
        position: 'sidebar',
      },
    },
    {
      name: 'notes',
      type: 'textarea',
      required: false,
      admin: {
        position: 'sidebar',
        description: 'Additional notes about this estimate request'
      },
    },
    {
      name: 'activity',
      type: 'array',
      label: 'Activity',
      required: false,
      admin: {
        position: 'sidebar',
        description: 'Comments and activity log for this estimate'
      },
      fields: [
        {
          name: 'user',
          type: 'relationship',
          relationTo: 'users',
          required: true,
        },
        {
          name: 'userName',
          type: 'text',
          required: false,
          admin: {
            description: 'Cached user name for display'
          },
        },
        {
          name: 'userEmail',
          type: 'email',
          required: false,
          admin: {
            description: 'Cached user email for Gravatar display'
          },
        },
        {
          name: 'type',
          type: 'select',
          required: true,
          options: [
            { label: 'Comment', value: 'comment' },
            { label: 'Viewed', value: 'viewed' },
            { label: 'Declined', value: 'declined' },
            { label: 'Approved', value: 'approved' },
          ],
          defaultValue: 'comment',
        },
        {
          name: 'content',
          type: 'textarea',
          required: false,
          admin: {
            description: 'Comment or activity description'
          },
        },
        {
          name: 'timestamp',
          type: 'date',
          required: true,
          admin: {
            date: {
              pickerAppearance: 'dayAndTime',
            },
          },
        },
      ],
    },
  ],
  hooks: {
    beforeChange: [
      async ({ data, req, operation }) => {
        if (operation === 'create' && !data.token) {
          // Generate short token for invite URL
          const token = generateShortToken(10)
          return { ...data, token }
        }
        return data
      },
    ],
    afterChange: [
      async ({ doc, req, operation }) => {
        if (operation === 'create') {
          // Fire Meta Conversion event for Facebook Custom Audience (fire-and-forget)
          try {
            const customerId = typeof doc.customer === 'string' ? doc.customer : doc.customer?.id
            const customerEmail = (req.user as any)?.email ||
              (typeof doc.customer === 'object' ? (doc.customer as any)?.email : undefined)
            const postId = typeof doc.post === 'string' ? doc.post : (doc.post as any)?.id
            const postTitle = typeof doc.post === 'object' ? (doc.post as any)?.title : undefined
            await trackEstimateCreated({
              estimateId: doc.id,
              estimateValue: doc.total ? Number(doc.total) : undefined,
              postId,
              postTitle,
              packageType: doc.packageType || undefined,
              userId: customerId,
              userEmail: customerEmail,
            })
          } catch (_) { }
        }
        return doc
      },
    ],
  },
}
