import { NextRequest, NextResponse } from 'next/server'
import { getPayload } from 'payload'
import configPromise from '@/payload.config'
import { yocoService } from '@/lib/yocoService'

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ postId: string }> }
) {
  try {
    const payload = await getPayload({ config: configPromise })
    const { postId } = await params
    
    // Get the post data to access packageSettings for custom names
    let postData = null
    try {
      postData = await payload.findByID({
        collection: 'posts',
        id: postId,
        depth: 1,
      })
    } catch (error) {
      console.log('Failed to fetch post data for custom names, continuing without custom names')
    }

    // Get addon packages from database (filter by category 'addon')
    const dbPackages = await payload.find({
      collection: 'packages',
      where: {
        post: { equals: postId },
        isEnabled: { equals: true },
        category: { equals: 'addon' }
      },
      depth: 2, // Increased depth to include related page data
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
    }).filter(pkg => pkg.isEnabled)

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
      .filter(pkg => pkg.isEnabled)

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