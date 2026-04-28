import { adminOrSelfField } from '@/access/adminOrSelfField'
import { isAdminField } from '@/access/isAdminField'
import { isHostField } from '@/access/isHostField'
import { slugField } from '@/fields/slug'
import type { CollectionConfig } from 'payload'

import { generateJwtToken, verifyJwtToken, generateShortToken } from '@/utilities/token'
import { trackGuestJoined } from '@/lib/metaConversions'
import { unavailableDates } from './endpoints/unavailable-dates'
import { checkAvailability } from './endpoints/check-availability'
import { multiPostAvailability } from './endpoints/multi-post-availability'
import { checkAvailabilityHook } from './hooks/checkAvailability'
import { sendBookingConfirmationHook } from './hooks/sendBookingConfirmation'

export const Booking: CollectionConfig = {
  slug: 'bookings',
  labels: {
    singular: 'Booking',
    plural: 'Bookings',
  },
  typescript: {
    interface: 'Booking',
  },
  admin: {
    useAsTitle: 'id',
    defaultColumns: ['customer', 'post', 'fromDate', 'toDate', 'guests'],
  },
  endpoints: [
    unavailableDates,
    checkAvailability,
    multiPostAvailability,
    // This endpoint is used to generate a token for the booking
    // and return it to the customer
    {
      path: '/:bookingId/token',
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

        const _bookingId =
          req.routeParams && 'bookingId' in req.routeParams && req.routeParams.bookingId

        if (!_bookingId || typeof _bookingId !== 'string') {
          return Response.json(
            {
              message: 'Booking ID not provided',
            },
            { status: 400 },
          )
        }

        try {
          // Use findOneAndUpdate to handle concurrent requests
          const booking = await req.payload.findByID({
            collection: 'bookings',
            id: _bookingId,
          })

          if (!booking) {
            return Response.json(
              {
                message: 'Booking not found',
              },
              { status: 404 },
            )
          }

          // Check if user is authorized
          if (
            typeof booking.customer === 'string'
              ? booking.customer !== req.user.id
              : booking.customer?.id !== req.user.id
          ) {
            return Response.json(
              {
                message: 'Unauthorized',
              },
              { status: 401 },
            )
          }

          // If booking already has a token, return it
          if (booking.token) {
            return Response.json({
              token: booking.token,
            })
          }

          // Generate short token for invite URL
          const token = generateShortToken(10)

          // Update booking with new token
          await req.payload.update({
            collection: 'bookings',
            id: _bookingId,
            overrideAccess: true,
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
    // If the token is refreshed, the old token will be invalidated
    {
      path: '/:bookingId/refresh-token',
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

        const _bookingId =
          req.routeParams && 'bookingId' in req.routeParams && req.routeParams.bookingId

        // This is not supposed to happen, but just in case
        if (!_bookingId || typeof _bookingId !== 'string') {
          return Response.json(
            {
              message: 'Booking ID not provided',
            },
            { status: 400 },
          )
        }

        const bookings = await req.payload.find({
          collection: 'bookings',
          where: {
            and: [
              {
                id: {
                  equals: _bookingId,
                },
              },
              {
                customer: {
                  equals: req.user.id,
                },
              },
            ],
          },
          limit: 1,
          pagination: false,
        })

        if (bookings.docs.length === 0) {
          return Response.json(
            {
              message: 'Booking not found',
            },
            { status: 404 },
          )
        }

        const booking = bookings.docs[0]

        if (!booking) {
          return Response.json(
            {
              message: 'Booking not found',
            },
            { status: 404 },
          )
        }

        // Generate short token for invite URL
        const token = generateShortToken(10)

        await req.payload.update({
          collection: 'bookings',
          id: _bookingId,
          overrideAccess: true,
          data: {
            token,
          },
        })
        return Response.json({
          token,
        })
      },
    },

    // This endpoint is used to accept the invite for the booking
    // and add the user to the guests list
    {
      path: '/:bookingId/accept-invite/:token',
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

        const _bookingId =
          req.routeParams && 'bookingId' in req.routeParams && req.routeParams.bookingId

        // This is not suppossed to happen, but just in case
        if (!_bookingId || typeof _bookingId !== 'string') {
          return Response.json(
            {
              message: 'Booking ID not provided',
            },
            { status: 400 },
          )
        }

        const _token = req.routeParams && 'token' in req.routeParams && req.routeParams.token

        // This is not suppossed to happen, but just in case
        if (!_token || typeof _token !== 'string') {
          return Response.json(
            {
              message: 'Token not provided',
            },
            { status: 400 },
          )
        }

        const bookings = await req.payload.find({
          collection: 'bookings',
          where: {
            and: [
              {
                id: {
                  equals: _bookingId,
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

        if (bookings.docs.length === 0) {
          return Response.json(
            {
              message: 'Booking not found',
            },
            { status: 404 },
          )
        }

        const booking = bookings.docs[0]

        if (!booking) {
          return Response.json(
            {
              message: 'Booking not found',
            },
            { status: 404 },
          )
        }

        if (
          booking.guests?.some((guest) =>
            typeof guest === 'string' ? guest === req.user?.id : guest.id === req.user?.id,
          ) ||
          (typeof booking.customer === 'string'
            ? booking.customer === req.user.id
            : booking.customer?.id === req.user.id)
        ) {
          return Response.json({
            message: 'User already in booking',
          })
        }

        await req.payload.update({
          collection: 'bookings',
          id: _bookingId,
          data: {
            guests: [...(booking.guests || []), req.user.id],
          },
        })

        // Fire Meta Conversion event for Facebook Custom Audience (fire-and-forget)
        try {
          await trackGuestJoined({
            resourceId: _bookingId,
            resourceType: 'booking',
            userId: req.user.id,
            userEmail: (req.user as any).email || undefined,
          })
        } catch (_) { }

        return Response.json({
          message: 'Booking updated',
        })
      },
    },

    // Read the token, verify and return the payload
    // This endpoint can be used to get booking id and customer id to fetch the details and show them to the user.
    {
      path: '/token/:token',
      method: 'get',
      handler: async (req) => {
        if (!req.user) {
          return Response.json(
            {
              message: 'Unauthorized',
            },
            { status: 401 },
          )
        }

        const _token = req.routeParams && 'token' in req.routeParams && req.routeParams.token

        // This is not suppossed to happen, but just in case
        if (!_token || typeof _token !== 'string') {
          return Response.json(
            {
              message: 'Token not provided',
            },
            { status: 400 },
          )
        }

        const payload = verifyJwtToken(_token)

        return Response.json(payload)
      },
    },

    // This will remove a guest from the booking
    {
      path: '/:bookingId/guests/:guestId',
      method: 'delete',
      handler: async (req) => {
        if (!req.user) {
          return Response.json(
            {
              message: 'Unauthorized',
            },
            { status: 401 },
          )
        }

        const _bookingId =
          req.routeParams && 'bookingId' in req.routeParams && req.routeParams.bookingId

        // This is not suppossed to happen, but just in case
        if (!_bookingId || typeof _bookingId !== 'string') {
          return Response.json(
            {
              message: 'Booking ID not provided',
            },
            { status: 400 },
          )
        }

        const _guestId = req.routeParams && 'guestId' in req.routeParams && req.routeParams.guestId

        // This is not suppossed to happen, but just in case
        if (!_guestId || typeof _guestId !== 'string') {
          return Response.json(
            {
              message: 'Guest ID not provided',
            },
            { status: 400 },
          )
        }

        const bookings = await req.payload.find({
          collection: 'bookings',
          where: {
            and: [
              {
                id: {
                  equals: _bookingId,
                },
              },
              {
                guests: {
                  contains: _guestId,
                },
              },
              {
                customer: {
                  equals: req.user.id,
                },
              },
            ],
          },
          limit: 1,
          pagination: false,
        })

        if (bookings.docs.length === 0) {
          return Response.json(
            {
              message: 'Booking not found',
            },
            { status: 404 },
          )
        }

        const booking = bookings.docs[0]

        if (!booking || !booking.guests) {
          return Response.json(
            {
              message: 'Booking not found',
            },
            { status: 404 },
          )
        }

        await req.payload.update({
          collection: 'bookings',
          id: _bookingId,
          data: {
            guests: booking.guests.filter((guest) =>
              typeof guest === 'string' ? guest !== _guestId : guest.id !== _guestId,
            ),
          },
        })

        return Response.json({
          message: 'Guest removed from booking',
        })
      },
    },
  ],
  access: {
    // create: ({ req: { user } }) => {
    //   if (!user) return false
    //   const roles = user.role || []
    //   return roles.includes('admin') || roles.includes('customer')
    // },
    // read: ({ req: { user } }) => {
    //   if (!user) return false
    //   if (user.role?.includes('admin')) return true
    //   if (user.role?.includes('customer')) {
    //     return { customer: { equals: user.id } }
    //   }
    //   return false
    // },
    // update: ({ req: { user } }) => {
    //   if (!user) return false
    //   if (user.role?.includes('admin')) return true
    //   if (user.role?.includes('customer')) {
    //     return { customer: { equals: user.id } }
    //   }
    //   return false
    // },
    delete: ({ req: { user } }) => {
      if (!user) return false
      const role = (user as any).role
      const roleArray = Array.isArray(role) ? role : role ? [role] : []
      // Only admins and hosts can delete bookings
      return roleArray.includes('admin') || roleArray.includes('host')
    },
  },
  hooks: {
    beforeChange: [checkAvailabilityHook],
    afterChange: [sendBookingConfirmationHook],
  },
  versions: {
    drafts: false, // We don't need drafts for bookings
    maxPerDoc: 50, // Keep last 50 versions for history
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
      // filterOptions: {
      //   role: {
      //     equals: 'customer',
      //   },
      // },
      access: {
        // Only admin and host can change the customer field
        // Customers cannot change who the booking belongs to
        update: ({ req: { user } }) => {
          if (!user) return false
          const role = (user as any).role
          const roleArray = Array.isArray(role) ? role : role ? [role] : []
          return roleArray.includes('admin') || roleArray.includes('host')
        },
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
          filterOptions: ({ data, siblingData }: { data?: any; siblingData?: any }) => {
            // `post` lives on the booking, not inside selectedPackage group
            const postId = data?.post ?? siblingData?.post
            if (!postId) return true
            return {
              post: {
                equals: postId,
              },
            }
          },
          admin: {
            description: 'Optional. Packages are filtered by the selected property (post).',
          },
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
        {
          label: 'Cancelled',
          value: 'cancelled',
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
      required: false,
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
      name: 'cleaningSchedule',
      label: 'Cleaning Schedule',
      type: 'json',
      required: false,
      admin: {
        position: 'sidebar',
        description: 'Stored cleaning schedule plan for this booking',
      },
    },
    {
      name: 'cleaningSource',
      label: 'Cleaning Source',
      type: 'select',
      required: false,
      options: [
        {
          label: 'Included in Booking',
          value: 'included',
        },
        {
          label: 'Addon Purchase',
          value: 'addon',
        },
      ],
      admin: {
        position: 'sidebar',
        description: 'Whether cleaning was included in the booking or purchased as an addon',
      },
    },
    {
      name: 'addonTransactions',
      label: 'Addon Transactions',
      type: 'relationship',
      relationTo: 'yoco-transactions',
      hasMany: true,
      required: false,
      admin: {
        position: 'sidebar',
        description: 'Transactions for addons purchased for this booking',
      },
    },
    {
      name: 'activity',
      type: 'array',
      label: 'Activity',
      required: false,
      admin: {
        position: 'sidebar',
        description: 'Comments and activity log (inherited from estimate if converted)'
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
}
