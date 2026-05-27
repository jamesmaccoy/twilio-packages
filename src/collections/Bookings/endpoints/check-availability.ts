import { Endpoint } from 'payload'
import { parseICalFeed } from '@/utilities/parseICalFeed'

const toISODateOnly = (date: Date): string => {
  const iso = date.toISOString()
  const idx = iso.indexOf('T')
  return idx === -1 ? iso : iso.slice(0, idx)
}

export const checkAvailability: Endpoint = {
  method: 'get',
  path: '/check-availability',
  handler: async (req) => {
    const { slug, postId, startDate, endDate, bookingId, packageId } = req.query

    if ((!slug && !postId) || !startDate || !endDate) {
      return Response.json(
        {
          message: 'Post slug/ID and date range (startDate, endDate) are required',
        },
        { status: 400 },
      )
    }

    try {
      let resolvedPostId = typeof postId === 'string' ? postId : undefined
      const targetPackageId = typeof packageId === 'string' ? packageId : undefined

      // If slug is provided, find the post by slug
      let post: any = null
      if (slug && !postId) {
        const posts = await req.payload.find({
          collection: 'posts',
          where: {
            slug: {
              equals: slug,
            },
          },
          select: {
            id: true,
            slug: true,
            googleCalendarUrl: true,
            airbnbCalendarUrl: true,
          },
          limit: 1,
        })

        if (!posts.docs.length) {
          return Response.json({ message: 'Post not found' }, { status: 404 })
        }

        post = posts.docs[0]
        const pid =
          typeof post?.id === 'string' || typeof post?.id === 'number' ? String(post.id) : undefined
        if (!pid) return Response.json({ message: 'Post not found' }, { status: 404 })
        resolvedPostId = pid
      } else if (resolvedPostId) {
        // Fetch post to get Google Calendar URL
        post = await req.payload.findByID({
          collection: 'posts',
          id: resolvedPostId,
          select: {
            id: true,
            googleCalendarUrl: true,
            airbnbCalendarUrl: true,
          },
        })
      }

      const finalPostId: string | undefined = resolvedPostId || (post?.id ? String(post.id) : undefined)

      if (!finalPostId) {
        return Response.json({ message: 'Post not found' }, { status: 404 })
      }

      // Parse the requested date range
      // This will handle various date formats including ISO strings, timestamps, etc.
      const requestStart = new Date(startDate as string)
      const requestEnd = new Date(endDate as string)

      if (isNaN(requestStart.getTime()) || isNaN(requestEnd.getTime())) {
        return Response.json({ message: 'Invalid date format' }, { status: 400 })
      }

      // Normalize dates to midnight UTC to get consistent date-only values
      // Extract just the date part (YYYY-MM-DD) to avoid timezone issues
      // Use UTC methods to ensure consistent normalization
      const normalizeToDateOnly = (date: Date): string => {
        const utcDate = new Date(Date.UTC(
          date.getUTCFullYear(),
          date.getUTCMonth(),
          date.getUTCDate()
        ))
        return toISODateOnly(utcDate)
      }
      
      // Normalize to ISO date strings for consistent database comparison
      // Use full ISO strings (YYYY-MM-DDTHH:mm:ss.sssZ) for query compatibility
      const normalizeToISOString = (date: Date): string => {
        const utcDate = new Date(Date.UTC(
          date.getUTCFullYear(),
          date.getUTCMonth(),
          date.getUTCDate(),
          0, 0, 0, 0
        ))
        return utcDate.toISOString()
      }
      
      const startFormatted = normalizeToDateOnly(requestStart)
      const endFormatted = normalizeToDateOnly(requestEnd)
      const startISO = normalizeToISOString(requestStart)
      const endISO = normalizeToISOString(requestEnd)
      
      console.log('📅 Normalized dates for availability check:', {
        original: { startDate, endDate },
        normalized: { startFormatted, endFormatted },
        iso: { startISO, endISO },
        requestStart: requestStart.toISOString(),
        requestEnd: requestEnd.toISOString(),
      })

      let concurrencyLimit = 1

      if (targetPackageId) {
        try {
          const packageDoc = await req.payload.findByID({
            collection: 'packages',
            id: targetPackageId,
            depth: 0,
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

      const resolveRelationshipId = (value: unknown): string | undefined => {
        if (!value) return undefined
        if (typeof value === 'string') return value
        if (typeof value === 'object' && 'id' in value && typeof (value as any).id === 'string') {
          return (value as any).id
        }
        return undefined
      }

      // Find all bookings for this post that overlap with the requested range
      // Use ISO date strings for proper comparison with database ISO timestamps
      // The overlap condition: booking.fromDate < request.endDate AND booking.toDate > request.startDate
      // Exclude cancelled bookings - they free up dates for other customers
      const whereConditions: Record<string, any>[] = [
        { post: { equals: finalPostId } },
        { fromDate: { less_than: endISO } },
        { toDate: { greater_than: startISO } },
        {
          // Exclude cancelled bookings - they free up dates for other customers
          paymentStatus: {
            not_equals: 'cancelled',
          },
        },
      ]

      if (bookingId && typeof bookingId === 'string') {
        whereConditions.push({
          id: {
            not_equals: bookingId,
          },
        })
      }

      // Get ALL overlapping bookings (not just one) to properly check conflicts
      const bookings = await req.payload.find({
        collection: 'bookings',
        where: {
          and: whereConditions,
        },
        limit: 100, // Get all overlapping bookings to check properly
        select: {
          slug: true,
          selectedPackage: true,
          fromDate: true,
          toDate: true,
          id: true,
          paymentStatus: true,
        },
        depth: 0,
      })

      console.log('🔍 Availability check:', {
        requestedRange: { startFormatted, endFormatted, startISO, endISO },
        targetPackageId,
        totalOverlappingBookings: bookings.docs.length,
        bookings: bookings.docs.map((b: any) => ({
          id: b.id,
          fromDate: b.fromDate,
          toDate: b.toDate,
          paymentStatus: b.paymentStatus,
          selectedPackage: b.selectedPackage,
          packageId: resolveRelationshipId(b?.selectedPackage?.package),
          hasPackage: !!resolveRelationshipId(b?.selectedPackage?.package),
        })),
      })

      const conflictingBookings = bookings.docs.filter((booking: any) => {
        // If no packageId specified, all bookings conflict (property-level availability)
        if (!targetPackageId) {
          return true
        }

        const bookingPackageId = resolveRelationshipId(booking?.selectedPackage?.package)
        
        // If booking has no package, it conflicts with everything (property-level booking)
        // This ensures that bookings without a specific package block all other bookings
        if (!bookingPackageId) {
          console.log('⚠️ Booking without package found - treating as conflict:', {
            bookingId: booking.id,
            fromDate: booking.fromDate,
            toDate: booking.toDate,
            selectedPackage: booking.selectedPackage,
          })
          return true
        }

        // Only check same package for concurrency limits
        // Different packages can coexist if they have different concurrency limits
        return bookingPackageId === targetPackageId
      })

      console.log('🔍 Conflicting bookings after package filter:', {
        targetPackageId,
        conflictingCount: conflictingBookings.length,
        concurrencyLimit,
        isAvailable: conflictingBookings.length < concurrencyLimit,
      })

      // Check Google Calendar availability if configured
      let hasGoogleCalendarConflict = false
      if (post?.googleCalendarUrl) {
        try {
          console.log('📅 Checking Google Calendar for conflicts:', post.googleCalendarUrl)
          const googleCalendarDates = await parseICalFeed(post.googleCalendarUrl)
          
          // Check if any Google Calendar dates overlap with the requested range
          const requestedDates: string[] = []
          const currentDate = new Date(requestStart)
          while (currentDate < requestEnd) {
            const dateISO = toISODateOnly(currentDate)
            requestedDates.push(dateISO)
            currentDate.setUTCDate(currentDate.getUTCDate() + 1)
          }
          
          // Check for overlap
          hasGoogleCalendarConflict = requestedDates.some(date => googleCalendarDates.includes(date))
          
          if (hasGoogleCalendarConflict) {
            console.log('❌ Google Calendar conflict detected for requested dates')
          }
        } catch (error) {
          console.error('Error checking Google Calendar availability:', error)
          // Continue without Google Calendar check if fetch fails
        }
      }

      // Check Airbnb Calendar availability if configured
      let hasAirbnbCalendarConflict = false
      if (post?.airbnbCalendarUrl) {
        try {
          console.log('📅 Checking Airbnb Calendar for conflicts:', post.airbnbCalendarUrl)
          const airbnbCalendarDates = await parseICalFeed(post.airbnbCalendarUrl)
          const requestedDates: string[] = []
          const currentDate = new Date(requestStart)
          while (currentDate < requestEnd) {
            const dateISO = toISODateOnly(currentDate)
            requestedDates.push(dateISO)
            currentDate.setUTCDate(currentDate.getUTCDate() + 1)
          }
          hasAirbnbCalendarConflict = requestedDates.some((date) => airbnbCalendarDates.includes(date))
          if (hasAirbnbCalendarConflict) {
            console.log('❌ Airbnb Calendar conflict detected for requested dates')
          }
        } catch (error) {
          console.error('Error checking Airbnb Calendar availability:', error)
        }
      }

      // If any bookings were found OR Google Calendar has conflicts, the dates are not available
      const isAvailable =
        conflictingBookings.length < concurrencyLimit &&
        !hasGoogleCalendarConflict &&
        !hasAirbnbCalendarConflict

      // If unavailable, find suggested available dates
      let suggestedDates: Array<{ startDate: string; endDate: string; duration: number }> = []
      
      if (!isAvailable) {
        const duration = Math.ceil((requestEnd.getTime() - requestStart.getTime()) / (1000 * 60 * 60 * 24))
        
        // Get all bookings for this post to find gaps
        const allBookings = await req.payload.find({
          collection: 'bookings',
          where: {
            post: { equals: finalPostId },
          },
          select: {
            fromDate: true,
            toDate: true,
          },
          depth: 0,
          limit: 100,
        })

        // Get Google Calendar dates if configured
        const externalCalendarDates = new Set<string>()
        if (post?.googleCalendarUrl) {
          try {
            ;(await parseICalFeed(post.googleCalendarUrl)).forEach((d) => externalCalendarDates.add(d))
          } catch (error) {
            console.error('Error fetching Google Calendar dates for suggestions:', error)
          }
        }
        if (post?.airbnbCalendarUrl) {
          try {
            ;(await parseICalFeed(post.airbnbCalendarUrl)).forEach((d) => externalCalendarDates.add(d))
          } catch (error) {
            console.error('Error fetching Airbnb Calendar dates for suggestions:', error)
          }
        }

        // Find available date ranges (considering both bookings and Google Calendar)
        suggestedDates = findAvailableDateRanges(
          requestStart,
          duration,
          allBookings.docs.map((b: any) => ({
            fromDate: new Date(b.fromDate),
            toDate: new Date(b.toDate),
          })),
          3, // Suggest up to 3 alternative date ranges
          [...externalCalendarDates] // Avoid external calendar conflicts
        )
      }

      return Response.json({
        isAvailable,
        requestedRange: {
          startDate: startFormatted,
          endDate: endFormatted,
        },
        metadata: {
          concurrencyLimit,
          conflictingCount: conflictingBookings.length,
          hasGoogleCalendarConflict,
          hasAirbnbCalendarConflict,
          hasGoogleCalendar: !!post?.googleCalendarUrl,
          hasAirbnbCalendar: !!post?.airbnbCalendarUrl,
        },
        suggestedDates: suggestedDates.length > 0 ? suggestedDates : undefined,
      })
    } catch (error) {
      console.error('Error checking availability:', error)
      return Response.json({ message: 'Error checking availability' }, { status: 500 })
    }
  },
}

// Helper function to find available date ranges near the requested dates
function findAvailableDateRanges(
  requestedStart: Date,
  duration: number,
  existingBookings: Array<{ fromDate: Date; toDate: Date }>,
  maxSuggestions: number = 3,
  googleCalendarDates: string[] = []
): Array<{ startDate: string; endDate: string; duration: number }> {
  const suggestions: Array<{ startDate: string; endDate: string; duration: number }> = []
  
  // Normalize dates to midnight UTC for consistent comparison
  const normalizeDate = (date: Date): Date => {
    const normalized = new Date(date)
    normalized.setUTCHours(0, 0, 0, 0)
    return normalized
  }

  const requestedStartNormalized = normalizeDate(requestedStart)
  
  // Sort bookings by start date
  const sortedBookings = existingBookings
    .map(b => ({
      fromDate: normalizeDate(b.fromDate),
      toDate: normalizeDate(b.toDate)
    }))
    .sort((a, b) => a.fromDate.getTime() - b.fromDate.getTime())

  // Look for gaps before and after the requested date
  const lookBackDays = 30 // Look back 30 days
  const lookForwardDays = 60 // Look forward 60 days
  
  const searchStart = new Date(requestedStartNormalized)
  searchStart.setUTCDate(searchStart.getUTCDate() - lookBackDays)
  
  const searchEnd = new Date(requestedStartNormalized)
  searchEnd.setUTCDate(searchEnd.getUTCDate() + lookForwardDays)

  // Helper to check if a date range conflicts with any booking or Google Calendar event
  const hasConflict = (testStart: Date, testEnd: Date): boolean => {
    // Check bookings
    const bookingConflict = sortedBookings.some(booking => {
      return testStart < booking.toDate && testEnd > booking.fromDate
    })
    
    if (bookingConflict) return true
    
    // Check Google Calendar dates
    if (googleCalendarDates.length > 0) {
      const testDates: string[] = []
      const currentDate = new Date(testStart)
      while (currentDate < testEnd) {
        const dateISO = toISODateOnly(currentDate)
        testDates.push(dateISO)
        currentDate.setUTCDate(currentDate.getUTCDate() + 1)
      }
      
      // Check if any test date is in Google Calendar unavailable dates
      const googleCalendarConflict = testDates.some(date => googleCalendarDates.includes(date))
      if (googleCalendarConflict) return true
    }
    
    return false
  }

  // Check dates before the requested start (earlier options)
  for (let daysBack = 1; daysBack <= lookBackDays && suggestions.length < maxSuggestions; daysBack++) {
    const testStart = new Date(requestedStartNormalized)
    testStart.setUTCDate(testStart.getUTCDate() - daysBack)
    const testEnd = new Date(testStart)
    testEnd.setUTCDate(testEnd.getUTCDate() + duration)

    if (testStart < searchStart) break

    if (!hasConflict(testStart, testEnd)) {
      suggestions.push({
        startDate: toISODateOnly(testStart),
        endDate: toISODateOnly(testEnd),
        duration,
      })
    }
  }

  // Check dates after the requested start (later options)
  for (let daysForward = 1; daysForward <= lookForwardDays && suggestions.length < maxSuggestions; daysForward++) {
    const testStart = new Date(requestedStartNormalized)
    testStart.setUTCDate(testStart.getUTCDate() + daysForward)
    const testEnd = new Date(testStart)
    testEnd.setUTCDate(testEnd.getUTCDate() + duration)

    if (testEnd > searchEnd) break

    if (!hasConflict(testStart, testEnd)) {
      suggestions.push({
        startDate: toISODateOnly(testStart),
        endDate: toISODateOnly(testEnd),
        duration,
      })
    }
  }

  // Sort suggestions by proximity to requested date
  suggestions.sort((a, b) => {
    const aDiff = Math.abs(new Date(a.startDate).getTime() - requestedStartNormalized.getTime())
    const bDiff = Math.abs(new Date(b.startDate).getTime() - requestedStartNormalized.getTime())
    return aDiff - bDiff
  })

  return suggestions.slice(0, maxSuggestions)
}
