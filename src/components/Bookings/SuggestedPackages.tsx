'use client'

import React, { useEffect, useState } from 'react'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Toggle } from '@/components/ui/toggle'
import { Media } from '@/components/Media'
import { type Media as MediaType, Post, Package } from '@/payload-types'
import Link from 'next/link'
import { formatDate } from 'date-fns'
import { useYoco } from '@/providers/Yoco'
import { useUserContext } from '@/context/UserContext'
import TrackingInsights from './TrackingInsights'

interface SuggestedPackage {
  id: string
  name: string
  description?: string | null
  baseRate?: number | null
  post?: Post | string | null
  category?: string
  features?: Array<{ feature: string }>
  relatedPage?: string | null
  isActive?: boolean
  bookingCount?: number
  guestCount?: number
  nextBookingDate?: string
  availableCount?: number
  participantsCount?: number
  bookingId?: string // For addons - the booking this addon is tokenized to
  postId?: string // Post ID for payment link creation
  purchasedAddonCount?: number // Number of addons already purchased for this booking
  totalAvailableAddons?: number // Total addons available for this booking
  purchasedAddons?: Array<{ name: string; features: string[] }> // Details of purchased addons
  availableAddonPackages?: Array<{ id: string; name: string; baseRate?: number | null; features?: Array<{ feature: string }> }> // All available addon packages for toggles
  revenueCatId?: string // Revenue category ID for package identification
  yocoId?: string // Yoco product ID for package identification
}

interface SuggestedPackagesProps {
  userId: string
  showInsights?: boolean // Optional: show tracking insights
}

export default function SuggestedPackages({ userId, showInsights = false }: SuggestedPackagesProps) {
  const [activePackages, setActivePackages] = useState<SuggestedPackage[]>([])
  const [inactivePackages, setInactivePackages] = useState<SuggestedPackage[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const fetchSuggestedPackages = async () => {
      try {
        setLoading(true)
        
        // Fetch upcoming bookings with full depth to get addonTransactions
        const bookingsResponse = await fetch('/api/bookings?type=upcoming')
        const bookingsData = await bookingsResponse.json()
        const upcomingBookings = bookingsData.bookings || []

        // Fetch addon transactions for each booking
        // The bookings already have addonTransactions populated at depth: 2
        const bookingsWithAddons = upcomingBookings.map((booking: any) => {
          const addonTransactions = booking.addonTransactions || []
          // Extract transaction details if they're populated objects
          const addonDetails = addonTransactions.map((tx: any) => {
            if (typeof tx === 'object' && tx) {
              return {
                id: tx.id,
                packageName: tx.packageName || tx.productName || 'Addon',
                metadata: tx.metadata || {},
                features: tx.metadata?.features || []
              }
            }
            return null
          }).filter(Boolean)
          
          return {
            ...booking,
            addonTransactions: addonDetails
          }
        })

        // Get unique post IDs from bookings
        const bookingPostIds = Array.from(
          new Set(
            bookingsWithAddons
              .map((b: any) => {
                const post = typeof b.post === 'object' ? b.post?.id : b.post
                return post
              })
              .filter(Boolean)
          )
        ) as string[]

        // Also fetch all enabled packages (for market/subscription packages)
        const allPackagesResponse = await fetch('/api/packages?where[isEnabled][equals]=true')
        const allPackagesData = await allPackagesResponse.json()
        const allEnabledPackages = allPackagesData.docs || []
        
        // Get unique post IDs from all enabled packages
        const allPostIds = Array.from(
          new Set([
            ...bookingPostIds,
            ...allEnabledPackages
              .map((pkg: any) => {
                const post = typeof pkg.post === 'object' ? pkg.post?.id : pkg.post
                return post
              })
              .filter(Boolean)
          ])
        ) as string[]

        // Fetch packages for all relevant posts
        const packagePromises = allPostIds.map(async (postId) => {
          try {
            const [packagesRes, addonsRes] = await Promise.all([
              fetch(`/api/packages/post/${postId}`),
              fetch(`/api/packages/addons/${postId}`)
            ])
            
            const packagesData = await packagesRes.json()
            const addonsData = await addonsRes.json()
            
            const allPackages = [
              ...(packagesData.packages || []),
              ...(addonsData.addons || [])
            ]
            
            return { 
              postId, 
              packages: allPackages, 
              bookings: bookingsWithAddons.filter((b: any) => {
                const post = typeof b.post === 'object' ? b.post?.id : b.post
                return post === postId
              }) 
            }
          } catch (error) {
            console.error(`Error fetching packages for post ${postId}:`, error)
            return { postId, packages: [], bookings: [] }
          }
        })

        const results = await Promise.all(packagePromises)
        
        // Process packages and categorize as active/inactive
        const active: SuggestedPackage[] = []
        const inactive: SuggestedPackage[] = []

        // Track packages we've already processed to avoid duplicates
        const processedPackageIds = new Set<string>()

        results.forEach(({ postId, packages, bookings }) => {
          // Get post data for image
          const postData = bookings.length > 0 && typeof bookings[0].post === 'object' 
            ? bookings[0].post 
            : null

          packages.forEach((pkg: any) => {
            // Skip if we've already processed this package
            if (processedPackageIds.has(pkg.id)) {
              return
            }
            processedPackageIds.add(pkg.id)
            const postBookings = bookings.filter((b: any) => {
              const selectedPkg = b.selectedPackage
              if (!selectedPkg) return false
              const pkgId = typeof selectedPkg === 'object' && selectedPkg.package
                ? (typeof selectedPkg.package === 'object' ? selectedPkg.package.id : selectedPkg.package)
                : null
              return pkgId === pkg.id
            })

            // Calculate total guest count across all bookings for this post
            const guestCount = bookings.reduce((sum: number, b: any) => {
              const guests = b.guests || []
              return sum + (Array.isArray(guests) ? guests.length : 0)
            }, 0)

            // Determine if package is checkin service, addon, or market
            const isCheckinService = pkg.name?.toLowerCase().includes('checkin') || 
                                     pkg.revenueCatId === 'per_night_luxury' ||
                                     pkg.yocoId === 'per_night_luxury'
            const isAddon = pkg.category === 'addon'
            const isMarket = pkg.name?.toLowerCase().includes('market') || 
                            pkg.revenueCatId === 'monthly_subscription' ||
                            pkg.yocoId === 'monthly_subscription' ||
                            pkg.revenueCatId === 'rc_weekly' ||
                            pkg.yocoId === 'rc_weekly'

            // For addons, only show if there are bookings to tokenize to
            if (isAddon && bookings.length === 0) {
              // Skip addons without bookings - they're not applicable
              return
            }

            // Get the first booking ID for addon tokenization
            const firstBooking = bookings.length > 0 ? bookings[0] : undefined
            const firstBookingId = firstBooking?.id

            // For addons, calculate purchased count and details
            let purchasedAddonCount = 0
            let purchasedAddons: Array<{ name: string; features: string[] }> = []
            let totalAvailableAddons = 0

            if (isAddon && firstBooking) {
              // Count purchased addons for this booking
              const addonTransactions = firstBooking.addonTransactions || []
              purchasedAddonCount = addonTransactions.length
              
              // Get details of purchased addons from transactions
              purchasedAddons = addonTransactions
                .map((tx: any) => {
                  if (typeof tx === 'object' && tx) {
                    // Extract addon name from transaction
                    const metadata = typeof tx.metadata === 'object' && tx.metadata !== null ? tx.metadata as Record<string, any> : {}
                    const packageName = tx.packageName || metadata.packageName || metadata.package_id || ''
                    const productName = tx.productName || metadata.productName || metadata.product_id || ''
                    const addonName = packageName || productName || tx.title || 'Addon'
                    
                    // Extract features/description from transaction
                    // Use description, title, or metadata features
                    const features: string[] = []
                    
                    // First try to get features from metadata
                    if (metadata.features && Array.isArray(metadata.features)) {
                      features.push(...metadata.features.map((f: any) => {
                        if (typeof f === 'string') return f
                        if (typeof f === 'object' && f.feature) return f.feature
                        return String(f)
                      }))
                    }
                    
                    // Then try description or title
                    if (features.length === 0) {
                      if (tx.description) {
                        features.push(tx.description)
                      } else if (tx.title && tx.title !== addonName) {
                        features.push(tx.title)
                      } else if (metadata.description) {
                        features.push(String(metadata.description))
                      }
                    }
                    
                    // Fallback to addon name if no features found
                    if (features.length === 0) {
                      features.push(addonName)
                    }
                    
                    return {
                      name: addonName,
                      features: features
                    }
                  }
                  return null
                })
                .filter(Boolean)
              
              // Get total available addons for this post
              const addonPackages = packages.filter((p: any) => p.category === 'addon')
              totalAvailableAddons = addonPackages.length || 8 // Default to 8 if can't determine
            }

            // For checkin service, ensure we have booking count and next booking date
            const checkinBookingCount = isCheckinService && bookings.length > 0 ? bookings.length : (isCheckinService ? 1 : 0)
            const checkinNextDate = isCheckinService && bookings.length > 0 
              ? bookings[0]?.fromDate 
              : (isCheckinService ? new Date().toISOString() : undefined)

            const packageData: SuggestedPackage = {
              id: pkg.id,
              name: pkg.name,
              description: pkg.description,
              baseRate: pkg.baseRate,
              post: postData || (typeof pkg.post === 'object' ? pkg.post : { id: postId } as Post),
              category: pkg.category,
              features: pkg.features,
              relatedPage: pkg.relatedPage,
              isActive: postBookings.length > 0 || isCheckinService,
              bookingCount: isCheckinService ? checkinBookingCount : (postBookings.length || 0),
              guestCount,
              nextBookingDate: isCheckinService ? checkinNextDate : (postBookings.length > 0 
                ? postBookings[0]?.fromDate 
                : undefined),
              availableCount: pkg.maxConcurrentBookings || (isMarket ? 33 : undefined),
              participantsCount: isMarket ? 3 : undefined,
              bookingId: isAddon ? firstBookingId : undefined, // Tokenize addon to booking
              postId: postId,
              purchasedAddonCount,
              totalAvailableAddons,
              purchasedAddons
            }

            // Categorize packages:
            // Active = packages with upcoming bookings OR checkin services/addons for posts with bookings
            // Inactive = market/subscription packages available but not currently booked
            
            const hasBookingsForPost = bookings.length > 0
            
            if (isCheckinService) {
              // Checkin service - only add once (first one found)
              if (!active.some(p => p.revenueCatId === 'per_night_luxury' || p.yocoId === 'per_night_luxury' || p.name?.toLowerCase().includes('checkin'))) {
                active.push(packageData)
              }
            } else if (isAddon && hasBookingsForPost) {
              // Addons - will be aggregated into a single summary card later
              active.push(packageData)
            } else if (isMarket) {
              // Market/subscription packages - show as inactive (only add once)
              if (!inactive.some(p => p.revenueCatId === 'monthly_subscription' || p.yocoId === 'monthly_subscription' || p.name?.toLowerCase().includes('market'))) {
                inactive.push(packageData)
              }
            } else if (hasBookingsForPost && postBookings.length > 0) {
              // Other packages with bookings - only if not already added
              if (!active.some(p => p.id === packageData.id)) {
                active.push(packageData)
              }
            }
            // Note: Addons without bookings are skipped above
          })
        })

        // Sort active by booking date, inactive by name
        active.sort((a, b) => {
          if (a.nextBookingDate && b.nextBookingDate) {
            return new Date(a.nextBookingDate).getTime() - new Date(b.nextBookingDate).getTime()
          }
          // Prioritize checkin service
          const aIsCheckin = a.name?.toLowerCase().includes('checkin')
          const bIsCheckin = b.name?.toLowerCase().includes('checkin')
          if (aIsCheckin && !bIsCheckin) return -1
          if (!aIsCheckin && bIsCheckin) return 1
          return 0
        })

        inactive.sort((a, b) => {
          // Prioritize market packages
          const aIsMarket = a.name?.toLowerCase().includes('market')
          const bIsMarket = b.name?.toLowerCase().includes('market')
          if (aIsMarket && !bIsMarket) return -1
          if (!aIsMarket && bIsMarket) return 1
          return (a.name || '').localeCompare(b.name || '')
        })

        // Separate packages by type to avoid duplicates
        const checkinPackages = active.filter(p => 
          p.name?.toLowerCase().includes('checkin') || 
          p.revenueCatId === 'per_night_luxury' || 
          p.yocoId === 'per_night_luxury'
        )
        const addonPackages = active.filter(p => p.category === 'addon')
        const otherActive = active.filter(p => 
          !p.name?.toLowerCase().includes('checkin') && 
          p.category !== 'addon' &&
          p.revenueCatId !== 'per_night_luxury' &&
          p.yocoId !== 'per_night_luxury'
        )
        
        const marketPackages = inactive.filter(p => 
          p.name?.toLowerCase().includes('market') ||
          p.revenueCatId === 'monthly_subscription' ||
          p.yocoId === 'monthly_subscription'
        )
        const otherInactive = inactive.filter(p => 
          !p.name?.toLowerCase().includes('market') &&
          p.revenueCatId !== 'monthly_subscription' &&
          p.yocoId !== 'monthly_subscription'
        )

        // Create a single addon summary card aggregating all addons across all bookings
        let addonSummaryCard: SuggestedPackage | null = null
        if (addonPackages.length > 0 && addonPackages[0]) {
          const firstAddon = addonPackages[0]
          // Aggregate addon data from all bookings
          const allPurchasedAddons: Array<{ name: string; features: string[] }> = []
          let totalPurchasedCount = 0
          let maxTotalAvailable = 0
          
          addonPackages.forEach((addon) => {
            if (addon.purchasedAddons) {
              allPurchasedAddons.push(...addon.purchasedAddons)
              totalPurchasedCount += addon.purchasedAddonCount || 0
              maxTotalAvailable = Math.max(maxTotalAvailable, addon.totalAvailableAddons || 8)
            }
          })
          
          // Deduplicate addons by name to avoid showing the same addon multiple times
          const uniqueAddons = new Map<string, { name: string; features: string[] }>()
          allPurchasedAddons.forEach((addon) => {
            const key = addon.name.toLowerCase()
            if (!uniqueAddons.has(key)) {
              uniqueAddons.set(key, addon)
            } else {
              // Merge features if duplicate
              const existing = uniqueAddons.get(key)!
              const mergedFeatures = [...new Set([...existing.features, ...addon.features])]
              uniqueAddons.set(key, { ...existing, features: mergedFeatures })
            }
          })
          
          const deduplicatedAddons = Array.from(uniqueAddons.values())
          
          // Fetch all available addon packages for the addon card
          let availableAddonPackages: Array<{ id: string; name: string; baseRate?: number | null; features?: Array<{ feature: string }> }> = []
          if (firstAddon.postId) {
            try {
              const addonsRes = await fetch(`/api/packages/addons/${firstAddon.postId}`)
              const addonsData = await addonsRes.json()
              const allAddons = addonsData.addons || []
              availableAddonPackages = allAddons.map((pkg: any) => ({
                id: pkg.id,
                name: pkg.name,
                baseRate: pkg.baseRate,
                features: pkg.features || []
              }))
            } catch (error) {
              console.error('Error fetching available addon packages:', error)
            }
          }
          
          // Use the first addon package as base, but update with aggregated transaction data
          addonSummaryCard = {
            ...firstAddon,
            purchasedAddonCount: totalPurchasedCount || firstAddon.purchasedAddonCount || 0,
            totalAvailableAddons: maxTotalAvailable || firstAddon.totalAvailableAddons || 8,
            purchasedAddons: deduplicatedAddons.length > 0 ? deduplicatedAddons : (firstAddon.purchasedAddons || []),
            availableAddonPackages
          }
        }

        // Set active packages: 1 checkin service, 1 addon summary
        setActivePackages([
          ...checkinPackages.slice(0, 1),
          ...(addonSummaryCard ? [addonSummaryCard] : [])
        ].slice(0, 2))
        
        // Set inactive packages: 1 market package
        setInactivePackages([
          ...marketPackages.slice(0, 1)
        ].slice(0, 1))

        // Track Meta Pixel and Google Tag events for addon suggestions
        if (typeof window !== 'undefined') {
          try {
            // Meta Pixel - ViewContent event for addon suggestions
            if ((window as any).fbq && typeof (window as any).fbq === 'function' && addonPackages.length > 0) {
              addonPackages.forEach((addon) => {
                try {
                  (window as any).fbq('track', 'ViewContent', {
                    content_name: addon.name,
                    content_category: 'addon',
                    content_ids: [addon.id],
                    value: addon.baseRate || 0,
                    currency: 'ZAR'
                  })
                } catch (fbqError) {
                  // Silently fail - don't break the UI if tracking fails
                  console.warn('Meta Pixel tracking error:', fbqError)
                }
              })
            }

            // Google Tag - view_item event for addon suggestions
            if ((window as any).gtag && typeof (window as any).gtag === 'function' && addonPackages.length > 0) {
              addonPackages.forEach((addon) => {
                try {
                  (window as any).gtag('event', 'view_item', {
                    currency: 'ZAR',
                    value: addon.baseRate || 0,
                    items: [{
                      item_id: addon.id,
                      item_name: addon.name,
                      item_category: 'addon',
                      price: addon.baseRate || 0,
                      quantity: 1
                    }]
                  })
                } catch (gtagError) {
                  // Silently fail - don't break the UI if tracking fails
                  console.warn('Google Tag tracking error:', gtagError)
                }
              })
            }
          } catch (error) {
            // Silently fail - don't break the UI if tracking fails
            console.warn('Analytics tracking error:', error)
          }
        }
      } catch (error) {
        console.error('Error fetching suggested packages:', error)
      } finally {
        setLoading(false)
      }
    }

    if (userId) {
      fetchSuggestedPackages()
    }
  }, [userId])

  if (loading) {
    return null // Or a loading skeleton
  }

  if (activePackages.length === 0 && inactivePackages.length === 0) {
    return null
  }

  return (
    <div className="space-y-10">
      {showInsights && (
        <div>
          <h2 className="text-4xl font-medium tracking-tighter my-6 text-teal-400">Your Insights</h2>
          <TrackingInsights userId={userId} />
        </div>
      )}
      {activePackages.length > 0 && (
        <div>
          <h2 className="text-4xl font-medium tracking-tighter my-6 text-teal-400">Active</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {activePackages.map((pkg, index) => (
              <PackageSuggestionCard key={`active-${pkg.id}-${index}`} package={pkg} />
            ))}
          </div>
        </div>
      )}

      {inactivePackages.length > 0 && (
        <div>
          <h2 className="text-4xl font-medium tracking-tighter my-6 text-teal-400">Inactive</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {inactivePackages.map((pkg, index) => (
              <PackageSuggestionCard key={`inactive-${pkg.id}-${index}`} package={pkg} />
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

function PackageSuggestionCard({ package: pkg }: { package: SuggestedPackage }) {
  const post = typeof pkg.post === 'object' ? pkg.post : null
  const postSlug = post?.slug
  const image = post?.meta?.image
  const { createPaymentLinkFromDatabase } = useYoco()
  const { currentUser } = useUserContext()
  const [isLoading, setIsLoading] = useState(false)
  const [selectedAddons, setSelectedAddons] = useState<Set<string>>(new Set())
  
  const isAddon = pkg.category === 'addon'
  
  // Initialize selected addons with purchased addons
  useEffect(() => {
    if (isAddon && pkg.purchasedAddons) {
      const purchasedIds = new Set<string>()
      pkg.purchasedAddons.forEach((addon) => {
        // Try to match by name with available packages
        if (pkg.availableAddonPackages) {
          const matching = pkg.availableAddonPackages.find(
            (ap) => ap.name.toLowerCase() === addon.name.toLowerCase()
          )
          if (matching) {
            purchasedIds.add(matching.id)
          }
        }
      })
      setSelectedAddons(purchasedIds)
    }
  }, [isAddon, pkg.purchasedAddons, pkg.availableAddonPackages])
  
  const formatPrice = (price?: number | null) => {
    if (!price) return 'R0'
    return `R${price.toLocaleString('en-ZA')}`
  }

  const getButtonText = () => {
    const isCheckin = pkg.name?.toLowerCase().includes('checkin') || 
                      pkg.revenueCatId === 'per_night_luxury' ||
                      pkg.yocoId === 'per_night_luxury'
    
    if (pkg.category === 'addon') {
      return `Include the special addon - ${formatPrice(pkg.baseRate)}`
    }
    if (isCheckin) {
      // For checkin service, include addon info if available
      const addonInfo = pkg.purchasedAddons && pkg.purchasedAddons.length > 0
        ? ` + ${pkg.purchasedAddonCount || 0} Add-ons`
        : ''
      return `🛎️ CHECKIN SERVICE - ${formatPrice(pkg.baseRate)}${addonInfo}`
    }
    if (pkg.name?.includes('Market') || pkg.name?.includes('market')) {
      return `JOIN THE MARKET - ${formatPrice(pkg.baseRate)}`
    }
    return `Book - ${formatPrice(pkg.baseRate)}`
  }

  const handleAddonPurchase = async (e: React.MouseEvent) => {
    if (pkg.category !== 'addon' || !pkg.bookingId || !pkg.baseRate) {
      return
    }

    e.preventDefault()
    setIsLoading(true)

    try {
      if (!createPaymentLinkFromDatabase) {
        throw new Error('Payment service not available')
      }

      const paymentLink = await createPaymentLinkFromDatabase(
        {
          id: pkg.id,
          name: pkg.name,
          description: pkg.description,
          baseRate: pkg.baseRate,
          revenueCatId: pkg.id,
        },
        currentUser?.name || currentUser?.email || 'Guest',
        pkg.baseRate,
        {
          postId: pkg.postId,
          intent: 'product',
          // @ts-ignore - bookingId is used by payment link API but not in type definition
          ...(pkg.bookingId && { bookingId: pkg.bookingId }), // Tokenize addon to this booking
        },
      )

      if (!paymentLink?.url) {
        throw new Error('Failed to create payment link')
      }

      // Navigate directly to Yoco payment
      window.location.href = paymentLink.url
    } catch (error) {
      console.error('Failed to purchase add-on:', error)
      alert(error instanceof Error ? error.message : 'Failed to create payment link. Please try again.')
    } finally {
      setIsLoading(false)
    }
  }

  const getTitle = () => {
    if (pkg.bookingCount && pkg.bookingCount > 0) {
      return `${pkg.bookingCount} Stays`
    }
    if (pkg.category === 'addon') {
      // Show "X of Y Add-ons" format
      const purchased = pkg.purchasedAddonCount || 0
      const total = pkg.totalAvailableAddons || 8
      return `${purchased} of ${total} Add-ons`
    }
    if (pkg.name?.includes('Add-on') || pkg.name?.includes('addon')) {
      return '2 of 8 Add-ons'
    }
    if (pkg.name?.includes('Market') || pkg.name?.includes('market')) {
      return `${pkg.participantsCount || 2} Shops online this month`
    }
    return pkg.name || 'Package'
  }

  const getDescription = () => {
    const lines: string[] = []
    
    const isCheckin = pkg.name?.toLowerCase().includes('checkin') || 
                      pkg.revenueCatId === 'per_night_luxury' ||
                      pkg.yocoId === 'per_night_luxury'
    const isAddon = pkg.category === 'addon'
    const isMarket = pkg.name?.toLowerCase().includes('market')
    
    if (isCheckin && pkg.nextBookingDate) {
      const date = new Date(pkg.nextBookingDate)
      const month = formatDate(date, 'MMMM')
      lines.push(`3 months time in ${month}`)
    }
    
    if (isCheckin && pkg.guestCount && pkg.guestCount > 0) {
      lines.push(`You have invited ${pkg.guestCount} guests`)
    }
    
    // For checkin service, don't show addon info in description (it's in button)
    // For addon card, show purchased addons
    if (isAddon) {
      // Show purchased addon transaction summary
      if (pkg.purchasedAddons && pkg.purchasedAddons.length > 0) {
        // Display purchased addons from transactions
        pkg.purchasedAddons.forEach((addon) => {
          // Show addon name and features from transaction
          if (addon.features && addon.features.length > 0) {
            // Show each feature/item from the transaction
            addon.features.forEach((feature: any) => {
              const featureText = typeof feature === 'string' ? feature : (feature?.feature || feature || '')
              if (featureText) {
                lines.push(`✓ ${featureText}`)
              }
            })
          } else if (addon.name) {
            // Fallback to addon name if no features
            lines.push(`✓ ${addon.name}`)
          }
        })
      }
      
      // Empty state message if no addons
      if (lines.length === 0) {
        lines.push('No addons purchased yet')
      }
    }
    
    if (isMarket) {
      if (pkg.participantsCount) {
        lines.push(`${pkg.participantsCount} people are joining the Monthly market stall`)
      }
      if (pkg.availableCount) {
        lines.push(`${pkg.availableCount} packages available`)
      }
    }
    
    // Fallback to description if no specific formatting
    if (lines.length === 0 && pkg.description) {
      lines.push(pkg.description)
    }
    
    return lines.length > 0 ? lines : ['']
  }

  // For addons, handle payment directly; for others, link to post
  const href = !isAddon 
    ? (postSlug 
        ? `/posts/${postSlug}?package=${pkg.id}`
        : pkg.relatedPage 
          ? `/${pkg.relatedPage}?package=${pkg.id}`
          : '#')
    : '#'

  return (
    <Card className="h-full hover:shadow-md transition-shadow">
      <div className="relative">
        {image && typeof image !== 'string' ? (
          <div className="relative w-full h-48 overflow-hidden">
            <Media 
              resource={image} 
              size="50vw" 
              className="w-full h-full object-cover"
              postId={post?.id}
              postTitle={post?.title}
            />
          </div>
        ) : isAddon ? (
          // Show basket icon for addon cards without image
          <div className="relative w-full h-48 bg-teal-500 flex items-center justify-center">
            <svg 
              xmlns="http://www.w3.org/2000/svg" 
              width="64" 
              height="64" 
              viewBox="0 0 24 24" 
              fill="none" 
              stroke="white" 
              strokeWidth="2" 
              strokeLinecap="round" 
              strokeLinejoin="round"
              className="w-16 h-16"
            >
              <path d="M6 2L3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4z"></path>
              <line x1="3" y1="6" x2="21" y2="6"></line>
              <path d="M16 10a4 4 0 0 1-8 0"></path>
            </svg>
          </div>
        ) : null}
        <CardContent className="p-4">
          <h3 className="text-xl font-semibold mb-2 text-teal-400">{getTitle()}</h3>
          <div className="space-y-1 mb-4 text-sm text-muted-foreground">
            {getDescription().map((line, idx) => (
              <p key={idx}>{line}</p>
            ))}
          </div>
          
          {/* Show toggles for available addon packages (lower priced ones) */}
          {isAddon && pkg.availableAddonPackages && pkg.availableAddonPackages.length > 0 && (
            <div className="mb-4 space-y-2">
              {/* Sort by price and show lower priced packages */}
              {pkg.availableAddonPackages
                .filter((ap) => ap.baseRate && ap.baseRate > 0)
                .sort((a, b) => (a.baseRate || 0) - (b.baseRate || 0))
                .slice(0, 5) // Show up to 5 lower priced addons
                .map((addonPkg) => {
                  const isSelected = selectedAddons.has(addonPkg.id)
                  const featureText = addonPkg.features && addonPkg.features.length > 0
                    ? (typeof addonPkg.features[0] === 'string' 
                        ? addonPkg.features[0] 
                        : addonPkg.features[0]?.feature || addonPkg.name)
                    : addonPkg.name
                  
                  return (
                    <div key={addonPkg.id} className="flex items-center justify-between gap-2 p-2 rounded-md border border-border/50 hover:bg-muted/50">
                      <div className="flex-1">
                        <p className="text-sm font-medium">{featureText}</p>
                        <p className="text-xs text-muted-foreground">{formatPrice(addonPkg.baseRate)}</p>
                      </div>
                      <Toggle
                        pressed={isSelected}
                        onPressedChange={(pressed) => {
                          const newSelected = new Set(selectedAddons)
                          if (pressed) {
                            newSelected.add(addonPkg.id)
                          } else {
                            newSelected.delete(addonPkg.id)
                          }
                          setSelectedAddons(newSelected)
                        }}
                        aria-label={`Toggle ${featureText}`}
                      >
                        {isSelected ? '✓' : '+'}
                      </Toggle>
                    </div>
                  )
                })}
            </div>
          )}
          
          {isAddon && pkg.bookingId ? (
            <Button 
              className="w-full" 
              variant={pkg.isActive ? 'default' : 'secondary'}
              onClick={handleAddonPurchase}
              disabled={isLoading}
            >
              {isLoading ? 'Preparing checkout...' : getButtonText()}
            </Button>
          ) : (
            <Link href={href}>
              <Button className="w-full" variant={pkg.isActive ? 'default' : 'secondary'}>
                {getButtonText()}
              </Button>
            </Link>
          )}
        </CardContent>
      </div>
    </Card>
  )
}

