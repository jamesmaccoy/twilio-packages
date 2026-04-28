'use client'

import type { Booking, User } from '@/payload-types'
import { formatDateTime } from '@/utilities/formatDateTime'
import {
  PlusCircleIcon,
  TrashIcon,
  UserIcon,
  FileText,
  Lock,
  Package,
  Calendar as CalendarIcon,
  Sparkles,
  Share2,
  MapPin,
  Clock,
  Users,
  Phone,
  Mail,
  Navigation,
  Download,
  Check,
  Star,
  ExternalLink,
  QrCode,
  Home,
  CreditCard,
  Shield,
  MessageCircle,
} from 'lucide-react'
import React, { useCallback, useEffect, useState } from 'react'
import InviteUrlDialog from './_components/invite-url-dialog'
import SimplePageRenderer from './_components/SimplePageRenderer'
import { Button } from '@/components/ui/button'
import { useYoco } from '@/providers/Yoco'
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs'
import { Calendar } from '@/components/ui/calendar'
import { AIAssistant } from '@/components/AIAssistant/AIAssistant'
import { format } from 'date-fns'
import { useRouter } from 'next/navigation'
import { calculateTotal } from '@/lib/calculateTotal'
import { PackageDisplay } from '@/components/PackageDisplay'
import { BookingInfoCard } from '@/components/BookingInfoCard'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import BookingSidebar from './_components/BookingSidebar'
import { getGravatarUrl } from '@/utils/gravatar'
import { Gravatar } from '@/components/Gravatar'
import { Media } from '@/components/Media'
import { QRCodeSVG } from 'qrcode.react'
import {
  Carousel,
  CarouselContent,
  CarouselItem,
  CarouselNext,
  CarouselPrevious,
} from '@/components/ui/carousel'

type Props = {
  data: Booking
  user: User
  isPreview?: boolean
}

interface AddonPackage {
  id: string
  name: string
  originalName: string
  description?: string
  multiplier: number
  category: string
  minNights: number
  maxNights: number
  revenueCatId: string
  baseRate?: number
  isEnabled: boolean
  features: any[]
  relatedPage?: any
  source: string
  hasCustomName: boolean
}

// Helper to format and convert price (kept for potential future use)
function formatPriceWithUSD(product: any) {
  const price = product.price
  const priceString = product.priceString
  const currency = product.currencyCode || 'ZAR'
  if (typeof price !== 'number') return 'N/A'
  if (currency === 'USD') return `$${price.toFixed(2)}`
  const usd = price / 18
  return `${priceString || `R${price.toFixed(2)}`} / $${usd.toFixed(2)}`
}

// Helper to generate calendar ICS file and download/resend
const handleAddToCalendar = async (booking: Booking) => {
  try {
    const bookingId = booking.id
    // Use the customer-based calendar endpoint
    const customerId = typeof booking.customer === 'object' && booking.customer ? booking.customer.id : (typeof booking.customer === 'string' ? booking.customer : null)
    if (customerId) {
      const calendarUrl = `/api/bookings/calendar.ics?customerId=${customerId}`
      // Open calendar link (browsers will handle .ics files)
      window.open(calendarUrl, '_blank')
    }
  } catch (error) {
    console.error('Error adding to calendar:', error)
  }
}

// Helper to get QR code URL (house manual page)
const getQRCodeUrl = (booking: Booking) => {
  // Link to house manual page
  return 'https://www.simpleplek.co.za/house-manual'
}

export default function BookingDetailsClientPage({ data, user, isPreview }: Props) {
  const [removedGuests, setRemovedGuests] = React.useState<string[]>([])
  const router = useRouter()
  const previewMode = Boolean(isPreview)

  const [addonPackages, setAddonPackages] = useState<AddonPackage[]>([])
  const [loadingAddons, setLoadingAddons] = useState(true)
  const [paymentLoading, setPaymentLoading] = useState(false)
  const [paymentError, setPaymentError] = useState<string | null>(null)
  const [paymentSuccess, setPaymentSuccess] = useState(false)
  const { isInitialized, createPaymentLinkFromDatabase } = useYoco()
  const [currentAddonId, setCurrentAddonId] = useState<string | null>(null)

  const [relatedPages, setRelatedPages] = useState<any[]>([])
  const [loadingPages, setLoadingPages] = useState(true)

  const [availablePackages, setAvailablePackages] = useState<any[]>([])

  const [isSubmittingEstimate, setIsSubmittingEstimate] = useState(false)
  const [estimateError, setEstimateError] = useState<string | null>(null)
  const [assistantHistory, setAssistantHistory] = useState<
    {
      role: 'user' | 'assistant'
      content: string
      timestamp: number
      threadId: number
    }[]
  >([])
  const historyKey = React.useMemo(() => (data?.id ? `ai:bookingHistory:${data.id}` : null), [data?.id])

  // Preview banner (admin-only tooling) – keep it simple & non-invasive.
  // In preview mode we intentionally disable mutating actions.
  const PreviewBanner = previewMode ? (
    <div className="mb-4 rounded-lg border border-dashed border-amber-300 bg-amber-50 px-4 py-3 text-sm text-amber-900 dark:border-amber-800/60 dark:bg-amber-950/30 dark:text-amber-100">
      You are viewing this booking in <strong>Preview as customer</strong> mode. Actions like payments, guest changes,
      and edits are disabled.
    </div>
  ) : null


  useEffect(() => {
    if (typeof window === 'undefined' || !historyKey) return

    try {
      const stored: any[] = JSON.parse(window.localStorage.getItem(historyKey) ?? '[]')
      if (Array.isArray(stored)) {
        setAssistantHistory(stored)
      } else {
        setAssistantHistory([])
      }
    } catch {
      setAssistantHistory([])
    }

    const handler = (event: Event) => {
      const detail = (event as CustomEvent)?.detail
      if (detail?.key === historyKey && Array.isArray(detail?.history)) {
        setAssistantHistory(detail.history)
      }
    }

    window.addEventListener('aiHistoryUpdate', handler as EventListener)
    return () => {
      window.removeEventListener('aiHistoryUpdate', handler as EventListener)
    }
  }, [historyKey])

  const clearAssistantHistory = useCallback(() => {
    if (typeof window === 'undefined' || !historyKey) return
    window.localStorage.removeItem(historyKey)
    const empty: any[] = []
    setAssistantHistory(empty)
    window.dispatchEvent(new CustomEvent('aiHistoryUpdate', { detail: { key: historyKey, history: empty } }))
  }, [historyKey])

  useEffect(() => {
    if (!loadingAddons) {
      setLoadingPages(false)
    }
  }, [loadingAddons])

  const removeGuestHandler = async (guestId: string) => {
    if (previewMode) return
    const res = await fetch(`/api/bookings/${data.id}/guests/${guestId}`, {
      method: 'DELETE',
      credentials: 'include',
      headers: {
        'Content-Type': 'application/json',
      },
    })

    if (!res.ok) {
      console.error('Error removing guest:', res.statusText)
      return
    }

    setRemovedGuests((prev) => [...prev, guestId])
  }

  const getBookingContext = React.useCallback(() => {
    const booking = data
    const post = typeof booking?.post === 'string' ? null : booking?.post

    return {
      context: 'booking-details',
      booking: {
        id: booking?.id,
        title: booking?.title,
        fromDate: booking?.fromDate,
        toDate: booking?.toDate,
        paymentStatus: booking?.paymentStatus,
        createdAt: booking?.createdAt,
      },
      property: post
        ? {
          id: post.id,
          title: post.title,
          description: post.meta?.description || '',
          content: post.content,
          baseRate: post.baseRate,
          relatedPosts: post.relatedPosts || [],
          categories: Array.isArray(post.categories)
            ? post.categories.map((c: any) => typeof c === 'object' ? c : c)
            : [],
        }
        : null,
      guests: {
        customer:
          typeof booking?.customer === 'string'
            ? null
            : {
              id: booking?.customer?.id,
              name: booking?.customer?.name,
              email: booking?.customer?.email,
            },
        guests:
          booking?.guests
            ?.filter((guest) => typeof guest !== 'string')
            .map((guest) => ({
              id: guest.id,
              name: guest.name,
              email: guest.email,
            })) || [],
      },
      addons: addonPackages.map((addon) => ({
        id: addon.id,
        name: addon.name,
        description: addon.description,
        price: (addon.baseRate || 0) * addon.multiplier,
        features: addon.features,
      })),
      checkinInfo: relatedPages.map((page) => ({
        id: page.id,
        title: page.title,
        packageName: page.packageName,
        content: page.layout,
      })),
    }
  }, [addonPackages, data, relatedPages])

  const bookingContext = React.useMemo(() => getBookingContext(), [getBookingContext])
  const bookingContextJson = React.useMemo(() => JSON.stringify(bookingContext ?? {}), [bookingContext])

  const handleAskAssistant = useCallback(() => {
    if (typeof window === 'undefined') return
    window.dispatchEvent(
      new CustomEvent('openAIAssistant', {
        detail: bookingContext,
      }),
    )
  }, [bookingContext])

  const handleScrollToAddons = useCallback(() => {
    const target = document.getElementById('booking-addons')
    if (target) {
      target.scrollIntoView({ behavior: 'smooth', block: 'start' })
    }
  }, [])

  const handleAddonPurchase = useCallback(
    async (addon: AddonPackage) => {
      if (!createPaymentLinkFromDatabase) {
        setPaymentError('Payments are not available right now. Please try again later.')
        return
      }

      const postId = typeof data?.post === 'string' ? data.post : data?.post?.id
      if (!postId) {
        setPaymentError('Missing property information for this add-on.')
        return
      }

      const baseRate = Number(addon.baseRate ?? 0)
      const multiplier = Number(addon.multiplier ?? 1)
      const total = Number((baseRate * multiplier).toFixed(2))

      if (!total || total <= 0) {
        setPaymentError('This add-on is not available for online purchase yet.')
        return
      }

      setPaymentLoading(true)
      setPaymentSuccess(false)
      setPaymentError(null)
      setCurrentAddonId(addon.id)

      try {
        const paymentLink = await createPaymentLinkFromDatabase(
          {
            id: addon.id,
            name: addon.name,
            description: addon.description,
            baseRate: addon.baseRate,
            revenueCatId: addon.revenueCatId,
          },
          user?.name || user?.email || 'Guest',
          total,
          {
            postId,
            bookingId: data.id, // Link addon transaction to this booking
            intent: 'product',
          },
        )

        if (!paymentLink?.url) {
          throw new Error('Failed to create payment link')
        }

        setPaymentSuccess(true)
        window.location.href = paymentLink.url
      } catch (error) {
        console.error('Failed to purchase add-on:', error)
        setPaymentError(error instanceof Error ? error.message : 'Failed to create payment link. Please try again.')
      } finally {
        setPaymentLoading(false)
        setCurrentAddonId(null)
      }
    },
    [createPaymentLinkFromDatabase, data?.post, user?.email, user?.name],
  )

  const packageSnapshot = React.useMemo(() => {
    const selectedPackage = data?.selectedPackage
    const packageTypeCode = data?.packageType?.toString().trim() || null

    let resolvedPackage: any =
      selectedPackage && typeof selectedPackage.package === 'object'
        ? selectedPackage.package
        : null

    let resolvedPackageId: string | null = null

    if (selectedPackage) {
      if (typeof selectedPackage.package === 'string') {
        resolvedPackageId = selectedPackage.package
      } else if (typeof selectedPackage.package === 'object' && selectedPackage.package?.id) {
        resolvedPackageId = selectedPackage.package.id
      }
    }

    if (!resolvedPackage && resolvedPackageId) {
      resolvedPackage =
        availablePackages.find(
          (pkg) =>
            pkg.id === resolvedPackageId ||
            pkg.yocoId === resolvedPackageId ||
            pkg.revenueCatId === resolvedPackageId,
        ) || null
    }

    if (!resolvedPackage && packageTypeCode) {
      const code = packageTypeCode.toLowerCase()
      const matchedPackage = availablePackages.find((pkg: any) => {
        const idMatch = pkg?.id?.toString().toLowerCase() === code
        const yocoMatch = pkg?.yocoId?.toString().toLowerCase() === code
        const revenueCatMatch = pkg?.revenueCatId?.toString().toLowerCase() === code
        return idMatch || yocoMatch || revenueCatMatch
      })

      if (matchedPackage) {
        resolvedPackage = matchedPackage
        resolvedPackageId = matchedPackage.id
      } else {
        resolvedPackageId = resolvedPackageId ?? packageTypeCode
      }
    }

    const fallbackBaseRate =
      typeof data?.post === 'object' && data?.post?.baseRate
        ? Number(data.post.baseRate)
        : 150

    const resolvedBaseRateRaw = resolvedPackage?.baseRate
    const resolvedBaseRate =
      resolvedBaseRateRaw !== undefined && !isNaN(Number(resolvedBaseRateRaw))
        ? Number(resolvedBaseRateRaw)
        : fallbackBaseRate

    const selectedPackageMultiplier = selectedPackage ? (selectedPackage as any).multiplier : undefined
    const resolvedMultiplier =
      selectedPackageMultiplier !== undefined && !isNaN(Number(selectedPackageMultiplier))
        ? Number(selectedPackageMultiplier)
        : resolvedPackage && (resolvedPackage as any).multiplier !== undefined && !isNaN(Number((resolvedPackage as any).multiplier))
          ? Number((resolvedPackage as any).multiplier)
          : 1

    const resolvedName =
      selectedPackage?.customName ||
      resolvedPackage?.name ||
      (packageTypeCode ? packageTypeCode.replace(/[-_]/g, ' ') : undefined)

    const resolvedDescription = resolvedPackage?.description ?? null
    const resolvedCategory = resolvedPackage?.category ?? null
    const resolvedMinNights =
      resolvedPackage?.minNights !== undefined ? Number(resolvedPackage.minNights) : null
    const resolvedMaxNights =
      resolvedPackage?.maxNights !== undefined ? Number(resolvedPackage.maxNights) : null

    const resolvedFeatures = Array.isArray(resolvedPackage?.features)
      ? resolvedPackage.features
        .map((feature: any) => {
          if (!feature) return null
          if (typeof feature === 'string') return feature
          if (typeof feature === 'object') {
            if (typeof feature.label === 'string') return feature.label
            if (typeof feature.feature === 'string') return feature.feature
          }
          return null
        })
        .filter(Boolean)
      : []

    return {
      id: resolvedPackageId,
      name: resolvedName,
      description: resolvedDescription,
      features: resolvedFeatures,
      category: resolvedCategory,
      minNights: resolvedMinNights,
      maxNights: resolvedMaxNights,
      baseRate: resolvedBaseRate,
      multiplier: resolvedMultiplier,
      customName: selectedPackage?.customName || null,
      hasResolvedPackage: Boolean(resolvedPackage),
      packageTypeCode,
    }
  }, [availablePackages, data?.packageType, data?.post, data?.selectedPackage])

  useEffect(() => {
    console.log('Booking package snapshot', {
      bookingId: data?.id,
      packageType: data?.packageType,
      resolvedPackageId: packageSnapshot?.id,
      hasResolvedPackage: packageSnapshot?.hasResolvedPackage,
    })
  }, [data?.id, data?.packageType, packageSnapshot])

  const bookingDuration = React.useMemo(() => {
    if (!data?.fromDate || !data?.toDate) return null

    const from = new Date(data.fromDate)
    const to = new Date(data.toDate)

    return Math.max(1, Math.round((to.getTime() - from.getTime()) / (1000 * 60 * 60 * 24)))
  }, [data?.fromDate, data?.toDate])

  // Calculate days until booking starts
  const daysUntilBooking = React.useMemo(() => {
    if (!data?.fromDate) return null

    const today = new Date()
    today.setHours(0, 0, 0, 0)
    const fromDate = new Date(data.fromDate)
    fromDate.setHours(0, 0, 0, 0)

    const diffTime = fromDate.getTime() - today.getTime()
    const diffDays = Math.round(diffTime / (1000 * 60 * 60 * 24))

    return diffDays
  }, [data?.fromDate])

  // Format countdown text
  const countdownText = React.useMemo(() => {
    if (daysUntilBooking === null) return null

    if (daysUntilBooking > 0) {
      return `${daysUntilBooking} ${daysUntilBooking === 1 ? 'day' : 'days'} until check-in`
    } else if (daysUntilBooking === 0) {
      return 'Check-in today!'
    } else {
      // Booking has already started
      const daysAgo = Math.abs(daysUntilBooking)
      return `Started ${daysAgo} ${daysAgo === 1 ? 'day' : 'days'} ago`
    }
  }, [daysUntilBooking])

  const currentPackageTotal = React.useMemo(() => {
    if (data?.total && !isNaN(Number(data.total))) {
      return Number(data.total)
    }

    if (!bookingDuration || !packageSnapshot) return null

    return calculateTotal(packageSnapshot.baseRate, bookingDuration, packageSnapshot.multiplier)
  }, [bookingDuration, data?.total, packageSnapshot])

  useEffect(() => {
    const loadPackages = async () => {
      setLoadingAddons(true)
      setPaymentError(null)
      try {
        const postId = typeof data?.post === 'string' ? data.post : data?.post?.id
        if (!postId) {
          throw new Error('No post ID found')
        }

        const [addonsResponse, allPackagesResponse] = await Promise.all([
          fetch(`/api/packages/addons/${postId}`),
          fetch(`/api/packages/post/${postId}`),
        ])

        if (!addonsResponse.ok || !allPackagesResponse.ok) {
          throw new Error('Failed to fetch packages')
        }

        const [addonsData, allPackagesData] = await Promise.all([
          addonsResponse.json(),
          allPackagesResponse.json(),
        ])

        const resolvedAddons = Array.isArray(addonsData)
          ? addonsData
          : Array.isArray(addonsData?.addons)
            ? addonsData.addons
            : []
        setAddonPackages(resolvedAddons)

        const resolvedPackages = Array.isArray(allPackagesData)
          ? allPackagesData
          : Array.isArray(allPackagesData?.packages)
            ? allPackagesData.packages
            : []
        const packagesWithPages = resolvedPackages.filter((pkg: any) => pkg.relatedPage)

        if (packagesWithPages.length > 0) {
          const pagePromises = packagesWithPages.map(async (pkg: any) => {
            try {
              const pageResponse = await fetch(`/api/pages/${pkg.relatedPage.id}?depth=2&draft=false&locale=undefined`)
              if (!pageResponse.ok) {
                throw new Error(`Failed to fetch page: ${pageResponse.statusText}`)
              }
              return pageResponse.json()
            } catch (err) {
              console.error(`Error fetching page ${pkg.relatedPage.id}:`, err)
              return null
            }
          })
          const pages = await Promise.all(pagePromises)
          setRelatedPages(pages)
        }

        setAvailablePackages(resolvedPackages)
      } catch (err) {
        console.error('Error loading packages:', err)
        setPaymentError('Failed to load packages')
      } finally {
        setLoadingAddons(false)
      }
    }

    loadPackages()
  }, [data?.post])


  const post = typeof data?.post === 'object' && data.post ? data.post : null
  const postImage = post?.meta?.image || post?.heroImage
  const postTitle = post?.title || 'Booking Details'
  const bookingId = data?.id || ''
  const paymentStatus = data?.paymentStatus || 'unpaid'
  const isConfirmed = paymentStatus === 'paid'
  const bookingIdDisplay = bookingId ? `BK-${bookingId.slice(-6).toUpperCase()}` : ''

  // Get post location (if available)
  const postLocation = 'Llandudno, Cape Town, South Africa' // Default, can be enhanced with actual post data

  // Get host information
  const host = typeof data?.customer === 'object' ? data.customer : null
  const hostName = host?.name || 'Host'
  const hostEmail = host?.email || ''

  // Calculate total paid
  const totalPaid = currentPackageTotal || data?.total || 0

  return (
    <div className="min-h-screen bg-background">
      {PreviewBanner}
      {/* Floating Header */}
      <div className="sticky top-0 z-50 border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
        <div className="container max-w-2xl mx-auto px-4 h-16 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-2">
              <div className={isConfirmed ? 'h-2 w-2 rounded-full bg-teal-500 animate-pulse' : 'h-2 w-2 rounded-full bg-yellow-500'}></div>
              <span className="text-sm font-medium">{isConfirmed ? 'Confirmed' : 'Pending'}</span>
            </div>
            {bookingIdDisplay && (
              <>
                <span className="text-sm text-muted-foreground">•</span>
                <span className="text-sm text-muted-foreground">{bookingIdDisplay}</span>
              </>
            )}
          </div>
          <Button variant="outline" size="sm" className="gap-2">
            <Share2 className="h-4 w-4" />
            Share
          </Button>
        </div>
      </div>

      {/* Hero Section */}
      {postImage && (
        <div className="relative h-[400px] overflow-hidden">
          <Media
            resource={postImage}
            fill
            imgClassName="object-cover"
            disableThrottling={true}
            postId={post?.id}
            postTitle={postTitle}
          />
          <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/40 to-transparent"></div>
          <div className="absolute bottom-0 left-0 right-0 p-6">
            <div className="container max-w-2xl mx-auto">
              <div className="flex items-start justify-between">
                <div>
                  <h1 className="text-4xl font-bold text-white mb-2">
                    🎟️ {postTitle}
                  </h1>
                  {packageSnapshot?.name && (
                    <p className="text-white/90 text-lg">
                      {packageSnapshot.name}
                    </p>
                  )}
                </div>
                <div className="flex items-center gap-1 bg-white/20 backdrop-blur-sm rounded-full px-3 py-1.5">
                  <Star className="h-4 w-4 text-yellow-400 fill-yellow-400" />
                  <span className="text-sm font-semibold text-white">4.9</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Main Content */}
      <div className="container max-w-2xl mx-auto px-4 py-6 space-y-4">
        {/* Status Timeline */}
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-lg font-semibold">Your Trip</h2>
              {daysUntilBooking !== null && (
                <span className="text-2xl font-bold text-teal-500">{Math.abs(daysUntilBooking)} {daysUntilBooking === 1 ? 'day' : 'days'}</span>
              )}
            </div>

            <div className="relative">
              <div className="absolute left-[15px] top-8 bottom-8 w-0.5 bg-border"></div>

              <div className="space-y-6">
                {/* Booking Confirmed */}
                <div className="relative flex gap-4">
                  <div className={isConfirmed ? 'flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-teal-500 text-white' : 'flex h-8 w-8 shrink-0 items-center justify-center rounded-full border-2 border-border bg-background'}>
                    {isConfirmed ? <Check className="h-4 w-4" /> : <Clock className="h-4 w-4 text-muted-foreground" />}
                  </div>
                  <div className="flex-1 pt-1">
                    <p className="font-medium">{isConfirmed ? 'Booking Confirmed' : 'Booking Pending'}</p>
                    <p className="text-sm text-muted-foreground">
                      {data?.createdAt ? format(new Date(data.createdAt), 'MMMM dd, yyyy') : 'Unknown'}
                    </p>
                  </div>
                </div>

                {/* Check-in */}
                {data?.fromDate && (
                  <div className="relative flex gap-4">
                    <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full border-2 border-teal-500 bg-background">
                      <CalendarIcon className="h-4 w-4 text-teal-500" />
                    </div>
                    <div className="flex-1 pt-1">
                      <p className="font-medium">Check-in</p>
                      <p className="text-sm text-muted-foreground">
                        {format(new Date(data.fromDate), 'MMMM dd, yyyy')} • 3:00 PM
                      </p>
                    </div>
                  </div>
                )}

                {/* Check-out */}
                {data?.toDate && (
                  <div className="relative flex gap-4">
                    <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full border-2 border-border bg-background">
                      <CalendarIcon className="h-4 w-4 text-muted-foreground" />
                    </div>
                    <div className="flex-1 pt-1">
                      <p className="font-medium text-muted-foreground">Check-out</p>
                      <p className="text-sm text-muted-foreground">
                        {format(new Date(data.toDate), 'MMMM dd, yyyy')} • 11:00 AM
                      </p>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Quick Actions */}
        <div className="grid grid-cols-2 gap-3">
          <Button
            variant="outline"
            className="h-14 gap-2"
            onClick={() => handleAddToCalendar(data)}
          >
            <CalendarIcon className="h-5 w-5 text-teal-500" />
            <span className="font-medium">Add to Calendar</span>
          </Button>
          <Button variant="outline" className="h-14 gap-2" asChild>
            <a
              href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(postLocation)}`}
              target="_blank"
              rel="noopener noreferrer"
            >
              <Navigation className="h-5 w-5 text-teal-500" />
              <span className="font-medium">Get Directions</span>
            </a>
          </Button>
        </div>

        {/* Check-in QR Code */}
        <Card className="bg-gradient-to-br from-teal-50 to-transparent">
          <CardContent className="p-6">
            <div className="flex items-start gap-4">
              <div className="flex-1">
                <div className="flex items-center gap-2 mb-2">
                  <QrCode className="h-5 w-5 text-teal-500" />
                  <h3 className="font-semibold">Digital Check-in</h3>
                </div>
                <p className="text-sm text-muted-foreground mb-4">
                  Show this QR code at arrival for contactless check-in
                </p>
                <Button
                  variant="default"
                  size="sm"
                  className="gap-2"
                  onClick={() => {
                    const qrUrl = getQRCodeUrl(data)
                    window.open(qrUrl, '_blank')
                  }}
                >
                  <Download className="h-4 w-4" />
                  Open House Manual
                </Button>
              </div>
              <div className="h-24 w-24 rounded-lg bg-white border-2 border-teal-500/20 flex items-center justify-center p-2">
                <QRCodeSVG
                  value={getQRCodeUrl(data)}
                  size={80}
                  level="M"
                  includeMargin={false}
                />
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Location */}
        <Card className="overflow-hidden">
          <CardContent className="p-6 pb-4">
            <div className="flex items-center gap-2 mb-4">
              <MapPin className="h-5 w-5 text-teal-500" />
              <h3 className="font-semibold">Location</h3>
            </div>
            <p className="text-sm text-muted-foreground mb-4">
              {postLocation}
            </p>
          </CardContent>
          <div className="h-48 bg-muted flex items-center justify-center border-t">
            <div className="text-center">
              <MapPin className="h-8 w-8 text-muted-foreground mx-auto mb-2" />
              <p className="text-sm text-muted-foreground">Map view</p>
            </div>
          </div>
        </Card>

        {/* Package Details */}
        {data && 'post' in data && typeof data?.post !== 'string' && (
          <Card>
            <CardContent className="p-6">
              <div className="flex items-center gap-2 mb-4">
                <Package className="h-5 w-5 text-teal-500" />
                <h3 className="font-semibold">Your Package</h3>
              </div>

              <div className="space-y-4">
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <p className="font-medium mb-1">
                      {packageSnapshot?.name || (data?.selectedPackage && typeof data.selectedPackage === 'object' ? data.selectedPackage.customName : null) || 'Package'}
                    </p>
                    <p className="text-sm text-muted-foreground">
                      {packageSnapshot?.description || 'Your selected package'}
                    </p>
                  </div>
                  <span className="text-lg font-semibold">R{totalPaid.toFixed(2)}</span>
                </div>

                {packageSnapshot?.features && packageSnapshot.features.length > 0 && (
                  <div className="border-t pt-4">
                    <p className="text-sm font-medium mb-3">Included:</p>
                    <div className="space-y-2">
                      {packageSnapshot.features.slice(0, 5).map((feature: any, index: number) => (
                        <div key={index} className="flex items-center gap-2 text-sm">
                          <div className="h-1.5 w-1.5 rounded-full bg-teal-500"></div>
                          <span>{typeof feature === 'string' ? feature : feature.label || feature.feature || feature}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {packageSnapshot && (
                  <div className="flex items-center gap-4 pt-2">
                    <Badge variant="secondary" className="text-xs">
                      {packageSnapshot.category || 'Standard Package'}
                    </Badge>
                    {packageSnapshot.minNights && packageSnapshot.maxNights && (
                      <span className="text-xs text-muted-foreground">
                        {packageSnapshot.minNights}-{packageSnapshot.maxNights} nights
                      </span>
                    )}
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        )}

        {/* Host Information */}
        {host && (
          <Card>
            <CardContent className="p-6">
              <div className="flex items-center gap-2 mb-4">
                <Home className="h-5 w-5 text-teal-500" />
                <h3 className="font-semibold">Your Host</h3>
              </div>

              <div className="flex items-center gap-4 mb-4">
                <Gravatar
                  email={hostEmail}
                  size={64}
                  alt={hostName}
                  className="h-16 w-16 rounded-full border-2 border-teal-500"
                  fallback={
                    <div className="flex h-16 w-16 items-center justify-center rounded-full bg-teal-500 text-white">
                      <UserIcon className="h-8 w-8" />
                    </div>
                  }
                />
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-1">
                    <p className="font-semibold">{hostName}</p>
                    <Badge variant="default" className="text-xs">
                      Host
                    </Badge>
                  </div>
                  <div className="flex items-center gap-1 text-sm text-muted-foreground">
                    <Star className="h-3 w-3 text-yellow-400 fill-yellow-400" />
                    <span>4.9 • 127 reviews</span>
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-2">
                <Button variant="outline" className="gap-2">
                  <MessageCircle className="h-4 w-4" />
                  Message
                </Button>
                <Button variant="outline" className="gap-2" asChild>
                  <a href={`mailto:${hostEmail}`}>
                    <Phone className="h-4 w-4" />
                    Contact
                  </a>
                </Button>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Guests */}
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <Users className="h-5 w-5 text-teal-500" />
                <h3 className="font-semibold">Guests</h3>
              </div>
              {data &&
                'customer' in data &&
                typeof data?.customer !== 'string' &&
                data.customer &&
                'id' in data.customer &&
                data.customer.id === user.id && (
                  <InviteUrlDialog
                    bookingId={data.id}
                    trigger={
                      <Button size="sm" variant="default" className="gap-2">
                        <Users className="h-4 w-4" />
                        Invite Guests
                      </Button>
                    }
                  />
                )}
            </div>

            <div className="flex items-center gap-3 rounded-lg border-2 border-teal-500/20 bg-teal-500/5 p-4 mb-3">
              <Gravatar
                email={hostEmail}
                size={40}
                alt={hostName}
                className="h-10 w-10 rounded-full"
                fallback={
                  <div className="flex h-10 w-10 items-center justify-center rounded-full bg-teal-500 text-white">
                    <UserIcon className="h-5 w-5" />
                  </div>
                }
              />
              <div className="flex-1">
                <p className="font-medium text-sm">{hostName}</p>
                <p className="text-xs text-muted-foreground">Primary guest</p>
              </div>
            </div>

            {data.guests
              ?.filter((guest) =>
                typeof guest === 'string'
                  ? !removedGuests.includes(guest)
                  : !removedGuests.includes(guest.id),
              )
              ?.map((guest) => {
                if (typeof guest === 'string') return null
                return (
                  <div
                    key={guest.id}
                    className="flex items-center gap-3 rounded-lg border bg-card p-3 mb-2"
                  >
                    <Gravatar
                      email={guest.email}
                      size={40}
                      alt={guest.name || 'Guest'}
                      className="h-10 w-10 rounded-full"
                      fallback={
                        <div className="flex h-10 w-10 items-center justify-center rounded-full bg-muted">
                          <UserIcon className="h-5 w-5 text-muted-foreground" />
                        </div>
                      }
                    />
                    <div className="flex-1">
                      <p className="font-medium text-sm">{guest.name}</p>
                      <Badge variant="outline" className="text-xs">
                        Guest
                      </Badge>
                    </div>
                    {data &&
                      'customer' in data &&
                      typeof data?.customer !== 'string' &&
                      data.customer &&
                      'id' in data.customer &&
                      data.customer.id === user.id && (
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => removeGuestHandler(guest.id)}
                          className="text-destructive hover:text-destructive hover:bg-destructive/10"
                        >
                          <TrashIcon className="size-4" />
                        </Button>
                      )}
                  </div>
                )
              })}
          </CardContent>
        </Card>

        {/* Enhance Your Stay - Carousel */}
        {!loadingAddons && addonPackages.length > 0 && (
          <Card id="booking-addons">
            <CardContent className="p-6">
              <div className="flex items-center gap-2 mb-2">
                <Sparkles className="h-5 w-5 text-teal-500" />
                <h3 className="font-semibold">Enhance Your Stay</h3>
              </div>
              <p className="text-sm text-muted-foreground mb-6">
                Add special experiences to make your trip unforgettable
              </p>

              <Carousel
                opts={{
                  align: 'start',
                  loop: true,
                }}
                className="w-full relative"
              >
                <CarouselContent className="-ml-4">
                  {addonPackages.map((addon) => {
                    const baseRate = addon.baseRate || 0
                    const price = baseRate * addon.multiplier
                    const priceString = `R${price.toFixed(2)}`

                    return (
                      <CarouselItem key={addon.id} className="pl-4 basis-[280px]">
                        <Card className="hover:shadow-md transition-shadow">
                          <CardContent className="p-4">
                            <div className="flex items-start justify-between mb-2">
                              <h4 className="font-medium text-sm">{addon.name}</h4>
                              <span className="text-sm font-semibold text-teal-500">
                                {priceString}
                              </span>
                            </div>
                            <p className="text-xs text-muted-foreground mb-3">
                              {addon.description || addon.originalName}
                            </p>
                            <Button
                              variant="outline"
                              size="sm"
                              className="w-full"
                              onClick={() => handleAddonPurchase(addon)}
                              disabled={(paymentLoading && currentAddonId === addon.id) || !isInitialized}
                            >
                              {paymentLoading && currentAddonId === addon.id
                                ? 'Processing...'
                                : 'Add'}
                            </Button>
                          </CardContent>
                        </Card>
                      </CarouselItem>
                    )
                  })}
                </CarouselContent>
                <CarouselPrevious />
                <CarouselNext />
              </Carousel>

              {paymentError && (
                <div className="mt-4 p-3 bg-destructive/10 text-destructive rounded-lg text-sm">
                  {paymentError}
                </div>
              )}
            </CardContent>
          </Card>
        )}

        {/* Payment Summary */}
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center gap-2 mb-4">
              <CreditCard className="h-5 w-5 text-teal-500" />
              <h3 className="font-semibold">Payment Summary</h3>
            </div>

            <div className="space-y-3">
              <div className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground">Package price</span>
                <span>R{totalPaid.toFixed(2)}</span>
              </div>
              <div className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground">Service fee</span>
                <span>R0.00</span>
              </div>
              <div className="border-t pt-3 flex items-center justify-between">
                <span className="font-semibold">Total paid</span>
                <span className="text-xl font-bold text-teal-500">R{totalPaid.toFixed(2)}</span>
              </div>
            </div>

            <div className="mt-4 flex items-center gap-2 text-xs text-muted-foreground">
              <Shield className="h-4 w-4" />
              <span>Payment secured and protected</span>
            </div>
          </CardContent>
        </Card>

        {/* Cancellation Policy with Rescheduling */}
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-semibold">Cancellation Policy</h3>
              <Button variant="link" size="sm" className="gap-1 h-auto p-0">
                View details
                <ExternalLink className="h-3 w-3" />
              </Button>
            </div>
            <p className="text-sm text-muted-foreground mb-4">
              Use your tokens to reschedule your booking
            </p>
            
            {/* Rescheduling Card */}
            <div className="mt-4 pt-4 border-t">
              <BookingInfoCard
                variant="booking"
                postUrl={typeof data?.post === 'object' && data.post ? `/posts/${data.post.slug || ''}` : undefined}
                postId={typeof data?.post === 'string' ? data.post : (typeof data?.post === 'object' && data.post ? data.post.id : undefined)}
                postTitle={typeof data?.post === 'object' && data.post ? data.post.title : undefined}
                packageMinNights={packageSnapshot?.minNights ?? null}
                packageMaxNights={packageSnapshot?.maxNights ?? null}
                isReschedule={true}
                originalBookingDates={data?.fromDate && data?.toDate ? {
                  from: new Date(data.fromDate as string),
                  to: new Date(data.toDate as string)
                } : null}
                onEstimateRequest={async (dates) => {
                  setIsSubmittingEstimate(true)
                  setEstimateError(null)

                  try {
                    const postId = typeof data?.post === 'string' ? data.post : data?.post?.id
                    if (!postId) {
                      throw new Error('No post ID found')
                    }

                    if (!packageSnapshot?.id) {
                      throw new Error('Original booking package not found. Cannot reschedule.')
                    }

                    const fromDateObj = new Date(dates.from)
                    const toDateObj = new Date(dates.to)
                    const duration = Math.max(
                      1,
                      Math.round((toDateObj.getTime() - fromDateObj.getTime()) / (1000 * 60 * 60 * 24)),
                    )

                    const minNights = packageSnapshot?.minNights ?? null
                    const maxNights = packageSnapshot?.maxNights ?? null
                    const originalDuration = bookingDuration ?? null

                    if (minNights !== null && duration < minNights) {
                      const durationText = minNights === 1 ? 'night' : 'nights'
                      throw new Error(
                        `⚠️ Duration mismatch: This package requires a minimum of ${minNights} ${durationText}. ` +
                        `Your original booking was ${originalDuration ? `${originalDuration} ${originalDuration === 1 ? 'night' : 'nights'}` : 'for this package'}. ` +
                        `Please select dates that match the package duration requirements.`
                      )
                    }

                    if (maxNights !== null && duration > maxNights) {
                      const durationText = maxNights === 1 ? 'night' : 'nights'
                      throw new Error(
                        `⚠️ Duration mismatch: This package allows a maximum of ${maxNights} ${durationText}. ` +
                        `Your original booking was ${originalDuration ? `${originalDuration} ${originalDuration === 1 ? 'night' : 'nights'}` : 'for this package'}. ` +
                        `Please select dates that match the package duration requirements.`
                      )
                    }

                    const packageId = packageSnapshot.id
                    const availabilityResponse = await fetch(
                      `/api/bookings/check-availability?postId=${postId}&startDate=${dates.from.toISOString()}&endDate=${dates.to.toISOString()}&packageId=${packageId}`,
                    )

                    if (!availabilityResponse.ok) {
                      throw new Error('Failed to check availability')
                    }

                    const availabilityData = await availabilityResponse.json()

                    if (!availabilityData.isAvailable) {
                      const suggestedDates = availabilityData.suggestedDates || []
                      if (suggestedDates.length > 0) {
                        throw new Error('The selected dates are not available for this package. Please see suggested dates below.')
                      }
                      throw new Error('The selected dates are not available for this package. Please choose different dates.')
                    }

                    const baseRate = packageSnapshot?.baseRate ??
                      (typeof data?.post === 'object' && data.post?.baseRate != null && Number(data.post.baseRate) > 0
                        ? Number(data.post.baseRate)
                        : 150)

                    const selectedPackage = data?.selectedPackage
                    const packageBaseRate =
                      selectedPackage && typeof selectedPackage.package === 'object' && selectedPackage.package?.baseRate != null && Number(selectedPackage.package.baseRate) > 0
                        ? Number(selectedPackage.package.baseRate)
                        : null

                    const multiplier = packageSnapshot?.multiplier ?? 1
                    const total = packageBaseRate
                      ? packageBaseRate
                      : calculateTotal(baseRate, duration, multiplier)

                    const originalPackageType = packageSnapshot.id || data?.packageType

                    if (!originalPackageType) {
                      throw new Error('Original package type not found. Cannot reschedule.')
                    }

                    const resp = await fetch('/api/estimates', {
                      method: 'POST',
                      headers: { 'Content-Type': 'application/json' },
                      body: JSON.stringify({
                        postId,
                        fromDate: dates.from.toISOString(),
                        toDate: dates.to.toISOString(),
                        guests: [],
                        title: `Reschedule estimate for ${typeof data?.post === 'object' ? data.post.title : 'Property'} - ${packageSnapshot?.minNights !== null && packageSnapshot?.minNights !== undefined && packageSnapshot.minNights <= 1 && duration === 1 ? 'hourly' : `${duration} ${duration === 1 ? 'night' : 'nights'}`}`,
                        packageType: originalPackageType,
                        total,
                        originalBooking: data.id,
                        selectedPackage: {
                          package: packageSnapshot.id,
                          customName: packageSnapshot.customName || packageSnapshot.name,
                          enabled: true,
                        },
                      }),
                    })

                    if (!resp.ok) {
                      const err = await resp.json().catch(() => ({}))
                      throw new Error(err?.error || 'Failed to create estimate')
                    }

                    const created = await resp.json()
                    router.push(`/estimate/${created.id}`)
                  } catch (error) {
                    console.error('Error creating estimate:', error)
                    setEstimateError(
                      error instanceof Error ? error.message : 'Failed to create estimate. Please try again.',
                    )
                  } finally {
                    setIsSubmittingEstimate(false)
                  }
                }}
                isSubmittingEstimate={isSubmittingEstimate}
                estimateError={estimateError}
              />
            </div>
          </CardContent>
        </Card>

        {/* Help Section */}
        <Card className="bg-muted/50">
          <CardContent className="p-6 text-center">
            <h3 className="font-semibold mb-2">Need help?</h3>
            <p className="text-sm text-muted-foreground mb-4">
              Our support team is available 24/7
            </p>
            <Button variant="outline" className="gap-2">
              <MessageCircle className="h-4 w-4" />
              Contact Support
            </Button>
          </CardContent>
        </Card>

        {/* Footer */}
        <div className="pt-8 pb-12 text-center space-y-2">
          {bookingIdDisplay && (
            <p className="text-xs text-muted-foreground">
              Booking ID: {bookingIdDisplay}
            </p>
          )}
          {data?.createdAt && (
            <p className="text-xs text-muted-foreground">
              Confirmed on {format(new Date(data.createdAt), 'MMMM dd, yyyy')}
            </p>
          )}
        </div>

        {/* Check-in Info Tab (if available) */}
        {relatedPages.length > 0 && (
          <Card className="mt-4">
            <CardHeader>
              <div className="flex items-center gap-2">
                <Lock className="h-5 w-5 text-primary" />
                <CardTitle>Check-in Information</CardTitle>
              </div>
              <CardDescription>Confidential information for you and your guests only</CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              {loadingPages ? (
                <p className="text-muted-foreground">Loading check-in information...</p>
              ) : (
                relatedPages.map((page, index) => (
                  <Card key={page.id || index} className="border-2">
                    <CardHeader className="bg-muted/30">
                      <div className="flex items-center gap-2">
                        <div className="p-2 bg-primary/10 rounded-lg">
                          <Lock className="h-4 w-4 text-primary" />
                        </div>
                        <div>
                          <CardTitle className="text-base">{page.title}</CardTitle>
                          <CardDescription className="text-xs">{page.packageName}</CardDescription>
                        </div>
                      </div>
                    </CardHeader>
                    <CardContent className="pt-6">{page.layout && <SimplePageRenderer page={page} />}</CardContent>
                  </Card>
                ))
              )}
            </CardContent>
          </Card>
        )}
      </div>

      <AIAssistant />

      {/* Set context for AI Assistant */}
      <script
        dangerouslySetInnerHTML={{
          __html: `
            window.addEventListener('load', function() {
              const context = ${bookingContextJson};
              window.bookingContext = context;
            });
          `,
        }}
      />
    </div>
  )
}
