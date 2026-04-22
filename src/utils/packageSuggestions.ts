import { SubscriptionStatus } from '@/hooks/useSubscription'

// Define customer entitlement types
export type CustomerEntitlement = 'standard' | 'pro' | 'none'

// Enhanced package interface
export interface SuggestedPackage {
  id: string
  title: string
  description: string
  minNights: number
  maxNights: number
  multiplier: number
  features: string[]
  revenueCatId: string
  entitlementRequired: CustomerEntitlement
  isPrimary?: boolean // Main suggestion for this duration/entitlement combo
}

// All available packages with entitlement requirements
export const allPackages: SuggestedPackage[] = [
  // Standard customer packages
  {
    id: 'per_night_customer',
    title: 'Per Night',
    description: 'Standard nightly rate for members',
    minNights: 1,
    maxNights: 1,
    multiplier: 1.0,
    features: ['Standard accommodation', 'Basic amenities', 'Self-service'],
    revenueCatId: 'per_night',
    entitlementRequired: 'standard',
    isPrimary: true,
  },
  {
    id: '3nights',
    title: '🏄‍♂️ Stay 3-Nights',
    description: 'Special rate for 3+ nights - Member pricing',
    minNights: 2,
    maxNights: 3,
    multiplier: 0.9,
    features: ['Standard accommodation', 'Basic amenities', 'Self-service', '10% member discount'],
    revenueCatId: '3nights',
    entitlementRequired: 'standard',
    isPrimary: true,
  },
  {
    id: 'weekly_customer',
    title: 'Weekly Package',
    description: 'Best value for week-long stays',
    minNights: 4,
    maxNights: 7,
    multiplier: 0.8,
    features: ['Standard accommodation', 'Basic amenities', 'Self-service', '20% member discount'],
    revenueCatId: 'Weekly',
    entitlementRequired: 'standard',
    isPrimary: true,
  },
  {
    id: 'extended_customer',
    title: 'Extended Stay Package',
    description: 'Long-term stay rate for members',
    minNights: 8,
    maxNights: 28,
    multiplier: 0.7,
    features: [
      'Standard accommodation',
      'Basic amenities',
      'Self-service',
      '30% member discount',
      'Extended stay benefits',
    ],
    revenueCatId: '2Xweekly',
    entitlementRequired: 'standard',
    isPrimary: true,
  },
  {
    id: 'monthly_customer',
    title: 'Monthly Package',
    description: 'Monthly rate for long-term members',
    minNights: 29,
    maxNights: 365,
    multiplier: 0.7,
    features: ['Standard accommodation', 'Basic amenities', 'Self-service', '30% member discount'],
    revenueCatId: 'monthly',
    entitlementRequired: 'standard',
    isPrimary: true,
  },

  // Pro customer packages (hosted experiences)
  {
    id: 'per_night_hosted',
    title: 'Hosted Night Experience',
    description: 'Premium hosted experience',
    minNights: 1,
    maxNights: 1,
    multiplier: 1.5,
    features: ['Premium accommodation', 'Dedicated host', 'Enhanced amenities', 'Priority service'],
    revenueCatId: 'per_night_luxury',
    entitlementRequired: 'pro',
    isPrimary: true,
  },
  {
    id: 'hosted3nights',
    title: 'Hosted 3-Night Experience',
    description: 'Premium 3-night hosted experience',
    minNights: 2,
    maxNights: 3,
    multiplier: 1.4,
    features: [
      'Premium accommodation',
      'Dedicated host',
      'Enhanced amenities',
      'Priority service',
      'Welcome package',
    ],
    revenueCatId: 'hosted3nights',
    entitlementRequired: 'pro',
    isPrimary: true,
  },
  {
    id: 'hosted7nights',
    title: 'Hosted Weekly Experience',
    description: 'Premium week-long hosted experience',
    minNights: 4,
    maxNights: 7,
    multiplier: 1.3,
    features: [
      'Premium accommodation',
      'Dedicated host',
      'Enhanced amenities',
      'Priority service',
      'Weekly host check-ins',
    ],
    revenueCatId: 'hosted7nights',
    entitlementRequired: 'pro',
    isPrimary: true,
  },
  {
    id: 'hosted_extended',
    title: 'Hosted Extended Stay',
    description: 'Premium long-term hosted experience',
    minNights: 8,
    maxNights: 365,
    multiplier: 1.2,
    features: [
      'Premium accommodation',
      'Dedicated host',
      'Enhanced amenities',
      'Priority service',
      'Bi-weekly host meetings',
    ],
    revenueCatId: 'hosted_extended',
    entitlementRequired: 'pro',
    isPrimary: true,
  },

  // Gathering monthly package (special) - Pro only
  {
    id: 'gathering_monthly',
    title: '🏘️ Annual agreement',
    description: 'Your booking is locked in for the year',
    minNights: 1,
    maxNights: 30,
    multiplier: 1.0,
    features: [
      'Month to month agreement',
      'No cancellation fees',
      'No minimum stay',
      'No lock in period',
    ],
    revenueCatId: 'gathering_monthly',
    entitlementRequired: 'pro',
    isPrimary: true,
  },

  // Wine package add-on (available to all)
  {
    id: 'wine',
    title: 'Wine Experience Add-on',
    description: 'Wine tasting and selection platters',
    minNights: 1,
    maxNights: 365,
    multiplier: 1.5,
    features: [
      'Wine tasting experience',
      'Curated wine selection',
      'Sommelier consultation',
      'Local wine knowledge',
    ],
    revenueCatId: 'Bottle_wine',
    entitlementRequired: 'none',
  },
]

// Determine customer entitlement based on subscription status
export function getCustomerEntitlement(subscriptionStatus: SubscriptionStatus): CustomerEntitlement {
  if (!subscriptionStatus.isSubscribed) {
    return 'none'
  }

  // Check for professional entitlements
  const proEntitlements = ['$rc_six_month', 'professional', 'pro']
  const hasProEntitlement = subscriptionStatus.entitlements.some((entitlement) =>
    proEntitlements.some((proId) => entitlement.includes(proId))
  )

  if (hasProEntitlement) {
    return 'pro'
  }

  // Standard subscription (monthly/annual)
  return 'standard'
}

// Get suggested packages based on duration and customer entitlement
export function getSuggestedPackages(
  duration: number,
  customerEntitlement: CustomerEntitlement,
  includeWineAddon: boolean = true
): SuggestedPackage[] {
  const suggestions: SuggestedPackage[] = []

  // Find primary packages that match duration and entitlement
  const primaryPackages = allPackages.filter(
    (pkg) =>
      pkg.isPrimary &&
      duration >= pkg.minNights &&
      duration <= pkg.maxNights &&
      (pkg.entitlementRequired === customerEntitlement || pkg.entitlementRequired === 'none')
  )

  // Add primary packages
  suggestions.push(...primaryPackages)

  // For pro customers, also suggest the standard alternative at a lower tier
  if (customerEntitlement === 'pro') {
    const standardAlternatives = allPackages.filter(
      (pkg) =>
        pkg.isPrimary &&
        duration >= pkg.minNights &&
        duration <= pkg.maxNights &&
        pkg.entitlementRequired === 'standard'
    )
    suggestions.push(...standardAlternatives)
  }

  // For non-subscribers, show what they could get with each subscription level
  if (customerEntitlement === 'none') {
    const standardPackages = allPackages.filter(
      (pkg) =>
        pkg.isPrimary &&
        duration >= pkg.minNights &&
        duration <= pkg.maxNights &&
        pkg.entitlementRequired === 'standard'
    )
    const proPackages = allPackages.filter(
      (pkg) =>
        pkg.isPrimary &&
        duration >= pkg.minNights &&
        duration <= pkg.maxNights &&
        pkg.entitlementRequired === 'pro'
    )
    suggestions.push(...standardPackages, ...proPackages)
  }

  // Add wine addon if requested
  if (includeWineAddon) {
    const winePackage = allPackages.find((pkg) => pkg.id === 'wine')
    if (winePackage) {
      suggestions.push(winePackage)
    }
  }

  // If no packages found, fall back to basic per-night
  if (suggestions.length === 0) {
    const fallback = allPackages.find((pkg) => pkg.id === 'per_night_customer')
    if (fallback) {
      suggestions.push(fallback)
    }
  }

  return suggestions
}

// Get the recommended primary package for a given duration and entitlement
export function getPrimaryPackageRecommendation(
  duration: number,
  customerEntitlement: CustomerEntitlement
): SuggestedPackage | null {
  const suggestions = getSuggestedPackages(duration, customerEntitlement, false)
  
  // Return the first package that matches the customer's entitlement level
  return suggestions.find((pkg) => pkg.entitlementRequired === customerEntitlement) || suggestions[0] || null
} 