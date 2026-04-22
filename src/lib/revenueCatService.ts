import { Purchases } from '@revenuecat/purchases-js'

export interface RevenueCatProduct {
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
  entitlement?: 'standard' | 'pro' | string // Allow string for custom entitlement IDs
  icon?: string // Added for Disney-style visual appeal
}

export interface RevenueCatCustomer {
  id: string
  entitlements: any
  activeSubscriptions: string[]
  allPurchasedProductIdentifiers: string[]
}

class RevenueCatService {
  private apiKey: string
  private initialized: boolean = false

  constructor() {
    this.apiKey = process.env.NEXT_PUBLIC_REVENUECAT_PUBLIC_KEY || ''
  }

  async initialize() {
    if (this.initialized) return

    try {
      if (!this.apiKey) {
        console.warn('RevenueCat API key not configured, using mock data')
        this.initialized = true
        return
      }
      
      // For web implementation, we'll use REST API calls instead of the JS SDK
      // The purchases-js SDK is mainly for actual purchase flows
      this.initialized = true
    } catch (error) {
      console.error('Failed to initialize RevenueCat:', error)
      console.warn('Falling back to mock data')
      this.initialized = true
    }
  }

  async getProducts(): Promise<RevenueCatProduct[]> {
    await this.initialize()
    
    try {
      // Always return RevenueCat products, never fallback products
      return await this.getRevenueCatProducts()
    } catch (error) {
      console.error('Failed to fetch RevenueCat products:', error)
      // Return empty array instead of fallback products
      return []
    }
  }

  // Method to fetch from actual RevenueCat API
  private async getRevenueCatProducts(): Promise<RevenueCatProduct[]> {
    try {
      // If API key is not configured, return mock data
      if (!this.apiKey) {
        console.warn('RevenueCat API key not configured, using mock data')
        return this.getMockProducts()
      }

      // TODO: Implement actual RevenueCat REST API call
      // For now, return the products that should match your RevenueCat dashboard
      
      const actualProducts = [
        // These should match your actual RevenueCat product IDs
       
        {
          id: 'per_hour',
          title: '⏰ Studio Space',
          description: 'Pay as you go hourly service',
          price: 25.00,
          currency: 'USD',
          period: 'hour' as const,
          periodCount: 1,
          category: 'standard' as const,
          features: ['Wifi', 'Hourly pricing', 'Parking'],
          isEnabled: true,
          entitlement: 'standard' as const,
          icon: '⏰',
        },
        {
          id: 'virtual_wine',
          title: '🍷 Virtual Wine Experience',
          description: 'Weekly virtual wine tasting and experience package',
          price: 5.00,
          currency: 'USD',
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
          currency: 'USD',
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
          title: '✨ Luxury Hours',
          description: 'Premium hourly service with VIP treatment',
          price: 389.00,
          currency: 'USD',
          period: 'hour' as const,
          periodCount: 1,
          category: 'hosted' as const,
          features: ['Premium service', 'Enhanced amenities', 'Dedicated support', 'VIP treatment'],
          isEnabled: true,
          entitlement: 'pro' as const,
          icon: '✨',
        },
        {
          id: '3nights',
          title: '🏄‍♂️ Stay 3-Nights',
          description: 'Special rate for the perfect weekend plus one experience',
          price: 389.99,
          currency: 'USD',
          period: 'day' as const,
          periodCount: 3,
          category: 'hosted' as const,
          features: ['Premium accommodation', 'Concierge service', 'Breakfast included', 'Late checkout'],
          isEnabled: true,
          entitlement: 'pro' as const,
          icon: '🏄‍♂️',
        },
        {
          id: 'weekly_customer',
          title: '🌍 World Explorer',
          description: 'Ultimate weekly adventure for explorers',
          price: 1399.99,
          currency: 'USD',
          period: 'day' as const,
          periodCount: 7,
          category: 'special' as const,
          features: ['Luxury accommodation', 'Personal concierge', 'Adventure planning', 'Premium transport', 'VIP experiences'],
          isEnabled: true,
          entitlement: 'pro' as const,
          icon: '🌍',
        },
        {
          id: 'week_x2_customer',
          title: '🏖️ Two Week Paradise',
          description: 'Perfect for a refreshing getaway',
          price: 299.99,
          currency: 'USD',
          period: 'day' as const,
          periodCount: 14,
          category: 'standard' as const,
          features: ['Standard accommodation', 'Basic amenities', 'Free WiFi'],
          isEnabled: true,
          entitlement: 'standard' as const,
          icon: '🏖️',
        },
        {
          id: 'week_x3_customer',
          title: '🌺 Three Week Adventure',
          description: 'Extended stay with amazing benefits',
          price: 399.99,
          currency: 'USD',
          period: 'day' as const,
          periodCount: 21,
          category: 'standard' as const,
          features: ['Standard accommodation', 'Basic amenities', 'Free WiFi'],
          isEnabled: true,
          entitlement: 'standard' as const,
          icon: '🌺',
        },
        {
          id: 'week_x4_customer',
          title: '🏝️ Monthly Escape',
          description: 'Ultimate monthly retreat experience',
          price: 499.99,
          currency: 'USD',
          period: 'day' as const,
          periodCount: 30,
          category: 'standard' as const,
          features: ['Wifi', 'Cleaning', 'Security', 'Parking', 'Greeting'],
          isEnabled: true,
          entitlement: 'standard' as const,
          icon: '🏝️',
        },
        {
          id: 'monthly',
          title: '🏠 Monthly Guest',
          description: 'Guest monthly package',
          price: 4990.99,
          currency: 'USD',
          period: 'day' as const,
          periodCount: 30,
          category: 'standard' as const,
          features: ['Wifi', 'Cleaning', 'Security', 'Parking', 'Greeting'],
          isEnabled: true,
          entitlement: 'standard' as const,
          icon: '🏠',
        },
        {
          id: 'gathering',
          title: '🎉 Gathering',
          description: 'Perfect for group events and gatherings',
          price: 4999.99,
          currency: 'USD',
          period: 'day' as const,
          periodCount: 1,
          category: 'special' as const,
          features: ['Event space', 'Group amenities', 'Catering support', 'Entertainment setup'],
          isEnabled: true,
          entitlement: 'standard' as const,
          icon: '🎉',
        },
        {
          id: 'gathering_monthly',
          title: '🏘️ Annual agreement',
          description: 'Your booking is locked in for the year',
          price: 5000.00,
          currency: 'USD',
          period: 'month' as const,
          periodCount: 1,
          category: 'special' as const,
          features: ['Month to month agreement', 'No cancellation fees', 'No minimum stay', 'No lock in period'],
          isEnabled: true,
          entitlement: 'pro' as const,
          icon: '🏘️',
        },
        {
          id: 'weekly',
          title: '📅 Weekly Pro',
          description: 'Professional weekly package with premium benefits',
          price: 599.99,
          currency: 'USD',
          period: 'week' as const,
          periodCount: 7,
          category: 'standard' as const,
          features: ['Wifi', 'Cleaning', 'Security', 'Parking', 'Privacy'],
          isEnabled: true,
          entitlement: 'pro' as const,
          icon: '📅',
        },
        {
          id: 'hosted7nights',
          title: '👑 Royal Suite Experience',
          description: 'The ultimate luxury experience',
          price: 999.99,
          currency: 'USD',
          period: 'day' as const,
          periodCount: 7,
          category: 'special' as const,
          features: ['Presidential suite', 'Personal butler', 'Gourmet dining', 'Spa access', 'Private transport'],
          isEnabled: true,
          entitlement: 'pro' as const,
          icon: '👑',
        },
        {
          id: 'hosted3nights',
          title: '👨‍👩‍👧‍👦 3 Nights for guests',
          description: 'Perfect for family adventures',
          price: 449.99,
          currency: 'USD',
          period: 'day' as const,
          periodCount: 3,
          category: 'special' as const,
          features: ['Baby Cot', 'Kids activities', 'Childcare services', 'Entertainment'],
          isEnabled: true,
          entitlement: 'standard' as const,
          icon: '👨‍👩‍👧‍👦',
        },
        {
          id: 'per_night_customer',
          title: '💕 Romantic Escape',
          description: 'Intimate experience for couples',
          price: 349.99,
          currency: 'USD',
          period: 'day' as const,
          periodCount: 1,
          category: 'special' as const,
          features: ['All inclusive breakfast & Snacks', 'Hiking tours', 'Driver', 'Butler', 'Wine sommelier'],
          isEnabled: true,
          entitlement: 'pro' as const,
          icon: '💕',
        },
        {
          id: 'per_night_luxury',
          title: '💼 Business Function',
          description: 'Executive package for business travelers',
          price: 500.99,
          currency: 'USD',
          period: 'day' as const,
          periodCount: 1,
          category: 'special' as const,
          features: ['All inclusive breakfast & Snacks', 'Hiking tours', 'Driver', 'Butler', 'Wine sommelier'],
          isEnabled: true,
          entitlement: 'pro' as const,
          icon: '💼',
        },
      ]

      return actualProducts
    } catch (error) {
      console.error('Failed to fetch from RevenueCat API:', error)
      // Fallback to mock products if API call fails
      return this.getMockProducts()
    }
  }

  // Helper method to get mock products
  private getMockProducts(): RevenueCatProduct[] {
    return [
      {
        id: 'gathering_monthly',
        title: '🏘️ Annual agreement',
        description: 'Your booking is locked in for the year',
        price: 5000.00,
        currency: 'USD',
        period: 'month' as const,
        periodCount: 1,
        category: 'special' as const,
        features: ['Month to month agreement', 'No cancellation fees', 'No minimum stay', 'No lock in period'],
        isEnabled: true,
        entitlement: 'pro' as const,
        icon: '🏘️',
      },
      // Add other essential products here as fallback
    ]
  }

  private getFallbackProducts(): Record<string, RevenueCatProduct> {
    return {
      'per_hour': {
        id: 'per_hour',
        title: '⏰ Studio Space',
        description: 'Pay as you go hourly service',
        price: 25.00,
        currency: 'USD',
        period: 'hour',
        periodCount: 1,
        category: 'standard',
        features: ['Wifi', 'Hourly pricing', 'Parking'],
        isEnabled: true,
        entitlement: 'standard',
        icon: '⏰',
      },
      'per_hour_luxury': {
        id: 'per_hour_luxury',
        title: '✨ Hosted hour',
        description: 'Premium hourly service with VIP treatment',
        price: 75.00,
        currency: 'USD',
        period: 'hour',
        periodCount: 1,
        category: 'hosted',
        features: ['Premium service', 'Enhanced amenities', 'Dedicated support', 'VIP treatment'],
        isEnabled: true,
        entitlement: 'pro',
        icon: '✨',
      },
      'per_night_luxury': {
        id: 'per_night_luxury',
        title: '💼 Business Function',
        description: 'Executive package for business travelers',
        price: 500.99,
        currency: 'USD',
        period: 'day',
        periodCount: 1,
        category: 'special',
        features: ['Executive room', 'Business lounge', 'Meeting rooms', 'Express laundry', 'Airport transfer'],
        isEnabled: true,
        entitlement: 'pro',
        icon: '💼',
      },
      'per_night_customer': {
        id: 'per_night_customer',
        title: '💕 Romantic Escape',
        description: 'Intimate experience for couples',
        price: 349.99,
        currency: 'USD',
        period: 'day',
        periodCount: 2,
        category: 'special',
        features: ['Couples suite', 'Romantic dinner', 'Spa for two', 'Private balcony', 'Champagne welcome'],
        isEnabled: true,
        entitlement: 'pro',
        icon: '💕',
      },
      '3nights': {
        id: '3nights',
        title: '🏄‍♂️ Stay 3-Nights',
        description: 'Perfect weekend plus one experience',
        price: 189.99,
        currency: 'USD',
        period: 'day',
        periodCount: 3,
        category: 'hosted',
        features: ['Wifi', 'Cleaner', 'Security', 'Parking'],
        isEnabled: true,
        entitlement: 'pro',
        icon: '🏄‍♂️',
      },
      'three_nights_guest': {
        id: '3nights',
        title: '🏄‍♂️ Three Night package',
        description: 'Perfect weekend plus one experience',
        price: 450.99,
        currency: 'USD',
        period: 'day',
        periodCount: 3,
        category: 'standard',
        features: ['Premium accommodation', 'Concierge service', 'Breakfast included', 'Late checkout'],
        isEnabled: true,
        entitlement: 'pro',
        icon: '🏄‍♂️',
      },
      'weekly': {
        id: 'weekly',
        title: '📅 Weekly Pro',
        description: 'Professional weekly package with premium benefits',
        price: 599.99,
        currency: 'USD',
        period: 'day',
        periodCount: 7,
        category: 'hosted',
        features:  ['Wifi', 'Cleaning', 'Security', 'Parking', 'Greeting'],
        isEnabled: true,
        entitlement: 'pro',
        icon: '📅',
      },
      'wine': {
        id: 'virtual_wine',
        title: '🍷 Virtual Wine Experience',
        description: 'Weekly virtual wine tasting and experience package',
        price: 5.00,
        currency: 'USD',
        period: 'day',
        periodCount: 7,
        category: 'standard',
        features: ['Pre order wine', 'Curation of the Cape finest', 'Mix and match', 'In app purchases', 'Wine sommelier on request'],
        isEnabled: true,
        entitlement: 'standard',
        icon: '🍷',
      },
      'hosted7nights': {
        id: 'hosted7nights',
        title: '👑 Royal Suite Experience',
        description: 'The ultimate luxury experience',
        price: 999.99,
        currency: 'USD',
        period: 'day',
        periodCount: 7,
        category: 'special',
        features:  ['Wifi', 'Cleaning', 'Security', 'Parking', 'Greeting'],
        isEnabled: true,
        entitlement: 'pro',
        icon: '👑',
      },
      'hosted3nights': {
        id: 'hosted3nights',
        title: '👨‍👩‍👧‍👦 3 Nights for guests',
        description: 'Perfect for family adventures',
        price: 449.99,
        currency: 'USD',
        period: 'day',
        periodCount: 3,
        category: 'special',  
        features:  ['Wifi', 'Cleaning', 'Security', 'Parking', 'Greeting'],
        isEnabled: true,
        entitlement: 'standard',
        icon: '👨‍👩‍👧‍👦',
      },
      'smart_traveler': {
        id: 'weekly_customer',
        title: '🌍 World Explorer',
        description: 'Ultimate weekly adventure for explorers',
        price: 1399.99,
        currency: 'USD',
        period: 'day',
        periodCount: 7,
        category: 'special',
        features: ['Luxury accommodation', 'Personal concierge', 'Adventure planning', 'Premium transport', 'VIP experiences'],
        isEnabled: true,
        entitlement: 'pro',
        icon: '🌍',
      },
      'week_x2_customer': {
        id: 'week_x2_customer',
        title: '🏖️ Two Week Paradise',
        description: 'Perfect for a refreshing getaway',
        price: 299.99,
        currency: 'USD',
        period: 'day',
        periodCount: 14,
        category: 'standard',
        features: ['Standard accommodation', 'Basic amenities', 'Free WiFi'],
        isEnabled: true,
        entitlement: 'standard',
        icon: '🏖️',
      },
      'week_x3_customer': {
        id: 'week_x3_customer',
        title: '🌺 Three Week Adventure',
        description: 'Extended stay with amazing benefits',
        price: 399.99,
        currency: 'USD',
        period: 'day',
        periodCount: 21,
        category: 'standard',
        features: ['Standard accommodation', 'Basic amenities', 'Free WiFi'],
        isEnabled: true,
        entitlement: 'standard',
        icon: '🌺',
      },
      'week_x4_customer': {
        id: 'week_x4_customer',
        title: '🏝️ Monthly Escape',
        description: 'Ultimate monthly retreat experience',
        price: 499.99,
        currency: 'USD',
        period: 'day',
        periodCount: 30,
        category: 'standard',
        features: ['Standard accommodation', 'Basic amenities', 'Free WiFi'],
        isEnabled: true,
        entitlement: 'standard',
        icon: '🏝️',
      },
      'gathering': {
        id: 'gathering',
        title: '🎉 Gathering',
        description: 'Perfect for group events and gatherings',
        price: 4999.99,
        currency: 'USD',
        period: 'day',
        periodCount: 1,
        category: 'special',
        features: ['Event space', 'Group amenities', 'Catering support', 'Entertainment setup'],
        isEnabled: true,
        entitlement: 'standard',
        icon: '🎉',
      },
      'monthly_gathering': {
        id: 'gathering_monthly',
        title: '🏘️ Annual agreement',
        description: 'Your booking is locked in for the year',
        price: 5000.00,
        currency: 'USD',
        period: 'day',
        periodCount: 1,
        category: 'special',
        features: ['Month to month agreement', 'No cancellation fees', 'No minimum stay', 'No lock in period'],
        isEnabled: true,
        entitlement: 'pro',
        icon: '🏘️',
      },
    }
  }

  async getCustomerInfo(customerId: string): Promise<RevenueCatCustomer | null> {
    await this.initialize()
    
    try {
      // Mock customer info for now
      return {
        id: customerId,
        entitlements: {},
        activeSubscriptions: [],
        allPurchasedProductIdentifiers: [],
      }
    } catch (error) {
      console.error('Failed to fetch customer info:', error)
      return null
    }
  }

  // Additional methods for subscription management
  async purchasePackage(packageId: string): Promise<boolean> {
    await this.initialize()
    
    try {
      // Mock purchase for now
      console.log(`Purchasing package: ${packageId}`)
      return true
    } catch (error) {
      console.error('Purchase failed:', error)
      return false
    }
  }

  // Validate if a user has an active subscription for a specific product
  async validateSubscription(userId: string, productId: string): Promise<boolean> {
    await this.initialize()
    
    try {
      // Get customer info
      const customerInfo = await this.getCustomerInfo(userId)
      
      if (!customerInfo) {
        console.log(`No customer info found for user: [REDACTED]`)
        return false
      }

      // Check if the user has purchased the specific product
      const hasProduct = customerInfo.allPurchasedProductIdentifiers.includes(productId)
      
      // For now, return true for mock purposes
      // In production, this would check against actual RevenueCat data
      console.log(`Validating subscription for user [REDACTED], product ${productId}: ${hasProduct}`)
      return true // Mock: always return true for testing
    } catch (error) {
      console.error('Failed to validate subscription:', error)
      return false
    }
  }
}

export const revenueCatService = new RevenueCatService() 