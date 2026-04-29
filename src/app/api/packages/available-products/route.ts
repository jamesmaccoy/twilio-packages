import { NextRequest, NextResponse } from 'next/server'
import { getPayload } from 'payload'
import configPromise from '@/payload.config'
import { yocoService } from '@/lib/yocoService'
import { getCustomerEntitlement, type CustomerEntitlement } from '@/utils/packageSuggestions'

export async function GET(request: NextRequest) {
  try {
    const payload = await getPayload({ config: configPromise })
    
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
        // Treat missing expiry as inactive to avoid accidentally granting subscription access.
        if (!tx.expiresAt) return false
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
    
    // Fetch all available products from Yoco
    const products = await yocoService.getProducts()
    
    // Filter products based on customer entitlement
    // Only show products that the customer can access or upgrade to
    const filteredProducts = products.filter(product => {
      const productEntitlement = product.entitlement as CustomerEntitlement
      
      // Always show products that match or are below customer's entitlement level
      // This allows customers to see what they have access to
      if (customerEntitlement === 'pro') {
        // Pro customers can see all products
        return true
      }
      
      if (customerEntitlement === 'standard') {
        // Standard customers can see standard and none entitlement products
        // Also show pro products so they know what they can upgrade to
        return productEntitlement === 'standard' || productEntitlement === 'none' || productEntitlement === 'pro'
      }
      
      // Non-subscribers (none) can see all products to encourage subscription
      // But we'll mark which ones require subscription
      return true
    })
    
    // Transform to the format expected by the frontend
    const availableProducts = filteredProducts.map(product => ({
      id: product.id,
      title: product.title,
      description: product.description,
      price: product.price,
      currency: product.currency,
      period: product.period,
      periodCount: product.periodCount,
      category: product.category,
      features: product.features,
      entitlement: product.entitlement,
      icon: product.icon,
      // Add flag to indicate if product is available to current customer
      isAvailable: (() => {
        const productEntitlement = product.entitlement as CustomerEntitlement
        if (customerEntitlement === 'pro') return true
        if (customerEntitlement === 'standard') {
          return productEntitlement === 'standard' || productEntitlement === 'none'
        }
        return productEntitlement === 'none'
      })(),
    }))

    console.log(`Serving ${availableProducts.length} available products for customer entitlement: ${customerEntitlement}`)
    
    return NextResponse.json(availableProducts)
  } catch (error) {
    console.error('Error fetching available products:', error)
    return NextResponse.json(
      { error: 'Failed to fetch available products' },
      { status: 500 }
    )
  }
} 