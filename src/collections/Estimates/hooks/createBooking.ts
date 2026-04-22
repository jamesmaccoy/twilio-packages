import { CollectionAfterChangeHook } from 'payload'
import { trackBookingConversion } from '@/lib/metaConversions'

export const createBookingHook: CollectionAfterChangeHook = async ({
  doc,
  previousDoc,
  req: { payload },
  req,
}) => {
  if (doc.paymentStatus === 'paid' && previousDoc?.paymentStatus !== 'paid') {
    // Resolve package information and custom name from packageSettings
    let resolvedSelectedPackage = doc.selectedPackage
    let resolvedPackageType = doc.packageType

    if (doc.packageType && doc.post) {
      try {
        const postId = typeof doc.post === 'string' ? doc.post : doc.post.id
        const postData = await payload.findByID({
          collection: 'posts',
          id: postId,
          depth: 1,
        })

        if (postData?.packageSettings && Array.isArray(postData.packageSettings)) {
          // Get database packages for this post
          const dbPackages = await payload.find({
            collection: 'packages',
            where: {
              post: { equals: postId },
              isEnabled: { equals: true }
            },
            depth: 1,
          })

          // Find the package that matches the packageType
          const code = doc.packageType.toLowerCase()
          const matchedDbPackage = dbPackages.docs.find((pkg: any) => {
            const pkgId = pkg.id?.toString().toLowerCase()
            const revenueCatId = pkg.revenueCatId?.toString().toLowerCase()
            const yocoId = (pkg.yocoId || pkg.revenueCatId)?.toString().toLowerCase()
            return pkgId === code || revenueCatId === code || yocoId === code
          })

          if (matchedDbPackage) {
            resolvedPackageType = matchedDbPackage.id

            // Get custom name from packageSettings
            const packageSetting = postData.packageSettings.find((setting: any) => {
              const settingPackageId = typeof setting.package === 'object' ? setting.package.id : setting.package
              return settingPackageId === matchedDbPackage.id
            })

            const customName = packageSetting?.customName || null

            // Build resolved selectedPackage with database package relationship
            resolvedSelectedPackage = {
              package: matchedDbPackage.id,
              customName: customName,
              enabled: true,
            }
          }
        }
      } catch (error) {
        console.warn('Could not resolve package information in createBooking hook:', error)
        // Fall back to doc's selectedPackage if available
        if (!resolvedSelectedPackage && doc.selectedPackage) {
          resolvedSelectedPackage = doc.selectedPackage
        }
      }
    }

    const booking = await payload.create({
      collection: 'bookings',
      data: {
        fromDate: doc.fromDate,
        toDate: doc.toDate,
        customer: doc.customer,
        post: doc.post,
        title: doc.title,
        total: doc.total,
        guests: doc.guests,
        packageType: resolvedPackageType || doc.packageType,
        paymentStatus: 'paid',
        selectedPackage: resolvedSelectedPackage || doc.selectedPackage,
        slug: doc.slug,
        // Transfer activity from estimate to booking
        activity: doc.activity && Array.isArray(doc.activity) ? doc.activity : [],
      },
      req,
    })

    // Track Purchase conversion event for Meta Pixel
    try {
      const postId = typeof doc.post === 'string' ? doc.post : doc.post?.id
      const customerId = typeof doc.customer === 'string' ? doc.customer : doc.customer?.id
      
      // Fetch customer data if available
      let userEmail: string | undefined
      if (customerId) {
        try {
          const customer = await payload.findByID({
            collection: 'users',
            id: customerId,
            depth: 0,
          })
          userEmail = customer?.email
        } catch (error) {
          // Customer might not exist or be accessible, continue without email
        }
      }

      await trackBookingConversion({
        bookingId: booking.id,
        bookingValue: doc.total || 0,
        postId,
        postTitle: doc.title,
        packageType: resolvedPackageType || doc.packageType,
        userId: customerId,
        userEmail,
        // Note: IP and user agent not available in hook context
        // These would ideally come from the request, but hooks don't have direct access
      })
    } catch (error) {
      // Don't fail booking creation if tracking fails
      console.error('Failed to track booking conversion:', error)
    }
  }

  return doc
}
