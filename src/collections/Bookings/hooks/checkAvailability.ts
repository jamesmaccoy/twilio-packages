import { format } from 'date-fns'
import { APIError, CollectionBeforeChangeHook } from 'payload'

export const checkAvailabilityHook: CollectionBeforeChangeHook = async ({
  data,
  req: { payload },
  req,
  operation,
}) => {
  if (operation === 'update') {
    return data
  }

  if (!('fromDate' in data && 'post' in data)) {
    throw new APIError('Start date and post are required.', 400, undefined, true)
  }

  const { fromDate, toDate } = data

  // Only validate date range if both dates are present
  if (toDate && fromDate >= toDate) {
    throw new APIError('Start date must be before end date.', 400, undefined, true)
  }

  // Skip availability check if toDate is not provided
  if (!toDate) {
    return data
  }

  // Normalize dates to ISO strings for consistent database comparison
  // Use full ISO strings (YYYY-MM-DDTHH:mm:ss.sssZ) for query compatibility
  const normalizeToISOString = (dateStr: string): string => {
    const date = new Date(dateStr)
    const utcDate = new Date(Date.UTC(
      date.getUTCFullYear(),
      date.getUTCMonth(),
      date.getUTCDate(),
      0, 0, 0, 0
    ))
    return utcDate.toISOString()
  }

  const formattedFromDate = format(new Date(fromDate), 'yyyy-MM-dd')
  const formattedToDate = format(new Date(toDate), 'yyyy-MM-dd')
  const fromDateISO = normalizeToISOString(fromDate)
  const toDateISO = normalizeToISOString(toDate)

  const resolveRelationshipId = (value: unknown): string | undefined => {
    if (!value) return undefined
    if (typeof value === 'string') return value
    if (typeof value === 'object' && 'id' in value && typeof (value as any).id === 'string') {
      return (value as any).id
    }
    return undefined
  }

  const targetPackageId = resolveRelationshipId(data?.selectedPackage?.package)

  let concurrencyLimit = 1

  if (targetPackageId) {
    try {
      const packageDoc = await payload.findByID({
        collection: 'packages',
        id: targetPackageId,
        depth: 0,
        req,
      })

      const configuredLimit = Number(packageDoc?.maxConcurrentBookings)
      if (Number.isFinite(configuredLimit) && configuredLimit > 0) {
        concurrencyLimit = configuredLimit
      }
    } catch (error) {
      console.warn(
        `⚠️ Failed to read package ${targetPackageId} maxConcurrentBookings, defaulting to 1.`,
        error,
      )
    }
  }

  // Check if the booking overlaps with existing bookings
  // Use ISO date strings for proper comparison with database ISO timestamps
  const bookings = await payload.find({
    collection: 'bookings',
    where: {
      and: [
        { post: { equals: data.post } },
        { fromDate: { less_than: toDateISO } },
        { toDate: { greater_than: fromDateISO } },
      ],
    },
    limit: 10, // Get more bookings for debugging
    select: {
      slug: true,
      fromDate: true,
      toDate: true,
      title: true,
      id: true,
      selectedPackage: true,
    },
    depth: 0,
    req,
  })

  const resolveBookingPackageId = (booking: any) => resolveRelationshipId(booking?.selectedPackage?.package)

  const conflictingBookings = bookings.docs.filter((booking) => {
    if (!targetPackageId) {
      return true
    }

    const bookingPackageId = resolveBookingPackageId(booking)
    // If booking has no package, it conflicts with everything (property-level booking)
    if (!bookingPackageId) {
      console.log('⚠️ Booking without package found in hook - treating as conflict:', {
        bookingId: booking.id,
        fromDate: booking.fromDate,
        toDate: booking.toDate,
        selectedPackage: booking.selectedPackage,
      })
      return true
    }

    return bookingPackageId === targetPackageId
  })

  const isAvailable = conflictingBookings.length < concurrencyLimit

  if (!isAvailable) {
    console.error('❌ Booking availability check failed:', {
      requestedDates: {
        fromDate: formattedFromDate,
        toDate: formattedToDate,
        post: data.post,
        packageId: targetPackageId,
        concurrencyLimit,
      },
      conflictingBookings: conflictingBookings.map((b) => ({
        id: b.id,
        title: b.title,
        fromDate: b.fromDate,
        toDate: b.toDate,
        packageId: resolveBookingPackageId(b),
      })),
    })
    
    throw new APIError(
      `Booking dates are not available. Found ${conflictingBookings.length} conflicting booking(s) and the limit for this package is ${concurrencyLimit}.`,
      400,
      [
        {
          message: 'The selected dates overlap with an existing booking.',
          conflictingBookings: conflictingBookings.map((b) => ({
            id: b.id,
            title: b.title,
            fromDate: b.fromDate,
            toDate: b.toDate,
            packageId: resolveBookingPackageId(b),
          })),
        },
      ],
      true,
    )
  }

  return data
}
