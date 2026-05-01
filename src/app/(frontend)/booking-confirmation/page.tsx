// app/(frontend)/booking-confirmation/page.tsx
import { getPayload } from 'payload'
import configPromise from '@payload-config'
import { redirect } from 'next/navigation'
import { headers } from 'next/headers'
import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { format } from 'date-fns'
import { DivineLightEffect } from '@/components/DivineLightEffect'
import { Package } from 'lucide-react'
import { trackBookingConversion } from '@/lib/metaConversions'
import { getMeUser } from '@/utilities/getMeUser'

function toRoleArray(role: unknown): string[] {
  if (Array.isArray(role)) return role.filter((r): r is string => typeof r === 'string')
  if (typeof role === 'string' && role.trim()) return [role.trim()]
  return []
}

function subscriptionMembershipLabel(plan: string, entitlement?: string | null): string {
  if (plan === 'pro' || entitlement === 'pro') return 'Pro'
  if (plan === 'basic' || entitlement === 'standard') return 'Standard'
  if (plan && plan !== 'free') return plan.charAt(0).toUpperCase() + plan.slice(1)
  return 'Member'
}

export default async function BookingConfirmationPage({
  searchParams,
}: {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>
}) {
  const resolvedSearchParams = await searchParams
  
  // Preserve the current URL path and query params for redirect after login
  const currentPath = '/booking-confirmation'
  const queryString = new URLSearchParams(resolvedSearchParams as Record<string, string>).toString()
  const redirectUrl = queryString ? `${currentPath}?${queryString}` : currentPath

  // Get the current user (robust cookie/JWT fallback)
  const payload = await getPayload({ config: configPromise })
  const { user } = await getMeUser({
    nullUserRedirect: `/login?redirect=${encodeURIComponent(redirectUrl)}`,
  })

  // Handle payment success callback - create booking if estimate ID is provided
  const success = resolvedSearchParams.success === 'true'
  const estimateId = typeof resolvedSearchParams.estimateId === 'string' ? resolvedSearchParams.estimateId : null
  const postId = typeof resolvedSearchParams.postId === 'string' ? resolvedSearchParams.postId : null
  const duration = typeof resolvedSearchParams.duration === 'string' ? Number(resolvedSearchParams.duration) : null
  const startDate = typeof resolvedSearchParams.startDate === 'string' ? resolvedSearchParams.startDate : null
  const endDate = typeof resolvedSearchParams.endDate === 'string' ? resolvedSearchParams.endDate : null
  const transactionId = typeof resolvedSearchParams.transactionId === 'string' ? resolvedSearchParams.transactionId : null
  const intentParam = typeof resolvedSearchParams.intent === 'string' ? resolvedSearchParams.intent : null
  const isSubscriptionIntent = intentParam === 'subscription'

  let activatedSubscription: {
    membershipLabel: string
    amount: number | null
    currency: string
    plan: string
    expiresAt: string | null
  } | null = null

  if (success && transactionId) {
    try {
      const transaction = await payload.findByID({
        collection: 'yoco-transactions',
        id: transactionId,
      })

      if (transaction) {
        const wasCompleted = transaction.status === 'completed'
        const transactionUserId =
          typeof transaction.user === 'string' ? transaction.user : transaction.user?.id

        if (transactionUserId === user.id) {
          const now = new Date()
          const periodDays =
            typeof transaction.periodDays === 'number' && transaction.periodDays > 0
              ? transaction.periodDays
              : typeof resolvedSearchParams.periodDays === 'string'
              ? Number(resolvedSearchParams.periodDays)
              : null
          const expiresAtDate =
            transaction.expiresAt && new Date(transaction.expiresAt) > now
              ? new Date(transaction.expiresAt)
              : periodDays
              ? new Date(now.getTime() + periodDays * 24 * 60 * 60 * 1000)
              : null

          const updateData: Record<string, unknown> = {
            status: 'completed',
            completedAt: now.toISOString(),
          }
          if (expiresAtDate) {
            updateData.expiresAt = expiresAtDate.toISOString()
          }

          if (transaction.status !== 'completed') {
            await payload.update({
              collection: 'yoco-transactions',
              id: transactionId,
              data: updateData,
            })
          }

          // Link addon transactions to bookings
          if (transaction.intent === 'product' && transaction.metadata && typeof transaction.metadata === 'object') {
            const metadata = transaction.metadata as Record<string, unknown>
            const bookingId = metadata.bookingId as string | undefined
            
            if (bookingId) {
              try {
                // Find the booking
                const booking = await payload.findByID({
                  collection: 'bookings',
                  id: bookingId,
                })
                
                if (booking) {
                  // Add this transaction to the booking's addonTransactions
                  const existingAddons = Array.isArray(booking.addonTransactions) 
                    ? booking.addonTransactions.map((t: any) => typeof t === 'string' ? t : t.id)
                    : []
                  
                  if (!existingAddons.includes(transactionId)) {
                    await payload.update({
                      collection: 'bookings',
                      id: bookingId,
                      data: {
                        addonTransactions: [...existingAddons, transactionId],
                      },
                    })
                    console.log(`✅ Linked addon transaction ${transactionId} to booking ${bookingId}`)
                  }
                }
              } catch (error) {
                console.error('Error linking addon transaction to booking:', error)
              }
            }
          }

          if (transaction.intent === 'subscription') {
            const qpPlan = typeof resolvedSearchParams.plan === 'string' ? resolvedSearchParams.plan : null
            const qpEntitlement =
              typeof resolvedSearchParams.entitlement === 'string' ? resolvedSearchParams.entitlement : null

            const entitlement =
              (typeof transaction.entitlement === 'string' ? transaction.entitlement : null) ||
              qpEntitlement ||
              null
            const transactionPlan =
              (typeof transaction.plan === 'string' ? transaction.plan : null) || qpPlan || null

            const userPlan: 'free' | 'basic' | 'pro' | 'enterprise' =
              transactionPlan === 'pro' || entitlement === 'pro'
                ? 'pro'
                : transactionPlan === 'standard' || entitlement === 'standard'
                  ? 'basic'
                  : 'free'

            const dbUser = await payload.findByID({
              collection: 'users',
              id: transactionUserId,
              depth: 0,
            })
            const roles = toRoleArray((dbUser as { role?: unknown }).role)
            const shouldGrantHost = userPlan === 'pro' && !roles.includes('admin') && !roles.includes('host')

            await payload.update({
              collection: 'users',
              id: transactionUserId,
              data: {
                subscriptionStatus: {
                  status: 'active',
                  plan: userPlan,
                  expiresAt: expiresAtDate ? expiresAtDate.toISOString() : undefined,
                },
                ...(shouldGrantHost ? { role: 'host' } : {}),
              },
            })

            if (payload.jobs && typeof (payload.jobs as any).queue === 'function') {
              await (payload.jobs as any).queue({
                task: 'handleSubscriptionEvent',
                queue: 'subscription-events',
                input: {
                  event: wasCompleted ? 'RENEWED' : 'INITIAL_PURCHASE',
                  userId: transactionUserId,
                  transactionId,
                  plan: userPlan,
                  entitlement: entitlement || (userPlan === 'pro' ? 'pro' : 'standard'),
                  expiresAt: expiresAtDate ? expiresAtDate.toISOString() : undefined,
                },
              })
            }

            activatedSubscription = {
              membershipLabel: subscriptionMembershipLabel(userPlan, entitlement),
              amount: typeof transaction.amount === 'number' ? transaction.amount : null,
              currency: transaction.currency || 'ZAR',
              plan: userPlan,
              expiresAt: expiresAtDate ? expiresAtDate.toISOString() : null,
            }
          }
        }
      }
    } catch (error) {
      console.error('❌ Error finalizing transaction:', error)
    }
  }

  // If payment was successful and we have an estimate ID, confirm estimate and create booking
  if (success && estimateId && !isSubscriptionIntent) {
    try {
      console.log('Processing payment success callback:', { estimateId, postId, startDate, endDate, duration, transactionId })
      
      // Validate that a real transaction occurred (not mock/bypassed)
      let transactionValidated = false
      if (transactionId) {
        try {
          const transaction = await payload.findByID({
            collection: 'yoco-transactions',
            id: transactionId,
          })
          
          if (transaction) {
            // Check if transaction is actually completed and not mock
            const isMock = transaction.id?.toString().startsWith('mock-')
            const isCompleted = transaction.status === 'completed'
            
            if (isMock) {
              console.warn('⚠️ Mock transaction detected - payment not actually processed!')
              // In production, reject mock transactions
              if (process.env.NODE_ENV === 'production') {
                console.error('❌ Production environment detected - rejecting mock transaction')
                return (
                  <div className="container py-10">
                    <div className="max-w-2xl mx-auto text-center">
                      <h1 className="text-4xl font-bold mb-4 text-red-600">Payment Error</h1>
                      <p className="text-muted-foreground mb-8">
                        Payment validation failed. Please contact support if you believe this is an error.
                      </p>
                      <Link href="/bookings" passHref>
                        <Button>View Bookings</Button>
                      </Link>
                    </div>
                  </div>
                )
              }
            }
            
            transactionValidated = isCompleted && !isMock
            console.log('Transaction validation:', { transactionId, isMock, isCompleted, transactionValidated })
          } else {
            console.warn('Transaction not found:', transactionId)
          }
        } catch (error) {
          console.warn('Could not validate transaction:', error)
          // In production, require transaction validation
          if (process.env.NODE_ENV === 'production') {
            console.error('❌ Production environment - transaction validation required')
            return (
              <div className="container py-10">
                <div className="max-w-2xl mx-auto text-center">
                  <h1 className="text-4xl font-bold mb-4 text-red-600">Payment Validation Error</h1>
                  <p className="text-muted-foreground mb-8">
                    Unable to validate payment. Please contact support.
                  </p>
                  <Link href="/bookings" passHref>
                    <Button>View Bookings</Button>
                  </Link>
                </div>
              </div>
            )
          }
        }
      } else {
        // In production, require transactionId
        if (process.env.NODE_ENV === 'production') {
          console.error('❌ Production environment - transactionId required')
          return (
            <div className="container py-10">
              <div className="max-w-2xl mx-auto text-center">
                <h1 className="text-4xl font-bold mb-4 text-red-600">Payment Error</h1>
                <p className="text-muted-foreground mb-8">
                  Payment transaction ID missing. Please contact support.
                </p>
                <Link href="/bookings" passHref>
                  <Button>View Bookings</Button>
                </Link>
              </div>
            </div>
          )
        }
      }
      
      // Get the estimate with originalBooking populated
      const estimate = await payload.findByID({
        collection: 'estimates',
        id: estimateId,
        depth: 2, // Populate originalBooking relationship
      })

      if (!estimate) {
        console.error('Estimate not found:', estimateId)
      } else {
        // Debug: Log estimate package information
        console.log('📋 Estimate package information:', {
          estimateId: estimate.id,
          packageType: estimate.packageType,
          hasSelectedPackage: !!estimate.selectedPackage,
          selectedPackagePackage: estimate.selectedPackage?.package,
          selectedPackagePackageType: typeof estimate.selectedPackage?.package,
          selectedPackagePackageId: typeof estimate.selectedPackage?.package === 'object' 
            ? estimate.selectedPackage.package?.id 
            : estimate.selectedPackage?.package,
          selectedPackageCustomName: estimate.selectedPackage?.customName,
        })
        // Check if customer matches (handle both string ID and relationship object)
        const estimateCustomerId = typeof estimate.customer === 'string' ? estimate.customer : estimate.customer?.id
        const isCustomerMatch = estimateCustomerId === user.id

        // Check if this is a reschedule (has originalBooking)
        const originalBooking = typeof estimate.originalBooking === 'object' ? estimate.originalBooking : null
        const isReschedule = !!originalBooking

        console.log('Estimate found:', {
          estimateId: estimate.id,
          estimateCustomerId,
          userId: user.id,
          isCustomerMatch,
          transactionValidated,
          isReschedule,
          originalBookingId: originalBooking?.id,
          postId: estimate.post ? (typeof estimate.post === 'string' ? estimate.post : estimate.post.id) : null,
          fromDate: estimate.fromDate,
          toDate: estimate.toDate
        })

        if (isCustomerMatch) {
          // Only confirm estimate if transaction is validated (or in development with mock)
          if (transactionValidated || (process.env.NODE_ENV !== 'production' && transactionId)) {
            // If this is a reschedule, cancel the original booking first to free up dates
            if (isReschedule && originalBooking?.id) {
              try {
                await payload.update({
                  collection: 'bookings',
                  id: originalBooking.id,
                  data: {
                    paymentStatus: 'cancelled', // Mark original booking as cancelled
                  },
                })
                console.log('✅ Original booking cancelled:', originalBooking.id, '- Dates are now available for other customers')
              } catch (cancelError) {
                console.error('⚠️ Failed to cancel original booking:', cancelError)
                // Continue with booking creation even if cancellation fails
              }
            }

            // Confirm the estimate
            await payload.update({
              collection: 'estimates',
              id: estimateId,
              data: {
                paymentStatus: 'paid',
              },
            })
            console.log('✅ Estimate confirmed')
          } else {
            console.warn('⚠️ Estimate not confirmed - transaction not validated')
          }

          // Determine which data to use for booking creation
          const bookingPostId = postId || (estimate.post ? (typeof estimate.post === 'string' ? estimate.post : estimate.post.id) : null)
          let bookingFromDate = startDate || estimate.fromDate
          let bookingToDate = endDate || estimate.toDate
          
          // Ensure dates are in correct order (fromDate must be before toDate)
          const fromDateObj = new Date(bookingFromDate)
          const toDateObj = new Date(bookingToDate)
          
          // Validate dates are valid
          if (isNaN(fromDateObj.getTime()) || isNaN(toDateObj.getTime())) {
            throw new Error(`Invalid date format: fromDate=${bookingFromDate}, toDate=${bookingToDate}`)
          }
          
          // If dates are swapped, fix them
          if (fromDateObj > toDateObj) {
            console.warn('⚠️ Dates are swapped - fixing order:', {
              originalFromDate: bookingFromDate,
              originalToDate: bookingToDate,
            })
            // Swap the dates
            const temp = bookingFromDate
            bookingFromDate = bookingToDate
            bookingToDate = temp
            console.log('✅ Dates corrected:', {
              correctedFromDate: bookingFromDate,
              correctedToDate: bookingToDate,
            })
          }
          
          // Final validation: ensure fromDate is still before toDate after correction
          const finalFromDate = new Date(bookingFromDate)
          const finalToDate = new Date(bookingToDate)
          if (finalFromDate >= finalToDate) {
            throw new Error(`Invalid date range: fromDate (${bookingFromDate}) must be before toDate (${bookingToDate})`)
          }
          const bookingTotal = estimate.total || 0

          if (bookingPostId && bookingFromDate && bookingToDate) {
            // Format dates to 'yyyy-MM-dd' format for consistent comparison
            // This matches how dates are formatted in checkAvailabilityHook
            const formattedFromDate = format(new Date(bookingFromDate), 'yyyy-MM-dd')
            const formattedToDate = format(new Date(bookingToDate), 'yyyy-MM-dd')
            
            // Check if a booking already exists for this estimate (prevent duplicates)
            // Query for bookings that overlap with the same date range
            // Since dates are stored with time components, we check for overlaps at the day level
            const existingBookings = await payload.find({
              collection: 'bookings',
              where: {
                and: [
                  { customer: { equals: user.id } },
                  { post: { equals: bookingPostId } },
                  // Check if existing booking's fromDate is on or before our toDate
                  // and existing booking's toDate is on or after our fromDate
                  // This finds bookings that overlap with our date range
                  { fromDate: { less_than_equal: formattedToDate } },
                  { toDate: { greater_than_equal: formattedFromDate } },
                ],
              },
              limit: 1,
            })

            if (existingBookings.docs.length > 0 && existingBookings.docs[0]) {
              const existingBooking = existingBookings.docs[0]
              console.log('✅ Booking already exists for this estimate:', existingBooking.id)

              // Reconcile guests: if the estimate had accepted invitees, ensure they exist on the booking too.
              // This fixes cases where the booking was created without copying `estimate.guests`.
              const estimateGuestIds = Array.isArray(estimate.guests)
                ? estimate.guests
                    .map((g: any) => (typeof g === 'string' ? g : g?.id))
                    .filter(Boolean)
                : []

              if (estimateGuestIds.length > 0) {
                const existingGuestIds = Array.isArray((existingBooking as any).guests)
                  ? (existingBooking as any).guests
                      .map((g: any) => (typeof g === 'string' ? g : g?.id))
                      .filter(Boolean)
                  : []

                const mergedGuestIds = Array.from(new Set([...existingGuestIds, ...estimateGuestIds]))

                if (mergedGuestIds.length !== existingGuestIds.length) {
                  await payload.update({
                    collection: 'bookings',
                    id: existingBooking.id,
                    data: {
                      guests: mergedGuestIds,
                    },
                  })
                  console.log('✅ Booking guests reconciled from estimate:', {
                    bookingId: existingBooking.id,
                    added: mergedGuestIds.length - existingGuestIds.length,
                  })
                }
              }
            } else {
              // Get the post to get its title for the booking title
              let postTitle = 'Booking'
              let postData: any = null
              try {
                postData = await payload.findByID({
                  collection: 'posts',
                  id: bookingPostId,
                  depth: 1,
                })
                postTitle = postData?.title || 'Booking'
              } catch (error) {
                console.warn('Could not fetch post title, using default:', error)
              }

              // Get package information from estimate
              const estimatePackageType = estimate.packageType || null
              const estimateSelectedPackage = estimate.selectedPackage || null

              // Resolve package information and custom name
              // PRIORITY: Use selectedPackage.package (actual package ID) over packageType (ambiguous identifier)
              let resolvedSelectedPackage = estimateSelectedPackage
              let resolvedPackageType = estimatePackageType

              // First, check if selectedPackage has a populated package object (most reliable)
              if (estimateSelectedPackage?.package && typeof estimateSelectedPackage.package === 'object' && estimateSelectedPackage.package.id) {
                // Use the package from selectedPackage directly - this is the most accurate
                const packageId = estimateSelectedPackage.package.id
                resolvedPackageType = packageId
                
                // Get custom name from packageSettings if available
                if (postData?.packageSettings && Array.isArray(postData.packageSettings)) {
                  const packageSetting = postData.packageSettings.find((setting: any) => {
                    const settingPackageId = typeof setting.package === 'object' ? setting.package.id : setting.package
                    return settingPackageId === packageId
                  })
                  if (packageSetting?.customName) {
                    resolvedSelectedPackage = {
                      package: packageId,
                      customName: packageSetting.customName,
                      enabled: estimateSelectedPackage.enabled ?? true,
                    }
                  } else {
                    // Use existing selectedPackage but ensure package ID is set
                    resolvedSelectedPackage = {
                      package: packageId,
                      customName: estimateSelectedPackage.customName || null,
                      enabled: estimateSelectedPackage.enabled ?? true,
                    }
                  }
                } else {
                  // Use existing selectedPackage
                  resolvedSelectedPackage = {
                    package: packageId,
                    customName: estimateSelectedPackage.customName || null,
                    enabled: estimateSelectedPackage.enabled ?? true,
                  }
                }
                
                console.log('✅ Using package from selectedPackage:', {
                  packageId,
                  packageName: estimateSelectedPackage.package.name,
                  customName: resolvedSelectedPackage.customName
                })
              } else if (estimateSelectedPackage?.package && typeof estimateSelectedPackage.package === 'string') {
                // Package is stored as string ID, use it directly
                resolvedPackageType = estimateSelectedPackage.package
                resolvedSelectedPackage = {
                  package: estimateSelectedPackage.package,
                  customName: estimateSelectedPackage.customName || null,
                  enabled: estimateSelectedPackage.enabled ?? true,
                }
                console.log('✅ Using package ID from selectedPackage (string):', estimateSelectedPackage.package)
              } else if (estimatePackageType && postData) {
                // Fallback: Try to resolve from packageType (less reliable due to potential duplicates)
                try {
                  // Get database packages for this post
                  const dbPackages = await payload.find({
                    collection: 'packages',
                    where: {
                      post: { equals: bookingPostId },
                      isEnabled: { equals: true }
                    },
                    depth: 1,
                  })

                  // Find the package that matches the packageType
                  // PRIORITY: Match by package ID first (most reliable), then fallback to revenueCatId/yocoId for backward compatibility
                  const code = estimatePackageType.toLowerCase()
                  let matchedDbPackage = dbPackages.docs.find((pkg: any) => {
                    // First try exact match by package ID (most reliable)
                    return pkg.id?.toString().toLowerCase() === code
                  })
                  
                  // Fallback: If no ID match, try revenueCatId/yocoId (for backward compatibility with old estimates)
                  if (!matchedDbPackage) {
                    console.warn('⚠️ No package match by ID, trying revenueCatId/yocoId matching:', {
                      packageType: estimatePackageType,
                      code,
                      availablePackages: dbPackages.docs.map((pkg: any) => ({
                        id: pkg.id,
                        name: pkg.name,
                        revenueCatId: pkg.revenueCatId,
                        yocoId: pkg.yocoId,
                      }))
                    })
                    
                    // Find ALL packages that match (there might be multiple)
                    const matchingPackages = dbPackages.docs.filter((pkg: any) => {
                      const revenueCatId = pkg.revenueCatId?.toString().toLowerCase()
                      const yocoId = (pkg.yocoId || pkg.revenueCatId)?.toString().toLowerCase()
                      return revenueCatId === code || yocoId === code
                    })
                    
                    if (matchingPackages.length === 0) {
                      console.error('❌ No package found matching packageType:', {
                        packageType: estimatePackageType,
                        code,
                        searchedIn: dbPackages.docs.length + ' packages',
                      })
                    } else if (matchingPackages.length > 1) {
                      console.error('❌ MULTIPLE packages match packageType (ambiguous):', {
                        packageType: estimatePackageType,
                        code,
                        matchingPackages: matchingPackages.map((pkg: any) => ({
                          id: pkg.id,
                          name: pkg.name,
                          revenueCatId: pkg.revenueCatId,
                          yocoId: pkg.yocoId,
                        })),
                        warning: 'This will select the first match, which may be incorrect!',
                      })
                      
                      // Try to use estimate's selectedPackage.package to disambiguate
                      if (estimateSelectedPackage?.package) {
                        const estimatePackageId = typeof estimateSelectedPackage.package === 'object' 
                          ? estimateSelectedPackage.package.id 
                          : estimateSelectedPackage.package
                        
                        const correctPackage = matchingPackages.find((pkg: any) => 
                          pkg.id?.toString() === estimatePackageId?.toString()
                        )
                        
                        if (correctPackage) {
                          console.log('✅ Found correct package using selectedPackage.package:', {
                            packageId: correctPackage.id,
                            packageName: correctPackage.name,
                          })
                          matchedDbPackage = correctPackage
                        } else {
                          console.warn('⚠️ selectedPackage.package does not match any of the ambiguous packages, using first match')
                          matchedDbPackage = matchingPackages[0]
                        }
                      } else {
                        console.warn('⚠️ No selectedPackage.package to disambiguate, using first match')
                        matchedDbPackage = matchingPackages[0]
                      }
                    } else {
                      // Single match - use it
                      matchedDbPackage = matchingPackages[0]
                      if (matchedDbPackage) {
                        console.log('✅ Single package match found:', {
                          packageId: matchedDbPackage.id,
                          packageName: matchedDbPackage.name,
                        })
                      }
                    }
                  }

                  if (matchedDbPackage) {
                    // Use the matched database package's ID (always use package ID, not yocoId/revenueCatId)
                    resolvedPackageType = matchedDbPackage.id
                    
                    // Get custom name from packageSettings
                    let customName: string | null = null
                    if (postData.packageSettings && Array.isArray(postData.packageSettings)) {
                      const packageSetting = postData.packageSettings.find((setting: any) => {
                        const settingPackageId = typeof setting.package === 'object' ? setting.package.id : setting.package
                        return settingPackageId === matchedDbPackage.id
                      })
                      customName = packageSetting?.customName || null
                    }

                    // Build resolved selectedPackage with database package relationship
                    resolvedSelectedPackage = {
                      package: matchedDbPackage.id,
                      customName: customName || null,
                      enabled: true,
                    }
                    
                    console.log('⚠️ Resolved package from packageType (fallback):', {
                      packageType: estimatePackageType,
                      matchedPackageId: matchedDbPackage.id,
                      matchedPackageName: matchedDbPackage.name
                    })
                  } else {
                    // Package not found in database - might be a Yoco product
                    // Check packageSettings for custom name by matching the packageType directly
                    if (postData.packageSettings && Array.isArray(postData.packageSettings)) {
                      const packageSetting = postData.packageSettings.find((setting: any) => {
                        const settingPackageId = typeof setting.package === 'object' ? setting.package.id : setting.package
                        const settingRevenueCatId = typeof setting.package === 'object' ? setting.package.revenueCatId : null
                        const settingYocoId = typeof setting.package === 'object' ? (setting.package.yocoId || setting.package.revenueCatId) : null
                        return (
                          settingPackageId?.toString().toLowerCase() === code ||
                          settingRevenueCatId?.toString().toLowerCase() === code ||
                          settingYocoId?.toString().toLowerCase() === code
                        )
                      })
                      
                      if (packageSetting?.customName) {
                        // We have a custom name but no database package - store minimal selectedPackage
                        resolvedSelectedPackage = {
                          enabled: true,
                          customName: packageSetting.customName,
                        }
                      }
                    }
                  }
                } catch (error) {
                  console.warn('Could not resolve package information:', error)
                  // Fall back to estimate's selectedPackage if available
                  if (!resolvedSelectedPackage && estimateSelectedPackage) {
                    resolvedSelectedPackage = estimateSelectedPackage
                  }
                }
              }

              // Normalize dates to midnight UTC to ensure consistent date-only storage
              // Extract date part and create new date at midnight UTC
              const fromDateObj = new Date(bookingFromDate)
              const toDateObj = new Date(bookingToDate)
              
              const fromDateStr = fromDateObj.toISOString().split('T')[0]
              const toDateStr = toDateObj.toISOString().split('T')[0]
              
              // Create dates at midnight UTC for consistent storage
              const normalizedFromDate = new Date(fromDateStr + 'T00:00:00.000Z')
              const normalizedToDate = new Date(toDateStr + 'T00:00:00.000Z')

              console.log('Creating booking with data:', {
                title: postTitle,
                post: bookingPostId,
                fromDate: normalizedFromDate.toISOString(),
                toDate: normalizedToDate.toISOString(),
                total: bookingTotal,
                customer: user.id,
                packageType: resolvedPackageType || estimatePackageType,
                selectedPackage: resolvedSelectedPackage,
              })

              try {
                const bookingData: any = {
                  title: postTitle,
                  post: bookingPostId, // Use 'post' not 'postId' for the relationship
                  fromDate: normalizedFromDate.toISOString(),
                  toDate: normalizedToDate.toISOString(),
                  total: bookingTotal, // Required field
                  paymentStatus: 'paid',
                  customer: user.id,
                }

                // Carry over accepted invitees from the estimate.
                // `estimate.guests` is a relationship array of user IDs / populated user objects.
                if (Array.isArray(estimate.guests) && estimate.guests.length > 0) {
                  bookingData.guests = estimate.guests.map((guest: any) =>
                    typeof guest === 'string' ? guest : guest?.id,
                  ).filter(Boolean)
                }

                // Include packageType - ALWAYS use resolved packageType (package ID) if available
                // This ensures we store the actual package ID, not the ambiguous yocoId/revenueCatId
                if (resolvedPackageType) {
                  bookingData.packageType = resolvedPackageType
                  console.log('✅ Booking will use package ID as packageType:', resolvedPackageType)
                } else if (estimatePackageType) {
                  // Fallback: use estimate's packageType (might be yocoId/revenueCatId for old estimates)
                  bookingData.packageType = estimatePackageType
                  console.warn('⚠️ Using estimate packageType (may be ambiguous):', estimatePackageType)
                }

                // Include selectedPackage - this is the most reliable way to store package info
                if (resolvedSelectedPackage) {
                  bookingData.selectedPackage = resolvedSelectedPackage
                  console.log('✅ Booking will include selectedPackage:', {
                    package: resolvedSelectedPackage.package,
                    customName: resolvedSelectedPackage.customName,
                  })
                } else {
                  console.warn('⚠️ No selectedPackage available for booking')
                }

                const booking = await payload.create({
                  collection: 'bookings',
                  data: bookingData,
                })
                console.log('✅ Booking created successfully:', booking.id)

                // Track Purchase conversion event for Meta Pixel
                try {
                  const headersList = await headers()
                  const clientIp = headersList.get('x-forwarded-for')?.split(',')[0] || 
                                   headersList.get('x-real-ip') || 
                                   'unknown'
                  const userAgent = headersList.get('user-agent') || 'unknown'
                  
                  await trackBookingConversion({
                    bookingId: booking.id,
                    bookingValue: bookingTotal,
                    postId: bookingPostId,
                    postTitle: postTitle,
                    packageType: resolvedPackageType || estimatePackageType || undefined,
                    userId: user.id,
                    userEmail: 'email' in user ? (user as any).email : undefined,
                    clientIp,
                    userAgent,
                    // Note: eventSourceUrl would ideally come from request headers
                    // but we don't have direct access to the request URL here
                  })
                } catch (trackingError) {
                  // Don't fail booking creation if tracking fails
                  console.error('Failed to track booking conversion:', trackingError)
                }
              } catch (bookingError) {
                console.error('❌ Failed to create booking:', bookingError)
                if (bookingError instanceof Error) {
                  console.error('Error details:', {
                    message: bookingError.message,
                    stack: bookingError.stack
                  })
                }
                throw bookingError // Re-throw to be caught by outer catch
              }
            }
          } else {
            console.error('❌ Missing required booking data:', {
              postId: bookingPostId,
              fromDate: bookingFromDate,
              toDate: bookingToDate
            })
          }
        } else {
          console.error('❌ Customer ID mismatch:', {
            estimateCustomerId,
            userId: user.id
          })
        }
      }
    } catch (error) {
      console.error('❌ Error processing payment success:', error)
      if (error instanceof Error) {
        console.error('Error stack:', error.stack)
      }
      // Continue to show confirmation page even if booking creation fails
    }
  }

  if (activatedSubscription && success && isSubscriptionIntent) {
    const formattedAmount =
      activatedSubscription.amount !== null
        ? `${activatedSubscription.currency} ${activatedSubscription.amount.toFixed(2)}`
        : '—'
    return (
      <div className="container py-16">
        <div className="mx-auto max-w-2xl text-center space-y-8">
          <div className="relative mx-auto max-w-xl">
            <div className="absolute -inset-1 rounded-3xl bg-gradient-to-r from-primary via-purple-500 to-primary opacity-75 blur-lg animate-pulse" />
            <div className="relative rounded-3xl border border-primary/40 bg-card p-10 shadow-xl">
              <h1 className="text-4xl font-extrabold tracking-tight mb-2">Membership Activated</h1>
              <p className="text-muted-foreground mb-8">
                Welcome to the Simple Plek community. Your member subscription is now live.
              </p>
              <div className="space-y-4 text-left">
                <div className="flex justify-between items-center">
                  <span className="text-muted-foreground">Membership</span>
                  <span className="font-semibold">{activatedSubscription.membershipLabel}</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-muted-foreground">Plan</span>
                  <span className="font-semibold capitalize">{activatedSubscription.plan}</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-muted-foreground">Billing</span>
                  <span className="font-semibold">{formattedAmount} / month</span>
                </div>
                {activatedSubscription.expiresAt && (
                  <div className="flex justify-between items-center">
                    <span className="text-muted-foreground">Renews on</span>
                    <span className="font-semibold">
                      {new Date(activatedSubscription.expiresAt).toLocaleDateString()}
                    </span>
                  </div>
                )}
              </div>
            </div>
          </div>
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <Link href="/bookings" passHref>
              <Button className="bg-primary text-primary-foreground hover:bg-primary/90">
                Explore Calendar
              </Button>
            </Link>
            {activatedSubscription.plan === 'pro' && (
              <Link href="/manage" passHref>
                <Button variant="outline">Manage listings</Button>
              </Link>
            )}
            <Link href="/account" passHref>
              <Button variant="outline">Manage Membership</Button>
            </Link>
          </div>
        </div>
      </div>
    )
  }

  // Get the most recent booking for this user with package information
  const bookings = await payload.find({
    collection: 'bookings',
    where: {
      customer: { equals: user.id }
    },
    sort: '-createdAt',
    limit: 1,
    depth: 2, // Include package relationship
  })

  const booking = bookings.docs[0]

  // Resolve package information - PRIORITY: Use selectedPackage.package (actual package ID)
  let packageName: string | null = null
  let packageDescription: string | null = null
  
  if (booking) {
    console.log('📦 Booking package resolution:', {
      bookingId: booking.id,
      hasSelectedPackage: !!booking.selectedPackage,
      selectedPackagePackage: booking.selectedPackage?.package,
      selectedPackagePackageType: typeof booking.selectedPackage?.package,
      selectedPackagePackageId: typeof booking.selectedPackage?.package === 'object' 
        ? booking.selectedPackage.package?.id 
        : booking.selectedPackage?.package,
      packageType: booking.packageType,
    })
    
    // PRIORITY 1: Use selectedPackage.package (most reliable - actual package ID)
    if (booking.selectedPackage) {
      // Check if package is populated as an object (has full package data)
      if (typeof booking.selectedPackage.package === 'object' && booking.selectedPackage.package?.id) {
        packageName = booking.selectedPackage.customName || booking.selectedPackage.package.name || null
        packageDescription = booking.selectedPackage.package.description || null
        console.log('✅ Using package from selectedPackage.package (object):', {
          packageId: booking.selectedPackage.package.id,
          packageName,
        })
      } 
      // Check if package is stored as string ID
      else if (typeof booking.selectedPackage.package === 'string' && booking.selectedPackage.package) {
        // Fetch the package by ID to get its name
        try {
          const packageId = booking.selectedPackage.package
          const pkg = await payload.findByID({
            collection: 'packages',
            id: packageId,
            depth: 1,
          })
          
          // Get custom name from packageSettings if available
          if (booking.post) {
            const postId = typeof booking.post === 'string' ? booking.post : booking.post.id
            const postData = await payload.findByID({
              collection: 'posts',
              id: postId,
              depth: 1,
            })
            
            if (postData?.packageSettings && Array.isArray(postData.packageSettings)) {
              const packageSetting = postData.packageSettings.find((setting: any) => {
                const settingPackageId = typeof setting.package === 'object' ? setting.package.id : setting.package
                return settingPackageId === packageId
              })
              packageName = packageSetting?.customName || pkg.name
            } else {
              packageName = pkg.name
            }
            packageDescription = pkg.description || null
          } else {
            packageName = pkg.name
            packageDescription = pkg.description || null
          }
          
          console.log('✅ Using package from selectedPackage.package (string ID):', {
            packageId,
            packageName,
          })
        } catch (error) {
          console.warn('Could not fetch package by ID:', error)
        }
      }
      // Fallback to customName if package isn't available
      else if (booking.selectedPackage.customName) {
        packageName = booking.selectedPackage.customName
        console.log('✅ Using customName from selectedPackage:', packageName)
      }
    }

    // PRIORITY 2: If still no package name, try to resolve from packageType (less reliable)
    // This should only happen if selectedPackage.package is not set
    if (!packageName && booking.packageType && booking.post) {
      console.warn('⚠️ Falling back to packageType resolution (less reliable):', booking.packageType)
      try {
        const postId = typeof booking.post === 'string' ? booking.post : booking.post.id
        const postData = await payload.findByID({
          collection: 'posts',
          id: postId,
          depth: 1,
        })

        // Get database packages
        const dbPackages = await payload.find({
          collection: 'packages',
          where: {
            post: { equals: postId },
            isEnabled: { equals: true }
          },
          depth: 1,
        })

        const code = booking.packageType.toLowerCase()
        // PRIORITY: Match by package ID first (most reliable, unambiguous)
        let matchedPackage = dbPackages.docs.find((pkg: any) => {
          return pkg.id?.toString().toLowerCase() === code
        })
        
        // Fallback: If no ID match, try revenueCatId/yocoId (for backward compatibility with old bookings)
        // Note: This can match multiple packages, so it's less reliable
        if (!matchedPackage) {
          console.warn('⚠️ No package match by ID, falling back to revenueCatId/yocoId matching (less reliable):', code)
          matchedPackage = dbPackages.docs.find((pkg: any) => {
            const revenueCatId = pkg.revenueCatId?.toString().toLowerCase()
            const yocoId = (pkg.yocoId || pkg.revenueCatId)?.toString().toLowerCase()
            return revenueCatId === code || yocoId === code
          })
        }

        if (matchedPackage) {
          // Check for custom name in packageSettings
          if (postData?.packageSettings && Array.isArray(postData.packageSettings)) {
            const packageSetting = postData.packageSettings.find((setting: any) => {
              const settingPackageId = typeof setting.package === 'object' ? setting.package.id : setting.package
              return settingPackageId === matchedPackage.id
            })
            packageName = packageSetting?.customName || matchedPackage.name
          } else {
            packageName = matchedPackage.name
          }
          packageDescription = matchedPackage.description || null
          
          console.log('⚠️ Resolved package from packageType (fallback):', {
            packageType: booking.packageType,
            matchedPackageId: matchedPackage.id,
            matchedPackageName: packageName,
          })
        } else {
          console.warn('❌ Could not find package matching packageType:', booking.packageType)
        }
      } catch (error) {
        console.warn('Could not resolve package information:', error)
      }
    }
  }
  
  // Calculate dates and duration
  let fromDate = new Date()
  let toDate = new Date()
  let bookingDurationDisplay = "N/A"
  
  if (booking?.fromDate && booking?.toDate) {
    fromDate = new Date(booking.fromDate)
    toDate = new Date(booking.toDate)
    
    // Calculate duration in days
    const diffTime = Math.abs(toDate.getTime() - fromDate.getTime())
    bookingDurationDisplay = Math.ceil(diffTime / (1000 * 60 * 60 * 24)).toString()
  }
  
  // Fallback to search params if booking not found
  const bookingTotal = typeof resolvedSearchParams.total === "string" ? resolvedSearchParams.total : "N/A"
  const bookingDuration = booking ? bookingDurationDisplay : (duration !== null ? String(duration) : "N/A")
  const totalAmount = 
    !isNaN(Number(bookingTotal)) && !isNaN(Number(bookingDuration)) 
      ? Number(bookingTotal) * Number(bookingDuration) 
      : "N/A"
  
  const showSuccess = success && !isSubscriptionIntent

  return (
    <div className="container py-10 relative">
      {showSuccess && <DivineLightEffect />}
      
      <div className="max-w-2xl mx-auto relative z-10">
        <div className="text-center mb-8">
          <h1 className="text-4xl font-bold tracking-tighter mb-4">Booking Confirmed!</h1>
          <p className="text-muted-foreground">Thank you for your booking. We&apos;re excited to host you!</p>
        </div>
        
        <div className="bg-muted p-6 rounded-lg border border-border mb-8">
          <h2 className="text-2xl font-semibold mb-4">Booking Details</h2>
          
          <div className="space-y-4">
            {booking?.id && (
              <div className="flex justify-between items-center">
                <span className="text-muted-foreground">Booking ID</span>
                <span className="font-medium">{booking.id}</span>
              </div>
            )}
            
            {booking?.title && (
              <div className="flex justify-between items-center">
                <span className="text-muted-foreground">Property</span>
                <span className="font-medium">{booking.title}</span>
              </div>
            )}

            {packageName && (
              <div className="flex justify-between items-start border-t pt-4 mt-4">
                <div className="flex items-center gap-2">
                  <Package className="h-4 w-4 text-muted-foreground" />
                  <span className="text-muted-foreground">Package</span>
                </div>
                <div className="text-right">
                  <span className="font-medium">{packageName}</span>
                  {packageDescription && (
                    <p className="text-sm text-muted-foreground mt-1">{packageDescription}</p>
                  )}
                </div>
              </div>
            )}
            
            {booking?.fromDate && (
              <div className="flex justify-between items-center">
                <span className="text-muted-foreground">Check-in Date:</span>
                <span className="font-medium">{new Date(booking.fromDate).toLocaleDateString()}</span>
              </div>
            )}
            
            {booking?.toDate && (
              <div className="flex justify-between items-center">
                <span className="text-muted-foreground">Check-out Date:</span>
                <span className="font-medium">{new Date(booking.toDate).toLocaleDateString()}</span>
              </div>
            )}
            
            <div className="flex justify-between items-center">
              <span className="text-muted-foreground">Rate per night:</span>
              <span className="font-medium">R{bookingTotal}</span>
            </div>
            
            <div className="flex justify-between items-center">
              <span className="text-muted-foreground">Duration:</span>
              <span className="font-medium">{bookingDuration} nights</span>
            </div>
            
            <div className="flex justify-between items-center">
              <span className="text-muted-foreground">Total:</span>
              <span className="text-2xl font-bold">R{totalAmount}</span>
            </div>
            
            {booking?.paymentStatus && (
              <div className="flex justify-between items-center">
                <span className="text-muted-foreground">Payment Status:</span>
                <span className="font-medium text-green-600">
                  {booking.paymentStatus === "paid" ? "Paid" : "Pending"}
                </span>
              </div>
            )}
            
            {booking?.token && (
              <div className="flex justify-between items-center">
                <span className="text-muted-foreground">Booking Token</span>
                <span className="font-medium text-xs">{booking.token}</span>
              </div>
            )}
          </div>
        </div>
        
        <div className="flex flex-col sm:flex-row gap-4 justify-center">
          <Link href="/bookings" passHref>
            <Button className="bg-primary text-primary-foreground hover:bg-primary/90">
              View All Bookings
            </Button>
          </Link>
          
          <Link href="/" passHref>
            <Button variant="outline">
              Return to Home
            </Button>
          </Link>
        </div>
      </div>
    </div>
  )
}