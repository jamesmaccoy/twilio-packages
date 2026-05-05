type BookingMetadata = {
  estimateId?: string
  postId?: string
  bookingId?: string
  duration?: number
  startDate?: string
  endDate?: string
  transactionId?: string
  intent?: 'booking' | 'subscription' | 'product'
  entitlement?: string
  plan?: string
  periodDays?: number
}

export interface YocoProduct {
  id: string
  title: string
  description: string
  price: number
  currency: string
  period: 'hour' | 'day' | 'week' | 'month' | 'year'
  periodCount: number
  category: 'standard' | 'hosted' | 'addon' | 'special'
  features: string[]
  isEnabled: boolean
  entitlement?: 'standard' | 'pro' | string
  icon?: string
}

export interface YocoPaymentLink {
  id: string
  url: string
  created_at: string
  updated_at: string
  customer_description: string
  customer_reference: string
  order: {
    id: string
    display_name: string
    name: string
    status: string
    currency: string
    amounts: {
      gross_amount: { amount: number; currency: string }
      net_amount: { amount: number; currency: string }
      tax_amount: { amount: number; currency: string }
      discount_amount: { amount: number; currency: string }
      tip_amount: { amount: number; currency: string }
    }
    line_items: Array<{
      id: string
      name: string
      quantity: string
      unit_price: { amount: number; currency: string }
      total_price: { amount: number; currency: string }
      item_type: string
    }>
  }
}

export interface YocoCustomer {
  id: string
  email: string
  name: string
  entitlements: {
    [key: string]: {
      expires_date: string | null
      product_identifier: string
      purchase_date: string
    }
  }
}

class YocoService {
  private apiKey: string
  private initialized: boolean = false
  private baseUrl: string = 'https://payments.yoco.com/api'

  constructor() {
    this.apiKey = process.env.YOCO_SECRET_KEY || ''
    console.log('Yoco API Key loaded:', this.apiKey ? 'Yes' : 'No', this.apiKey ? `(${this.apiKey.substring(0, 10)}...)` : '')
  }

  private getApiKey(version?: string): string {
    if (version === 'V2') {
      return process.env.YOCO_SECRET_KEY_V2 || this.apiKey
    }
    return this.apiKey
  }

  async initialize() {
    if (this.initialized) return

    try {
      if (!this.apiKey) {
        console.warn('Yoco API key not configured, using mock data')
        this.initialized = true
        return
      }
      
      // Skip API testing for now since the endpoints don't exist
      console.log('Yoco service initialized with API key')
      this.initialized = true
    } catch (error) {
      console.error('Failed to initialize Yoco:', error)
      console.warn('Falling back to mock data')
      this.initialized = true
    }
  }

  async getProducts(): Promise<YocoProduct[]> {
    await this.initialize()
    
    try {
      return await this.getYocoProducts()
    } catch (error) {
      console.error('Failed to fetch Yoco products:', error)
      return []
    }
  }

  private async getYocoProducts(): Promise<YocoProduct[]> {
    try {
      if (!this.apiKey) {
        console.warn('Yoco API key not configured, using mock data')
        return this.getMockProducts()
      }

      // For now, return mock products since the Yoco API endpoints don't exist
      console.log('Using mock Yoco products (API endpoints not available)')
      return this.getMockProducts()
    } catch (error) {
      console.error('Failed to get Yoco products:', error)
      return this.getMockProducts()
    }
  }

  private getMockProducts(): YocoProduct[] {
    return [
      {
        id: 'per_hour',
        title: '🌿 Member Subscription',
        description: 'Monthly Simple Plek membership with calendar access and community perks',
        price: 25.0,
        currency: 'ZAR',
        period: 'month' as const,
        periodCount: 1,
        category: 'standard' as const,
        features: ['Unlock availability calendar', 'Longer stays', 'Addon packages'],
        isEnabled: true,
        entitlement: 'standard' as const,
        icon: '🌿',
      },
      {
        id: 'virtual_wine',
        title: '🍷 Virtual Wine Experience',
        description: 'Weekly virtual wine tasting and experience package',
        price: 5.00,
        currency: 'ZAR',
        period: 'day' as const,
        periodCount: 7,
        category: 'standard' as const,
        features: ['Pre order wine', 'Curation of the Cape finest', 'Mix and match', 'In app purchases', 'Wine sommelier on request'],
        isEnabled: true,
        entitlement: 'standard' as const,
        icon: '🍷',
      },
      {
        id: 'per_hour_guest',
        title: '🚗 Parking',
        description: 'Parking for 1 hour',
        price: 25.00,
        currency: 'ZAR',
        period: 'hour' as const,
        periodCount: 1,
        category: 'standard' as const,
        features: ['Flexible booking', 'Hourly pricing', 'No commitment'],
        isEnabled: true,
        entitlement: 'standard' as const,
        icon: '⏰',
      },
      {
        id: 'per_hour_luxury',
        title: '✨ Pro Host',
        description: 'Host your own plek with your own addons',
        price: 50.00,
        currency: 'ZAR',
        period: 'hour' as const,
        periodCount: 1,
        category: 'special' as const,
        features: ['Invite link sharing', 'Schedule overview', 'Create your own addons'],
        isEnabled: true,
        entitlement: 'pro' as const,
        icon: '✨',
      },
      {
        id: 'Bottle_wine',
        title: '🍷 Wine Add-on',
        description: 'Curated wine selection with optional sommelier pairing',
        price: 350.0,
        currency: 'ZAR',
        period: 'day' as const,
        periodCount: 1,
        category: 'addon' as const,
        features: ['Premium wine selection', 'Sommelier pairing', 'Delivered chilled'],
        isEnabled: true,
        entitlement: 'standard' as const,
        icon: '🍷',
      },
      {
        id: 'cleaning',
        title: '🧹 Mid-Stay Cleaning',
        description: 'Professional cleaning service during your stay',
        price: 450.0,
        currency: 'ZAR',
        period: 'day' as const,
        periodCount: 1,
        category: 'addon' as const,
        features: ['Professional cleaners', 'Flexible scheduling', 'Premium supplies'],
        isEnabled: true,
        entitlement: 'standard' as const,
        icon: '🧹',
      },
      {
        id: 'Hike',
        title: '🥾 Guided Hike',
        description: 'Guided hiking experience on local trails',
        price: 650.0,
        currency: 'ZAR',
        period: 'day' as const,
        periodCount: 1,
        category: 'addon' as const,
        features: ['Local guide', 'Trail snacks', 'Safety briefing'],
        isEnabled: true,
        entitlement: 'standard' as const,
        icon: '🥾',
      },
      {
        id: 'bathBomb',
        title: '🛁 Luxury Bath Experience',
        description: 'Premium bath bomb set for a relaxing soak',
        price: 220.0,
        currency: 'ZAR',
        period: 'day' as const,
        periodCount: 1,
        category: 'addon' as const,
        features: ['Artisanal bath bomb', 'Aromatherapy oils', 'Relaxation guide'],
        isEnabled: true,
        entitlement: 'standard' as const,
        icon: '🛁',
      },
      {
        id: 'gathering_monthly',
        title: '🏘️ Annual agreement',
        description: 'Your booking is locked in for the year',
        price: 5000.00,
        currency: 'ZAR',
        period: 'month' as const,
        periodCount: 1,
        category: 'special' as const,
        features: ['Month to month agreement', 'No cancellation fees', 'No minimum stay', 'No lock in period'],
        isEnabled: true,
        entitlement: 'pro' as const,
        icon: '🏘️',
      },
    ]
  }

  async createPaymentLink(
    product: YocoProduct,
    customerId: string,
    customerName: string,
    version?: string,
    bookingData?: BookingMetadata,
  ): Promise<YocoPaymentLink | null> {
    await this.initialize()
    
    const apiKey = this.getApiKey(version)
    console.log(`Using Yoco API key version: ${version || 'default'}`)
    
    try {
      if (!apiKey) {
        console.warn('Yoco API key not configured, using mock payment link')
        return this.getMockPaymentLink(product, customerId, customerName, bookingData)
      }

      // Build success URL with booking data
      // Use production URL in production, localhost in development
      const baseUrl = process.env.NODE_ENV === 'production' 
        ? (process.env.NEXT_PUBLIC_URL || 'https://www.simpleplek.co.za')
        : (process.env.NEXT_PUBLIC_URL || 'http://localhost:3000')
      const successParams = new URLSearchParams({ success: 'true' })
      if (bookingData?.estimateId) successParams.set('estimateId', bookingData.estimateId)
      if (bookingData?.postId) successParams.set('postId', bookingData.postId)
      if (bookingData?.duration) successParams.set('duration', String(bookingData.duration))
      if (bookingData?.startDate) successParams.set('startDate', bookingData.startDate)
      if (bookingData?.endDate) successParams.set('endDate', bookingData.endDate)
      if (bookingData?.transactionId) successParams.set('transactionId', bookingData.transactionId)
      if (bookingData?.intent) successParams.set('intent', bookingData.intent)
      if (bookingData?.entitlement) successParams.set('entitlement', bookingData.entitlement)
      if (bookingData?.plan) successParams.set('plan', bookingData.plan)
      if (bookingData?.periodDays) successParams.set('periodDays', String(bookingData.periodDays))

      // Build cancel URL - redirect back to estimate if estimateId exists, otherwise to post or estimate page
      let cancelUrl = `${baseUrl}/estimate?cancelled=true`
      if (bookingData?.estimateId) {
        cancelUrl = `${baseUrl}/estimate/${bookingData.estimateId}?cancelled=true`
      } else if (bookingData?.postId) {
        // If we have postId but no estimateId, redirect to post page
        cancelUrl = `${baseUrl}/posts/${bookingData.postId}?cancelled=true`
      }

      // Create checkout via Yoco Checkout API
      const requestBody = {
        amount: Math.round(product.price * 100), // Amount in cents
        currency: product.currency,
        successUrl: `${baseUrl}/booking-confirmation?${successParams.toString()}`,
        cancelUrl,
        metadata: {
          productId: product.id,
          productName: product.title,
          customerId: customerId,
          customerName: customerName,
          ...(bookingData?.estimateId && { estimateId: bookingData.estimateId }),
          ...(bookingData?.postId && { postId: bookingData.postId })
        }
      }

      console.log('Making Yoco API request to create payment link for product:', {
        url: `${this.baseUrl}/checkouts`,
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${apiKey.substring(0, 10)}...`,
          'Content-Type': 'application/json',
        },
        body: requestBody
      })

      const response = await fetch(`${this.baseUrl}/checkouts`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${apiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(requestBody)
      })

      console.log('Yoco API response:', {
        status: response.status,
        statusText: response.statusText,
        ok: response.ok
      })

      if (!response.ok) {
        const errorText = await response.text()
        console.error('Yoco API error response:', errorText)
        throw new Error(`Yoco API error: ${response.status} ${response.statusText} - ${errorText}`)
      }

      const checkout = await response.json()
      console.log('✅ Yoco checkout created successfully for product:', checkout)
      
      // Transform checkout response to payment link format
      const paymentLink: YocoPaymentLink = {
        id: checkout.id,
        url: checkout.redirectUrl || checkout.url || `https://pay.yoco.com/checkout/${checkout.id}`,
        created_at: checkout.createdDate || new Date().toISOString(),
        updated_at: checkout.updatedDate || new Date().toISOString(),
        customer_description: product.description,
        customer_reference: customerName,
        order: {
          id: checkout.id,
          display_name: product.title,
          name: product.title,
          status: checkout.status || 'pending',
          currency: product.currency,
          amounts: {
            gross_amount: { amount: Math.round(product.price * 100), currency: product.currency },
            net_amount: { amount: Math.round(product.price * 100), currency: product.currency },
            tax_amount: { amount: 0, currency: product.currency },
            discount_amount: { amount: 0, currency: product.currency },
            tip_amount: { amount: 0, currency: product.currency }
          },
          line_items: [{
            id: `item-${Date.now()}`,
            name: product.title,
            quantity: '1.00',
            unit_price: { amount: Math.round(product.price * 100), currency: product.currency },
            total_price: { amount: Math.round(product.price * 100), currency: product.currency },
            item_type: 'product'
          }]
        }
      }
      
      return paymentLink
      
    } catch (error) {
      console.error('Failed to create payment link:', error)
      return this.getMockPaymentLink(product, customerId, customerName, bookingData)
    }
  }

  // New method to create payment link from database package
  async createPaymentLinkFromDatabasePackage(
    packageData: {
      id: string
      name: string
      description?: string
      baseRate?: number
      revenueCatId?: string
    },
    customerId: string,
    customerName: string,
    total: number,
    version?: string,
    bookingData?: BookingMetadata,
  ): Promise<YocoPaymentLink | null> {
    await this.initialize()

    const apiKey = this.getApiKey(version)
    console.log(`Using Yoco API key version: ${version  || 'default'} and ${apiKey}`)
    
    console.log('Creating payment link for database package:', {
      packageData,
      customerId,
      customerName,
      total,
      bookingData,
      apiKey: apiKey ? 'Present' : 'Missing'
    })
    
    try {
      if (!apiKey) {
        console.warn('Yoco API key not configured, using mock payment link')
        return this.getMockPaymentLinkFromDatabase(packageData, customerId, customerName, total, bookingData)
      }

      // Build success URL with booking data
      // Use production URL in production, localhost in development
      const baseUrl = process.env.NODE_ENV === 'production' 
        ? (process.env.NEXT_PUBLIC_URL || 'https://www.simpleplek.co.za')
        : (process.env.NEXT_PUBLIC_URL || 'http://localhost:3000')
      const successParams = new URLSearchParams({ success: 'true' })
      if (bookingData?.estimateId) successParams.set('estimateId', bookingData.estimateId)
      if (bookingData?.postId) successParams.set('postId', bookingData.postId)
      if (bookingData?.duration) successParams.set('duration', String(bookingData.duration))
      if (bookingData?.startDate) successParams.set('startDate', bookingData.startDate)
      if (bookingData?.endDate) successParams.set('endDate', bookingData.endDate)
      if (bookingData?.transactionId) successParams.set('transactionId', bookingData.transactionId)
      if (bookingData?.intent) successParams.set('intent', bookingData.intent)
      if (bookingData?.entitlement) successParams.set('entitlement', bookingData.entitlement)
      if (bookingData?.plan) successParams.set('plan', bookingData.plan)
      if (bookingData?.periodDays) successParams.set('periodDays', String(bookingData.periodDays))

      // Build cancel URL - redirect back to estimate if estimateId exists, otherwise to post or estimate page
      let cancelUrl = `${baseUrl}/estimate?cancelled=true`
      if (bookingData?.estimateId) {
        cancelUrl = `${baseUrl}/estimate/${bookingData.estimateId}?cancelled=true`
      } else if (bookingData?.postId) {
        // If we have postId but no estimateId, redirect to post page
        cancelUrl = `${baseUrl}/posts/${bookingData.postId}?cancelled=true`
      }

      // Create checkout via Yoco Checkout API
      // Note: The Checkout API creates a checkout session, not a direct payment link
      // Convert total from rands (Payload CMS format) to cents (Yoco API format)
      const amountInCents = Math.round(total * 100)
      
      console.log('[Yoco Payment] Converting rands to cents:', {
        totalReceived: total,
        amountInCents
      })
      
      const requestBody = {
        amount: amountInCents, // Amount in cents (converted from rands)
        currency: 'ZAR',
        successUrl: `${baseUrl}/booking-confirmation?${successParams.toString()}`,
        cancelUrl,
        metadata: {
          packageId: packageData.id,
          packageName: packageData.name,
          customerId: customerId,
          customerName: customerName,
          ...(bookingData?.estimateId && { estimateId: bookingData.estimateId }),
          ...(bookingData?.postId && { postId: bookingData.postId })
        }
      }

      console.log('Making Yoco API request to create payment link:', {
        url: `${this.baseUrl}/checkouts`,
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${apiKey.substring(0, 10)}...`,
          'Content-Type': 'application/json',
        },
        body: requestBody
      })

      const response = await fetch(`${this.baseUrl}/checkouts`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${apiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(requestBody)
      })

      console.log('Yoco API response:', {
        status: response.status,
        statusText: response.statusText,
        ok: response.ok
      })

      if (!response.ok) {
        const errorText = await response.text()
        console.error('Yoco API error response:', errorText)
        throw new Error(`Yoco API error: ${response.status} ${response.statusText} - ${errorText}`)
      }

      const checkout = await response.json()
      console.log('✅ Yoco checkout created successfully:', checkout)
      
      // Transform checkout response to payment link format
      const paymentLink: YocoPaymentLink = {
        id: checkout.id,
        url: checkout.redirectUrl || checkout.url || `https://pay.yoco.com/checkout/${checkout.id}`,
        created_at: checkout.createdDate || new Date().toISOString(),
        updated_at: checkout.updatedDate || new Date().toISOString(),
        customer_description: packageData.description || packageData.name,
        customer_reference: customerName,
        order: {
          id: checkout.id,
          display_name: packageData.name,
          name: packageData.name,
          status: checkout.status || 'pending',
          currency: 'ZAR',
          amounts: {
            gross_amount: { amount: Math.round(total * 100), currency: 'ZAR' },
            net_amount: { amount: Math.round(total * 100), currency: 'ZAR' },
            tax_amount: { amount: 0, currency: 'ZAR' },
            discount_amount: { amount: 0, currency: 'ZAR' },
            tip_amount: { amount: 0, currency: 'ZAR' }
          },
          line_items: [{
            id: `item-${Date.now()}`,
            name: packageData.name,
            quantity: '1.00',
            unit_price: { amount: Math.round(total * 100), currency: 'ZAR' },
            total_price: { amount: Math.round(total * 100), currency: 'ZAR' },
            item_type: 'product'
          }]
        }
      }
      
      return paymentLink
      
    } catch (error) {
      console.error('Failed to create payment link:', error)
      console.error('Error details:', {
        message: error instanceof Error ? error.message : 'Unknown error',
        stack: error instanceof Error ? error.stack : undefined
      })
      console.warn('Falling back to mock payment link due to API error')
      return this.getMockPaymentLinkFromDatabase(packageData, customerId, customerName, total, bookingData)
    }
  }

  private getMockPaymentLink(
    product: YocoProduct,
    customerId: string,
    customerName: string,
    bookingData?: BookingMetadata,
  ): YocoPaymentLink {
    // Use production URL in production, localhost in development
    const baseUrl = process.env.NODE_ENV === 'production' 
      ? (process.env.NEXT_PUBLIC_URL || 'https://www.simpleplek.co.za')
      : (process.env.NEXT_PUBLIC_URL || 'http://localhost:3000')
    const successParams = new URLSearchParams({ success: 'true' })
    if (bookingData?.estimateId) successParams.set('estimateId', bookingData.estimateId)
    if (bookingData?.postId) successParams.set('postId', bookingData.postId)
    if (bookingData?.duration) successParams.set('duration', String(bookingData.duration))
    if (bookingData?.startDate) successParams.set('startDate', bookingData.startDate)
    if (bookingData?.endDate) successParams.set('endDate', bookingData.endDate)
    if (bookingData?.transactionId) successParams.set('transactionId', bookingData.transactionId)
    if (bookingData?.intent) successParams.set('intent', bookingData.intent)
    if (bookingData?.entitlement) successParams.set('entitlement', bookingData.entitlement)
    if (bookingData?.plan) successParams.set('plan', bookingData.plan)
    if (bookingData?.periodDays) successParams.set('periodDays', String(bookingData.periodDays))
    
    // Build cancel URL for mock payment link
    let cancelUrl = `${baseUrl}/estimate?cancelled=true`
    if (bookingData?.estimateId) {
      cancelUrl = `${baseUrl}/estimate/${bookingData.estimateId}?cancelled=true`
    } else if (bookingData?.postId) {
      cancelUrl = `${baseUrl}/posts/${bookingData.postId}?cancelled=true`
    }
    
    return {
      id: `mock-${Date.now()}`,
      url: `${baseUrl}/booking-confirmation?${successParams.toString()}`,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      customer_description: product.description,
      customer_reference: customerName,
      order: {
        id: `order-${Date.now()}`,
        display_name: product.title,
        name: product.title,
        status: 'pending',
        currency: product.currency,
        amounts: {
          gross_amount: { amount: Math.round(product.price * 100), currency: product.currency },
          net_amount: { amount: Math.round(product.price * 100), currency: product.currency },
          tax_amount: { amount: 0, currency: product.currency },
          discount_amount: { amount: 0, currency: product.currency },
          tip_amount: { amount: 0, currency: product.currency }
        },
        line_items: [{
          id: `item-${Date.now()}`,
          name: product.title,
          quantity: '1.00',
          unit_price: { amount: Math.round(product.price * 100), currency: product.currency },
          total_price: { amount: Math.round(product.price * 100), currency: product.currency },
          item_type: 'product'
        }]
      }
    }
  }

  private getMockPaymentLinkFromDatabase(
    packageData: {
      id: string
      name: string
      description?: string
      baseRate?: number
      revenueCatId?: string
    },
    customerId: string,
    customerName: string,
    total: number,
    bookingData?: BookingMetadata,
  ): YocoPaymentLink {
    // Use production URL in production, localhost in development
    const baseUrl = process.env.NODE_ENV === 'production' 
      ? (process.env.NEXT_PUBLIC_URL || 'https://www.simpleplek.co.za')
      : (process.env.NEXT_PUBLIC_URL || 'http://localhost:3000')
    const successParams = new URLSearchParams({ success: 'true' })
    if (bookingData?.estimateId) successParams.set('estimateId', bookingData.estimateId)
    if (bookingData?.postId) successParams.set('postId', bookingData.postId)
    if (bookingData?.duration) successParams.set('duration', String(bookingData.duration))
    if (bookingData?.startDate) successParams.set('startDate', bookingData.startDate)
    if (bookingData?.endDate) successParams.set('endDate', bookingData.endDate)
    if (bookingData?.transactionId) successParams.set('transactionId', bookingData.transactionId)
    if (bookingData?.intent) successParams.set('intent', bookingData.intent)
    if (bookingData?.entitlement) successParams.set('entitlement', bookingData.entitlement)
    if (bookingData?.plan) successParams.set('plan', bookingData.plan)
    if (bookingData?.periodDays) successParams.set('periodDays', String(bookingData.periodDays))
    
    // Build cancel URL for mock payment link
    let cancelUrl = `${baseUrl}/estimate?cancelled=true`
    if (bookingData?.estimateId) {
      cancelUrl = `${baseUrl}/estimate/${bookingData.estimateId}?cancelled=true`
    } else if (bookingData?.postId) {
      cancelUrl = `${baseUrl}/posts/${bookingData.postId}?cancelled=true`
    }
    
    console.warn('⚠️ Using mock payment link - Yoco API requires OAuth 2.0 for Payment Links')
    console.warn('💡 To use real Yoco payments, you need to:')
    console.warn('   1. Get OAuth 2.0 credentials from Yoco')
    console.warn('   2. Or implement the Charge API (requires frontend token generation)')
    console.warn('   3. Contact Yoco support for Payment Links API access')
    
    return {
      id: `mock-${Date.now()}`,
      url: `${baseUrl}/booking-confirmation?${successParams.toString()}`,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      customer_description: packageData.description || packageData.name,
      customer_reference: customerName,
      order: {
        id: `order-${Date.now()}`,
        display_name: packageData.name,
        name: packageData.name,
        status: 'pending',
        currency: 'ZAR',
        amounts: {
          gross_amount: { amount: Math.round(total * 100), currency: 'ZAR' },
          net_amount: { amount: Math.round(total * 100), currency: 'ZAR' },
          tax_amount: { amount: 0, currency: 'ZAR' },
          discount_amount: { amount: 0, currency: 'ZAR' },
          tip_amount: { amount: 0, currency: 'ZAR' }
        },
        line_items: [{
          id: `item-${Date.now()}`,
          name: packageData.name,
          quantity: '1.00',
          unit_price: { amount: Math.round(total * 100), currency: 'ZAR' },
          total_price: { amount: Math.round(total * 100), currency: 'ZAR' },
          item_type: 'product'
        }]
      }
    }
  }

  async getPaymentLink(paymentLinkId: string): Promise<YocoPaymentLink | null> {
    await this.initialize()
    
    try {
      if (!this.apiKey) {
        console.warn('Yoco API key not configured, using mock payment link')
        return null
      }

      const response = await fetch(`${this.baseUrl}/checkouts/${paymentLinkId}`, {
        headers: {
          'Authorization': `Bearer ${this.apiKey}`,
        }
      })

      if (!response.ok) {
        throw new Error(`Yoco API error: ${response.status} ${response.statusText}`)
      }

      const paymentLink = await response.json()
      return paymentLink
    } catch (error) {
      console.error('Failed to get payment link:', error)
      return null
    }
  }

  async getCustomerInfo(customerId: string): Promise<YocoCustomer | null> {
    await this.initialize()
    
    try {
      if (!this.apiKey) {
        console.warn('Yoco API key not configured, using mock customer info')
        return null
      }

      // For now, return null since we can't fetch customer info from the API
      console.log('Customer info fetching not implemented yet')
      return null
    } catch (error) {
      console.error('Failed to get customer info:', error)
      return null
    }
  }

  async purchasePackage(packageId: string, customerId: string, customerName: string): Promise<YocoPaymentLink | null> {
    await this.initialize()
    
    try {
      if (!this.apiKey) {
        console.warn('Yoco API key not configured, using mock payment link')
        return null
      }

      // For now, return null since we can't purchase packages from the API
      console.log('Package purchasing not implemented yet')
      return null
    } catch (error) {
      console.error('Failed to purchase package:', error)
      return null
    }
  }

  async validateSubscription(userId: string, productId: string): Promise<boolean> {
    await this.initialize()
    
    try {
      // For now, return true to allow all subscriptions
      // This would need to be implemented with Yoco's subscription checking
      console.log(`Validating subscription for user ${userId}, product ${productId}`)
      return true
    } catch (error) {
      console.error('Failed to validate subscription:', error)
      return false
    }
  }
}

export const yocoService = new YocoService()
export default yocoService