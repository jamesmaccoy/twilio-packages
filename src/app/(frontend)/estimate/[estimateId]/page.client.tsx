'use client'

import { useState, useEffect, useMemo } from 'react'
import { Estimate, User } from '@/payload-types'
import { Button } from '@/components/ui/button'
import { useYoco } from '@/providers/Yoco'
import { FileText, Loader2, PlusCircleIcon, TrashIcon, Lock, Share2, Copy, Users, MessageCircle, Clock, MapPin, ChevronRight } from 'lucide-react'
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import { Check } from 'lucide-react'
import { cn } from '@/lib/utils'
import InviteUrlDialog from './_components/invite-url-dialog'
import { Media } from '@/components/Media'
import { formatDateTime } from '@/utilities/formatDateTime'
import { UserIcon } from 'lucide-react'
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs'
import { Badge } from '@/components/ui/badge'
import Link from 'next/link'
import { format, formatDistanceToNow } from 'date-fns'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Textarea } from '@/components/ui/textarea'
import { AIAssistant } from '@/components/AIAssistant/AIAssistant'
// Import package suggestion system
import {
  getCustomerEntitlement,
  type CustomerEntitlement,
} from '@/utils/packageSuggestions'
import { useSubscription } from '@/hooks/useSubscription'
import { useRouter, useSearchParams } from 'next/navigation'
import { trackEstimateViewGoogleAds } from '@/lib/googleAdsTracking'
import { getGravatarUrl } from '@/utils/gravatar'
import { Gravatar } from '@/components/Gravatar'
import { EstimateAds } from '@/components/MetaAds/EstimateAds'

type TokenUsageSummary = {
  total: number | null
  prompt: number | null
  candidates: number | null
  cached: number | null
  thoughts: number | null
  timestamp: number
}

// --- Add the usePackages hook here ---
export interface PostPackage {
  id: string
  name: string
  originalName?: string // Keep track of original name
  description?: string
  multiplier: number
  features: { feature: string }[]
  category: string
  minNights: number
  maxNights: number
  yocoId?: string
  revenueCatId?: string
  baseRate?: number // Package-specific base rate
  isEnabled: boolean
  source?: 'database' | 'yoco'
  hasCustomName?: boolean // Indicates if this package has a custom name set by host
}

export function usePackages(postId: string) {
  const [packages, setPackages] = useState<PostPackage[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<Error | null>(null)

  useEffect(() => {
    if (!postId) return
    setLoading(true)
    // Use the new endpoint that includes custom names
    fetch(`/api/packages/post/${postId}`)
      .then(res => res.json())
      .then(data => {
        // Transform the data to match PostPackage interface and filter out add-on packages
        const transformedPackages = (data.packages || [])
          .filter((pkg: any) => pkg.category !== 'addon') // Exclude add-on packages
          .map((pkg: any) => ({
            id: pkg.id,
            name: pkg.name, // This will be the custom name if available
            originalName: pkg.originalName,
            description: pkg.description,
            multiplier: pkg.multiplier,
            features: pkg.features?.map((f: any) => 
              typeof f === 'string' ? { feature: f } : f
            ) || [],
            category: pkg.category,
            minNights: pkg.minNights,
            maxNights: pkg.maxNights,
            revenueCatId: pkg.revenueCatId,
            baseRate: pkg.baseRate, // Include package-specific base rate
            isEnabled: pkg.isEnabled,
            source: pkg.source,
            hasCustomName: pkg.hasCustomName
          }))
        setPackages(transformedPackages)
        setLoading(false)
      })
      .catch(err => {
        setError(err)
        setLoading(false)
      })
  }, [postId])

  return { packages, loading, error }
}

type Props = {
  data: Estimate
  user: User
}

export default function EstimateDetailsClientPage({ data, user }: Props) {
  const { createPaymentLinkFromDatabase } = useYoco()
  const router = useRouter()
  const searchParams = useSearchParams()
  
  // Get active tab from URL query parameter, default to 'details'
  const [currentTab, setCurrentTab] = useState<string>(searchParams?.get('tab') || 'details')
  
  // Update tab when URL parameter changes
  useEffect(() => {
    const tab = searchParams?.get('tab') || 'details'
    setCurrentTab(tab)
  }, [searchParams])
  
  // Handle tab change
  const handleTabChange = (value: string) => {
    setCurrentTab(value)
    // Update URL without page reload
    const newUrl = value === 'details' 
      ? window.location.pathname 
      : `${window.location.pathname}?tab=${value}`
    router.replace(newUrl, { scroll: false })
  }
  
  // Check for cancellation from payment gateway
  useEffect(() => {
    const cancelled = searchParams?.get('cancelled') === 'true'
    if (cancelled) {
      setPaymentError('Payment was cancelled. You can try again when ready.')
      // Remove the cancelled parameter from URL
      const newUrl = window.location.pathname
      router.replace(newUrl, { scroll: false })
    }
  }, [searchParams, router])

  // Check if this is a reschedule estimate (has originalBooking)
  const originalBooking = typeof data?.originalBooking === 'object' ? data.originalBooking : null
  const isReschedule = !!originalBooking
  const originalBookingPaid = originalBooking?.paymentStatus === 'paid'
  const originalBookingTotal = originalBooking?.total ? Number(originalBooking.total) : null
  const originalBookingDuration = originalBooking?.fromDate && originalBooking?.toDate
    ? Math.max(
        1,
        Math.round(
          (new Date(originalBooking.toDate).getTime() - new Date(originalBooking.fromDate).getTime()) /
            (1000 * 60 * 60 * 24),
        ),
      )
    : null

  // Helper function to get display name from either package type
  const getPackageDisplayName = (pkg: PostPackage | null): string => {
    if (!pkg) return ''
    return pkg.name // PostPackage (which includes custom name)
  }

  // Helper function to check if package is a PostPackage
  const isPostPackage = (pkg: PostPackage | null): pkg is PostPackage => {
    return pkg !== null && 'name' in pkg && !('title' in pkg)
  }

  // Calculate duration and use a fallback for total
  const _bookingDuration =
    data?.fromDate && data?.toDate
      ? Math.max(
          1,
          Math.round(
            (new Date(data.toDate).getTime() - new Date(data.fromDate).getTime()) /
              (1000 * 60 * 60 * 24),
          ),
        )
      : 1
  
  // Get the post's baseRate properly
  const _postBaseRate = typeof data?.post === 'object' && data?.post?.baseRate 
    ? Number(data.post.baseRate) 
    : 150 // Default fallback
  
  // Use the estimate total if it's valid, otherwise calculate from baseRate
  // Use values directly from Payload CMS as stored (no conversion)
  const _bookingTotal = data?.total && !isNaN(Number(data.total)) && Number(data.total) > 0
    ? Number(data.total)
    : _postBaseRate * _bookingDuration
  
  const _postId = typeof data?.post === 'object' && data?.post?.id ? data.post.id : ''

  // Track estimate view for Google Ads
  useEffect(() => {
    if (data?.id) {
      const postData = typeof data.post === 'object' ? data.post : null
      const packageType = (data as any).packageType || null
      
      trackEstimateViewGoogleAds({
        estimateId: data.id,
        estimateValue: _bookingTotal,
        postId: _postId || undefined,
        postTitle: postData?.title || data.title || undefined,
        packageType: packageType || undefined,
      })
    }
  }, [data?.id, _bookingTotal, _postId, data?.title, data?.post])

  // Track PageView with URL for Meta audience matching
  useEffect(() => {
    if (typeof window === 'undefined' || !(window as any).fbq) {
      return
    }

    // Ensure PageView is tracked with current URL for audience matching
    // Meta Pixel automatically includes URL, but we'll track it explicitly to ensure it's captured
    const currentUrl = window.location.href
    const currentPath = window.location.pathname

    // Only track if we're on an estimate page
    if (currentPath.includes('/estimate/')) {
      // Track PageView with explicit URL parameter
      ;(window as any).fbq('track', 'PageView', {
        content_name: 'Estimate Page',
        content_category: 'estimate',
      }, {
        eventID: `pageview-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`,
        eventSourceUrl: currentUrl,
      })

      console.log('Meta Pixel PageView tracked for estimate page:', {
        url: currentUrl,
        path: currentPath,
        estimateId: data?.id,
      })
    }
  }, [data?.id])
  const { packages, loading, error } = usePackages(_postId)

  // Payment states
  const [paymentLoading, setPaymentLoading] = useState(false)
  const [paymentError, setPaymentError] = useState<string | null>(null)
  const [paymentSuccess, setPaymentSuccess] = useState(false)

  // Package suggestion states
  const [selectedPackage, setSelectedPackage] = useState<PostPackage | null>(null)
  const [customerEntitlement, setCustomerEntitlement] = useState<CustomerEntitlement>('none')
  const [isWineSelected, setIsWineSelected] = useState(false)
  const [packagePrice, setPackagePrice] = useState<number | null>(null)
  const [packageTotal, setPackageTotal] = useState<number | null>(null)
  const [latestTokenUsage, setLatestTokenUsage] = useState<TokenUsageSummary | null>(null)

  const subscriptionStatus = useSubscription()
  const { isSubscribed, isLoading: isSubscriptionLoading, entitlements } = subscriptionStatus
  const [areDatesAvailable, setAreDatesAvailable] = useState(true)
  const [subscriptionProductId, setSubscriptionProductId] = useState<string | null>(null)
  
  // Fetch subscription transaction to get productId
  useEffect(() => {
    if (!isSubscribed || !user?.id) {
      setSubscriptionProductId(null)
      return
    }
    
    const fetchSubscriptionDetails = async () => {
      try {
        const response = await fetch('/api/check-subscription', {
          credentials: 'include',
        })
        if (response.ok) {
          const data = await response.json()
          // Get the active transaction's productId
          const activeTransaction = data.transactions?.find((tx: any) => {
            if (!tx || tx.status !== 'completed' || tx.intent !== 'subscription') return false
            if (!tx.expiresAt) return true
            return new Date(tx.expiresAt) > new Date()
          })
          if (activeTransaction?.productId) {
            setSubscriptionProductId(activeTransaction.productId)
          }
        }
      } catch (error) {
        console.error('Error fetching subscription details:', error)
      }
    }
    
    fetchSubscriptionDetails()
  }, [isSubscribed, user?.id])
  
  // Check if the selected package matches the user's subscription
  const isPackageIncludedInSubscription = useMemo(() => {
    if (!isSubscribed || !selectedPackage || !subscriptionProductId) {
      return false
    }
    
    // Get all possible package identifiers
    const packageIds = [
      selectedPackage.revenueCatId,
      selectedPackage.yocoId,
      selectedPackage.id,
    ].filter(Boolean) as string[]
    
    // Check if any package identifier matches the subscription productId
    return packageIds.some(packageId => {
      // Direct match
      if (packageId === subscriptionProductId) return true
      // Case-insensitive match
      if (packageId.toLowerCase() === subscriptionProductId.toLowerCase()) return true
      // Partial match (for cases where productId might be a prefix/suffix)
      if (packageId.includes(subscriptionProductId) || subscriptionProductId.includes(packageId)) return true
      return false
    })
  }, [isSubscribed, selectedPackage, subscriptionProductId])
  const [removedGuests, setRemovedGuests] = useState<string[]>([])
  const [shareLink, setShareLink] = useState<string>('')
  const [shareLinkCopied, setShareLinkCopied] = useState(false)
  const [isLoadingShareLink, setIsLoadingShareLink] = useState(false)
  const [activity, setActivity] = useState<any[]>([])
  const [commentDialogOpen, setCommentDialogOpen] = useState(false)
  const [commentText, setCommentText] = useState('')
  const [isSubmittingComment, setIsSubmittingComment] = useState(false)

  // Fetch share link token
  useEffect(() => {
    const fetchShareLink = async () => {
      if (!data?.id) return
      
      try {
        setIsLoadingShareLink(true)
        const res = await fetch(`/api/estimates/${data.id}/token`, {
          method: 'POST',
          credentials: 'include',
        })

        if (res.ok) {
          const data = await res.json()
          const url = `${window.location.origin}/i/${data.token}`
          setShareLink(url)
        }
      } catch (error) {
        console.error('Error fetching share link:', error)
      } finally {
        setIsLoadingShareLink(false)
      }
    }

    fetchShareLink()
  }, [data?.id])

  // Copy share link handler
  const copyShareLink = () => {
    if (shareLink) {
      navigator.clipboard.writeText(shareLink)
      setShareLinkCopied(true)
      setTimeout(() => setShareLinkCopied(false), 2000)
    }
  }

  // Share handler
  const handleShare = () => {
    if (navigator.share && shareLink) {
      navigator.share({
        title: 'Estimate Details',
        text: 'Check out this estimate',
        url: shareLink,
      }).catch(() => {
        // Fallback to copy if share fails
        copyShareLink()
      })
    } else {
      copyShareLink()
    }
  }

  // Load activity from estimate
  useEffect(() => {
    const estimateData = data as any
    if (estimateData?.activity && Array.isArray(estimateData.activity)) {
      setActivity(estimateData.activity)
    }
  }, [data])

  // Add comment handler
  const handleAddComment = async () => {
    if (!commentText.trim() || !data?.id) return

    setIsSubmittingComment(true)
    try {
      const res = await fetch(`/api/estimates/${data.id}/activity`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        credentials: 'include',
        body: JSON.stringify({
          type: 'comment',
          content: commentText.trim(),
        }),
      })

      if (res.ok) {
        const result = await res.json()
        setActivity(result.activity || [])
        setCommentText('')
        setCommentDialogOpen(false)
      } else {
        throw new Error('Failed to add comment')
      }
    } catch (error) {
      console.error('Error adding comment:', error)
      alert('Failed to add comment. Please try again.')
    } finally {
      setIsSubmittingComment(false)
    }
  }

  // Handle decline
  const handleDecline = async () => {
    if (!data?.id) return

    if (!confirm('Are you sure you want to decline this estimate?')) {
      return
    }

    try {
      const res = await fetch(`/api/estimates/${data.id}/activity`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        credentials: 'include',
        body: JSON.stringify({
          type: 'declined',
          content: 'Estimate declined',
        }),
      })

      if (res.ok) {
        const result = await res.json()
        setActivity(result.activity || [])
      } else {
        throw new Error('Failed to decline estimate')
      }
    } catch (error) {
      console.error('Error declining estimate:', error)
      alert('Failed to decline estimate. Please try again.')
    }
  }

  // Remove guest handler for estimates
  const removeGuestHandler = async (guestId: string) => {
    try {
      const res = await fetch(`/api/estimates/${data.id}/guests/${guestId}`, {
        method: 'DELETE',
        credentials: 'include',
        headers: {
          'Content-Type': 'application/json',
        },
      })

      if (!res.ok) {
        throw new Error('Failed to remove guest')
      }

      // Add to removed guests list to update UI immediately
      setRemovedGuests(prev => [...prev, guestId])
    } catch (error) {
      console.error('Error removing guest:', error)
    }
  }

  // Update customer entitlement when subscription status changes
  useEffect(() => {
    const entitlement = getCustomerEntitlement(subscriptionStatus)
    setCustomerEntitlement(entitlement)
  }, [subscriptionStatus])

  // Update package selection when packages are loaded and duration is available
  useEffect(() => {
    if (packages.length > 0 && _bookingDuration > 0 && !selectedPackage) {
      // Find the best package based on duration and enabled status
      const enabledPackages = packages.filter(pkg => pkg.isEnabled)
      
      console.log('Available packages:', enabledPackages.map(pkg => ({
        name: pkg.name,
        minNights: pkg.minNights,
        maxNights: pkg.maxNights,
        revenueCatId: pkg.revenueCatId
      })))
      console.log('Booking duration:', _bookingDuration, 'nights')
      
      if (enabledPackages.length > 0) {
        // Find package that best matches the duration
        let bestPackage = enabledPackages.find(pkg => 
          _bookingDuration >= pkg.minNights && _bookingDuration <= pkg.maxNights
        )
        
        console.log('Exact match found:', bestPackage?.name)
        
        // If no exact match, find the package that can accommodate this duration
        // Prefer packages where maxNights >= duration (can handle the stay)
        if (!bestPackage) {
          const accommodatingPackages = enabledPackages.filter(pkg => 
            pkg.maxNights >= _bookingDuration || pkg.maxNights === 1 // Include per-night packages
          )
          
          if (accommodatingPackages.length > 0) {
            // Sort by how close the minNights is to the duration
            bestPackage = accommodatingPackages.reduce((best, current) => {
              const bestScore = Math.abs(best.minNights - _bookingDuration)
              const currentScore = Math.abs(current.minNights - _bookingDuration)
              return currentScore < bestScore ? current : best
            })
          } else {
            // Fallback to any enabled package
            bestPackage = enabledPackages[0]
          }
        }
        
        // If wine is selected and we have a hosted option, prefer that
        if (isWineSelected) {
          const hostedOption = enabledPackages.find(pkg => 
            pkg.category === 'hosted' || pkg.category === 'special'
          )
          if (hostedOption) {
            bestPackage = hostedOption
          }
        }
        
        setSelectedPackage(bestPackage || null)
        console.log('Auto-selected package:', bestPackage?.name, 'for duration:', _bookingDuration, 'nights')
        console.log('Package details:', {
          minNights: bestPackage?.minNights,
          maxNights: bestPackage?.maxNights,
          multiplier: bestPackage?.multiplier
        })
      }
    }
  }, [packages, _bookingDuration, isWineSelected, selectedPackage])

  useEffect(() => {
    if (typeof window === 'undefined') return

    const readStoredUsage = (): TokenUsageSummary | null => {
      try {
        const stored = window.localStorage.getItem('ai:lastTokenUsage')
        if (!stored) return null
        const parsed = JSON.parse(stored)
        if (!parsed || typeof parsed !== 'object') return null
        return parsed as TokenUsageSummary
      } catch (storageError) {
        console.warn('Failed to load stored AI token usage', storageError)
        return null
      }
    }

    const initialUsage = readStoredUsage()
    if (initialUsage) {
      setLatestTokenUsage(initialUsage)
    }

    const handleTokenUsage = (event: Event) => {
      const customEvent = event as CustomEvent<TokenUsageSummary>
      if (customEvent.detail) {
        setLatestTokenUsage(customEvent.detail)
      }
    }

    window.addEventListener('aiTokenUsage', handleTokenUsage as EventListener)

    return () => {
      window.removeEventListener('aiTokenUsage', handleTokenUsage as EventListener)
    }
  }, [])

  // Update package price when package or duration changes
  useEffect(() => {
    if (!selectedPackage) {
      setPackagePrice(null)
      setPackageTotal(null)
      return
    }

    const hasFixedPackageRate = Boolean(selectedPackage.baseRate && selectedPackage.baseRate > 0)

    if (hasFixedPackageRate) {
      // Use baseRate directly from Payload CMS (stored as-is, no conversion)
      // For fixed price packages, always use baseRate directly without division
      const packageBaseRate = selectedPackage.baseRate ?? 0
      
      // For fixed packages, price and total are both the baseRate
      setPackagePrice(packageBaseRate)
      setPackageTotal(packageBaseRate)
      return
    }

    const perNightRate = _postBaseRate * (selectedPackage.multiplier || 1)
    setPackagePrice(perNightRate)
    setPackageTotal(perNightRate * _bookingDuration)
  }, [selectedPackage, _postBaseRate, _bookingDuration])

  // Format price for display: use value directly from Payload CMS (stored in rands)
  const formatPrice = (price: number | null) => {
    if (price === null) return 'N/A'
    return `R${price.toFixed(2)}`
  }

  // Use values directly from Payload CMS (stored in rands)
  const bookingTotal = useMemo(() => {
    if (packageTotal !== null) {
      return packageTotal
    }
    if (packagePrice !== null) {
      return packagePrice * _bookingDuration
    }
    return _bookingTotal
  }, [packageTotal, packagePrice, _bookingDuration, _bookingTotal])

  const isFixedPricePackage = Boolean(selectedPackage?.baseRate && selectedPackage.baseRate > 0)
  const effectiveNightsForDisplay = isFixedPricePackage
    ? Math.max(
        _bookingDuration > 0
          ? _bookingDuration
          : selectedPackage?.minNights ?? selectedPackage?.maxNights ?? 1,
        1,
      )
    : _bookingDuration

  // Handle estimate completion
  const handleEstimate = async () => {
    if (!areDatesAvailable || !selectedPackage) return

    setPaymentLoading(true)
    setPaymentError(null)

    try {
      if (selectedPackage.revenueCatId === 'gathering_monthly' && customerEntitlement !== 'pro') {
        throw new Error('This package requires a pro subscription. Please upgrade your account.')
      }

      // If user has active subscription AND the selected package matches their subscription, create booking directly without payment
      if (isSubscribed && isPackageIncludedInSubscription) {
        const postId = typeof data?.post === 'string' ? data.post : data?.post?.id
        if (!postId || !user?.id) {
          throw new Error('Missing required information to create booking.')
        }

        const bookingData: any = {
          title: typeof data?.post === 'object' ? data.post.title : 'Booking',
          post: postId,
          fromDate: data.fromDate ? new Date(data.fromDate).toISOString() : undefined,
          toDate: data.toDate ? new Date(data.toDate).toISOString() : undefined,
          total: bookingTotal,
          paymentStatus: 'paid', // Mark as paid for subscribers
          customer: user.id,
          guests: Array.isArray((data as any)?.guests)
            ? (data as any).guests.map((g: any) => (typeof g === 'string' ? g : g?.id)).filter(Boolean)
            : [],
        }

        // Include package information
        // ALWAYS use package ID (not yocoId/revenueCatId) to avoid ambiguity
        if (selectedPackage) {
          bookingData.packageType = selectedPackage.id // Use package ID, not yocoId
          bookingData.selectedPackage = {
            package: selectedPackage.id,
            customName: selectedPackage.name,
            enabled: true,
          }
        }

        // If this is a reschedule, cancel the original booking first
        if (isReschedule && originalBooking?.id) {
          try {
            await fetch(`/api/bookings/${originalBooking.id}`, {
              method: 'PATCH',
              headers: {
                'Content-Type': 'application/json',
              },
              body: JSON.stringify({
                paymentStatus: 'cancelled', // Mark original booking as cancelled
                // Keep dates but mark as cancelled so unavailable-dates excludes it
              }),
            })
            console.log('✅ Original booking cancelled:', originalBooking.id)
          } catch (cancelError) {
            console.error('⚠️ Failed to cancel original booking:', cancelError)
            // Continue with new booking creation even if cancellation fails
          }
        }

        const bookingResponse = await fetch('/api/bookings', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(bookingData),
        })

        if (!bookingResponse.ok) {
          const errorData = await bookingResponse.json()
          throw new Error(errorData.error || 'Failed to create booking')
        }

        const booking = await bookingResponse.json()
        setPaymentSuccess(true)
        
        // Build redirect URL with reschedule information if applicable
        const redirectParams = new URLSearchParams({
          total: bookingTotal.toString(),
          duration: _bookingDuration.toString(),
          transactionId: `subscription-${Date.now()}`,
          success: 'true',
          estimateId: data.id,
          bookingId: booking.id,
        })
        
        // Add reschedule information if this is a reschedule
        if (isReschedule && originalBooking?.id) {
          redirectParams.set('isReschedule', 'true')
          if (originalBooking.fromDate) redirectParams.set('oldFromDate', new Date(originalBooking.fromDate).toISOString())
          if (originalBooking.toDate) redirectParams.set('oldToDate', new Date(originalBooking.toDate).toISOString())
          if (data.fromDate) redirectParams.set('newFromDate', new Date(data.fromDate).toISOString())
          if (data.toDate) redirectParams.set('newToDate', new Date(data.toDate).toISOString())
        }
        
        // Redirect to booking confirmation page
        router.push(`/booking-confirmation?${redirectParams.toString()}`)
        return
      }

      // For non-subscribers, proceed with normal payment flow
      const metadata = {
        estimateId: data.id,
        postId: _postId,
        duration: _bookingDuration,
        startDate: data.fromDate ? new Date(data.fromDate).toISOString() : undefined,
        endDate: data.toDate ? new Date(data.toDate).toISOString() : undefined,
      }

      console.log('[Estimate Page] Creating payment link:', {
        selectedPackage: {
          id: selectedPackage.id,
          name: selectedPackage.name,
          baseRate: selectedPackage.baseRate,
          yocoId: selectedPackage.yocoId,
          revenueCatId: selectedPackage.revenueCatId,
        },
        bookingTotal,
        packageTotal,
        packagePrice,
        _bookingTotal
      })
      
      const paymentLink = await createPaymentLinkFromDatabase?.(
        {
          id: selectedPackage.id,
          name: selectedPackage.name,
          description: selectedPackage.description,
          baseRate: selectedPackage.baseRate,
          revenueCatId: selectedPackage.revenueCatId,
        },
        user?.name || 'Guest',
        bookingTotal,
        metadata,
      )

      if (!paymentLink) {
        throw new Error('Failed to create payment link. Please try again.')
      }

      setPaymentSuccess(true)
      window.location.href = paymentLink.url
    } catch (err) {
      console.error('❌ Payment Error:', err)
      setPaymentError(err instanceof Error ? err.message : 'An unknown error occurred')
    } finally {
      setPaymentLoading(false)
    }
  }

  if (!data) {
    return <div className="container py-16">Estimate not found</div>
  }

  const post = typeof data?.post === 'object' ? data.post : null
  const postSlug = post?.slug
  const postTitle = post?.title || 'Property'
  const postImage = post?.meta?.image
  const allGuests = data?.guests || []
  const guestCount = Array.isArray(allGuests) ? allGuests.length : 0
  const onlineCount = guestCount // Mock online count - can be enhanced with real data

  // Prepare estimate data for Meta Ads tracking
  const estimateForAds = data ? {
    id: data.id,
    total: _bookingTotal,
    title: typeof data.post === 'object' ? data.post?.title : data.title || undefined,
    post: typeof data.post === 'object' ? {
      id: data.post.id,
      title: data.post.title || undefined,
      slug: (data.post.slug ?? undefined) as string | undefined,
      meta: data.post.meta ? {
        image: data.post.meta.image ? {
          url: (typeof data.post.meta.image === 'object' ? (data.post.meta.image.url ?? undefined) : undefined) as string | undefined,
        } : undefined,
      } : undefined,
    } : typeof data.post === 'string' ? data.post : undefined,
    packageType: (data as any).packageType || undefined,
  } : null

  return (
    <div className="min-h-screen bg-background">
      {/* Meta Ads tracking for estimate views */}
      <EstimateAds estimate={estimateForAds} />
      <div className="mx-auto max-w-2xl">
        {/* Secure Estimate Banner */}
        <div className="bg-primary/10 border-b border-primary/20 px-6 py-3 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Lock className="h-4 w-4 text-primary" />
            <span className="text-sm font-medium text-foreground">Invite someone to share booking</span>
          </div>
          <Button
            variant="ghost"
            size="sm"
            onClick={handleShare}
            className="h-8 gap-2"
          >
            <Share2 className="h-4 w-4" />
            <span>Share</span>
          </Button>
        </div>

        {/* Main Content */}
        <div className="bg-white dark:bg-card rounded-lg shadow-sm border border-border -mt-px">
          <Tabs value={currentTab} onValueChange={handleTabChange} className="w-full">
            <div className="px-6 pt-4 border-b border-border">
              <TabsList className="bg-transparent p-0 h-auto">
                <TabsTrigger value="details" className="data-[state=active]:bg-transparent data-[state=active]:border-b-2 data-[state=active]:border-primary rounded-none">
                  <FileText className="h-4 w-4 mr-2" />
                  <span>Details</span>
                </TabsTrigger>
                <TabsTrigger value="guests" className="data-[state=active]:bg-transparent data-[state=active]:border-b-2 data-[state=active]:border-primary rounded-none">
                  <UserIcon className="h-4 w-4 mr-2" />
                  <span>Guests</span>
                </TabsTrigger>
              </TabsList>
            </div>
            <TabsContent value="details" className="mt-0">
              <div className="p-6 space-y-6">
                {/* Property Header */}
                {postImage && (
                  <div className="relative w-full h-64 rounded-lg overflow-hidden -mx-6 -mt-6 mb-6">
                    <Media
                      resource={postImage}
                      className="w-full h-full object-cover"
                      postId={post?.id}
                      postTitle={postTitle}
                    />
                  </div>
                )}
                
                <div className="space-y-2">
                  <h1 className="text-2xl font-bold">{postTitle}</h1>
                </div>

                {/* Booking Period */}
                <div className="grid grid-cols-2 gap-4 pt-4 border-t border-border">
                  <div>
                    <p className="text-xs text-muted-foreground mb-1">Check-in</p>
                    <p className="font-medium text-sm">
                      {data.fromDate && data.toDate
                        ? `${format(new Date(data.fromDate), 'MMM dd')} - ${format(new Date(data.toDate), 'MMM dd')}`
                        : 'Not set'}
                    </p>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground mb-1">Duration</p>
                    <p className="font-medium text-sm">{_bookingDuration} {_bookingDuration === 1 ? 'night' : 'nights'}</p>
                  </div>
                </div>

                {/* Package Details */}
                {selectedPackage && (
                  <div className="pt-4 border-t border-border space-y-4">
                    <div className="flex items-center justify-between">
                      <h3 className="text-sm font-semibold">Package Details</h3>
                      <Badge variant="secondary" className="text-xs">Selected</Badge>
                    </div>
                    
                    <div>
                      <h4 className="font-medium mb-1">{selectedPackage.name}</h4>
                      {selectedPackage.description && (
                        <p className="text-sm text-muted-foreground">{selectedPackage.description}</p>
                      )}
                    </div>

                    <ul className="space-y-2">
                      {selectedPackage.features.slice(0, 3).map((f, idx) => (
                        <li key={idx} className="flex items-center text-sm gap-2">
                          <Check className="h-4 w-4 text-primary flex-shrink-0" />
                          <span>{f.feature}</span>
                        </li>
                      ))}
                    </ul>

                    <div className="pt-4 border-t border-border">
                      <div className="flex items-center justify-between mb-2">
                        <p className="text-sm text-muted-foreground">Total Estimate</p>
                        <p className="text-lg font-bold">{formatPrice(bookingTotal)}</p>
                      </div>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="w-full justify-between text-xs"
                        onClick={() => {
                          // Scroll to package selection section
                          document.getElementById('package-selection')?.scrollIntoView({ behavior: 'smooth' })
                        }}
                      >
                        <span>View breakdown</span>
                        <ChevronRight className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                )}

                {/* Recent Activity */}
                <div className="pt-4 border-t border-border space-y-3">
                  <h3 className="text-sm font-semibold">Recent Activity</h3>
                  <div className="space-y-3 max-h-48 overflow-y-auto">
                    {activity.length > 0 ? (
                      activity
                        .slice()
                        .reverse()
                        .slice(0, 5)
                        .map((entry: any, index: number) => {
                          const entryDate = entry.timestamp ? new Date(entry.timestamp) : new Date()
                          const timeAgo = formatDistanceToNow(entryDate, { addSuffix: true })
                          
                          const userEmail = typeof entry.user === 'object' ? entry.user?.email : null
                          const userName = entry.userName || (typeof entry.user === 'object' ? entry.user?.name : 'User')
                          
                          return (
                            <div key={`${entry.timestamp}-${index}`} className="space-y-1 rounded-md border border-dashed p-2">
                              <div className="flex items-center justify-between gap-2">
                                <div className="flex items-center gap-2">
                                  <Gravatar
                                    email={userEmail}
                                    size={24}
                                    alt={userName}
                                    className="h-6 w-6 rounded-full object-cover flex-shrink-0 border border-border"
                                    fallback={
                                      <div className="h-6 w-6 rounded-full bg-muted flex items-center justify-center flex-shrink-0">
                                        <UserIcon className="h-3 w-3 text-muted-foreground" />
                                      </div>
                                    }
                                  />
                                  <span className="text-[0.68rem] uppercase tracking-wide text-muted-foreground">
                                    {userName}
                                    {entry.type === 'comment' && ' commented'}
                                    {entry.type === 'viewed' && ' viewed'}
                                    {entry.type === 'declined' && ' declined'}
                                    {entry.type === 'approved' && ' approved'}
                                  </span>
                                </div>
                                <span className="flex items-center gap-1 text-[0.68rem] uppercase tracking-wide text-muted-foreground">
                                  <Clock className="h-3 w-3" />
                                  {timeAgo}
                                </span>
                              </div>
                              {entry.content && (
                                <p className="whitespace-pre-wrap leading-snug text-sm text-foreground pl-8">
                                  {entry.content}
                                </p>
                              )}
                            </div>
                          )
                        })
                    ) : (
                      <div className="rounded-md border border-dashed p-4 text-center text-xs text-muted-foreground">
                        No activity yet. Add a comment to get started.
                      </div>
                    )}
                  </div>
                  <Button 
                    variant="outline" 
                    size="sm" 
                    className="w-full gap-2"
                    onClick={() => setCommentDialogOpen(true)}
                  >
                    <MessageCircle className="h-4 w-4" />
                    <span>Add Comment</span>
                  </Button>
                </div>

                {/* Payment Error Display */}
                {paymentError && (
                  <div className="pt-4 border-t border-border">
                    <div className="p-3 text-sm text-destructive bg-destructive/10 rounded-md">
                      {paymentError}
                    </div>
                  </div>
                )}

                {/* Action Buttons */}
                <div className="pt-4 border-t border-border flex gap-3">
                  <Button
                    variant="outline"
                    className="flex-1"
                    onClick={handleDecline}
                  >
                    Decline
                  </Button>
                  <Button
                    onClick={handleEstimate}
                    className="flex-1 bg-primary text-primary-foreground hover:bg-primary/90"
                    disabled={
                      paymentLoading || paymentSuccess || !_postId || !selectedPackage || !areDatesAvailable || isSubscriptionLoading
                    }
                  >
                    {paymentLoading ? (
                      <>
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        {isSubscribed ? 'Creating Booking...' : 'Processing...'}
                      </>
                    ) : paymentSuccess ? (
                      'Estimate Confirmed!'
                    ) : !_postId ? (
                      'Missing Property Information'
                    ) : !selectedPackage ? (
                      'Please Select a Package'
                    ) : !areDatesAvailable ? (
                      'Dates Not Available'
                    ) : isSubscriptionLoading ? (
                      'Checking Subscription...'
                    ) : isSubscribed && isPackageIncludedInSubscription ? (
                      'Approve Estimate (Included)'
                    ) : (
                      'Approve Estimate'
                    )}
                  </Button>
                </div>
              </div>

              {/* Package Selection Section */}
              <div id="package-selection" className="px-6 pb-6 border-t border-border pt-6">
              <div className="space-y-4">
                <h2 className="text-xl font-semibold">
                  Available Packages 
                  <span className="text-sm text-muted-foreground font-normal ml-2">
                    ({_bookingDuration} {_bookingDuration === 1 ? 'night' : 'nights'})
                  </span>
                </h2>
                
                {/* Package Selection */}
              <div className="grid grid-cols-1 gap-4">
                {loading ? (
                  <div>Loading packages...</div>
                ) : error ? (
                  <div>Error loading packages.</div>
                ) : !packages.length ? (
                  <div>No packages available for this post.</div>
                ) : (
                  <div className="grid grid-cols-1 gap-4">
                    {packages
                      .filter(pkg => pkg.isEnabled)
                      .sort((a, b) => {
                        // Sort packages by how well they match the duration
                        const aDurationMatch = _bookingDuration >= a.minNights && _bookingDuration <= a.maxNights
                        const bDurationMatch = _bookingDuration >= b.minNights && _bookingDuration <= b.maxNights
                        
                        if (aDurationMatch && !bDurationMatch) return -1
                        if (!aDurationMatch && bDurationMatch) return 1
                        
                        // If both match or both don't match, sort by minNights closest to duration
                        const aDistance = Math.abs(a.minNights - _bookingDuration)
                        const bDistance = Math.abs(b.minNights - _bookingDuration)
                        return aDistance - bDistance
                      })
                      .map((pkg) => {
                        const isDurationMatch = _bookingDuration >= pkg.minNights && _bookingDuration <= pkg.maxNights
                        const canAccommodate = pkg.maxNights >= _bookingDuration || pkg.maxNights === 1
                        
                        // Calculate per-night rate for this package
                        const hasFixedPackageRate = Boolean(pkg.baseRate && pkg.baseRate > 0)
                        const effectiveDuration = _bookingDuration > 0 
                          ? _bookingDuration 
                          : Math.max(pkg.minNights ?? pkg.maxNights ?? 1, 1)
                        
                        // Check if this is an hourly package (minNights < 1 indicates hourly/half-day)
                        const isHourlyPackage = pkg.minNights !== null && pkg.minNights !== undefined && pkg.minNights < 1
                        
                        // Use baseRate directly from Payload CMS (no conversion)
                        const packageBaseRate = hasFixedPackageRate 
                          ? (pkg.baseRate ?? 0)
                          : null
                        
                        // For fixed price packages, use baseRate directly (no division)
                        // For multiplier-based packages, calculate per-night rate
                        const perNightRate = hasFixedPackageRate && packageBaseRate !== null
                          ? packageBaseRate // Use baseRate directly for fixed packages
                          : _postBaseRate * (pkg.multiplier || 1)
                        
                        // Calculate total for this package
                        // For fixed packages, total is the baseRate (no multiplication)
                        // For multiplier packages, multiply by duration
                        const packageTotal = hasFixedPackageRate && packageBaseRate !== null
                          ? packageBaseRate // Fixed packages: total = baseRate
                          : perNightRate * effectiveDuration // Multiplier packages: total = rate * duration
                        
                        return (
                          <Card
                            key={pkg.id}
                            className={cn(
                              'cursor-pointer transition-all',
                              selectedPackage?.id === pkg.id
                                ? 'border-primary bg-primary/5'
                                : isDurationMatch
                                ? 'border-green-500/50 hover:border-green-500'
                                : canAccommodate
                                ? 'border-amber-500/50 hover:border-amber-500'
                                : 'border-border hover:border-primary/50'
                            )}
                            onClick={() => setSelectedPackage(pkg)}
                          >
                            <CardHeader>
                              <div className="flex justify-between items-start">
                                <div className="flex-1">
                                  <div className="flex items-center gap-2 mb-1">
                                    <CardTitle>{pkg.name}</CardTitle>
                                    {isDurationMatch && (
                                      <span className="text-xs bg-green-500/10 text-green-700 px-2 py-1 rounded-full">
                                        Perfect Match
                                      </span>
                                    )}
                                    {!isDurationMatch && canAccommodate && (
                                      <span className="text-xs bg-amber-500/10 text-amber-700 px-2 py-1 rounded-full">
                                        Can Accommodate
                                      </span>
                                    )}
                                  </div>
                                  <CardDescription>{pkg.description}</CardDescription>
                                  <div className="text-xs text-muted-foreground mt-1">
                                    Duration: {isHourlyPackage
                                      ? 'hourly'
                                      : pkg.minNights === pkg.maxNights 
                                      ? `${pkg.minNights} ${pkg.minNights === 1 ? 'night' : 'nights'}`
                                      : `${pkg.minNights}-${pkg.maxNights} nights`
                                    }
                                  </div>
                                </div>
                                <div className="text-right">
                                  <div className="text-lg font-bold">
                                    {formatPrice(packageTotal)}
                                  </div>
                                  {pkg.baseRate && pkg.baseRate > 0 && pkg.multiplier !== 1 && (
                                    <div className="text-xs text-muted-foreground">
                                      {pkg.multiplier > 1
                                        ? `+${((pkg.multiplier - 1) * 100).toFixed(0)}% rate`
                                        : `-${((1 - pkg.multiplier) * 100).toFixed(0)}% rate`}
                                    </div>
                                  )}
                                </div>
                              </div>
                            </CardHeader>
                            <CardContent>
                              <ul className="space-y-2">
                                {pkg.features.map((f, idx) => (
                                  <li key={idx} className="flex items-center text-sm">
                                    <Check className="mr-2 h-4 w-4 text-primary" />
                                    {f.feature}
                                  </li>
                                ))}
                              </ul>
                            </CardContent>
                            {selectedPackage?.id === pkg.id && (
                              <CardFooter>
                                <span className="text-2xl font-bold text-primary">
                                  Total: {formatPrice(packageTotal)}
                                </span>
                              </CardFooter>
                            )}
                          </Card>
                        )
                      })}
                  </div>
                )}
              </div>
            </div>
            </div>
            </TabsContent>

          <TabsContent value="guests" className="mt-0">
            <div className="p-6 space-y-6">
              {/* Shared with Section */}
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <h2 className="text-sm font-semibold">Shared with</h2>
                  <span className="text-xs text-muted-foreground">{onlineCount} online</span>
                </div>

                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <div className="flex -space-x-2">
                      {/* Customer Avatar */}
                      <Gravatar
                        email={typeof data.customer === 'object' ? data.customer?.email : null}
                        size={40}
                        alt={typeof data.customer === 'string' ? 'Customer' : data.customer?.name || 'Customer'}
                        className="h-10 w-10 rounded-full border-2 border-background object-cover"
                        fallback={
                          <div className="h-10 w-10 rounded-full border-2 border-background bg-muted flex items-center justify-center">
                            <UserIcon className="h-5 w-5 text-muted-foreground" />
                          </div>
                        }
                      />

                      {/* Guest Avatars */}
                      {allGuests
                        .filter((guest) =>
                          typeof guest === 'string'
                            ? !removedGuests.includes(guest)
                            : !removedGuests.includes(guest.id),
                        )
                        .slice(0, 3)
                        .map((guest) => {
                          if (typeof guest === 'string') return null
                          return (
                            <Gravatar
                              key={guest.id}
                              email={guest.email}
                              size={40}
                              alt={guest.name || 'Guest'}
                              className="h-10 w-10 rounded-full border-2 border-background object-cover"
                              fallback={
                                <div className="h-10 w-10 rounded-full border-2 border-background bg-muted flex items-center justify-center">
                                  <UserIcon className="h-5 w-5 text-muted-foreground" />
                                </div>
                              }
                            />
                          )
                        })}

                      {/* More guests indicator */}
                      {guestCount > 3 && (
                        <div className="h-10 w-10 rounded-full border-2 border-background bg-muted flex items-center justify-center text-xs font-medium">
                          +{guestCount - 3}
                        </div>
                      )}
                    </div>
                  </div>

                  {data &&
                    'customer' in data &&
                    typeof data?.customer !== 'string' &&
                    data.customer?.id === user.id && (
                      <InviteUrlDialog
                        trigger={
                          <Button variant="outline" size="sm" className="gap-2">
                            <PlusCircleIcon className="h-4 w-4" />
                            <span>Invite</span>
                          </Button>
                        }
                        estimateId={data.id}
                        type="estimates"
                      />
                    )}
                </div>

                {/* Share Link Section */}
                {shareLink && (
                  <div className="flex items-center gap-2 p-3 bg-muted/50 rounded-lg">
                    <span className="text-xs text-muted-foreground flex-1 truncate font-mono">
                      {shareLink.replace(window.location.origin, '').substring(0, 30)}...
                    </span>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={copyShareLink}
                      className="h-8 gap-2"
                    >
                      <Copy className="h-3 w-3" />
                      <span className="text-xs">{shareLinkCopied ? 'Copied!' : 'Copy'}</span>
                    </Button>
                  </div>
                )}
              </div>

              <div className="space-y-3 pt-4 border-t border-border">
                <div className="shadow-sm p-2 border border-border rounded-lg flex items-center gap-2">
                  <Gravatar
                    email={typeof data.customer === 'object' ? data.customer?.email : null}
                    size={40}
                    alt={typeof data.customer === 'string' ? 'Customer' : data.customer?.name || 'Customer'}
                    className="h-10 w-10 rounded-full object-cover border border-border"
                    fallback={
                      <div className="p-2 border border-border rounded-full">
                        <UserIcon className="size-6" />
                      </div>
                    }
                  />
                  <div>
                    <div>{typeof data.customer === 'string' ? 'Customer' : data.customer?.name}</div>
                    <div className="font-medium text-sm">Customer</div>
                  </div>
                </div>
                {data.guests
                  ?.filter((guest) =>
                    typeof guest === 'string'
                      ? !removedGuests.includes(guest)
                      : !removedGuests.includes(guest.id),
                  )
                  ?.map((guest) => {
                    if (typeof guest === 'string') {
                      return <div key={guest}>{guest}</div>
                    }
                    return (
                      <div
                        key={guest.id}
                        className="shadow-sm p-2 border border-border rounded-lg flex items-center gap-2 justify-between"
                      >
                        <div className="flex items-center gap-2">
                          <Gravatar
                            email={guest.email}
                            size={40}
                            alt={guest.name || 'Guest'}
                            className="h-10 w-10 rounded-full object-cover border border-border"
                            fallback={
                              <div className="p-2 border border-border rounded-full">
                                <UserIcon className="size-6" />
                              </div>
                            }
                          />
                          <div>
                            <div>{guest.name}</div>
                            <div className="font-medium text-sm">Guest</div>
                          </div>
                        </div>
                        {data &&
                          'customer' in data &&
                          typeof data?.customer !== 'string' &&
                          data.customer?.id === user.id && (
                            <Button
                              variant="secondary"
                              size="icon"
                              onClick={() => removeGuestHandler(guest.id)}
                            >
                              <TrashIcon className="size-4" />
                              <span className="sr-only">Remove Guest</span>
                            </Button>
                          )}
                      </div>
                    )
                  })}
              </div>
            </div>
          </TabsContent>
        </Tabs>
        </div>
        
        {/* Set estimate context for AI Assistant */}
        {data && (
          <script
            dangerouslySetInnerHTML={{
              __html: `
                window.addEventListener('load', function() {
                  const context = ${JSON.stringify({
                    context: 'estimate-details',
                    estimate: {
                      id: data.id,
                      fromDate: data.fromDate,
                      toDate: data.toDate,
                      total: data.total,
                    },
                    post: typeof data.post === 'object' ? {
                      id: data.post.id,
                      title: data.post.title,
                      slug: data.post.slug,
                    } : null,
                  })};
                  window.estimateContext = context;
                });
              `
            }}
          />
        )}
      </div>

      {/* Comment Dialog */}
      <Dialog open={commentDialogOpen} onOpenChange={setCommentDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add Comment</DialogTitle>
            <DialogDescription>
              Share your thoughts or questions about this estimate
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <Textarea
              placeholder="Enter your comment..."
              value={commentText}
              onChange={(e) => setCommentText(e.target.value)}
              rows={4}
              className="resize-none"
            />
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setCommentDialogOpen(false)
                setCommentText('')
              }}
            >
              Cancel
            </Button>
            <Button
              onClick={handleAddComment}
              disabled={!commentText.trim() || isSubmittingComment}
            >
              {isSubmittingComment ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Adding...
                </>
              ) : (
                'Add Comment'
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
