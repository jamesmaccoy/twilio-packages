import { NextRequest, NextResponse } from 'next/server'
import { getPayload } from 'payload'
import configPromise from '@/payload.config'
import { yocoService } from '@/lib/yocoService'
import { getCustomerEntitlement, type CustomerEntitlement } from '@/utils/packageSuggestions'

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ postId: string }> }
) {
  try {
    const payload = await getPayload({ config: configPromise })
    const { postId } = await params
    
    // Get user and determine entitlement
    let user = null
    try {
      const authResult = await payload.auth({ headers: request.headers })
      user = authResult.user
    } catch (authError) {
      // User not authenticated - default to 'none' entitlement
      console.log('No authenticated user, defaulting to entitlement: none')
    }
    
    let customerEntitlement: CustomerEntitlement = 'none'
    
    if (user) {
      // Check for active subscription
      const now = new Date()
      const transactions = await payload.find({
        collection: 'yoco-transactions',
        where: {
          and: [
            { user: { equals: user.id } },
            { status: { equals: 'completed' } },
            { intent: { equals: 'subscription' } },
          ],
        },
        sort: '-completedAt',
        limit: 10,
      })

      const activeTransaction = transactions.docs.find((tx: any) => {
        if (!tx) return false
        if (!tx.expiresAt) return true
        return new Date(tx.expiresAt) > now
      })

      const subscriptionStatus = {
        isSubscribed: Boolean(activeTransaction),
        entitlements: activeTransaction?.entitlement ? [activeTransaction.entitlement] : [],
        expirationDate: activeTransaction?.expiresAt ? new Date(activeTransaction.expiresAt) : null,
        isLoading: false,
        error: null,
      }
      
      customerEntitlement = getCustomerEntitlement(subscriptionStatus)
    }
    
    // Get the post data to access packageSettings for custom names
    let postData = null
    try {
      postData = await payload.findByID({
        collection: 'posts',
        id: postId,
        depth: 1,
      })
    } catch (error) {
      // Don't log the full error to reduce noise, just continue without custom names
      console.log('Failed to fetch post data for custom names, continuing without custom names')
    }

    // Get packages from database
    // Try querying without isEnabled filter first to see all packages for this post
    const dbPackagesAll = await payload.find({
      collection: 'packages',
      where: {
        post: { equals: postId }
      },
      depth: 2,
      limit: 100, // Increase limit to ensure we get all packages
    })
    
    console.log('🔍 All packages for post (before isEnabled filter):', {
      postId,
      total: dbPackagesAll.docs.length,
      packages: dbPackagesAll.docs.map((pkg: any) => ({
        id: pkg.id,
        name: pkg.name,
        category: pkg.category,
        isEnabled: pkg.isEnabled,
        postId: (pkg.post as any)?.id || pkg.post
      }))
    })
    
    // Now query with isEnabled filter
    const dbPackages = await payload.find({
      collection: 'packages',
      where: {
        post: { equals: postId },
        isEnabled: { equals: true }
      },
      depth: 2, // Increased depth to include related page data
      limit: 100, // Increase limit to ensure we get all packages
    })
    
    // Debug: Check if specific package is in database results
    const targetPackage = dbPackages.docs.find((pkg: any) => pkg.id === '68a587e7420e4517de8d2b2d')
    if (targetPackage) {
      console.log('✅ Package found in database query:', {
        id: targetPackage.id,
        name: targetPackage.name,
        category: targetPackage.category,
        isEnabled: targetPackage.isEnabled,
        postId: (targetPackage.post as any)?.id || targetPackage.post,
        expectedPostId: postId
      })
    } else {
      console.log('❌ Package NOT found in database query for post:', postId)
      console.log('Total packages found:', dbPackages.docs.length)
      console.log('Package IDs found:', dbPackages.docs.map((pkg: any) => ({ id: pkg.id, name: pkg.name, category: pkg.category })))
      
      // Try to find the package directly to see why it's not in the query
      try {
        const directPackage = await payload.findByID({
          collection: 'packages',
          id: '68a587e7420e4517de8d2b2d',
          depth: 1,
        })
        console.log('🔍 Direct package lookup:', {
          id: directPackage.id,
          name: directPackage.name,
          category: directPackage.category,
          isEnabled: directPackage.isEnabled,
          postId: (directPackage.post as any)?.id || directPackage.post,
          postType: typeof directPackage.post,
          expectedPostId: postId,
          postMatches: String((directPackage.post as any)?.id || directPackage.post) === String(postId)
        })
      } catch (error) {
        console.log('❌ Could not find package directly:', error)
      }
    }

    // Get Yoco products
    const yocoProducts = await yocoService.getProducts()
    
    // Helper function to get custom name from packageSettings
    const getCustomName = (packageId: string) => {
      if (!postData?.packageSettings || !Array.isArray(postData.packageSettings)) {
        return null
      }
      const packageSetting = postData.packageSettings.find((setting: any) => {
        const pkgId = typeof setting.package === 'object' ? setting.package.id : setting.package
        return pkgId === packageId
      })
      return packageSetting?.customName || null
    }
    
    // Helper function to check DB package is enabled for this post
    const isDbPackageEnabledForPost = (packageId: string) => {
      if (!postData?.packageSettings || !Array.isArray(postData.packageSettings)) {
        if (packageId === '68a587e7420e4517de8d2b2d') {
          console.log('✅ Package enabled check: No packageSettings, defaulting to enabled')
        }
        return true // Default to enabled if no settings exist for DB packages
      }
      const packageSetting = postData.packageSettings.find((setting: any) => {
        const pkgId = typeof setting.package === 'object' ? setting.package.id : setting.package
        return pkgId === packageId
      })
      // If not configured, default to true for DB packages
      if (!packageSetting) {
        if (packageId === '68a587e7420e4517de8d2b2d') {
          console.log('✅ Package enabled check: Not in packageSettings, defaulting to enabled')
        }
        return true
      }
      const isEnabled = packageSetting?.enabled !== false
      if (packageId === '68a587e7420e4517de8d2b2d') {
        console.log('🔍 Package enabled check:', {
          packageId,
          foundInSettings: true,
          enabled: packageSetting?.enabled,
          isEnabled,
          packageSetting
        })
      }
      return isEnabled // Default to true if not explicitly set to false
    }
    
    // Helper to check if a Yoco product is enabled for this post
    const isYocoEnabledForPost = (productId: string) => {
      if (!postData?.packageSettings || !Array.isArray(postData.packageSettings)) {
        return false // Default to disabled unless explicitly configured
      }
      const packageSetting = postData.packageSettings.find((setting: any) => {
        const pkgId = typeof setting.package === 'object' ? setting.package.id : setting.package
        return pkgId === productId
      })
      // Only enabled if explicitly present and not disabled
      if (!packageSetting) return false
      return packageSetting?.enabled !== false
    }

    // Convert Yoco period to nights
    const getNightsForProduct = (product: any) => {
      const count = Number(product.periodCount) || 1
      switch (product.period) {
        case 'hour':
          return 1
        case 'day':
          return count
        case 'week':
          return count * 7
        case 'month':
          return count * 30
        case 'year':
          return count * 365
        default:
          return count
      }
    }
    
    // Combine database packages with Yoco products
    const allPackages = [
      ...dbPackages.docs.map(pkg => {
        const customName = getCustomName(pkg.id)
        // Map revenueCatId to yocoId for backward compatibility
        // If yocoId exists, use it; otherwise fall back to revenueCatId
        const yocoId = (pkg as any).yocoId || pkg.revenueCatId
        const dbEnabledForPost = isDbPackageEnabledForPost(pkg.id)
        const finalEnabled = pkg.isEnabled && dbEnabledForPost
        
        // Debug logging for special packages
        if (pkg.category === 'special' || pkg.id === '68a58832420e4517de8d2bdb' || pkg.id === '68a587e7420e4517de8d2b2d') {
          console.log('🔍 Special package processing:', {
            id: pkg.id,
            name: pkg.name,
            category: pkg.category,
            pkgIsEnabled: pkg.isEnabled,
            dbEnabledForPost,
            finalEnabled,
            postHasSettings: !!postData?.packageSettings,
            settingsCount: postData?.packageSettings?.length || 0
          })
        }
        
        return {
          id: pkg.id,
          name: customName || pkg.name, // Use custom name if available
          originalName: pkg.name, // Keep original name for reference
          description: pkg.description,
          multiplier: pkg.multiplier,
          category: pkg.category,
          minNights: pkg.minNights,
          maxNights: pkg.maxNights,
          revenueCatId: pkg.revenueCatId, // Keep for backward compatibility
          yocoId: yocoId, // Add yocoId field (maps from revenueCatId if not set)
          baseRate: pkg.baseRate,
          isEnabled: finalEnabled,
          features: pkg.features?.map((f: any) => f.feature) || [],
          relatedPage: (pkg as any).relatedPage, // Include related page data
          source: 'database',
          hasCustomName: !!customName
        }
      }),
      ...yocoProducts.map(product => {
        const customName = getCustomName(product.id)
        const nights = getNightsForProduct(product)
        return {
          id: product.id,
          name: customName || product.title, // Use custom name if available
          originalName: product.title, // Keep original name for reference
          description: product.description,
          multiplier: 1, // Default multiplier for Yoco products
          category: product.category,
          minNights: nights,
          maxNights: nights,
          revenueCatId: product.id, // Keep for backward compatibility
          yocoId: product.id, // Yoco products use their own ID as yocoId
          baseRate: product.price,
          isEnabled: product.isEnabled && isYocoEnabledForPost(product.id),
          features: product.features,
          source: 'yoco',
          hasCustomName: !!customName
        }
      })
    ]
      .filter(pkg => {
        // Debug logging for specific package
        if (pkg.id === '68a587e7420e4517de8d2b2d') {
          console.log('🔍 Debug package filtering:', {
            packageId: pkg.id,
            packageName: pkg.name,
            category: pkg.category,
            isEnabled: pkg.isEnabled,
            customerEntitlement,
            willPassEnabledFilter: pkg.isEnabled,
            willPassCategoryFilter: pkg.category !== 'addon' && (
              customerEntitlement === 'pro' || 
              (customerEntitlement === 'none' && ['hosted', 'special'].includes(pkg.category)) ||
              (customerEntitlement === 'standard' && ['standard', 'hosted', 'special'].includes(pkg.category))
            )
          })
        }
        return pkg.isEnabled // Only include enabled packages
      })
      .filter(pkg => {
        // Filter out addon packages - these should only appear on the booking page
        if (pkg.category === 'addon') {
          return false
        }
        
        // Filter packages based on customer entitlement (3-Tier System):
        // Tier 1: Non-subscribers (none) - Only see hosted/special packages (premium experience)
        if (customerEntitlement === 'none') {
          const shouldInclude = ['hosted', 'special'].includes(pkg.category)
          if (pkg.id === '68a587e7420e4517de8d2b2d') {
            console.log('🔍 Package entitlement check (none):', {
              packageId: pkg.id,
              category: pkg.category,
              shouldInclude,
              allowedCategories: ['hosted', 'special']
            })
          }
          return shouldInclude
        }
        
        // Tier 2: Standard subscribers - See standard + hosted + special (better than non-subscribers)
        if (customerEntitlement === 'standard') {
          return ['standard', 'hosted', 'special'].includes(pkg.category)
        }
        
        // Tier 3: Pro subscribers - See everything (all packages)
        if (customerEntitlement === 'pro') {
          return true
        }
        
        // Legacy: Filter out pro-only packages by yocoId for non-pro users
        if (pkg.yocoId === 'gathering_monthly' && customerEntitlement !== 'pro') {
          return false
        }
        
        return true
      })

    // Debug logging
    console.log('📦 Package filtering summary:', {
      postId,
      customerEntitlement,
      totalDbPackages: dbPackages.docs.length,
      totalYocoProducts: yocoProducts.length,
      totalAfterCombining: allPackages.length,
      packagesReturned: allPackages.map(pkg => ({
        id: pkg.id,
        name: pkg.name,
        category: pkg.category,
        isEnabled: pkg.isEnabled
      }))
    })

    const response = NextResponse.json({
      packages: allPackages,
      total: allPackages.length
    })

    // Disable caching temporarily to debug - results vary by user entitlement
    // TODO: Re-enable caching with proper cache keys once filtering is verified
    response.headers.set('Cache-Control', 'no-store, no-cache, must-revalidate, private')
    response.headers.set('Pragma', 'no-cache')
    response.headers.set('Expires', '0')

    return response
  } catch (error) {
    console.error('Error fetching packages:', error)
    return NextResponse.json(
      { error: 'Failed to fetch packages', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    )
  }
} 