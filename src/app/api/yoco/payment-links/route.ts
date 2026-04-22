import { NextRequest, NextResponse } from 'next/server'
import { getPayload } from 'payload'
import configPromise from '@payload-config'
import { yocoService } from '@/lib/yocoService'

export async function POST(request: NextRequest) {
  try {
    const payload = await getPayload({ config: configPromise })
    const { user } = await payload.auth({ headers: request.headers })

    if (!user) {
      return NextResponse.json({ error: 'Authentication required' }, { status: 401 })
    }

    const body = await request.json()
    const {
      packageData,
      customerName: customerNameFromBody,
      total,
      productId,
      estimateId,
      postId,
      bookingId,
      duration,
      startDate,
      endDate,
      version,
      intent: intentFromBody,
      entitlement,
      plan,
      periodDays,
    } = body

    const customerId = String(user.id)
    const customerName = customerNameFromBody || user.name || user.email || 'Guest'

    if (!customerName) {
      return NextResponse.json({ error: 'Customer name is required' }, { status: 400 })
    }

    console.log(`API Route: Using Yoco API version: ${version || 'default'}`)

    let paymentLink = null
    let transactionRecord = null
    let transactionAmount = 0
    let transactionIntent: 'booking' | 'subscription' | 'product' = intentFromBody || (packageData ? 'booking' : 'product')
    let transactionCurrency = 'ZAR'
    let transactionPackageName = packageData?.name || 'Custom Package'
    let transactionProductId = packageData?.revenueCatId || packageData?.id
    let transactionEntitlement = entitlement || (plan === 'pro' ? 'pro' : plan === 'standard' ? 'standard' : 'none')
    let transactionPlan = plan || (transactionEntitlement === 'pro' ? 'pro' : transactionEntitlement === 'standard' ? 'standard' : 'free')
    let transactionPeriodDays = periodDays as number | undefined

    const metadata = {
      estimateId,
      postId,
      bookingId,
      duration,
      startDate,
      endDate,
      version,
      intent: transactionIntent,
      entitlement: transactionEntitlement,
      plan: transactionPlan,
      periodDays: transactionPeriodDays,
    }

    transactionRecord = await payload.create({
      collection: 'yoco-transactions',
      data: {
        user: user.id,
        intent: transactionIntent,
        status: 'pending',
        productId: transactionProductId,
        packageName: transactionPackageName || 'Yoco Product',
        amount: transactionAmount,
        currency: transactionCurrency,
        entitlement: transactionEntitlement || 'none',
        plan: transactionPlan,
        periodDays: transactionPeriodDays,
        metadata,
      },
    })

    const transactionId = transactionRecord?.id
    const metadataWithId = {
      ...metadata,
      transactionId,
    }

    if (packageData) {
      // Create payment link for database package
      if (!total || Number(total) <= 0) {
        return NextResponse.json({ error: 'Total amount is required for database packages' }, { status: 400 })
      }
      if (!packageData.id || !packageData.name) {
        return NextResponse.json({ error: 'packageData.id and packageData.name are required' }, { status: 400 })
      }
      transactionAmount = Number(total)
      transactionPackageName = packageData.name
      transactionProductId = packageData.revenueCatId || packageData.id
      
      console.log('[Payment Link API] Creating payment link for database package:', {
        packageData,
        total,
        transactionAmount,
        packageBaseRate: packageData.baseRate
      })
      
      paymentLink = await yocoService.createPaymentLinkFromDatabasePackage(
        packageData,
        customerId,
        customerName,
        Number(total),
        version,
        metadataWithId,
      )
    } else if (productId) {
      // Create payment link for Yoco product
      const products = await yocoService.getProducts()
      const product = products.find(p => p.id === productId)
      
      if (!product) {
        return NextResponse.json({ error: 'Product not found' }, { status: 404 })
      }
      
      transactionAmount = Number(product.price || 0)
      transactionCurrency = product.currency || 'ZAR'
      transactionPackageName = product.title
      transactionProductId = product.id
      if (!transactionEntitlement || transactionEntitlement === 'none') {
        transactionEntitlement = (product.entitlement as 'standard' | 'pro' | undefined) || 'none'
      }
      if (!transactionPlan || transactionPlan === 'free') {
        transactionPlan = transactionEntitlement === 'pro' ? 'pro' : transactionEntitlement === 'standard' ? 'standard' : 'free'
      }
      if (!transactionPeriodDays) {
        if (product.period === 'day') transactionPeriodDays = product.periodCount
        if (product.period === 'week') transactionPeriodDays = product.periodCount * 7
        if (product.period === 'month') transactionPeriodDays = product.periodCount * 30
        if (product.period === 'year') transactionPeriodDays = product.periodCount * 365
      }

      paymentLink = await yocoService.createPaymentLink(product, customerId, customerName, version, metadataWithId)
    } else {
      return NextResponse.json({ error: 'Either packageData or productId is required' }, { status: 400 })
    }

    if (!paymentLink) {
      return NextResponse.json({ error: 'Failed to create payment link' }, { status: 500 })
    }

    if (transactionRecord?.id) {
      await payload.update({
        collection: 'yoco-transactions',
        id: transactionRecord.id,
        data: {
          paymentLinkId: paymentLink.id,
          paymentUrl: paymentLink.url,
          amount: transactionAmount,
          currency: transactionCurrency,
          productId: transactionProductId,
          packageName: transactionPackageName,
          entitlement: transactionEntitlement || 'none',
          plan: transactionPlan,
          periodDays: transactionPeriodDays,
        metadata: metadataWithId,
        },
      })
    }

    return NextResponse.json({ paymentLink, transactionId })
  } catch (error) {
    console.error('Error creating payment link:', error)
    return NextResponse.json(
      { error: 'Failed to create payment link', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    )
  }
}
