import { Purchases } from '@revenuecat/purchases-js'
import { Endpoint } from 'payload'
import { parseICalFeed } from '@/utilities/parseICalFeed'

export const unavailableDates: Endpoint = {
  method: 'get',
  path: '/unavailable-dates',
  handler: async (req) => {
    const { slug, postId } = req.query

    if (!slug && !postId) {
      return Response.json({ message: 'Post slug or ID is required' }, { status: 400 })
    }

    if (!req.user) {
      return Response.json({ message: 'Unauthorized' }, { status: 401 })
    }

    const isSubscribed = await hasSubscription(req.user.id)

    if (!isSubscribed) {
      return Response.json({
        unavailableDates: [],
      })
    }

    try {
      let resolvedPostId = postId

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
        resolvedPostId = post.id
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

      // Find all bookings for this post with package information
      // Use depth: 1 to properly populate the selectedPackage relationship
      // Exclude cancelled bookings (paymentStatus: 'cancelled') so their dates become available
      const bookings = await req.payload.find({
        collection: 'bookings',
        where: {
          and: [
            {
              post: {
                equals: resolvedPostId,
              },
            },
            {
              // Exclude cancelled bookings - they free up dates for other customers
              paymentStatus: {
                not_equals: 'cancelled',
              },
            },
          ],
        },
        limit: 1000,
        select: {
          fromDate: true,
          toDate: true,
          selectedPackage: true,
          paymentStatus: true,
        },
        depth: 1, // Increased depth to properly resolve selectedPackage.package relationship
      })

      // Helper to resolve package ID from booking (matches check-availability logic)
      const resolvePackageId = (booking: any): string | null => {
        if (!booking?.selectedPackage) {
          return null
        }
        
        const pkg = booking.selectedPackage.package
        if (!pkg) {
          return null
        }
        
        // Handle different formats: string ID, object with id, or nested object
        if (typeof pkg === 'string') {
          return pkg
        }
        
        if (typeof pkg === 'object') {
          if ('id' in pkg) {
            return pkg.id
          }
          // Sometimes Payload returns nested structure
          if (pkg && typeof pkg === 'object' && 'value' in pkg) {
            return typeof pkg.value === 'string' ? pkg.value : pkg.value?.id
          }
        }
        
        return null
      }

      // Get all enabled packages for this post to check concurrency limits
      const packages = await req.payload.find({
        collection: 'packages',
        where: {
          and: [
            {
              post: {
                equals: resolvedPostId,
              },
            },
            {
              isEnabled: {
                equals: true,
              },
            },
          ],
        },
        limit: 100,
        select: {
          id: true,
          maxConcurrentBookings: true,
          isEnabled: true,
        },
        depth: 0,
      })

      // Create a map of package IDs to their concurrency limits
      const packageConcurrencyMap = new Map<string, number>()
      packages.docs.forEach((pkg: any) => {
        const limit = Number(pkg?.maxConcurrentBookings)
        if (Number.isFinite(limit) && limit > 0) {
          packageConcurrencyMap.set(pkg.id, limit)
        } else {
          // Default to 1 if not set or invalid
          packageConcurrencyMap.set(pkg.id, 1)
        }
      })

      // Track bookings per date per package
      // Map structure: dateISO -> Map<packageId | 'property-level', count>
      const datePackageBookings = new Map<string, Map<string, number>>()

      console.log('📅 Processing bookings for unavailable dates:', {
        postId: resolvedPostId,
        totalBookings: bookings.docs.length,
        totalPackages: packages.docs.length,
        packageIds: packages.docs.map((p: any) => ({ id: p.id, limit: p.maxConcurrentBookings })),
      })

      bookings.docs.forEach((booking, index) => {
        // Skip bookings without valid dates
        if (!booking.fromDate || !booking.toDate) {
          console.warn('⚠️ Skipping booking with missing dates:', booking.id)
          return
        }
        
        const fromDate = new Date(booking.fromDate)
        const toDate = new Date(booking.toDate)
        
        // Skip if dates are invalid
        if (isNaN(fromDate.getTime()) || isNaN(toDate.getTime())) {
          console.warn('⚠️ Skipping booking with invalid dates:', booking.id)
          return
        }
        
        const fromDateStr = fromDate.toISOString().split('T')[0]
        const toDateStr = toDate.toISOString().split('T')[0]
        
        const normalizedFromDate = new Date(fromDateStr + 'T00:00:00.000Z')
        const normalizedToDate = new Date(toDateStr + 'T00:00:00.000Z')

        const packageId = resolvePackageId(booking)
        
        // If booking has a package ID, check if it's in our enabled packages list
        // If not, treat it as property-level (blocks everything)
        let bookingKey: string
        if (packageId) {
          // Check if this package is in our enabled packages map
          if (packageConcurrencyMap.has(packageId)) {
            bookingKey = packageId
          } else {
            // Package exists but is disabled or not found - treat as property-level
            bookingKey = 'property-level'
            if (index < 5) {
              console.warn(`⚠️ Booking ${index + 1} has package ${packageId} that is not enabled - treating as property-level`)
            }
          }
        } else {
          // No package associated - property-level booking
          bookingKey = 'property-level'
        }

        if (index < 10) { // Log first 10 bookings for debugging
          console.log(`📅 Booking ${index + 1}:`, {
            id: booking.id,
            fromDate: fromDateStr,
            toDate: toDateStr,
            packageId,
            bookingKey,
            isPropertyLevel: bookingKey === 'property-level',
            selectedPackage: booking.selectedPackage,
            selectedPackageRaw: JSON.stringify(booking.selectedPackage),
          })
        }

        // Generate array of all dates in the range (excluding check-out date)
        const currentDate = new Date(normalizedFromDate)
        while (currentDate.getTime() < normalizedToDate.getTime()) {
          const dateISO = currentDate.toISOString()
          
          if (!datePackageBookings.has(dateISO)) {
            datePackageBookings.set(dateISO, new Map())
          }
          
          const packageMap = datePackageBookings.get(dateISO)!
          const currentCount = packageMap.get(bookingKey) || 0
          packageMap.set(bookingKey, currentCount + 1)
          
          currentDate.setUTCDate(currentDate.getUTCDate() + 1)
        }
      })

      // Determine unavailable dates
      // A date is unavailable if:
      // 1. There are property-level bookings (bookings without packages) on that date, OR
      // 2. NO packages can accept bookings on that date (all have reached their concurrency limits)
      const unavailableDates: string[] = []

      console.log('📅 Analyzing dates for availability:', {
        totalDates: datePackageBookings.size,
        packageConcurrencyMap: Object.fromEntries(packageConcurrencyMap),
        sampleDates: Array.from(datePackageBookings.entries()).slice(0, 5).map(([date, map]) => ({
          date,
          bookings: Object.fromEntries(map),
        })),
      })

      datePackageBookings.forEach((packageMap, dateISO) => {
        // For calendar display purposes, mark ALL dates with ANY active bookings as unavailable
        // This ensures the calendar accurately reflects when the property is booked
        // regardless of package concurrency limits
        
        // Check if there are any bookings on this date (property-level or package-level)
        const hasAnyBookings = packageMap.size > 0
        
        if (!hasAnyBookings) {
          // No bookings - date is available
          return
        }
        
        // Check if there are property-level bookings (these block everything)
        if (packageMap.has('property-level')) {
          console.log(`❌ Date ${dateISO} unavailable: property-level booking`)
          unavailableDates.push(dateISO)
          return
        }

        // For calendar display: Mark any date with bookings as unavailable
        // This provides a clear visual indication that the property is booked
        // Package-specific availability is handled by check-availability endpoint
        const totalBookingsOnDate = Array.from(packageMap.values()).reduce((sum, count) => sum + count, 0)
        
        if (totalBookingsOnDate > 0) {
          console.log(`❌ Date ${dateISO} unavailable: has ${totalBookingsOnDate} booking(s)`, {
            bookingsByPackage: Object.fromEntries(packageMap),
          })
          unavailableDates.push(dateISO)
        }
      })

      // Remove duplicates if needed
      const uniqueUnavailableDates = [...new Set(unavailableDates)]

      // Fetch unavailable dates from external calendars (Google / Airbnb) if configured
      const externalCalendarDates = new Set<string>()

      if (post?.googleCalendarUrl) {
        try {
          console.log('📅 Fetching Google Calendar dates from:', post.googleCalendarUrl)
          ;(await parseICalFeed(post.googleCalendarUrl)).forEach((d) => externalCalendarDates.add(d))
        } catch (error) {
          console.error('Error fetching Google Calendar dates:', error)
        }
      }

      if (post?.airbnbCalendarUrl) {
        try {
          console.log('📅 Fetching Airbnb Calendar dates from:', post.airbnbCalendarUrl)
          ;(await parseICalFeed(post.airbnbCalendarUrl)).forEach((d) => externalCalendarDates.add(d))
        } catch (error) {
          console.error('Error fetching Airbnb Calendar dates:', error)
        }
      }

      const mergedExternalDates = [...externalCalendarDates]
      if (mergedExternalDates.length > 0) {
        console.log(`📅 Found ${mergedExternalDates.length} unavailable dates from external calendars`)
      }

      // Merge dates from both sources (bookings + external calendars)
      const allUnavailableDates = [...uniqueUnavailableDates, ...mergedExternalDates]
      const finalUnavailableDates = [...new Set(allUnavailableDates)].sort()

      console.log('📅 Final unavailable dates summary:', {
        totalUnavailableDates: finalUnavailableDates.length,
        bookingDates: uniqueUnavailableDates.length,
        externalCalendarDates: mergedExternalDates.length,
        unavailableDates: finalUnavailableDates.slice(0, 10), // Show first 10
        totalBookingsProcessed: bookings.docs.length,
        totalPackagesFound: packages.docs.length,
        packagesWithLimits: Array.from(packageConcurrencyMap.entries()).map(([id, limit]) => ({
          id,
          limit,
        })),
        hasGoogleCalendar: !!post?.googleCalendarUrl,
        hasAirbnbCalendar: !!post?.airbnbCalendarUrl,
      })

      return Response.json({
        unavailableDates: finalUnavailableDates,
      })
    } catch (error) {
      console.error('Error fetching unavailable dates:', error)
      return Response.json({ message: 'Error fetching unavailable dates' }, { status: 500 })
    }
  },
}

// Subscription checking is now handled by Yoco service
const hasSubscription = async (userId: string) => {
  // For now, return true to allow all users to check availability
  // Subscription checking is handled elsewhere in the application
  return true
}