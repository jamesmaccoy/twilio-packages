export type PackageCategory = 'standard' | 'hosted' | 'addon' | 'special'
export type DurationTier = 'single' | 'short' | 'weekly' | 'extended' | 'monthly'
export type CustomerTier = 'standard' | 'pro' | 'none'

export interface PackageFeature {
  id: string
  label: string
  description?: string
  category: 'accommodation' | 'service' | 'amenity' | 'discount' | 'special'
}

export interface BasePackageConfig {
  id: string
  category: PackageCategory
  durationTier: DurationTier
  minNights: number
  maxNights: number
  baseMultiplier: number
  features: PackageFeature[]
  revenueCatId: string
  customerTierRequired: CustomerTier
  isDefault?: boolean
  canBeRenamed?: boolean
  canBeDisabled?: boolean
}

export interface HostPackageConfig extends BasePackageConfig {
  hostCustomTitle?: string
  hostCustomDescription?: string
  isEnabled: boolean
  hostMultiplierOverride?: number
  hostFeatureOverrides?: PackageFeature[]
  displayOrder?: number
}

// Standard package features library
export const PACKAGE_FEATURES: Record<string, PackageFeature> = {
  // Accommodation
  standard_accommodation: {
    id: 'standard_accommodation',
    label: 'Standard Accommodation',
    description: 'Comfortable lodging with basic amenities',
    category: 'accommodation'
  },
  premium_accommodation: {
    id: 'premium_accommodation',
    label: 'Premium Accommodation',
    description: 'Enhanced lodging with upgraded amenities',
    category: 'accommodation'
  },
  luxury_accommodation: {
    id: 'luxury_accommodation',
    label: 'Luxury Accommodation',
    description: 'Top-tier lodging with premium amenities',
    category: 'accommodation'
  },

  // Service levels
  self_service: {
    id: 'self_service',
    label: 'Self-Service',
    description: 'Independent stay with minimal host interaction',
    category: 'service'
  },
  hosted_experience: {
    id: 'hosted_experience',
    label: 'Hosted Experience',
    description: 'Dedicated host support throughout stay',
    category: 'service'
  },
  concierge_service: {
    id: 'concierge_service',
    label: 'Concierge Service',
    description: 'Full concierge and personal assistance',
    category: 'service'
  },

  // Amenities
  basic_amenities: {
    id: 'basic_amenities',
    label: 'Basic Amenities',
    description: 'Essential facilities and services',
    category: 'amenity'
  },
  enhanced_amenities: {
    id: 'enhanced_amenities',
    label: 'Enhanced Amenities',
    description: 'Additional comfort features and services',
    category: 'amenity'
  },
  premium_amenities: {
    id: 'premium_amenities',
    label: 'Premium Amenities',
    description: 'Luxury features and personalized services',
    category: 'amenity'
  },

  // Discounts
  member_discount_10: {
    id: 'member_discount_10',
    label: '10% Member Discount',
    description: 'Special pricing for subscription members',
    category: 'discount'
  },
  member_discount_20: {
    id: 'member_discount_20',
    label: '20% Member Discount',
    description: 'Enhanced savings for loyal members',
    category: 'discount'
  },
  member_discount_30: {
    id: 'member_discount_30',
    label: '30% Member Discount',
    description: 'Maximum savings for extended stays',
    category: 'discount'
  },

  // Special features
  welcome_package: {
    id: 'welcome_package',
    label: 'Welcome Package',
    description: 'Curated welcome gifts and local treats',
    category: 'special'
  },
  priority_booking: {
    id: 'priority_booking',
    label: 'Priority Booking',
    description: 'Priority access to future reservations',
    category: 'special'
  },
  host_checkins: {
    id: 'host_checkins',
    label: 'Regular Host Check-ins',
    description: 'Scheduled check-ins with dedicated host',
    category: 'special'
  }
}

// Base package templates that hosts can customize
export const BASE_PACKAGE_TEMPLATES: BasePackageConfig[] = [
  // Standard customer packages
  {
    id: 'per_night_standard',
    category: 'standard',
    durationTier: 'single',
    minNights: 1,
    maxNights: 1,
    baseMultiplier: 1.0,
    features: [
      {
        id: 'standard_accommodation',
        label: 'Standard Accommodation',
        description: 'Comfortable lodging with basic amenities',
        category: 'accommodation'
      },
      {
        id: 'basic_amenities',
        label: 'Basic Amenities',
        description: 'Essential facilities and services',
        category: 'amenity'
      },
      {
        id: 'self_service',
        label: 'Self-Service',
        description: 'Independent stay with minimal host interaction',
        category: 'service'
      }
    ],
    revenueCatId: 'per_night',
    customerTierRequired: 'standard',
    isDefault: true,
    canBeRenamed: true,
    canBeDisabled: false // Core package can't be disabled
  },
  {
    id: 'three_nights_standard',
    category: 'standard',
    durationTier: 'short',
    minNights: 2,
    maxNights: 3,
    baseMultiplier: 0.9,
    features: [
      {
        id: 'standard_accommodation',
        label: 'Standard Accommodation',
        description: 'Comfortable lodging with basic amenities',
        category: 'accommodation'
      },
      {
        id: 'basic_amenities',
        label: 'Basic Amenities',
        description: 'Essential facilities and services',
        category: 'amenity'
      },
      {
        id: 'self_service',
        label: 'Self-Service',
        description: 'Independent stay with minimal host interaction',
        category: 'service'
      },
      {
        id: 'member_discount_10',
        label: '10% Member Discount',
        description: 'Special pricing for subscription members',
        category: 'discount'
      }
    ],
    revenueCatId: '3nights',
    customerTierRequired: 'standard',
    canBeRenamed: true,
    canBeDisabled: true
  },
  {
    id: 'weekly_standard',
    category: 'standard',
    durationTier: 'weekly',
    minNights: 4,
    maxNights: 7,
    baseMultiplier: 0.8,
    features: [
      {
        id: 'standard_accommodation',
        label: 'Standard Accommodation',
        description: 'Comfortable lodging with basic amenities',
        category: 'accommodation'
      },
      {
        id: 'basic_amenities',
        label: 'Basic Amenities',
        description: 'Essential facilities and services',
        category: 'amenity'
      },
      {
        id: 'self_service',
        label: 'Self-Service',
        description: 'Independent stay with minimal host interaction',
        category: 'service'
      },
      {
        id: 'member_discount_20',
        label: '20% Member Discount',
        description: 'Enhanced savings for loyal members',
        category: 'discount'
      }
    ],
    revenueCatId: 'Weekly',
    customerTierRequired: 'standard',
    canBeRenamed: true,
    canBeDisabled: true
  },
  {
    id: 'extended_standard',
    category: 'standard',
    durationTier: 'extended',
    minNights: 8,
    maxNights: 28,
    baseMultiplier: 0.7,
    features: [
      {
        id: 'standard_accommodation',
        label: 'Standard Accommodation',
        description: 'Comfortable lodging with basic amenities',
        category: 'accommodation'
      },
      {
        id: 'basic_amenities',
        label: 'Basic Amenities',
        description: 'Essential facilities and services',
        category: 'amenity'
      },
      {
        id: 'self_service',
        label: 'Self-Service',
        description: 'Independent stay with minimal host interaction',
        category: 'service'
      },
      {
        id: 'member_discount_30',
        label: '30% Member Discount',
        description: 'Maximum savings for extended stays',
        category: 'discount'
      }
    ],
    revenueCatId: '2Xweekly',
    customerTierRequired: 'standard',
    canBeRenamed: true,
    canBeDisabled: true
  },
  {
    id: 'monthly_standard',
    category: 'standard',
    durationTier: 'monthly',
    minNights: 29,
    maxNights: 365,
    baseMultiplier: 0.7,
    features: [
      {
        id: 'standard_accommodation',
        label: 'Standard Accommodation',
        description: 'Comfortable lodging with basic amenities',
        category: 'accommodation'
      },
      {
        id: 'basic_amenities',
        label: 'Basic Amenities',
        description: 'Essential facilities and services',
        category: 'amenity'
      },
      {
        id: 'self_service',
        label: 'Self-Service',
        description: 'Independent stay with minimal host interaction',
        category: 'service'
      },
      {
        id: 'member_discount_30',
        label: '30% Member Discount',
        description: 'Maximum savings for extended stays',
        category: 'discount'
      }
    ],
    revenueCatId: 'monthly',
    customerTierRequired: 'standard',
    canBeRenamed: true,
    canBeDisabled: true
  },

  // Pro/Hosted packages
  {
    id: 'per_night_hosted',
    category: 'hosted',
    durationTier: 'single',
    minNights: 1,
    maxNights: 1,
    baseMultiplier: 1.5,
    features: [
      {
        id: 'premium_accommodation',
        label: 'Premium Accommodation',
        description: 'Enhanced lodging with upgraded amenities',
        category: 'accommodation'
      },
      {
        id: 'enhanced_amenities',
        label: 'Enhanced Amenities',
        description: 'Additional comfort features and services',
        category: 'amenity'
      },
      {
        id: 'hosted_experience',
        label: 'Hosted Experience',
        description: 'Dedicated host support throughout stay',
        category: 'service'
      }
    ],
    revenueCatId: 'per_night_luxury',
    customerTierRequired: 'pro',
    canBeRenamed: true,
    canBeDisabled: true
  },
  {
    id: 'three_nights_hosted',
    category: 'hosted',
    durationTier: 'short',
    minNights: 2,
    maxNights: 3,
    baseMultiplier: 1.4,
    features: [
      {
        id: 'premium_accommodation',
        label: 'Premium Accommodation',
        description: 'Enhanced lodging with upgraded amenities',
        category: 'accommodation'
      },
      {
        id: 'enhanced_amenities',
        label: 'Enhanced Amenities',
        description: 'Additional comfort features and services',
        category: 'amenity'
      },
      {
        id: 'hosted_experience',
        label: 'Hosted Experience',
        description: 'Dedicated host support throughout stay',
        category: 'service'
      },
      {
        id: 'welcome_package',
        label: 'Welcome Package',
        description: 'Curated welcome gifts and local treats',
        category: 'special'
      }
    ],
    revenueCatId: 'hosted3nights',
    customerTierRequired: 'pro',
    canBeRenamed: true,
    canBeDisabled: true
  },
  {
    id: 'weekly_hosted',
    category: 'hosted',
    durationTier: 'weekly',
    minNights: 4,
    maxNights: 7,
    baseMultiplier: 1.3,
    features: [
      {
        id: 'premium_accommodation',
        label: 'Premium Accommodation',
        description: 'Enhanced lodging with upgraded amenities',
        category: 'accommodation'
      },
      {
        id: 'enhanced_amenities',
        label: 'Enhanced Amenities',
        description: 'Additional comfort features and services',
        category: 'amenity'
      },
      {
        id: 'hosted_experience',
        label: 'Hosted Experience',
        description: 'Dedicated host support throughout stay',
        category: 'service'
      },
      {
        id: 'host_checkins',
        label: 'Regular Host Check-ins',
        description: 'Scheduled check-ins with dedicated host',
        category: 'special'
      }
    ],
    revenueCatId: 'hosted7nights',
    customerTierRequired: 'pro',
    canBeRenamed: true,
    canBeDisabled: true
  },
  {
    id: 'week_x2_hosted',
    category: 'hosted',
    durationTier: 'extended',
    minNights: 7,
    maxNights: 14,
    baseMultiplier: 1.2,
    features: [
      {
        id: 'premium_accommodation',
        label: 'Premium Accommodation',
        description: 'Enhanced lodging with upgraded amenities',
        category: 'accommodation'
      },
      {
        id: 'enhanced_amenities',
        label: 'Enhanced Amenities',
        description: 'Additional comfort features and services',
        category: 'amenity'
      },
      {
        id: 'hosted_experience',
        label: 'Hosted Experience',
        description: 'Dedicated host support throughout stay',
        category: 'service'
      },
      {
        id: 'host_checkins',
        label: 'Regular Host Check-ins',
        description: 'Scheduled check-ins with dedicated host',
        category: 'special'
      }
    ],
    revenueCatId: 'week_x2_customer',
    customerTierRequired: 'pro',
    canBeRenamed: true,
    canBeDisabled: true
  },
  

  // Add-on packages
  {
    id: 'wine_addon',
    category: 'addon',
    durationTier: 'single',
    minNights: 1,
    maxNights: 365,
    baseMultiplier: 1.5,
    features: [
      {
        id: 'wine_tasting',
        label: 'Wine Tasting Experience',
        description: 'Curated wine selection and tasting',
        category: 'special'
      },
      {
        id: 'sommelier_consultation',
        label: 'Sommelier Consultation',
        description: 'Expert wine guidance and pairing advice',
        category: 'special'
      }
    ],
    revenueCatId: 'Bottle_wine',
    customerTierRequired: 'none',
    canBeRenamed: true,
    canBeDisabled: true
  },
  {
    id: 'cleaning_addon',
    category: 'addon',
    durationTier: 'single',
    minNights: 1,
    maxNights: 365,
    baseMultiplier: 1.0,
    features: [
      {
        id: 'professional_cleaning',
        label: 'Professional Cleaning',
        description: 'Deep cleaning service during stay',
        category: 'service'
      }
    ],
    revenueCatId: 'cleaning',
    customerTierRequired: 'none',
    canBeRenamed: true,
    canBeDisabled: true
  },
  {
    id: 'hike_addon',
    category: 'addon',
    durationTier: 'single',
    minNights: 1,
    maxNights: 365,
    baseMultiplier: 1.0,
    features: [
      {
        id: 'guided_hike',
        label: 'Guided Hiking Experience',
        description: 'Professional guide for local hiking trails',
        category: 'special'
      }
    ],
    revenueCatId: 'Hike',
    customerTierRequired: 'none',
    canBeRenamed: true,
    canBeDisabled: true
  },
  {
    id: 'bathbomb_addon',
    category: 'addon',
    durationTier: 'single',
    minNights: 1,
    maxNights: 365,
    baseMultiplier: 1.0,
    features: [
      {
        id: 'luxury_bath',
        label: 'Luxury Bath Experience',
        description: 'Premium bath bomb for relaxing soak',
        category: 'amenity'
      }
    ],
    revenueCatId: 'bathBomb',
    customerTierRequired: 'none',
    canBeRenamed: true,
    canBeDisabled: true
  },

  // Hourly packages
  {
    id: 'per_hour_standard',
    category: 'standard',
    durationTier: 'single',
    minNights: 1,
    maxNights: 1,
    baseMultiplier: 0.1,
    features: [
      {
        id: 'standard_accommodation',
        label: 'Standard Accommodation',
        description: 'Comfortable lodging with basic amenities',
        category: 'accommodation'
      },
      {
        id: 'basic_amenities',
        label: 'Basic Amenities',
        description: 'Essential facilities and services',
        category: 'amenity'
      },
      {
        id: 'self_service',
        label: 'Self-Service',
        description: 'Independent stay with minimal host interaction',
        category: 'service'
      }
    ],
    revenueCatId: 'per_hour',
    customerTierRequired: 'standard',
    canBeRenamed: true,
    canBeDisabled: true
  },
  {
    id: 'per_hour_luxury',
    category: 'hosted',
    durationTier: 'single',
    minNights: 1,
    maxNights: 1,
    baseMultiplier: 0.15,
    features: [
      {
        id: 'premium_accommodation',
        label: 'Premium Accommodation',
        description: 'Enhanced lodging with upgraded amenities',
        category: 'accommodation'
      },
      {
        id: 'enhanced_amenities',
        label: 'Enhanced Amenities',
        description: 'Additional comfort features and services',
        category: 'amenity'
      },
      {
        id: 'hosted_experience',
        label: 'Hosted Experience',
        description: 'Dedicated host support throughout stay',
        category: 'service'
      }
    ],
    revenueCatId: 'per_hour_luxury',
    customerTierRequired: 'pro',
    canBeRenamed: true,
    canBeDisabled: true
  },

  // Extended weekly package
  {
    id: 'week_x3_standard',
    category: 'standard',
    durationTier: 'extended',
    minNights: 21,
    maxNights: 21,
    baseMultiplier: 0.6,
    features: [
      {
        id: 'standard_accommodation',
        label: 'Standard Accommodation',
        description: 'Comfortable lodging with basic amenities',
        category: 'accommodation'
      },
      {
        id: 'basic_amenities',
        label: 'Basic Amenities',
        description: 'Essential facilities and services',
        category: 'amenity'
      },
      {
        id: 'self_service',
        label: 'Self-Service',
        description: 'Independent stay with minimal host interaction',
        category: 'service'
      },
      {
        id: 'member_discount_30',
        label: '30% Member Discount',
        description: 'Maximum savings for extended stays',
        category: 'discount'
      }
    ],
    revenueCatId: 'week_x3_customer',
    customerTierRequired: 'standard',
    canBeRenamed: true,
    canBeDisabled: true
  },

  // Gathering packages
  {
    id: 'gathering_special',
    category: 'special',
    durationTier: 'single',
    minNights: 1,
    maxNights: 7,
    baseMultiplier: 1.2,
    features: [
      {
        id: 'team_building',
        label: 'Team Building',
        description: 'Organized team building activities',
        category: 'special'
      },
      {
        id: 'catering_support',
        label: 'Catering Support',
        description: 'Professional catering services',
        category: 'service'
      },
      {
        id: 'entertainment_setup',
        label: 'Entertainment Setup',
        description: 'Complete entertainment and event setup',
        category: 'service'
      }
    ],
    revenueCatId: 'gathering',
    customerTierRequired: 'pro',
    canBeRenamed: true,
    canBeDisabled: true
  },
  {
    id: 'gathering_monthly_special',
    category: 'special',
    durationTier: 'monthly',
    minNights: 1,
    maxNights: 30,
    baseMultiplier: 1.0,
    features: [
      {
        id: 'team_building',
        label: 'Team Building',
        description: 'Organized team building activities',
        category: 'special'
      },
      {
        id: 'quad_bike_tour',
        label: 'Quad Bike Tour',
        description: 'Adventure quad bike experience',
        category: 'special'
      },
      {
        id: 'catering_support',
        label: 'Catering Support',
        description: 'Professional catering services',
        category: 'service'
      },
      {
        id: 'entertainment_setup',
        label: 'Entertainment Setup',
        description: 'Complete entertainment and event setup',
        category: 'service'
      }
    ],
    revenueCatId: 'gathering_monthly',
    customerTierRequired: 'pro',
    canBeRenamed: true,
    canBeDisabled: true
  }
]

// Utility functions for package management
export function getPackagesByCategory(category: PackageCategory): BasePackageConfig[] {
  return BASE_PACKAGE_TEMPLATES.filter(pkg => pkg.category === category)
}

export function getPackageByRevenueCatId(revenueCatId: string): BasePackageConfig | undefined {
  return BASE_PACKAGE_TEMPLATES.find(pkg => pkg.revenueCatId === revenueCatId)
}

export function createHostPackageConfig(
  baseTemplate: BasePackageConfig,
  hostOverrides: Partial<HostPackageConfig> = {}
): HostPackageConfig {
  return {
    ...baseTemplate,
    isEnabled: hostOverrides.isEnabled ?? true,
    hostCustomTitle: hostOverrides.hostCustomTitle,
    hostCustomDescription: hostOverrides.hostCustomDescription,
    hostMultiplierOverride: hostOverrides.hostMultiplierOverride,
    hostFeatureOverrides: hostOverrides.hostFeatureOverrides,
    displayOrder: hostOverrides.displayOrder ?? 0
  }
}

export function getDisplayTitle(hostPackage: HostPackageConfig): string {
  return hostPackage.hostCustomTitle || getDefaultPackageTitle(hostPackage)
}

export function getDisplayDescription(hostPackage: HostPackageConfig): string {
  return hostPackage.hostCustomDescription || getDefaultPackageDescription(hostPackage)
}

export function getEffectiveMultiplier(hostPackage: HostPackageConfig): number {
  return hostPackage.hostMultiplierOverride ?? hostPackage.baseMultiplier
}

export function getEffectiveFeatures(hostPackage: HostPackageConfig): PackageFeature[] {
  return hostPackage.hostFeatureOverrides ?? hostPackage.features
}

export function getDefaultPackageTitle(pkg: BasePackageConfig): string {
  const categoryMap = {
    standard: 'Standard',
    hosted: 'Hosted',
    addon: 'Add-on',
    special: 'Special'
  }
  
  const durationMap = {
    single: 'Per Night',
    short: '3-Night Package',
    weekly: 'Weekly Package',
    extended: 'Extended Stay',
    monthly: 'Monthly Package'
  }
  
  if (pkg.category === 'addon') {
    return pkg.id === 'wine_addon' ? 'Wine Experience' :
           pkg.id === 'cleaning_addon' ? 'Cleaning Service' :
           pkg.id === 'hike_addon' ? 'Guided Hiking' : 'Add-on Service'
  }
  
  return `${categoryMap[pkg.category]} ${durationMap[pkg.durationTier]}`
}

function getDefaultPackageDescription(pkg: BasePackageConfig): string {
  const tierDesc = pkg.customerTierRequired === 'pro' ? 'Premium experience' :
                  pkg.customerTierRequired === 'standard' ? 'Member pricing' :
                  'Available to all guests'
  
  if (pkg.category === 'addon') {
    return `${pkg.features[0]?.description || 'Additional service'} - ${tierDesc}`
  }
  
  return `${tierDesc} for ${pkg.minNights === pkg.maxNights ? `${pkg.minNights} night` : `${pkg.minNights}-${pkg.maxNights} nights`}`
} 