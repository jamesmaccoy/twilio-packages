import { NextRequest, NextResponse } from 'next/server'
import { getPayload } from 'payload'
import configPromise from '@/payload.config'
import { yocoService } from '@/lib/yocoService'
import { hasPackageCategory } from '@/utils/packageCategories'
import {
  normalizePackageEntitlements,
  packageVisibleToCustomer,
  type CustomerEntitlement,
} from '@/utils/packageSuggestions'

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ postId: string }> }
) {
  try {
    const payload = await getPayload({ config: configPromise })
    const { postId } = await params
    
    // If authenticated, apply host ownership checks for draft/unpublished posts too.
    let user: any = null
    try {
      const authResult = await payload.auth({ headers: request.headers })
      user = authResult.user
    } catch {
      user = null
    }
    
    // Get the post data to access packageSettings for custom names
    let postData = null
    try {
      postData = await payload.findByID({
        collection: 'posts',
        id: postId,
        depth: 1,
        user: user || undefined,
        overrideAccess: false,
      })
    } catch (error) {
      console.log('Failed to fetch post data for custom names, continuing without custom names')
    }

    // Determine customer entitlement (for addon gating).
    // NOTE: Payload's `users` collection read access is adminOrSelf; we rely on payload.auth() user object here.
    const customerEntitlement: CustomerEntitlement = (() => {
      if (!user) return 'none'
      const role = (user as any)?.role
      const roleArray = Array.isArray(role) ? role : role ? [role] : []
      if (roleArray.includes('admin')) return 'pro'

      const sub = (user as any)?.subscriptionStatus
      const status = sub?.status
      const expiresAt = sub?.expiresAt
      const plan = String(sub?.plan || '').toLowerCase()
      const now = new Date()
      const notExpired = !expiresAt || (typeof expiresAt === 'string' && new Date(expiresAt) > now)
      if (status === 'active' && notExpired) return plan === 'pro' ? 'pro' : 'standard'
      return 'none'
    })()

    // Get addon packages from database (filter by category 'addon')
    const dbPackages = await payload.find({
      collection: 'packages',
      where: {
        post: { equals: postId },
        isEnabled: { equals: true },
        category: { equals: 'addon' }
      },
      depth: 2, // Increased depth to include related page data
      user: user || undefined,
      overrideAccess: false,
    })
    const yocoProducts = await yocoService.getProducts()
    
    const findPackageSetting = (packageId: string) => {
      if (!postData?.packageSettings || !Array.isArray(postData.packageSettings)) {
        return null
      }
      return (
        postData.packageSettings.find((setting: any) => {
          if (!setting?.package) return false
          if (typeof setting.package === 'string') {
            return setting.package === packageId
          }
          const pkg = setting.package
          const pkgId =
            typeof pkg === 'object' && pkg !== null
              ? pkg.id || pkg?.value
              : undefined
          const pkgRevenueCatId =
            typeof pkg === 'object' && pkg !== null ? pkg.revenueCatId : undefined
          return pkgId === packageId || pkgRevenueCatId === packageId
        }) || null
      )
    }

    // Helper function to get custom name from packageSettings
    const getCustomName = (packageId: string) => {
      const packageSetting = findPackageSetting(packageId)
      return packageSetting?.customName || null
    }
    
    // Helper function to check DB package is enabled for this post
    const isDbPackageEnabledForPost = (packageId: string) => {
      const packageSetting = findPackageSetting(packageId)
      if (!packageSetting) return true // Default to enabled if no settings exist for DB packages
      return packageSetting?.enabled !== false // Default to true if not explicitly set to false
    }

    const isYocoAddonEnabledForPost = (productId: string, defaultEnabled: boolean) => {
      if (!defaultEnabled) return false
      const packageSetting = findPackageSetting(productId)
      if (!packageSetting) return defaultEnabled
      return packageSetting?.enabled !== false
    }

    const getAddonDuration = (product: any) => {
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
    
    // Process addon packages
    const dbAddonPackages = dbPackages.docs.map(pkg => {
      const customName = getCustomName(pkg.id)
      return {
        id: pkg.id,
        name: customName || pkg.name, // Use custom name if available
        originalName: pkg.name, // Keep original name for reference
        description: pkg.description,
        multiplier: pkg.multiplier,
        category: pkg.category,
        entitlement: (pkg as any).entitlement ?? null,
        minNights: pkg.minNights,
        maxNights: pkg.maxNights,
        revenueCatId: pkg.revenueCatId,
        baseRate: pkg.baseRate,
        isEnabled: pkg.isEnabled && isDbPackageEnabledForPost(pkg.id),
        features: pkg.features?.map((f: any) => f.feature) || [],
        relatedPage: (pkg as any).relatedPage, // Include related page data
        source: 'database',
        hasCustomName: !!customName
      }
    })
      .filter((pkg) => Boolean(pkg.isEnabled))
      // Strictly require addon category, even if category is a hasMany array.
      .filter((pkg) => hasPackageCategory(pkg.category as any, 'addon'))
      // Enforce entitlement gating for signed-in customers.
      .filter((pkg) =>
        packageVisibleToCustomer({
          packageEntitlement: (pkg as any).entitlement,
          customerEntitlement,
          hideNoneForPaying: false,
        }),
      )

    const yocoAddonPackages = yocoProducts
      .filter(product => product.category === 'addon')
      .map(product => {
        const customName = getCustomName(product.id)
        const isEnabled = isYocoAddonEnabledForPost(product.id, product.isEnabled)
        const duration = getAddonDuration(product)
        return {
          id: product.id,
          name: customName || product.title,
          originalName: product.title,
          description: product.description,
          multiplier: 1,
          category: product.category,
          entitlement: (product as any).entitlement ?? null,
          minNights: duration,
          maxNights: duration,
          revenueCatId: product.id,
          baseRate: product.price,
          isEnabled,
          features: Array.isArray(product.features) ? product.features : [],
          relatedPage: null,
          source: 'yoco',
          hasCustomName: !!customName
        }
      })
      .filter((pkg) => Boolean(pkg.isEnabled))
      .filter((pkg) =>
        packageVisibleToCustomer({
          packageEntitlement: (pkg as any).entitlement,
          customerEntitlement,
          hideNoneForPaying: false,
        }),
      )

    const addonPackages = [...dbAddonPackages, ...yocoAddonPackages]

    const response = NextResponse.json({
      addons: addonPackages,
      total: addonPackages.length
    })

    // Add caching headers to prevent excessive API calls
    response.headers.set('Cache-Control', 'public, max-age=60, s-maxage=300') // Cache for 1 minute client-side, 5 minutes CDN
    response.headers.set('ETag', `addons-${postId}-${Date.now()}`)

    return response
  } catch (error) {
    console.error('Error fetching addon packages:', error)
    return NextResponse.json(
      { error: 'Failed to fetch addon packages', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    )
  }
} 