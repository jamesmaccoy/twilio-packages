import { NextRequest, NextResponse } from 'next/server'
import { getPayload } from 'payload'
import configPromise from '@/payload.config'
import { yocoService } from '@/lib/yocoService'

export async function POST(request: NextRequest) {
  try {
    const payload = await getPayload({ config: configPromise })
    const { user } = await payload.auth({ headers: request.headers })
    
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Only admins can sync packages
    if (!user.role || !user.role.includes('admin')) {
      return NextResponse.json({ error: 'Insufficient permissions' }, { status: 403 })
    }

    const body = await request.json()
    const { postId, selectedProducts } = body

    if (!postId) {
      return NextResponse.json({ error: 'Post ID is required' }, { status: 400 })
    }

    // Fetch products from Yoco
    const yocoProducts = await yocoService.getProducts()
    
    // If selectedProducts is provided, use those; otherwise use the default list
    const requestedProducts = selectedProducts && selectedProducts.length > 0 
      ? selectedProducts 
      : [
          'week_x2_customer',
          'week_x3_customer', 
          'week_x4_customer',
          'per_hour',
          'per_hour_guest',
          'per_hour_luxury',
          '3nights',
          '3nights',
          'weekly',
          'hosted7nights',
          'hosted3nights',
          'per_night_customer',
          'per_night_luxury',
          'weekly_customer',
          'monthly',
          'gathering'
        ]

    const productsToImport = yocoProducts.filter(product => 
      requestedProducts.includes(product.id)
    )

    const importedPackages = []
    const errors = []

    for (const product of productsToImport) {
      try {
        // Check if package already exists
        const existing = await payload.find({
          collection: 'packages',
          where: {
            post: { equals: postId },
            revenueCatId: { equals: product.id }
          },
          limit: 1
        })

        if (existing.docs.length > 0 && existing.docs[0]) {
          // Update existing package
          const updated = await payload.update({
            collection: 'packages',
            id: existing.docs[0].id,
            data: {
              name: product.title,
              description: product.description,
              multiplier: 1, // Default multiplier
              category: product.category,
              minNights: product.period === 'hour' ? 1 : product.periodCount,
              maxNights: product.period === 'hour' ? 1 : product.periodCount,
              revenueCatId: product.id,
              isEnabled: product.isEnabled,
              baseRate: product.price,
              features: product.features.map(feature => ({ feature }))
            },
            user
          })
          importedPackages.push(updated)
        } else {
          // Create new package
          const created = await payload.create({
            collection: 'packages',
            data: {
              post: postId,
              name: product.title,
              description: product.description,
              multiplier: 1, // Default multiplier
              category: product.category,
              minNights: product.period === 'hour' ? 1 : product.periodCount,
              maxNights: product.period === 'hour' ? 1 : product.periodCount,
              revenueCatId: product.id,
              isEnabled: product.isEnabled,
              baseRate: product.price,
              features: product.features.map(feature => ({ feature }))
            },
            user
          })
          importedPackages.push(created)
        }
      } catch (error) {
        console.error(`Failed to import product ${product.id}:`, error)
        errors.push({
          productId: product.id,
          error: error instanceof Error ? error.message : 'Unknown error'
        })
      }
    }

    return NextResponse.json({
      message: `Successfully imported ${importedPackages.length} packages`,
      importedPackages,
      errors: errors.length > 0 ? errors : undefined,
      totalProducts: productsToImport.length
    })
  } catch (error) {
    console.error('Error syncing Yoco packages:', error)
    return NextResponse.json(
      { error: 'Failed to sync packages', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    )
  }
} 