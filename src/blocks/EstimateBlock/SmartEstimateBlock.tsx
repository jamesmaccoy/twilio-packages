'use client'

import React, { useState, useEffect, useRef, useCallback } from 'react'
import { cn } from '@/utilities/cn'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { Calendar as CalendarComponent } from '@/components/ui/calendar'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { Switch } from '@/components/ui/switch'
import { Label } from '@/components/ui/label'
import { Bot, Send, Calendar, CalendarIcon, Package, Sparkles, Loader2, User, Bookmark } from 'lucide-react'
import { motion, AnimatePresence } from 'framer-motion'
import { Conversation, ConversationContent, ConversationScrollButton } from '@/components/ai-elements/conversation'
import { Suggestions, Suggestion } from '@/components/ai-elements/suggestion'
import { Loader } from '@/components/ai-elements/loader'
import { Message, MessageContent, MessageResponse } from '@/components/ai-elements/message'
import {
  PromptInput,
  PromptInputHeader,
  PromptInputBody,
  PromptInputTextarea,
  PromptInputFooter,
  PromptInputTools,
  PromptInputSpeechButton,
  PromptInputSubmit,
  type PromptInputMessage,
} from '@/components/ai-elements/prompt-input'
import { Checkpoint, CheckpointIcon, CheckpointTrigger } from '@/components/ai-elements/checkpoint'
import { format } from 'date-fns'
import { hasUnavailableDateBetween } from '@/utilities/hasUnavailableDateBetween'
import { useUserContext } from '@/context/UserContext'
import { useSubscription } from '@/hooks/useSubscription'
import {
  getCustomerEntitlement,
  isPublicBookablePackage,
  normalizePackageEntitlement,
  normalizePackageEntitlements,
  packageVisibleToCustomer,
  type CustomerEntitlement,
} from '@/utils/packageSuggestions'
import { categoryPriorityScore, hasPackageCategory } from '@/utils/packageCategories'
import { calculateTotal } from '@/lib/calculateTotal'
import { useYoco } from '@/providers/Yoco'
import { yocoService, YocoProduct, YocoPaymentLink } from '@/lib/yocoService'
import { useRouter, useSearchParams } from 'next/navigation'
import { Mic, MicOff } from 'lucide-react'
import { PackageDisplay } from '@/components/PackageDisplay'

interface Package {
  id: string
  name: string
  description: string
  multiplier: number
  category: string | string[]
  entitlement?: 'none' | 'standard' | 'pro'
  minNights: number
  maxNights: number
  yocoId?: string
  baseRate?: number
  isEnabled: boolean
  features: string[]
  source: 'database' | 'yoco'
}

interface Message {
  role: 'user' | 'assistant' | 'system'
  content: string
  type?: 'text' | 'package_suggestion' | 'booking_summary' | 'quick_action' | 'date_selection' | 'date_suggestion'
  data?: any
}

interface SmartEstimateBlockProps {
  className?: string
  postId: string
  baseRate: number
  postTitle?: string
  postDescription?: string
  relatedPosts?: Array<{ id?: string; title?: string; slug?: string } | string>
  postContent?: any
  /** Server index: post has at least one guest-bookable (entitlement=none) package */
  guestBookable?: boolean
}

const QuickActions = ({ 
  onAction, 
  hasDates, 
  suggestedDates 
}: { 
  onAction: (action: string, data?: any) => void
  hasDates: boolean
  suggestedDates?: Array<{ startDate: string; endDate: string; duration: number }>
}) => (
  <div className="flex flex-wrap gap-2 mb-4">
    <Button 
      variant="outline" 
      size="sm" 
      onClick={() => onAction('select_dates')}
      className="text-xs"
    >
      <Calendar className="h-3 w-3 mr-1" />
      Select Dates
    </Button>
    <Button 
      variant="outline" 
      size="sm" 
      onClick={() => onAction('smart_action')}
      className="text-xs"
    >
      <Sparkles className="h-3 w-3 mr-1" />
      {hasDates ? 'Get Recommendations' : 'Help Me Choose'}
    </Button>
  </div>
)

const PackageCard = ({ 
  package: pkg, 
  duration, 
  baseRate, 
  isSelected, 
  onSelect 
}: { 
  package: Package
  duration: number
  baseRate: number
  isSelected: boolean
  onSelect: () => void 
}) => {
  const total = pkg.baseRate || calculateTotal(baseRate, duration, pkg.multiplier)
  const effectiveDuration = Math.max(duration, pkg.minNights || pkg.maxNights || 1, 1)
  
  // Check if this is an hourly package (minNights < 1 indicates hourly/half-day)
  const isHourlyPackage = pkg.minNights !== null && pkg.minNights !== undefined && pkg.minNights < 1
  // Check if this is a 1-night package (should not be divided, but not hourly)
  const isOneNightPackage = !isHourlyPackage && pkg.minNights === 1 && pkg.maxNights === 1
  
  // For fixed price packages, use baseRate directly (no division)
  // For multiplier-based packages, calculate per-night rate
  const pricePerNight = pkg.baseRate
    ? (isOneNightPackage ? total : total / Math.max(effectiveDuration, 1))
    : total / Math.max(duration, 1)
  
  const multiplierText = pkg.baseRate 
    ? 'Fixed package price' 
    : pkg.multiplier === 1 
    ? 'Base rate' 
    : pkg.multiplier > 1 
      ? `+${((pkg.multiplier - 1) * 100).toFixed(0)}%` 
      : `-${((1 - pkg.multiplier) * 100).toFixed(0)}%`
  
  return (
    <Card 
      className={cn(
        "cursor-pointer transition-all hover:shadow-md",
        isSelected ? "border-primary bg-primary/5" : "border-border"
      )}
      onClick={onSelect}
    >
      <CardHeader className="pb-3">
        <div className="flex justify-between items-start">
          <div className="flex-1">
            <CardTitle className="text-lg">{pkg.name}</CardTitle>
            <CardDescription className="mt-1">{pkg.description}</CardDescription>
          </div>
          <div className="text-right">
            <div className="text-2xl font-bold text-primary">R{total.toFixed(0)}</div>
            <div className="text-sm text-muted-foreground">
              {isHourlyPackage
                ? `R${total.toFixed(0)}`
                : isOneNightPackage 
                  ? `R${total.toFixed(0)}`
                  : pkg.baseRate
                    ? `R${total.toFixed(0)}`
                    : `R${pricePerNight.toFixed(0)}/night`}
            </div>
            <div className="text-xs text-muted-foreground">
              {multiplierText}
            </div>
          </div>
        </div>
      </CardHeader>
      <CardContent className="pt-0">
        <div className="space-y-2">
          <div className="text-xs text-muted-foreground">
            Duration: {isHourlyPackage
              ? 'hourly'
              : pkg.minNights === pkg.maxNights 
                ? `${pkg.minNights} ${pkg.minNights === 1 ? 'night' : 'nights'}`
                : `${pkg.minNights}-${pkg.maxNights} nights`
            }
          </div>
          <div className="space-y-1">
            {pkg.features.slice(0, 3).map((feature, idx) => (
              <div key={idx} className="flex items-center text-sm">
                <span className="w-1.5 h-1.5 bg-primary rounded-full mr-2" />
                {typeof feature === 'string' ? feature : (feature as any).feature}
              </div>
            ))}
            {pkg.features.length > 3 && (
              <div className="text-xs text-muted-foreground">
                +{pkg.features.length - 3} more features
              </div>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  )
}

export const SmartEstimateBlock: React.FC<SmartEstimateBlockProps> = ({
  className,
  postId,
  baseRate,
  postTitle = "this property",
  postDescription = "",
  relatedPosts = [],
  postContent,
  guestBookable: guestBookableFromServer,
}) => {
  const { currentUser } = useUserContext()
  const isLoggedIn = !!currentUser
  const router = useRouter()
  const searchParams = useSearchParams()
  const { isInitialized, createPaymentLink, createPaymentLinkFromDatabase } = useYoco()
  
  // Session storage key for this specific post
  const sessionKey = `booking_journey_${postId}_${currentUser?.id || 'guest'}`
  
  const [messages, setMessages] = useState<Message[]>([])
  const [input, setInput] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [packages, setPackages] = useState<Package[]>([])
  const [selectedPackage, setSelectedPackage] = useState<Package | null>(null)
  const [duration, setDuration] = useState(1)
  const [startDate, setStartDate] = useState<Date | null>(null)
  const [endDate, setEndDate] = useState<Date | null>(null)
  const [showPerHourPackages, setShowPerHourPackages] = useState(false)
  const [isListening, setIsListening] = useState(false)
  const [isSpeaking, setIsSpeaking] = useState(false)
  const [micError, setMicError] = useState<string | null>(null)
  
  // Addon states
  interface AddonPackage {
    id: string
    name: string
    description: string
    baseRate: number
    enabled: boolean
    features: string[]
  }
  const [suggestedAddons, setSuggestedAddons] = useState<AddonPackage[]>([])
  const [selectedAddons, setSelectedAddons] = useState<Set<string>>(new Set())
  const [isLoadingAddons, setIsLoadingAddons] = useState(false)
  
  // Booking states
  const [isBooking, setIsBooking] = useState(false)
  const [bookingError, setBookingError] = useState<string | null>(null)
  const [offerings, setOfferings] = useState<YocoProduct[]>([])
  const [isCreatingEstimate, setIsCreatingEstimate] = useState(false)
  const textareaRef = useRef<HTMLTextAreaElement>(null)
  const selectedPackageTotal =
    selectedPackage && selectedPackage.baseRate && selectedPackage.baseRate > 0
      ? selectedPackage.baseRate
      : selectedPackage
        ? calculateTotal(baseRate, duration, selectedPackage.multiplier)
        : null
  
  // Calculate total including addons
  const totalWithAddons = selectedPackageTotal 
    ? selectedPackageTotal + Array.from(selectedAddons).reduce((sum, addonId) => {
        const addon = suggestedAddons.find(a => a.id === addonId)
        return sum + (addon?.baseRate || 0)
      }, 0)
    : null
  
  // Availability checking states
  const [unavailableDates, setUnavailableDates] = useState<string[]>([])
  const [isCheckingAvailability, setIsCheckingAvailability] = useState(false)
  const [areDatesAvailable, setAreDatesAvailable] = useState(true)
  const [availabilityError, setAvailabilityError] = useState<string | null>(null)
  
  // Latest estimate state
  const [latestEstimate, setLatestEstimate] = useState<any>(null)
  const [loadingEstimate, setLoadingEstimate] = useState(false)

  const dateRangeStorageKey = 'plek_date_range_v1'

  useEffect(() => {
    if (typeof window === 'undefined') return
    if (!startDate || !endDate) return
    if (Number.isNaN(startDate.getTime()) || Number.isNaN(endDate.getTime())) return
    if (endDate <= startDate) return

    const toISODate = (d: Date) => {
      const yyyy = d.getFullYear()
      const mm = String(d.getMonth() + 1).padStart(2, '0')
      const dd = String(d.getDate()).padStart(2, '0')
      return `${yyyy}-${mm}-${dd}`
    }

    try {
      window.localStorage.setItem(
        dateRangeStorageKey,
        JSON.stringify({ fromDate: toISODate(startDate), toDate: toISODate(endDate) }),
      )
    } catch (err) {
      console.warn('Failed to persist date range to storage', err)
    }
  }, [startDate, endDate])
  
  // Checkpoint state for estimate restoration
  interface EstimateCheckpoint {
    id: string
    messageIndex: number
    estimateId: string
    estimate: any
    timestamp: Date
  }
  const [checkpoints, setCheckpoints] = useState<EstimateCheckpoint[]>([])
  
  // Suggested dates state (for showing near input)
  const [suggestedDates, setSuggestedDates] = useState<Array<{ startDate: string; endDate: string; duration: number }>>([])
  // Proactive date suggestions for PromptInput header
  const [dateSuggestions, setDateSuggestions] = useState<Array<{ startDate: Date; endDate: Date; label: string; dayRange?: string }>>([])
  
  // Package loading state to prevent multiple API calls
  const [loadingPackages, setLoadingPackages] = useState(false)
  const [packagesLoaded, setPackagesLoaded] = useState(false)
  const [hasPublicBookablePackages, setHasPublicBookablePackages] = useState(
    guestBookableFromServer ?? false,
  )
  
  // Ref to track loading state to prevent infinite loops
  const loadingRef = useRef(false)
  const loadedRef = useRef(false)
  
  // Ref to prevent infinite loops in booking journey
  const journeyLoadedRef = useRef(false)
  
  // Debounce ref for saving booking journey
  const saveTimeoutRef = useRef<NodeJS.Timeout | null>(null)
  
  // Ref to prevent loadLatestEstimate from being called repeatedly
  const estimateLoadedRef = useRef(false)
  
  // Ref to prevent package suggestions from being triggered repeatedly
  const packagesSuggestedRef = useRef(false)

  // Ref to prevent duplicate package suggestions for same selection
  const lastPackageSuggestionKeyRef = useRef<string | null>(null)
  
  // Ref to store original packages for re-filtering
  const originalPackagesRef = useRef<Package[]>([])
  const lastPackagesFetchKeyRef = useRef<string | null>(null)

  // Tracks whether the user explicitly chose a package (so we don't override their choice).
  const userSelectedPackageRef = useRef(false)
  
  // Ref to track last checked dates to prevent duplicate availability checks
  const lastCheckedDatesRef = useRef<{ start: string; end: string } | null>(null)
  
  // Ref to track if availability check is in progress
  const availabilityCheckInProgressRef = useRef(false)
  
  // Ref to track previous availability state to detect changes
  const previousAvailabilityRef = useRef<boolean | null>(null)
  
  // Ref to preserve startDate during iOS Safari date picker interactions
  const preservedStartDateRef = useRef<Date | null>(null)
  
  const subscriptionStatus = useSubscription()
  const { isSubscribed, isLoading: isSubscriptionLoading } = subscriptionStatus
  const [customerEntitlement, setCustomerEntitlement] = useState<CustomerEntitlement>('none')
  
  const recognitionRef = useRef<any>(null)
  const synthRef = useRef<SpeechSynthesis | null>(null)
  const isProcessingRef = useRef(false)
  const finalTranscriptRef = useRef('')
  const activeThreadRef = useRef(0)
  const historyKeyRef = useRef<string | null>(null)

  // Extract plain text from Lexical editor content structure
  const extractPlainTextFromContent = useCallback((content: any, depth = 0): string => {
    if (content == null) return ''
    if (typeof content === 'string') return content
    if (typeof content === 'number' || typeof content === 'boolean') return String(content)
    if (Array.isArray(content)) {
      return content.map((c) => extractPlainTextFromContent(c, depth + 1)).filter(Boolean).join('\n')
    }
    if (typeof content === 'object') {
      // Common rich text shapes: { text }, { children }, blocks with { value }, etc.
      const textParts: string[] = []
      // Handle explicit line breaks from lexical
      if ((content as any).type === 'linebreak') {
        textParts.push('\n')
      }
      // Handle autolink nodes that might only carry a URL
      if ((content as any).type === 'autolink') {
        const url = (content as any)?.fields?.url
        if (typeof url === 'string' && url.length > 0) {
          textParts.push(url)
        }
      }
      if (typeof (content as any).text === 'string') {
        textParts.push((content as any).text)
      }
      if ((content as any).children) {
        textParts.push(extractPlainTextFromContent((content as any).children, depth + 1))
      }
      // Some Payload blocks store content under fields like "content", "value", "fields", "data", or "root" (Lexical)
      const candidateKeys = ['content', 'value', 'fields', 'data', 'root']
      for (const key of candidateKeys) {
        if ((content as any)[key] && typeof (content as any)[key] !== 'function') {
          textParts.push(extractPlainTextFromContent((content as any)[key], depth + 1))
        }
      }
      // Fallback: scan other string props
      for (const [k, v] of Object.entries(content as Record<string, unknown>)) {
        if (k === 'text' || candidateKeys.includes(k) || k === 'children') continue
        if (typeof v === 'string' && v.trim().length > 0) {
          textParts.push(v)
        }
      }
      return textParts.filter(Boolean).join('\n')
    }
    return ''
  }, [])

  const persistHistoryEntries = useCallback((threadId: number, entries: Message[]) => {
    if (typeof window === 'undefined' || !historyKeyRef.current || entries.length === 0) return

    try {
      const existing: any[] = JSON.parse(window.localStorage.getItem(historyKeyRef.current) ?? '[]')
      const additions = entries.map((entry) => ({
        role: entry.role,
        content: entry.content,
        timestamp: Date.now(),
        threadId,
      }))
      const updated = [...existing, ...additions].slice(-50)
      window.localStorage.setItem(historyKeyRef.current, JSON.stringify(updated))
      window.dispatchEvent(
        new CustomEvent('aiHistoryUpdate', {
          detail: { key: historyKeyRef.current, history: updated },
        }),
      )
    } catch (error) {
      console.warn('Failed to persist smart estimate history', error)
    }
  }, [])

  const beginNewThread = useCallback(
    (initialMessages: Message[] = []) => {
      const nextThreadId = activeThreadRef.current + 1
      activeThreadRef.current = nextThreadId
      packagesSuggestedRef.current = false
      setMessages(initialMessages)
      persistHistoryEntries(nextThreadId, initialMessages)
      return nextThreadId
    },
    [persistHistoryEntries],
  )

  const appendMessageToThread = useCallback(
    (threadId: number, message: Message) => {
      if (activeThreadRef.current !== threadId) return
      setMessages((prev) => [...prev, message])
      persistHistoryEntries(threadId, [message])
    },
    [persistHistoryEntries],
  )

  // Helper function to filter packages based on customer entitlement
  // This ensures that pro-only packages are only shown to pro users
  // Also filters out addon packages which should only appear on the booking page
  const filterPackagesByEntitlement = useCallback((packages: Package[]): Package[] => {
    
    const filtered = packages.filter((pkg: Package) => {
      if (!pkg.isEnabled) {
        return false
      }
      
      // Filter out addon packages - these should only appear on the booking page
      if (hasPackageCategory(pkg.category, 'addon')) {
        return false
      }

      // Entitlement-based gating (supports entitlement arrays).
      if (
        !packageVisibleToCustomer({
          packageEntitlement: pkg.entitlement,
          customerEntitlement,
          hideNoneForPaying: true,
        })
      ) {
        return false
      }
      
      // Legacy: Filter out pro-only packages by yocoId for non-pro users
        // Only keep this for packages that don't have entitlement field in database
        if (pkg.yocoId === 'gathering_monthly' && customerEntitlement !== 'pro') {
        return false
      }
      
      return true
    })
    
    
    return filtered
  }, [customerEntitlement])

  const sortPackagesForDisplay = useCallback((list: Package[]) => {
    // Higher priority first: special > hosted > standard
    return [...list].sort((a, b) => {
      const aPriority = categoryPriorityScore(a?.category)
      const bPriority = categoryPriorityScore(b?.category)
      if (aPriority !== bPriority) return bPriority - aPriority
      // Tie-breaker: higher multiplier first
      return (b.multiplier || 1) - (a.multiplier || 1)
    })
  }, [])

  const fetchPackagesForPost = useCallback(async () => {
    const fetchKey = `${postId}:${customerEntitlement}`
    if (loadingRef.current) return
    if (lastPackagesFetchKeyRef.current === fetchKey) return

    loadingRef.current = true
    lastPackagesFetchKeyRef.current = fetchKey

    try {
      const res = await fetch(`/api/packages/post/${postId}`, {
        credentials: 'include',
        cache: 'no-store',
      })
      const data = await res.json().catch(() => null)
      if (!res.ok) throw new Error(data?.error || `Failed to load packages (HTTP ${res.status})`)

      const rawPackages: Package[] = data?.packages || []
      const publicBookable = rawPackages.some((pkg) => isPublicBookablePackage(pkg as any))
      setHasPublicBookablePackages(publicBookable)

      const filtered = rawPackages.filter((pkg: Package) => {
        if (!pkg.isEnabled) return false
        if (hasPackageCategory(pkg.category, 'addon')) return false

        if (
          !packageVisibleToCustomer({
            packageEntitlement: pkg.entitlement,
            customerEntitlement,
            hideNoneForPaying: true,
          })
        ) {
          return false
        }

        if (pkg.yocoId === 'gathering_monthly' && customerEntitlement !== 'pro') return false
        return true
      })

      originalPackagesRef.current = rawPackages
      setPackages(sortPackagesForDisplay(filtered))
      loadedRef.current = true
      setPackagesLoaded(true)
    } catch (e) {
      console.error('Error loading packages:', e)
    } finally {
      loadingRef.current = false
    }
  }, [postId, customerEntitlement, sortPackagesForDisplay])

  const computeSelectedDuration = useCallback(
    (from: Date | null, to: Date | null, perHour: boolean): number | null => {
      if (!from || !to) return null

      // "Per hour" packages are modeled as half-day (0.5 nights)
      if (perHour) return 0.5

      // Normalize dates to midnight for accurate calculation
      const normalizedStart = new Date(from)
      normalizedStart.setHours(0, 0, 0, 0)
      const normalizedEnd = new Date(to)
      normalizedEnd.setHours(0, 0, 0, 0)

      const diffDays =
        (normalizedEnd.getTime() - normalizedStart.getTime()) / (1000 * 60 * 60 * 24)
      if (!Number.isFinite(diffDays)) return null

      // Ensure a minimum of 1 "night" for same-day selections
      return Math.max(1, Math.ceil(diffDays))
    },
    [],
  )

  // Recalculate duration when dates change
  useEffect(() => {
    const calculatedDuration = computeSelectedDuration(startDate, endDate, showPerHourPackages)
    if (calculatedDuration != null) {
      setDuration(calculatedDuration)
    }
  }, [startDate, endDate, showPerHourPackages, computeSelectedDuration])

  // Helper function to normalize date to YYYY-MM-DD format for comparison
  const normalizeDateToString = (date: Date | string): string => {
    if (typeof date === 'string') {
      const datePart = date.split('T')[0]
      return datePart || ''
    }
    const isoString = date.toISOString()
    return isoString.split('T')[0] || ''
  }

  // Format date using natural language style (like NaturalLanguageDatePicker)
  const formatDateNatural = (date: Date | null | undefined): string => {
    if (!date) return ''
    return date.toLocaleDateString('en-US', {
      day: '2-digit',
      month: 'long',
      year: 'numeric',
    })
  }

  // Load unavailable dates for the post
  const loadUnavailableDates = async () => {
    // Only load if user is logged in (endpoint requires authentication)
    if (!isLoggedIn) {
      console.log('📅 Skipping unavailable dates load: user not logged in')
      return
    }
    
    try {
      console.log('📅 Loading unavailable dates for postId:', postId)
      const response = await fetch(`/api/bookings/unavailable-dates?postId=${postId}`)
      if (response.ok) {
        const data = await response.json()
        const dates = data.unavailableDates || []
        setUnavailableDates(dates)
        // Debug logging
        console.log('📅 Loaded unavailable dates:', {
          postId,
          count: dates.length,
          rawDates: dates.slice(0, 10),
          normalizedDates: dates.slice(0, 10).map((d: string) => normalizeDateToString(d)),
        })
      } else if (response.status === 401) {
        // User not authenticated - this is expected for logged-out users
        console.log('📅 Unavailable dates require authentication')
      } else {
        const errorText = await response.text().catch(() => 'Unknown error')
        console.error('Failed to load unavailable dates:', {
          status: response.status,
          statusText: response.statusText,
          error: errorText,
        })
      }
    } catch (error) {
      console.error('Error loading unavailable dates:', error)
    }
  }

  // Generate date suggestions based on unavailable dates
  useEffect(() => {
    const generateDateSuggestions = () => {
      if (!isLoggedIn) {
        setDateSuggestions([])
        return
      }

      const unavailableDatesSet = new Set(unavailableDates)
      const today = new Date()
      today.setHours(0, 0, 0, 0)
      const suggestions: Array<{ startDate: Date; endDate: Date; label: string; dayRange?: string }> = []

      // Helper to normalize dates to midnight UTC (matching check-availability.ts)
      const normalizeDate = (date: Date): Date => {
        const normalized = new Date(date)
        normalized.setUTCHours(0, 0, 0, 0)
        return normalized
      }

      // Helper to check if a date range conflicts with unavailable dates
      const hasConflict = (testStart: Date, testEnd: Date): boolean => {
        const checkDate = new Date(testStart)
        while (checkDate < testEnd) {
          const dateStr = checkDate.toISOString()
          if (unavailableDatesSet.has(dateStr)) {
            return true
          }
          checkDate.setUTCDate(checkDate.getUTCDate() + 1)
        }
        return false
      }

      // Generate suggestions for 3, 5, and 7 night stays
      // Spread them across different months for variety
      const durations = [3, 5, 7]
      const todayNormalized = normalizeDate(today)
      
      // Target dates spread across months: 1 week, 1 month, 2 months from now
      const targetDates = [
        new Date(todayNormalized.getTime() + 7 * 24 * 60 * 60 * 1000),   // ~1 week
        new Date(todayNormalized.getTime() + 30 * 24 * 60 * 60 * 1000),  // ~1 month
        new Date(todayNormalized.getTime() + 60 * 24 * 60 * 60 * 1000),  // ~2 months
      ]

      for (const targetDate of targetDates) {
        for (const nights of durations) {
          // Look for available dates around the target date (±7 days)
          const searchWindow = 7
          let found = false
          
          for (let offset = 0; offset <= searchWindow && !found; offset++) {
            // Try dates before and after target
            for (const direction of [-1, 1]) {
              const startDate = new Date(targetDate)
              startDate.setUTCDate(startDate.getUTCDate() + (offset * direction))
              const endDate = new Date(startDate)
              endDate.setUTCDate(endDate.getUTCDate() + nights)

              // Ensure dates are in the future
              if (startDate < todayNormalized) continue

              if (!hasConflict(startDate, endDate)) {
                const startStr = format(startDate, 'MMM d')
                const endStr = format(endDate, 'MMM d')
                const startDay = format(startDate, 'EEE')
                const endDay = format(endDate, 'EEE')
                suggestions.push({
                  startDate,
                  endDate,
                  label: `${startStr} - ${endStr}`,
                  dayRange: `${startDay} - ${endDay}`,
                })
                found = true
                break
              }
            }
          }
        }
      }

      // Sort by start date and limit to 6 suggestions
      suggestions.sort((a, b) => a.startDate.getTime() - b.startDate.getTime())
      setDateSuggestions(suggestions.slice(0, 6))
    }

    generateDateSuggestions()
  }, [unavailableDates, isLoggedIn])

  // Check if selected dates are available
  const checkDateAvailability = async (
    fromDate: Date,
    toDate: Date,
    threadId: number = activeThreadRef.current,
    addMessage: boolean = false, // Only add message when explicitly requested
  ) => {
    if (!fromDate || !toDate) return true
    
    // Prevent duplicate checks for the same date combination
    if (lastCheckedDatesRef.current?.start === fromDate.toISOString() && 
        lastCheckedDatesRef.current?.end === toDate.toISOString() &&
        !addMessage) {
      return areDatesAvailable
    }
    
    // Prevent concurrent checks
    if (availabilityCheckInProgressRef.current) {
      return areDatesAvailable
    }
    
    availabilityCheckInProgressRef.current = true
    setIsCheckingAvailability(true)
    setAvailabilityError(null)
    
    try {
      const params = new URLSearchParams({
        postId,
        startDate: fromDate.toISOString(),
        endDate: toDate.toISOString(),
      })

      const activePackageId = selectedPackage?.id || packages[0]?.id
      if (activePackageId) {
        params.set('packageId', activePackageId)
      }

      const response = await fetch(`/api/bookings/check-availability?${params.toString()}`)
      
      if (response.ok) {
        const data = await response.json()
        const isAvailable = data.isAvailable
        const suggestedDates = data.suggestedDates || []
        
        console.log('📅 Availability check result:', {
          isAvailable,
          suggestedDatesCount: suggestedDates.length,
          suggestedDates,
          addMessage,
          threadId,
          activeThread: activeThreadRef.current,
        })
        
        // Track previous availability to detect changes
        const previousAvailable = previousAvailabilityRef.current
        
        // Update state
        setAreDatesAvailable(isAvailable)
        previousAvailabilityRef.current = isAvailable
        
        // Store the checked dates
        lastCheckedDatesRef.current = {
          start: fromDate.toISOString(),
          end: toDate.toISOString(),
        }
        
        // Add a message to inform the user about availability:
        // 1. If explicitly requested (addMessage = true) AND dates are unavailable - always show
        // 2. If availability changed from available to unavailable - show to notify user
        // 3. Store suggested dates in state for display near input field
        if (!isAvailable && suggestedDates.length > 0) {
          setSuggestedDates(suggestedDates)
        } else if (isAvailable) {
          // Clear suggested dates if dates are available
          setSuggestedDates([])
        }
        
        // 4. Show message if explicitly requested or if availability changed
        const shouldShowMessage = 
          (addMessage && !isAvailable) || // Explicitly requested and unavailable
          (previousAvailable === true && !isAvailable) // Changed from available to unavailable
        
        if (shouldShowMessage && activeThreadRef.current === threadId) {
          const availabilityMessage: Message = {
            role: 'assistant',
            content: `I'm sorry, but the dates you selected (${format(fromDate, 'MMM dd')} to ${format(
              toDate,
              'MMM dd, yyyy',
            )}) are not available.${suggestedDates.length > 0 ? ' Please see suggested dates below.' : ' Please select different dates for your stay.'}`,
            type: 'text',
          }
          console.log('💬 Adding availability message:', {
            addMessage,
            isAvailable,
            previousAvailable,
            suggestedDatesCount: suggestedDates.length,
            message: availabilityMessage,
          })
          appendMessageToThread(threadId, availabilityMessage)
        }
        
        return isAvailable
      } else {
        console.error('Availability check failed:', response.status, response.statusText)
        setAvailabilityError('Failed to check availability')
        return false
      }
    } catch (error) {
      console.error('Error checking availability:', error)
      setAvailabilityError('Failed to check availability')
      return false
    } finally {
      setIsCheckingAvailability(false)
      availabilityCheckInProgressRef.current = false
    }
  }

  // Create checkpoint for an estimate
  const createEstimateCheckpoint = useCallback((estimate: any, messageIndex: number) => {
    const checkpoint: EstimateCheckpoint = {
      id: `checkpoint-${estimate.id}-${Date.now()}`,
      messageIndex,
      estimateId: estimate.id,
      estimate,
      timestamp: new Date(),
    }
    setCheckpoints((prev) => [...prev, checkpoint])
  }, [])

  // Restore to checkpoint
  const restoreToCheckpoint = useCallback((checkpoint: EstimateCheckpoint) => {
    // Restore messages up to checkpoint
    setMessages((prev) => prev.slice(0, checkpoint.messageIndex + 1))
    
    // Restore estimate state
    const estimate = checkpoint.estimate
    setLatestEstimate(estimate)
    
    // Restore dates
    if (estimate.fromDate && estimate.toDate) {
      const from = new Date(estimate.fromDate)
      const to = new Date(estimate.toDate)
      const calcDuration = Math.ceil((to.getTime() - from.getTime()) / (1000 * 60 * 60 * 24))
      
      setStartDate(from)
      setEndDate(to)
      setDuration(calcDuration)
    }
    
    // Restore package if available
    if (estimate.packageType) {
      // Try to find and set the package
      const packageId = estimate.packageType
      const foundPackage = packages.find(pkg => 
        pkg.id === packageId || 
        pkg.yocoId === packageId || 
        (pkg as any).revenueCatId === packageId
      )
      if (foundPackage) {
        setSelectedPackage(foundPackage)
      }
    }
    
    // Remove checkpoints after this one
    setCheckpoints((prev) => prev.filter(cp => cp.messageIndex <= checkpoint.messageIndex))
    
    // Add restoration message
    const restoreMessage: Message = {
      role: 'assistant',
      content: `Restored to estimate checkpoint. Your dates and package selection have been restored.`,
      type: 'text'
    }
    appendMessageToThread(activeThreadRef.current, restoreMessage)
  }, [packages, appendMessageToThread])

  // Load latest estimate for the user
  const loadLatestEstimate = async (force: boolean = false) => {
    if (!isLoggedIn || (estimateLoadedRef.current && !force)) return
    
    try {
      estimateLoadedRef.current = true
      const response = await fetch(`/api/estimates/latest?userId=${currentUser?.id}&postId=${postId}`)
      if (response.ok) {
        const estimate = await response.json()
        if (estimate) {
          setLatestEstimate(estimate)
          
          // Pre-populate dates if available
          if (estimate.fromDate && estimate.toDate) {
            const from = new Date(estimate.fromDate)
            const to = new Date(estimate.toDate)
            const calcDuration = Math.ceil((to.getTime() - from.getTime()) / (1000 * 60 * 60 * 24))
            
            setStartDate(from)
            setEndDate(to)
            setDuration(calcDuration)
          }
          
          // Create checkpoint for this estimate after initial message is set
          // We'll create it after the welcome message, so wait a bit
          setTimeout(() => {
            // Create checkpoint at the end of current messages
            const currentMessageCount = messages.length
            createEstimateCheckpoint(estimate, currentMessageCount > 0 ? currentMessageCount - 1 : 0)
          }, 500)
        }
      }
    } catch (error) {
      console.error('Error loading latest estimate:', error)
    }
  }
  
  // Initialize booking journey on component mount
  useEffect(() => {
    const restored = loadBookingJourney()
    
    // Load unavailable dates for the post
    loadUnavailableDates()

    // Hydrate from shared storage (home/editorial) if present, unless we restored a full journey.
    if (!restored && typeof window !== 'undefined') {
      try {
        const raw = window.localStorage.getItem(dateRangeStorageKey)
        if (raw) {
          const parsed = JSON.parse(raw) as { fromDate?: string; toDate?: string } | null
          const fromStr = typeof parsed?.fromDate === 'string' ? parsed.fromDate : null
          const toStr = typeof parsed?.toDate === 'string' ? parsed.toDate : null
          if (fromStr && toStr) {
            const from = new Date(fromStr)
            const to = new Date(toStr)
            if (!Number.isNaN(from.getTime()) && !Number.isNaN(to.getTime()) && to > from) {
              const calcDuration = Math.ceil((to.getTime() - from.getTime()) / (1000 * 60 * 60 * 24))
              setStartDate(from)
              setEndDate(to)
              setDuration(calcDuration)
            }
          }
        }
      } catch (err) {
        console.warn('Failed to hydrate date range from storage', err)
      }
    }
    
    // Check for fromDate and toDate URL parameters (from property suggestions)
    const fromDateParam = searchParams?.get('fromDate')
    const toDateParam = searchParams?.get('toDate')
    if (fromDateParam && toDateParam && !restored) {
      try {
        const from = new Date(fromDateParam)
        const to = new Date(toDateParam)
        
        // Validate dates
        if (!isNaN(from.getTime()) && !isNaN(to.getTime()) && to > from) {
          const calcDuration = Math.ceil((to.getTime() - from.getTime()) / (1000 * 60 * 60 * 24))
          
          setStartDate(from)
          setEndDate(to)
          setDuration(calcDuration)
          
          // Clear URL parameters after setting dates
          if (typeof window !== 'undefined') {
            const url = new URL(window.location.href)
            url.searchParams.delete('fromDate')
            url.searchParams.delete('toDate')
            router.replace(url.pathname + url.search, { scroll: false })
          }
        }
      } catch (error) {
        console.error('Error parsing date parameters:', error)
      }
    }
    
    // Check for restoreEstimate URL parameter
    const restoreEstimateId = searchParams?.get('restoreEstimate')
    if (restoreEstimateId && isLoggedIn && !restored) {
      // Fetch the estimate directly by ID to get its actual postId
      fetch(`/api/estimates/${restoreEstimateId}`, { credentials: 'include' })
        .then(res => res.json())
        .then(estimate => {
          if (estimate && estimate.id === restoreEstimateId) {
            // Get the estimate's actual post ID
            const estimatePostId = typeof estimate.post === 'string' ? estimate.post : estimate.post?.id
            
            // Only restore if we're on the correct post page
            if (estimatePostId && estimatePostId === postId) {
              // Restore dates
              if (estimate.fromDate && estimate.toDate) {
                const from = new Date(estimate.fromDate)
                const to = new Date(estimate.toDate)
                const calcDuration = Math.ceil((to.getTime() - from.getTime()) / (1000 * 60 * 60 * 24))
                
                setStartDate(from)
                setEndDate(to)
                setDuration(calcDuration)
              }
              
              // Set initial message
              const initialMessage: Message = {
                role: 'assistant',
                content: `Restored to your estimate checkpoint for ${postTitle}. Your dates and package selection have been restored.`,
                type: 'text'
              }
              setMessages([initialMessage])
              
              // Create checkpoint
              setTimeout(() => {
                createEstimateCheckpoint(estimate, 0)
              }, 100)
              
              // Clear URL parameter
              if (typeof window !== 'undefined') {
                router.replace(window.location.pathname, { scroll: false })
              }
            } else if (estimatePostId && estimatePostId !== postId) {
              // Redirect to the correct post if we're on the wrong page
              const estimatePost = typeof estimate.post === 'object' ? estimate.post : null
              const estimatePostSlug = estimatePost?.slug
              if (estimatePostSlug) {
                router.push(`/posts/${estimatePostSlug}?restoreEstimate=${restoreEstimateId}`)
              }
            }
          }
        })
        .catch(console.error)
      return
    }
    
    if (!restored) {
      // Load latest estimate first, then set initial message
      if (isLoggedIn) {
        loadLatestEstimate().then(() => {
          // Check if we need to set an initial message after loading estimate
          if (messages.length === 0) {
            const initialMessage: Message = {
              role: 'assistant',
              content: latestEstimate ? 
                `Welcome back! I see you have an existing estimate for ${postTitle}. I've pre-loaded your previous dates. Feel free to modify them or ask me anything about your booking.` :
                `Hi! I'm here to help you book ${postTitle}. I can help you find the perfect dates, recommend packages based on your needs, and handle your booking. What would you like to know?`,
              type: 'text'
            }
            setMessages([initialMessage])
          }
        })
      } else {
        const initialMessage: Message = {
          role: 'assistant',
          content: `Welcome to ${postTitle}! I can show you available packages and help you get started. Please log in to access the full AI booking experience and complete your reservation.`,
          type: 'text'
        }
        setMessages([initialMessage])
      }
    } else if (isLoggedIn) {
      // Even if journey was restored, still load latest estimate to sync data
      loadLatestEstimate()
    }
  }, [isLoggedIn, searchParams, currentUser?.id, postId, router, createEstimateCheckpoint]) // Added dependencies for checkpoint restoration

  // Refetch latest estimate and unavailable dates when post changes
  useEffect(() => {
    estimateLoadedRef.current = false
    if (isLoggedIn && postId) {
      loadLatestEstimate(true)
    }
    // Reload unavailable dates when postId changes or when user logs in
    if (postId) {
      loadUnavailableDates()
    }
  }, [postId, isLoggedIn])

  // Separate effect to handle initial message after estimate loads
  useEffect(() => {
    if (latestEstimate && messages.length === 0 && isLoggedIn && !estimateLoadedRef.current) {
      const initialMessage: Message = {
        role: 'assistant',
        content: `Welcome back! I see you have an existing estimate for ${postTitle}. I've pre-loaded your previous dates (${format(new Date(latestEstimate.fromDate), 'MMM dd')} to ${format(new Date(latestEstimate.toDate), 'MMM dd, yyyy')}). Feel free to modify them or ask me anything about your booking.`,
        type: 'text'
      }
      setMessages([initialMessage])
    }
  }, [latestEstimate, isLoggedIn]) // Removed messages.length and postTitle from dependencies

  // Save booking journey when state changes
  useEffect(() => {
    if (messages.length > 0 && !journeyLoadedRef.current) {
      saveBookingJourney()
    }
  }, [messages, selectedPackage, duration, startDate, endDate])

  // Update customer entitlement when subscription status changes
  useEffect(() => {
    const entitlement = getCustomerEntitlement(subscriptionStatus)
    setCustomerEntitlement(entitlement)
    
    // Re-filter packages when entitlement changes
    if (originalPackagesRef.current.length > 0) {
      setHasPublicBookablePackages(originalPackagesRef.current.some((pkg) => isPublicBookablePackage(pkg as any)))
      const filtered = filterPackagesByEntitlement(originalPackagesRef.current)
      setPackages(sortPackagesForDisplay(filtered))
    }
  }, [subscriptionStatus, filterPackagesByEntitlement, sortPackagesForDisplay])

  // Load Yoco products when initialized
  useEffect(() => {
    if (isInitialized) {
      loadYocoProducts()
    }
  }, [isInitialized])

  // Load and suggest addons when package and dates are selected
  const loadAndSuggestAddons = useCallback(async () => {
    if (!selectedPackage || !startDate || !endDate || !isLoggedIn) {
      setSuggestedAddons([])
      return
    }

    setIsLoadingAddons(true)
    try {
      // First, fetch available addons for this post
      const addonsResponse = await fetch(`/api/packages/addons/${postId}`)
      if (!addonsResponse.ok) {
        throw new Error('Failed to fetch addons')
      }
      const addonsData = await addonsResponse.json()
      const availableAddons = addonsData.addons || []

      if (availableAddons.length === 0) {
        setSuggestedAddons([])
        setIsLoadingAddons(false)
        return
      }

      // Use AI to suggest relevant addons based on package and dates
      const contextDescription = `Package: ${selectedPackage.name} (${duration} ${duration === 1 ? 'night' : 'nights'}), Dates: ${format(startDate, 'MMM dd')} - ${format(endDate, 'MMM dd, yyyy')}, Property: ${postTitle}`
      
      const suggestResponse = await fetch('/api/packages/suggest', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          description: contextDescription,
          postId,
          baseRate,
          hostContext: false
        })
      })

      if (suggestResponse.ok) {
        const suggestData = await suggestResponse.json()
        const aiRecommendations = suggestData.recommendations || []
        
        // Filter to only addon category recommendations
        const addonRecommendations = aiRecommendations.filter((r: any) => 
          r.details?.category === 'addon'
        )

        // Match AI suggestions with available addons
        const matchedAddons: AddonPackage[] = []
        
        // First, add AI-suggested addons that match available addons
        for (const recommendation of addonRecommendations) {
          const matchedAddon = availableAddons.find((addon: any) => 
            addon.id === recommendation.revenueCatId || 
            addon.revenueCatId === recommendation.revenueCatId ||
            addon.name.toLowerCase().includes(recommendation.suggestedName.toLowerCase()) ||
            recommendation.suggestedName.toLowerCase().includes(addon.name.toLowerCase())
          )
          
          if (matchedAddon) {
            matchedAddons.push({
              id: matchedAddon.id,
              name: matchedAddon.name,
              description: matchedAddon.description || recommendation.description || '',
              baseRate: matchedAddon.baseRate || recommendation.baseRate || 0,
              enabled: false,
              features: matchedAddon.features || recommendation.features || []
            })
          }
        }

        // If no AI matches, show top 1 available addon (sorted by price)
        if (matchedAddons.length === 0 && availableAddons.length > 0) {
          const topAddons = availableAddons
            .slice(0, 1)
            .map((addon: any) => ({
              id: addon.id,
              name: addon.name,
              description: addon.description || '',
              baseRate: addon.baseRate || 0,
              enabled: false,
              features: addon.features || []
            }))
          matchedAddons.push(...topAddons)
        }

        setSuggestedAddons(matchedAddons.slice(0, 1)) // Limit to 1 suggestion
      } else {
        // Fallback: show top 1 available addon if AI fails
        const topAddons = availableAddons
          .slice(0, 1)
          .map((addon: any) => ({
            id: addon.id,
            name: addon.name,
            description: addon.description || '',
            baseRate: addon.baseRate || 0,
            enabled: false,
            features: addon.features || []
          }))
        setSuggestedAddons(topAddons)
      }
    } catch (error) {
      console.error('Error loading addons:', error)
      setSuggestedAddons([])
    } finally {
      setIsLoadingAddons(false)
    }
  }, [selectedPackage, startDate, endDate, duration, postId, postTitle, baseRate, isLoggedIn])

  // Load addons when package and dates change
  useEffect(() => {
    if (selectedPackage && startDate && endDate && isLoggedIn) {
      loadAndSuggestAddons()
    } else {
      setSuggestedAddons([])
      setSelectedAddons(new Set())
    }
  }, [selectedPackage?.id, startDate, endDate, isLoggedIn, loadAndSuggestAddons])

  // Initialize speech recognition and synthesis
  useEffect(() => {
    // Initialize speech recognition
    if (typeof window !== 'undefined') {
      const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition
      if (SpeechRecognition) {
        try {
          recognitionRef.current = new SpeechRecognition()
          recognitionRef.current.continuous = true
          recognitionRef.current.interimResults = true
          recognitionRef.current.lang = 'en-US'

          recognitionRef.current.onresult = async (event: any) => {
            let interimTranscript = ''
            let finalTranscript = ''
            let allTranscript = ''

            for (let i = event.resultIndex; i < event.results.length; i++) {
              const result = event.results[i]
              if (result && result[0]) {
                const transcript = result[0].transcript
                if (result.isFinal) {
                  finalTranscript += transcript + ' '
                  allTranscript += transcript + ' '
                } else {
                  interimTranscript += transcript
                  allTranscript += transcript
                }
              }
            }

            // Always update input with the combined transcript (final + interim)
            // This ensures the user sees their full speech as they speak
            const combinedTranscript = (finalTranscriptRef.current + allTranscript).trim()
            setInput(combinedTranscript)

            // Only process final transcripts when recognition stops (not immediately)
            // This prevents interrupting continuous recognition
            if (finalTranscript) {
              finalTranscriptRef.current = combinedTranscript
            }
          }

          recognitionRef.current.onend = () => {
            // Only restart if we're still supposed to be listening
            // and we haven't manually stopped
            if (isListening && !isProcessingRef.current) {
              // If we have a final transcript, process it before restarting
              if (finalTranscriptRef.current && finalTranscriptRef.current.trim()) {
                const transcriptToProcess = finalTranscriptRef.current.trim()
                finalTranscriptRef.current = ''
                
                // Process the transcript asynchronously without blocking restart
                handleAIRequest(transcriptToProcess).catch((error) => {
                  console.error('Error processing voice input:', error)
                })
              }
              
              // Restart recognition for continuous listening
              try {
                // Small delay to prevent rapid restart loops
                setTimeout(() => {
                  if (isListening && recognitionRef.current) {
                    recognitionRef.current.start()
                  }
                }, 100)
              } catch (error) {
                console.error('Error restarting speech recognition:', error)
                setIsListening(false)
                setMicError('Error with speech recognition. Please try again.')
              }
            } else if (!isListening) {
              // If we manually stopped, process any final transcript
              if (finalTranscriptRef.current && finalTranscriptRef.current.trim()) {
                const transcriptToProcess = finalTranscriptRef.current.trim()
                finalTranscriptRef.current = ''
                handleAIRequest(transcriptToProcess).catch((error) => {
                  console.error('Error processing voice input:', error)
                })
              }
            }
          }

          recognitionRef.current.onerror = (event: any) => {
            console.error('Speech recognition error:', event)
            setMicError('Error with speech recognition. Please try again.')
            setIsListening(false)
          }
        } catch (error) {
          console.error('Error initializing speech recognition:', error)
          setMicError('Speech recognition is not supported in your browser.')
        }
      } else {
        setMicError('Speech recognition is not supported in your browser.')
      }
    }

    // Initialize speech synthesis
    if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
      synthRef.current = window.speechSynthesis
    }

    return () => {
      if (recognitionRef.current) {
        recognitionRef.current.stop()
      }
      if (synthRef.current) {
        synthRef.current.cancel()
      }
    }
  }, [isListening])

  const startListening = () => {
    if (!recognitionRef.current) {
      setMicError('Speech recognition is not available.')
      return
    }

    try {
      setMicError(null)
      finalTranscriptRef.current = ''
      recognitionRef.current.start()
      setIsListening(true)
    } catch (error) {
      console.error('Error starting speech recognition:', error)
      setMicError('Failed to start speech recognition. Please try again.')
      setIsListening(false)
    }
  }

  const stopListening = () => {
    if (recognitionRef.current) {
      try {
        // Set flag to prevent auto-restart
        isProcessingRef.current = false
        recognitionRef.current.stop()
        setIsListening(false)
        
        // Process any remaining transcript
        if (finalTranscriptRef.current && finalTranscriptRef.current.trim()) {
          const transcriptToProcess = finalTranscriptRef.current.trim()
          finalTranscriptRef.current = ''
          handleAIRequest(transcriptToProcess).catch((error) => {
            console.error('Error processing voice input:', error)
          })
        }
      } catch (error) {
        console.error('Error stopping speech recognition:', error)
        setMicError('Error stopping speech recognition.')
        setIsListening(false)
      }
    }
  }

  const speak = (text: string) => {
    if (synthRef.current) {
      const utterance = new SpeechSynthesisUtterance(text)
      utterance.onstart = () => setIsSpeaking(true)
      utterance.onend = () => {
        setIsSpeaking(false)
        // If we're still listening, restart recognition after speaking
        if (isListening && recognitionRef.current) {
          try {
            recognitionRef.current.start()
          } catch (error) {
            console.error('Error restarting speech recognition after speaking:', error)
          }
        }
      }
      synthRef.current.speak(utterance)
    }
  }

  const loadYocoProducts = async () => {
    try {
      const response = await fetch('/api/yoco/products')
      if (!response.ok) {
        throw new Error(`Failed to fetch products: ${response.status}`)
      }
      const data = await response.json()
      setOfferings(data.products || [])
    } catch (err) {
      console.error('Error loading Yoco products:', err)
    }
  }

  const handleBooking = async () => {
    if (!selectedPackage || !isLoggedIn) return
    
    // Prevent booking if dates are not available or if we're still checking
    if (!areDatesAvailable || isCheckingAvailability) {
      setBookingError('Please wait for availability check to complete or select different dates.')
      return
    }
    
    // Double-check availability before proceeding with booking (with addMessage = false to avoid duplicate messages)
    if (startDate && endDate) {
      const isAvailable = await checkDateAvailability(startDate, endDate, activeThreadRef.current, false)
      if (!isAvailable) {
        setBookingError('The selected dates are no longer available. Please choose different dates.')
        return
      }
    }
    
    setIsBooking(true)
    setBookingError(null)
    
    try {
      const packageTotal = selectedPackage.baseRate || calculateTotal(baseRate, duration, selectedPackage.multiplier)
      const addonTotal = Array.from(selectedAddons).reduce((sum, addonId) => {
        const addon = suggestedAddons.find(a => a.id === addonId)
        return sum + (addon?.baseRate || 0)
      }, 0)
      const total = packageTotal + addonTotal
      
      // Create estimate first
      // ALWAYS use package ID (not yocoId/revenueCatId) to avoid ambiguity when multiple packages share the same yocoId
      console.log('Creating estimate with package:', {
        selectedPackage,
        packageType: selectedPackage.id, // Use package ID, not yocoId
        postId,
        total
      })
      
      const estimateData = {
        postId,
        fromDate: startDate?.toISOString() || new Date().toISOString(),
        toDate: endDate?.toISOString() || new Date(Date.now() + duration * 24 * 60 * 60 * 1000).toISOString(),
        guests: [],
        baseRate: total,
        duration,
        customer: currentUser?.id,
        packageType: selectedPackage.id, // Use package ID, not yocoId/revenueCatId
        selectedPackage: {
          package: selectedPackage.id,
          customName: selectedPackage.name,
          enabled: true,
        },
        // Include estimateId if we have a latest estimate for this post to preserve package info
        estimateId: latestEstimate && (typeof latestEstimate.post === 'string' ? latestEstimate.post === postId : latestEstimate.post?.id === postId) 
          ? latestEstimate.id 
          : undefined,
      }
      
      const estimateResponse = await fetch('/api/estimates', {
        method: 'POST',
        credentials: 'include',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(estimateData),
      })
      
      if (!estimateResponse.ok) {
        const errorData = await estimateResponse.json()
        throw new Error(errorData.error || 'Failed to create estimate')
      }
      
      const estimate = await estimateResponse.json()
      
      // Update latest estimate
      setLatestEstimate(estimate)
      
      // Create checkpoint after estimate is created
      // Wait for any confirmation messages to be added first
      setTimeout(() => {
        createEstimateCheckpoint(estimate, messages.length)
      }, 500)
      
      console.log('Available Yoco products:', offerings.map(pkg => ({
        id: pkg.id,
        title: pkg.title
      })))
      console.log('Looking for package with yocoId:', selectedPackage.yocoId)
      console.log('Selected package details:', {
        id: selectedPackage.id,
        name: selectedPackage.name,
        yocoId: selectedPackage.yocoId,
        source: selectedPackage.source
      })
      
      // Handle known package ID mismatches between database and Yoco
      const getYocoPackageId = (yocoId: string) => {
        const mappings: Record<string, string> = {
          'per_night': 'per_night_customer', // Database has per_night, Yoco has per_night_customer
          'Weekly': 'weekly_customer', // Database has Weekly, Yoco has weekly_customer (Standard Weekly)
          'week_x2_customer': 'week_x2_customer', // Database has week_x2_customer, Yoco has week_x2_customer
        }
        return mappings[yocoId] || yocoId
      }
      
      // Find the package in Yoco products (case-insensitive + mapping)
      const yocoProduct = offerings.find((pkg) => {
        const identifier = pkg.id
        const yocoId = selectedPackage.yocoId
        const mappedYocoId = yocoId ? getYocoPackageId(yocoId) : undefined
        
        console.log('Checking Yoco product:', {
          identifier,
          yocoId,
          mappedYocoId,
          matches: identifier === yocoId || 
                   identifier === mappedYocoId ||
                   (identifier && yocoId && identifier.toLowerCase() === yocoId.toLowerCase()) ||
                   (identifier && mappedYocoId && identifier.toLowerCase() === mappedYocoId.toLowerCase())
        })
        
        return identifier === yocoId || 
               identifier === mappedYocoId ||
               (identifier && yocoId && identifier.toLowerCase() === yocoId.toLowerCase()) ||
               (identifier && mappedYocoId && identifier.toLowerCase() === mappedYocoId.toLowerCase())
      })
      
      if (yocoProduct) {
        try {
          // Create Yoco payment link via API
          const response = await fetch('/api/yoco/payment-links', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              productId: yocoProduct.id,
              customerId: String(currentUser.id),
              customerName: currentUser.name || currentUser.email || 'Customer',
              estimateId: estimate.id, // Pass estimate ID so we can create booking after payment
              postId: postId,
              total: total,
              duration: duration,
              startDate: startDate?.toISOString(),
              endDate: endDate?.toISOString(),
              version: 'V2' // Use V2 API keys
            })
          })
          
          if (!response.ok) {
            throw new Error(`Failed to create payment link: ${response.status}`)
          }
          
          const data = await response.json()
          const paymentLink = data.paymentLink
          
          if (!paymentLink) {
            throw new Error('Failed to create payment link')
          }
          
          // Redirect to Yoco payment page
          window.location.href = paymentLink.url
          
        } catch (paymentError: any) {
          console.error('Yoco Payment Link Error:', paymentError)
          throw new Error('Payment link creation failed. Please try again.')
        }
      } else if (selectedPackage.source === 'database') {
        // Handle database packages directly
        try {
          console.log('Creating payment link for database package:', selectedPackage)
          
          const response = await fetch('/api/yoco/payment-links', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              packageData: {
                id: selectedPackage.id,
                name: selectedPackage.name,
                description: selectedPackage.description,
                baseRate: selectedPackage.baseRate,
                yocoId: selectedPackage.yocoId
              },
              customerId: String(currentUser.id),
              customerName: currentUser.name || currentUser.email || 'Customer',
              estimateId: estimate.id, // Pass estimate ID so we can create booking after payment
              postId: postId,
              total: total,
              duration: duration,
              startDate: startDate?.toISOString(),
              endDate: endDate?.toISOString(),
              version: 'V2' // Use V2 API keys
            })
          })
          
          if (!response.ok) {
            throw new Error(`Failed to create payment link: ${response.status}`)
          }
          
          const data = await response.json()
          const paymentLink = data.paymentLink
          
          if (!paymentLink) {
            throw new Error('Failed to create payment link')
          }
          
          // Redirect to Yoco payment page
          window.location.href = paymentLink.url
          
        } catch (paymentError: any) {
          console.error('Yoco Payment Link Error for database package:', paymentError)
          throw new Error('Payment link creation failed. Please try again.')
        }
      } else {
        // Fallback: Package not found in Yoco products
        console.error('❌ Package not found in Yoco products!')
        console.error('❌ Available products:', offerings.map(pkg => pkg.id))
        console.error('❌ Looking for:', selectedPackage.yocoId)
        console.error('❌ Mapped to:', selectedPackage.yocoId ? getYocoPackageId(selectedPackage.yocoId) : 'undefined')
        
        // In production, reject bookings without valid Yoco products
        if (process.env.NODE_ENV === 'production') {
          throw new Error(`Package "${selectedPackage.name}" (${selectedPackage.yocoId}) not found in Yoco. Please contact support.`)
        }
        
        // Development fallback: simulate payment success (DISABLED IN PRODUCTION)
        console.warn('⚠️ DEVELOPMENT MODE: Using fallback payment flow (payment bypassed)')
        console.warn('⚠️ This should NOT happen in production!')
        
        // Confirm the estimate with payment validation (for fallback case - DEV ONLY)
        const confirmResponse = await fetch(`/api/estimates/${estimate.id}/confirm`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            packageType: selectedPackage.yocoId || selectedPackage.id,
            baseRate: total,
            paymentValidated: true, // Mark that payment was successfully processed (fallback case)
            yocoPaymentId: `mock-${Date.now()}`, // Use mock ID for development
            selectedPackage: {
              package: selectedPackage.id,
              customName: selectedPackage.name,
              enabled: true,
            },
          }),
        })
        
        if (!confirmResponse.ok) {
          const errorData = await confirmResponse.json()
          throw new Error(errorData.error || 'Failed to confirm estimate')
        }
        
        const confirmedEstimate = await confirmResponse.json()
        
        // Create booking record AFTER successful estimate confirmation
        await createBookingRecord()
        
        // Clear booking journey after successful booking
        clearBookingJourney()
        
        // Redirect to booking confirmation with mock transaction ID
        router.push(`/booking-confirmation?total=${total}&duration=${duration}&transactionId=mock-${Date.now()}&success=true&estimateId=${estimate.id}`)
      }
      
    } catch (error) {
      console.error('Booking Error:', error)
      setBookingError(error instanceof Error ? error.message : 'An unknown error occurred')
    } finally {
      setIsBooking(false)
    }
  }

  // Create booking record in the database
  const createBookingRecord = async () => {
    if (!startDate || !endDate || !selectedPackage) {
      throw new Error('Start and end dates and a selected package are required')
    }

    const fallbackTotal = selectedPackage.baseRate || calculateTotal(baseRate, duration, selectedPackage.multiplier)
    const bookingData = {
      postId,
      fromDate: startDate.toISOString(),
      toDate: endDate.toISOString(),
      paymentStatus: 'paid',
      customer: currentUser?.id,
      title: postTitle,
      total: selectedPackageTotal ?? fallbackTotal,
      packageType: selectedPackage?.yocoId || selectedPackage?.id,
      selectedPackage: selectedPackage
        ? {
            package: selectedPackage.id,
            customName: selectedPackage.name,
            enabled: true,
          }
        : undefined,
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
    return booking
  }

  // Navigate to estimate details (latest or create then navigate)
  // IMPORTANT: Always update/create estimate with current dates to ensure correct dates are shown
  const handleGoToEstimate = async () => {
    if (!isLoggedIn) {
      router.push('/login')
      return
    }
    try {
      setIsCreatingEstimate(true)
      
      // Always use current dates from state (most recent selection)
      const from = startDate ? startDate.toISOString() : new Date().toISOString()
      const to = endDate
        ? endDate.toISOString()
        : new Date(Date.now() + (duration || 1) * 24 * 60 * 60 * 1000).toISOString()
      const multiplier = selectedPackage?.multiplier ?? 1
      const total = selectedPackage?.baseRate || calculateTotal(baseRate, duration || 1, multiplier)

      // Always create/update estimate with current dates to ensure correct dates are shown
      const resp = await fetch('/api/estimates', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          postId,
          fromDate: from,
          toDate: to,
          guests: [],
          title: `Estimate for ${postId}`,
          packageType: selectedPackage?.yocoId || selectedPackage?.id || 'standard',
          total,
          selectedPackage: selectedPackage
            ? {
                package: selectedPackage.id,
                customName: selectedPackage.name,
                enabled: true,
              }
            : undefined,
          // Include estimateId if we have a latest estimate for this post to update it with new dates
          estimateId: latestEstimate && (typeof latestEstimate.post === 'string' ? latestEstimate.post === postId : latestEstimate.post?.id === postId) 
            ? latestEstimate.id 
            : undefined,
        })
      })
      if (!resp.ok) {
        const err = await resp.json().catch(() => ({}))
        throw new Error(err?.error || 'Failed to create estimate')
      }
      const created = await resp.json()
      // Refresh latest estimate state for future actions
      await loadLatestEstimate(true)
      router.push(`/estimate/${created.id}?tab=guests`)
    } catch (e) {
      console.error('Failed navigating to estimate:', e)
    } finally {
      setIsCreatingEstimate(false)
    }
  }
  
  // Load (and re-load) packages when entitlement changes.
  useEffect(() => {
    void fetchPackagesForPost()
  }, [postId, customerEntitlement])
  
  // Auto-scroll is now handled by Conversation component

  useEffect(() => {
    if (packages.length === 0) {
      return
    }

    // If the user manually selected a package, keep it as long as it still exists.
    if (selectedPackage && packages.some((pkg) => pkg.id === selectedPackage.id)) {
      // If this was an auto-selection and entitlement upgraded, prefer the new top package.
      if (!userSelectedPackageRef.current) {
        const top = packages[0]
        if (top && top.id !== selectedPackage.id) {
          setSelectedPackage(top)
        }
      }
      return
    }

    const nextPackage = packages[0]
    if (nextPackage) {
      setSelectedPackage(nextPackage)
    }
  }, [packages, selectedPackage?.id])
  
  const handleQuickAction = (action: string, data?: any) => {
    const threadId = beginNewThread()
    let message = ''
    
    switch (action) {
      case 'select_dates':
        // Reload unavailable dates when opening the date picker to ensure they're up-to-date
        if (isLoggedIn) {
          loadUnavailableDates()
        }
        
        // If dates are already populated, acknowledge them
        if (startDate && endDate) {
          const acknowledgmentMessage: Message = {
            role: 'assistant',
            content: `I see you already have dates selected: ${format(startDate, 'MMM dd')} to ${format(endDate, 'MMM dd, yyyy')} (${duration} ${duration === 1 ? 'night' : 'nights'}). You can modify them below or ask me to suggest packages for these dates.`,
            type: 'text'
          }
          appendMessageToThread(threadId, acknowledgmentMessage)
        }
        
        const dateMessage: Message = {
          role: 'assistant',
          content: startDate && endDate ? 
            'You can modify your dates below if needed:' : 
            'Please select your check-in and check-out dates:',
          type: 'date_selection'
        }
        appendMessageToThread(threadId, dateMessage)
        return
      case 'suggest_duration':
        message = `For ${postTitle}, I'd recommend considering these durations:\n\n` +
          `• 1-2 nights: Perfect for a quick getaway\n` +
          `• 3-5 nights: Ideal for a relaxing break\n` +
          `• 7+ nights: Great for a longer vacation\n\n` +
          `What duration are you thinking of? I can help you find the perfect package.`
        break
      case 'show_packages':
        if (startDate && endDate) {
          showAvailablePackages(threadId)
          return
        } else {
          message = `I'd love to show you the best packages! To give you personalized recommendations, please select your dates first using the "Select Dates" button above.`
        }
        break
      case 'get_recommendation':
        if (startDate && endDate) {
          message = `Based on your ${duration} ${duration === 1 ? 'night' : 'nights'} stay at ${postTitle}, here are my top recommendations:\n\n` +
            `• For couples: Romantic packages with premium amenities\n` +
            `• For families: Spacious options with kid-friendly features\n` +
            `• For business: Professional packages with work amenities\n\n` +
            `Let me show you the specific packages available for your dates!`
          
          const assistantMessage: Message = { role: 'assistant', content: message, type: 'text' }
          appendMessageToThread(threadId, assistantMessage)
          
          // Show packages after the recommendation message
          setTimeout(() => showAvailablePackages(threadId), 1000)
          return
        } else {
          message = `I'd love to give you personalized recommendations! To suggest the best packages for your needs, please select your travel dates first using the "Select Dates" button above.`
        }
        break
      case 'smart_action':
        // Intelligent action that combines multiple actions based on current state
        if (startDate && endDate) {
          // If dates are selected, check availability first, then show recommendations
          checkDateAvailability(startDate, endDate, threadId, true).then((isAvailable) => {
            if (activeThreadRef.current !== threadId) return
            
            if (isAvailable) {
              // Dates are available - show recommendations and packages
              message = `Great! Your dates (${format(startDate, 'MMM dd')} to ${format(endDate, 'MMM dd, yyyy')}) are available. Here are my recommendations for your ${duration} ${duration === 1 ? 'night' : 'nights'} stay:`
              const assistantMessage: Message = { role: 'assistant', content: message, type: 'text' }
              appendMessageToThread(threadId, assistantMessage)
              setTimeout(() => showAvailablePackages(threadId), 1000)
            } else {
              // Dates not available - availability check will show suggestions
              return
            }
          })
          return
        } else {
          // No dates selected - suggest when to visit and help choose dates
          message = `I'd love to help you plan your visit! For ${postTitle}, I'd recommend:\n\n` +
            `• 1-2 nights: Perfect for a quick getaway\n` +
            `• 3-5 nights: Ideal for a relaxing break\n` +
            `• 7+ nights: Great for a longer vacation\n\n` +
            `Please select your dates above, and I'll show you the best packages and check availability.`
        }
        break
      case 'check_availability':
        if (startDate && endDate) {
          // Check availability and provide feedback (with addMessage = true to show result)
          checkDateAvailability(startDate, endDate, threadId, true).then((isAvailable) => {
            if (activeThreadRef.current !== threadId) return
            const availabilityMessage: Message = {
              role: 'assistant',
              content: isAvailable ? 
                `✅ Great news! Your selected dates (${format(startDate, 'MMM dd')} to ${format(endDate, 'MMM dd, yyyy')}) are available for booking.` :
                `❌ Unfortunately, your selected dates (${format(startDate, 'MMM dd')} to ${format(endDate, 'MMM dd, yyyy')}) are not available. Please select different dates.`,
              type: 'text'
            }
            appendMessageToThread(threadId, availabilityMessage)
          })
          return
        } else {
          message = `To check availability, please select your dates first using the "Select Dates" button above.`
        }
        break
      default:
        message = 'I can help you with that! What would you like to know?'
    }
    
    if (message) {
      const assistantMessage: Message = { role: 'assistant', content: message, type: 'text' }
      appendMessageToThread(threadId, assistantMessage)
    }
  }

  const showAvailablePackages = (threadId: number = activeThreadRef.current) => {
    
    if (threadId !== activeThreadRef.current) {
      return
    }
    
    // Always derive from the full package list (never from top-3 suggestions)
    const sourcePackages =
      originalPackagesRef.current.length > 0 ? originalPackagesRef.current : packages

    // Use existing packages instead of making new API calls
    if (sourcePackages.length > 0) {
      // Apply entitlement filtering first
      const filteredPackages = filterPackagesByEntitlement(sourcePackages)
      
      // Filter packages by duration if dates are selected
      let suitablePackages = filteredPackages
      if (startDate && endDate) {
        const selectedDuration =
          computeSelectedDuration(startDate, endDate, showPerHourPackages) ?? duration
        setDuration(selectedDuration)
        
        // Filter packages that match the duration
        suitablePackages = filteredPackages.filter((pkg: any) => {
          const matches = selectedDuration >= pkg.minNights && selectedDuration <= pkg.maxNights
          // Debug logging for the 7-night package
          if (pkg.id === '68a587eb420e4517de8d2b33' || pkg.name?.includes('Stay 7 nights')) {
            console.log('🔍 Package filtering debug (7-night package):', {
              packageId: pkg.id,
              packageName: pkg.name,
              minNights: pkg.minNights,
              maxNights: pkg.maxNights,
              selectedDuration,
              matches,
              condition: `${selectedDuration} >= ${pkg.minNights} && ${selectedDuration} <= ${pkg.maxNights}`
            })
          }
          return matches
        })
        
        // If no exact matches, include packages that can accommodate the duration
        if (suitablePackages.length === 0) {
          suitablePackages = filteredPackages.filter((pkg: any) => {
            return pkg.maxNights >= selectedDuration || pkg.maxNights === 1 // Include per-night packages
          })
        }
        
        // Debug logging
        console.log('📦 Package filtering summary:', {
          selectedDuration,
          totalFiltered: filteredPackages.length,
          suitableAfterDurationFilter: suitablePackages.length,
          sevenNightPackageFound: suitablePackages.some((pkg: any) => pkg.id === '68a587eb420e4517de8d2b33' || pkg.name?.includes('Stay 7 nights'))
        })
      }
      
      // Filter for per-hour packages (1 night duration) if toggle is on
      // Allow packages that can accommodate 1-night stays (minNights <= 1)
      if (showPerHourPackages) {
        suitablePackages = suitablePackages.filter((pkg: any) => {
          return pkg.minNights <= 1
        })
      }
      
      // Sort packages by relevance and select top 3
      const sortedPackages = suitablePackages.sort((a: any, b: any) => {
        
        // Prioritize packages that exactly match the duration
        const selectedDuration =
          startDate && endDate
            ? computeSelectedDuration(startDate, endDate, showPerHourPackages) ?? duration
            : duration

        const aExactMatch = startDate && endDate ?
          (selectedDuration >= a.minNights && selectedDuration <= a.maxNights) : false
        const bExactMatch = startDate && endDate ?
          (selectedDuration >= b.minNights && selectedDuration <= b.maxNights) : false
        
        if (aExactMatch && !bExactMatch) return -1
        if (!aExactMatch && bExactMatch) return 1

        // Ensure Studio hire is visible for short stays / per-hour mode when it matches
        const isStudioHire = (p: any) =>
          p?.id === '68a58832420e4517de8d2bdb' || String(p?.name || '').includes('Studio hire')

        if (selectedDuration <= 1) {
          const aIsStudio = isStudioHire(a)
          const bIsStudio = isStudioHire(b)
          if (aIsStudio && !bIsStudio) return -1
          if (!aIsStudio && bIsStudio) return 1
        }
        
        // Then sort by category priority (special > hosted > standard)
        // Note: addon packages are filtered out earlier and should not appear here
        // Yoco packages without category field get default priority
        const categoryPriority: Record<string, number> = { special: 3, hosted: 2, standard: 1 }
        const aPriority = a.category ? categoryPriority[a.category as string] || 1 : 1
        const bPriority = b.category ? categoryPriority[b.category as string] || 1 : 1
        
        
        if (aPriority !== bPriority) return bPriority - aPriority
        
        // Finally sort by multiplier (higher first)
        return (b.multiplier || 1) - (a.multiplier || 1)
      })
      
      // Take top 3 packages
      const suggestedPackages = sortedPackages.slice(0, 3)
      
      // Create personalized message based on duration
      let message = ''
      if (startDate && endDate) {
        message = `Based on your ${duration} ${duration === 1 ? 'night' : 'nights'} stay from ${format(startDate, 'MMM dd')} to ${format(endDate, 'MMM dd, yyyy')}, here are my top 3 recommendations:`
      } else {
        message = `Here are my top 3 package recommendations for ${postTitle}:`
      }
      
      const packageMessage: Message = {
        role: 'assistant',
        content: message,
        type: 'package_suggestion',
        data: { packages: suggestedPackages }
      }
      appendMessageToThread(threadId, packageMessage)
    } else {
      // Fallback: load packages if none exist
      fetch(`/api/packages/post/${postId}`, { credentials: 'include' })
        .then(res => res.json())
        .then(data => {
          // Apply entitlement filtering first
          const allPackages = filterPackagesByEntitlement((data.packages || []).filter((pkg: Package) => pkg.isEnabled))
          // Store originals for future re-filtering (do not overwrite the UI list with suggestions)
          originalPackagesRef.current = data.packages || []
          
          // Filter packages by duration if dates are selected
          let suitablePackages = allPackages
          if (startDate && endDate) {
            // Normalize dates to midnight for accurate calculation
            const normalizedStart = new Date(startDate)
            normalizedStart.setHours(0, 0, 0, 0)
            const normalizedEnd = new Date(endDate)
            normalizedEnd.setHours(0, 0, 0, 0)
            
            const selectedDuration = Math.ceil((normalizedEnd.getTime() - normalizedStart.getTime()) / (1000 * 60 * 60 * 24))
            setDuration(selectedDuration)
            
            // Filter packages that match the duration
            suitablePackages = allPackages.filter((pkg: any) => {
              return selectedDuration >= pkg.minNights && selectedDuration <= pkg.maxNights
            })
            
            // If no exact matches, include packages that can accommodate the duration
            if (suitablePackages.length === 0) {
              suitablePackages = allPackages.filter((pkg: any) => {
                return pkg.maxNights >= selectedDuration || pkg.maxNights === 1 // Include per-night packages
              })
            }
          }
          
          // Sort packages by relevance and select top 3
          const sortedPackages = suitablePackages.sort((a: any, b: any) => {
            // Prioritize packages that exactly match the duration
            const aExactMatch = startDate && endDate ? 
              (duration >= a.minNights && duration <= a.maxNights) : false
            const bExactMatch = startDate && endDate ? 
              (duration >= b.minNights && duration <= b.maxNights) : false
            
            if (aExactMatch && !bExactMatch) return -1
            if (!aExactMatch && bExactMatch) return 1
            
            // Then sort by category priority (special > hosted > standard)
            // Note: addon packages are filtered out earlier and should not appear here
            const categoryPriority: Record<string, number> = { special: 3, hosted: 2, standard: 1 }
            const aPriority = categoryPriority[a.category as string] || 1
            const bPriority = categoryPriority[b.category as string] || 1
            
            if (aPriority !== bPriority) return bPriority - aPriority
            
            // Finally sort by multiplier (higher first)
            return (b.multiplier || 1) - (a.multiplier || 1)
          })
          
          // Take top 3 packages
          const suggestedPackages = sortedPackages.slice(0, 3)
          
          // Create personalized message based on duration
          let message = ''
          if (startDate && endDate) {
            message = `Based on your ${duration} ${duration === 1 ? 'night' : 'nights'} stay from ${format(startDate, 'MMM dd')} to ${format(endDate, 'MMM dd, yyyy')}, here are my top 3 recommendations:`
          } else {
            message = `Here are my top 3 package recommendations for ${postTitle}:`
          }
          
          const packageMessage: Message = {
            role: 'assistant',
            content: message,
            type: 'package_suggestion',
            data: { packages: suggestedPackages }
          }
          if (activeThreadRef.current !== threadId) return
          appendMessageToThread(threadId, packageMessage)
        })
        .catch(err => {
          console.error('Error loading packages:', err)
          if (activeThreadRef.current !== threadId) return
          const errorMessage: Message = {
            role: 'assistant',
            content: 'Sorry, I encountered an error loading packages. Please try again.',
            type: 'text'
          }
          appendMessageToThread(threadId, errorMessage)
        })
    }
  }
  
  // Parse dates from user message
  const parseDatesFromMessage = (message: string): { startDate: Date | null; endDate: Date | null; duration: number | null } => {
    const lowerMessage = message.toLowerCase()
    const today = new Date()
    today.setHours(0, 0, 0, 0)
    
    let parsedStartDate: Date | null = null
    let parsedEndDate: Date | null = null
    let parsedDuration: number | null = null
    
    // Try to parse explicit date formats (MM/DD/YYYY, DD/MM/YYYY, YYYY-MM-DD, etc.)
    const datePatterns = [
      /(\d{1,2})\/(\d{1,2})\/(\d{4})/g, // MM/DD/YYYY or DD/MM/YYYY
      /(\d{4})-(\d{1,2})-(\d{1,2})/g, // YYYY-MM-DD
      /(\d{1,2})-(\d{1,2})-(\d{4})/g, // MM-DD-YYYY or DD-MM-YYYY
      /(\w+)\s+(\d{1,2})(?:st|nd|rd|th)?(?:\s+(\d{4}))?/gi, // "January 15" or "Jan 15 2024"
    ]
    
    const dates: Date[] = []
    
    // Try to find explicit dates
    for (const pattern of datePatterns) {
      const matches = [...message.matchAll(pattern)]
      for (const match of matches) {
        try {
          let date: Date
          if (pattern === datePatterns[0] || pattern === datePatterns[2]) {
            // MM/DD/YYYY or DD/MM/YYYY format
            const month = match[1] ? parseInt(match[1]) : 0
            const day = match[2] ? parseInt(match[2]) : 0
            const year = match[3] ? parseInt(match[3]) : 0
            if (month && day && year) {
              date = new Date(year, month - 1, day)
            } else {
              continue
            }
          } else if (pattern === datePatterns[1]) {
            // YYYY-MM-DD format
            if (match[0]) {
              date = new Date(match[0])
            } else {
              continue
            }
          } else {
            // Month name format
            if (match[0]) {
              date = new Date(match[0])
            } else {
              continue
            }
          }
          if (!isNaN(date.getTime())) {
            dates.push(date)
          }
        } catch (e) {
          // Ignore parse errors
        }
      }
    }
    
    // If we found explicit dates, use them
    if (dates.length >= 2) {
      dates.sort((a, b) => a.getTime() - b.getTime())
      parsedStartDate = dates[0] || null
      parsedEndDate = dates[1] || null
      if (parsedStartDate && parsedEndDate) {
        parsedDuration = Math.ceil((parsedEndDate.getTime() - parsedStartDate.getTime()) / (1000 * 60 * 60 * 24))
      }
    } else if (dates.length === 1) {
      parsedStartDate = dates[0] || null
      // Try to infer end date from duration
      if (parsedStartDate && parsedDuration) {
        parsedEndDate = new Date(parsedStartDate.getTime() + parsedDuration * 24 * 60 * 60 * 1000)
      }
    }
    
    // Parse month names with dates (e.g., "December 15", "Dec 15", "December 15-20", "December")
    if (!parsedStartDate || !parsedEndDate) {
      const monthNames = [
        'january', 'february', 'march', 'april', 'may', 'june',
        'july', 'august', 'september', 'october', 'november', 'december'
      ]
      const monthAbbrevs = ['jan', 'feb', 'mar', 'apr', 'may', 'jun', 'jul', 'aug', 'sep', 'oct', 'nov', 'dec']
      
      // Pattern: "December 15" or "Dec 15" or "December 15-20" or "December 15 to 20"
      const monthDatePatterns = [
        /(january|february|march|april|may|june|july|august|september|october|november|december|jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)\s+(\d{1,2})(?:\s*-\s*|\s+to\s+)(\d{1,2})(?:\s*,?\s*(\d{4}))?/gi,
        /(january|february|march|april|may|june|july|august|september|october|november|december|jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)\s+(\d{1,2})(?:\s*,?\s*(\d{4}))?/gi,
      ]
      
      for (const pattern of monthDatePatterns) {
        const matches = [...message.matchAll(pattern)]
        for (const match of matches) {
          try {
            const monthName = match[1]?.toLowerCase() || ''
            const monthIndex = monthNames.indexOf(monthName) !== -1 
              ? monthNames.indexOf(monthName)
              : monthAbbrevs.indexOf(monthName)
            
            if (monthIndex !== -1) {
              const day1 = parseInt(match[2] || '0')
              const day2 = match[3] ? parseInt(match[3]) : null
              const year = match[4] ? parseInt(match[4]) : today.getFullYear()
              
              if (day1 && day2) {
                // Range: "December 15-20"
                parsedStartDate = new Date(year, monthIndex, day1)
                parsedEndDate = new Date(year, monthIndex, day2)
                parsedDuration = day2 - day1
              } else if (day1 && !parsedStartDate) {
                // Single date: "December 15"
                parsedStartDate = new Date(year, monthIndex, day1)
              }
            }
          } catch (e) {
            // Ignore parse errors
          }
        }
      }
      
      // Also check for just month name (e.g., "December" or "in December")
      // This will be combined with duration if available
      if (!parsedStartDate) {
        const monthOnlyPattern = /(?:in\s+)?(january|february|march|april|may|june|july|august|september|october|november|december|jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)(?:\s|$)/gi
        const monthMatch = message.match(monthOnlyPattern)
        if (monthMatch) {
          const monthName = monthMatch[0].replace(/in\s+/gi, '').trim().toLowerCase()
          const monthIndex = monthNames.indexOf(monthName) !== -1 
            ? monthNames.indexOf(monthName)
            : monthAbbrevs.indexOf(monthName)
          
          if (monthIndex !== -1) {
            // Default to first day of the month if no day specified
            const year = today.getFullYear()
            // If the month has passed this year, use next year
            const targetMonth = monthIndex
            const targetYear = (today.getMonth() > monthIndex) ? year + 1 : year
            parsedStartDate = new Date(targetYear, monthIndex, 1)
          }
        }
      }
    }
    
    // Parse relative dates and durations
    if (!parsedStartDate) {
      // "tomorrow", "next week", "next month", etc.
      if (lowerMessage.includes('tomorrow')) {
        parsedStartDate = new Date(today.getTime() + 24 * 60 * 60 * 1000)
      } else if (lowerMessage.includes('next week')) {
        parsedStartDate = new Date(today.getTime() + 7 * 24 * 60 * 60 * 1000)
      } else if (lowerMessage.includes('next month')) {
        parsedStartDate = new Date(today.getFullYear(), today.getMonth() + 1, today.getDate())
      } else if (lowerMessage.includes('in ') && lowerMessage.match(/in\s+(\d+)\s+days?/i)) {
        const daysMatch = lowerMessage.match(/in\s+(\d+)\s+days?/i)
        if (daysMatch && daysMatch[1]) {
          const days = parseInt(daysMatch[1])
          parsedStartDate = new Date(today.getTime() + days * 24 * 60 * 60 * 1000)
        }
      }
    }
    
    // Parse duration (nights, days, weeks)
    // First check for "a week" or "one week" (special case with no number)
    if (lowerMessage.match(/(?:^|\s)(?:a|one)\s+week(?:\s|$)/i)) {
      parsedDuration = 7
    } else {
      const durationPatterns = [
        /(\d+)\s+(?:night|nights)/i,
        /(\d+)\s+(?:day|days)/i,
        /(\d+)\s+(?:week|weeks)/i,
        /for\s+(\d+)/i,
      ]
      
      for (const pattern of durationPatterns) {
        const match = message.match(pattern)
        if (match && match[1]) {
          const value = parseInt(match[1])
          // If pattern matches "week" or "weeks", convert to nights (7 nights per week)
          if (pattern.source.includes('week')) {
            parsedDuration = value * 7
          } else {
            parsedDuration = value
          }
          break
        }
      }
    }
    
    // If we have start date and duration but no end date, calculate it
    if (parsedStartDate && parsedDuration && !parsedEndDate) {
      parsedEndDate = new Date(parsedStartDate.getTime() + parsedDuration * 24 * 60 * 60 * 1000)
    }
    
    // If we have end date and duration but no start date, calculate it
    if (parsedEndDate && parsedDuration && !parsedStartDate) {
      parsedStartDate = new Date(parsedEndDate.getTime() - parsedDuration * 24 * 60 * 60 * 1000)
    }
    
    return {
      startDate: parsedStartDate,
      endDate: parsedEndDate,
      duration: parsedDuration,
    }
  }

  const handleAIRequest = async (message: string) => {
    const trimmedMessage = message.trim()
    if (!trimmedMessage) return

    // Parse dates from user message BEFORE processing
    const parsedDates = parseDatesFromMessage(trimmedMessage)
    
    console.log('📅 Parsed dates from message:', {
      message: trimmedMessage,
      parsedDates: {
        startDate: parsedDates.startDate?.toISOString(),
        endDate: parsedDates.endDate?.toISOString(),
        duration: parsedDates.duration,
      },
      currentState: {
        startDate: startDate?.toISOString(),
        endDate: endDate?.toISOString(),
        duration,
      },
    })
    
    // Update dates if parsed successfully and update estimate
    if (parsedDates.startDate && parsedDates.endDate) {
      const newDuration =
        parsedDates.duration ||
        computeSelectedDuration(parsedDates.startDate, parsedDates.endDate, showPerHourPackages) ||
        duration
      
      // Update state immediately
      setStartDate(parsedDates.startDate)
      setEndDate(parsedDates.endDate)
      setDuration(newDuration)
      
      // Reset package suggestions to allow new suggestions for new dates
      packagesSuggestedRef.current = false
      lastPackageSuggestionKeyRef.current = null
      
      // IMPORTANT: Check availability BEFORE updating estimate to prevent creating estimates with unavailable dates
      console.log('🔍 Checking availability with parsed dates:', {
        startDate: parsedDates.startDate.toISOString(),
        endDate: parsedDates.endDate.toISOString(),
        packageId: selectedPackage?.id,
      })
      
      const isAvailable = await checkDateAvailability(parsedDates.startDate, parsedDates.endDate, activeThreadRef.current, false)
      
      if (!isAvailable) {
        console.warn('⚠️ Dates are not available, skipping estimate update')
        // Don't update estimate if dates are not available
        // The availability check will show suggestions to the user
        // Continue with AI response but don't update estimate
      } else {
        // Only update estimate if dates are available
        if (latestEstimate && isLoggedIn && currentUser) {
          try {
            const total = selectedPackage?.baseRate || calculateTotal(baseRate, newDuration, selectedPackage?.multiplier || 1)
            
            console.log('💾 Updating estimate with new dates:', {
              estimateId: latestEstimate.id,
              fromDate: parsedDates.startDate.toISOString(),
              toDate: parsedDates.endDate.toISOString(),
              duration: newDuration,
            })
            
            const estimateResponse = await fetch('/api/estimates', {
              method: 'POST',
              credentials: 'include',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                postId,
                fromDate: parsedDates.startDate.toISOString(),
                toDate: parsedDates.endDate.toISOString(),
                guests: [],
                baseRate: total,
                duration: newDuration,
                customer: currentUser.id,
                packageType: selectedPackage?.yocoId || selectedPackage?.id || latestEstimate.packageType,
                selectedPackage: selectedPackage ? {
                  package: selectedPackage.id,
                  customName: selectedPackage.name,
                  enabled: true,
                } : latestEstimate.selectedPackage,
                estimateId: latestEstimate.id, // Update existing estimate
              }),
            })
            
            if (estimateResponse.ok) {
              const updatedEstimate = await estimateResponse.json()
              console.log('✅ Estimate updated successfully:', updatedEstimate.id)
              setLatestEstimate(updatedEstimate)
            }
          } catch (error) {
            console.error('❌ Error updating estimate with new dates:', error)
          }
        }
      }
    } else if (parsedDates.duration && startDate) {
      // If we have a duration and existing start date, update end date
      const newEndDate = new Date(startDate.getTime() + parsedDates.duration * 24 * 60 * 60 * 1000)
      
      // Check availability BEFORE updating
      const isAvailable = await checkDateAvailability(startDate, newEndDate, activeThreadRef.current, false)
      
      if (!isAvailable) {
        console.warn('⚠️ Dates are not available, skipping estimate update')
        // Don't update estimate if dates are not available
        // Continue with AI response but don't update estimate
      } else {
        // Only update if available
        setEndDate(newEndDate)
        setDuration(parsedDates.duration)
        packagesSuggestedRef.current = false
        
        // Update estimate if exists
        if (latestEstimate && isLoggedIn && currentUser) {
          try {
            const total = selectedPackage?.baseRate || calculateTotal(baseRate, parsedDates.duration, selectedPackage?.multiplier || 1)
            
            const estimateResponse = await fetch('/api/estimates', {
              method: 'POST',
              credentials: 'include',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                postId,
                fromDate: startDate.toISOString(),
                toDate: newEndDate.toISOString(),
                guests: [],
                baseRate: total,
                duration: parsedDates.duration,
                customer: currentUser.id,
                packageType: selectedPackage?.yocoId || selectedPackage?.id || latestEstimate.packageType,
                selectedPackage: selectedPackage ? {
                  package: selectedPackage.id,
                  customName: selectedPackage.name,
                  enabled: true,
                } : latestEstimate.selectedPackage,
                estimateId: latestEstimate.id,
              }),
            })
            
            if (estimateResponse.ok) {
              const updatedEstimate = await estimateResponse.json()
              setLatestEstimate(updatedEstimate)
            }
          } catch (error) {
            console.error('Error updating estimate with new duration:', error)
          }
        }
      }
    }

    const userMessage: Message = { role: 'user', content: trimmedMessage }
    const threadId = beginNewThread([userMessage])
    setInput('')
    setIsLoading(true)

    const speakSafely = (text: string) => {
      if (activeThreadRef.current === threadId) {
        speak(text)
      }
    }

    try {
      if (trimmedMessage.toLowerCase().includes('debug packages') || 
          trimmedMessage.toLowerCase().includes('debug') ||
          trimmedMessage.toLowerCase().includes('show packages')) {
        try {
          const response = await fetch(`/api/packages/post/${postId}`, { credentials: 'include' })
          if (response.ok) {
            const data = await response.json()
            if (activeThreadRef.current !== threadId) return
            const packages = data.packages || []

            const userEntitlement = currentUser?.role === 'admin'
              ? 'pro'
              : currentUser?.subscriptionStatus?.plan || 'none'

            const debugInfo = `
**Debug Package Information:**
- Total packages found: ${packages.length}
- User role: ${currentUser?.role || 'guest'}
- Subscription plan: ${currentUser?.subscriptionStatus?.plan || 'none'}
- Entitlement level: ${userEntitlement}

**Available Packages:**
${packages.map((pkg: any, index: number) => 
  `${index + 1}. **${pkg.name}**
     - Category: ${pkg.category || 'N/A'}
     - Entitlement: ${pkg.entitlement || 'N/A'}
     - Enabled: ${pkg.isEnabled ? 'Yes' : 'No'}
     - Min/Max nights: ${pkg.minNights}-${pkg.maxNights}
     - Multiplier: ${pkg.multiplier}x
     - Yoco ID: ${pkg.yocoId || 'N/A'}
     - Features: ${pkg.features?.length || 0} features`
).join('\n\n')}

**Filtering Logic:**
- Non-subscribers see: packages with entitlement=none only (any category)
- Standard subscribers see: packages with entitlement=standard only
- Pro subscribers see: entitlement=standard or pro
- Addon packages are filtered out (booking page only)
            `
            
            const assistantMessage: Message = {
              role: 'assistant',
              content: debugInfo,
            }
            appendMessageToThread(threadId, assistantMessage)
            speakSafely("Here's the debug information for packages and entitlements.")
            if (activeThreadRef.current === threadId) {
              setIsLoading(false)
            }
            return
          }
        } catch (error) {
          console.error('Debug packages error:', error)
          if (activeThreadRef.current === threadId) {
            const assistantMessage: Message = {
              role: 'assistant',
              content: 'Sorry, I encountered an error while fetching debug information. Please try again.',
            }
            appendMessageToThread(threadId, assistantMessage)
            setIsLoading(false)
          }
          return
        }
      }
      
      // If user is not logged in, provide basic responses without API call
      if (!isLoggedIn) {
        let response = ''
        const lowerMessage = trimmedMessage.toLowerCase()
        
        if (lowerMessage.includes('package') || lowerMessage.includes('option')) {
          response = `Here are the available packages for ${postTitle}. Please log in for personalized recommendations and to complete your booking.`
          const assistantMessage: Message = {
            role: 'assistant',
            content: response,
            type: 'text',
          }
          appendMessageToThread(threadId, assistantMessage)
          setTimeout(() => showAvailablePackages(threadId), 500)
        } else if (lowerMessage.includes('price') || lowerMessage.includes('cost')) {
          response = `Pricing starts at R${baseRate} per night, with different packages offering various multipliers. Log in to see personalized pricing and complete your booking.`
        } else if (lowerMessage.includes('book') || lowerMessage.includes('reserve')) {
          response = `To complete a booking, please log in first. I'll be able to help you through the entire process once you're logged in!`
        } else {
          response = `I'd love to help you with that! For the full AI assistant experience and personalized recommendations, please log in. I can show you available packages without logging in if you'd like.`
        }
        
        const assistantMessage: Message = {
          role: 'assistant',
          content: response,
          type: 'text',
        }
        appendMessageToThread(threadId, assistantMessage)
        if (activeThreadRef.current === threadId) {
          setIsLoading(false)
        }
        return
      }
      
      // For logged-in users, use the full AI API with enhanced context
      // IMPORTANT: Use parsed dates directly (not from state) since state updates are async
      // This ensures the AI sees the dates the user just entered
      const effectiveStartDate = parsedDates.startDate || startDate
      const effectiveEndDate = parsedDates.endDate || endDate
      const effectiveDuration =
        parsedDates.duration ||
        (effectiveStartDate && effectiveEndDate
          ? computeSelectedDuration(effectiveStartDate, effectiveEndDate, showPerHourPackages) || duration
          : duration)
      
      // Format related posts with titles and slugs for better AI reference
      const relatedPostsList = Array.isArray(relatedPosts) && relatedPosts.length > 0
        ? relatedPosts
            .filter((p: any) => typeof p === 'object' && p !== null)
            .map((p: any) => {
              const title = p.title || 'Untitled'
              const slug = p.slug ? ` (${p.slug})` : ''
              return `${title}${slug}`
            })
            .join(', ')
        : 'None'

      // Extract plain text from post content
      const fullContentTextRaw = extractPlainTextFromContent(postContent)
      // Limit to a reasonable length to avoid token overuse while keeping relevance
      const fullContentText = (fullContentTextRaw || 'No content available').split('\n').map((l: string) => l.trim()).filter(Boolean).join('\n')
      const CONTENT_LIMIT = 60000
      const limitedContentText = fullContentText.length > CONTENT_LIMIT ? fullContentText.slice(0, CONTENT_LIMIT) + '\n[...truncated...]' : fullContentText

      const contextString = `
Property Context:
- Title: ${postTitle}
- Description: ${postDescription}
- Base Rate: R${baseRate}
- Post ID: ${postId}
- Related Posts: ${relatedPostsList}

Article Content:
${limitedContentText}

Current Booking State:
- Selected Package: ${selectedPackage?.name || 'None'}
- Duration: ${effectiveDuration} ${effectiveDuration === 1 ? 'night' : 'nights'}
- Start Date: ${effectiveStartDate ? format(effectiveStartDate, 'MMM dd, yyyy') : 'Not selected'}
- End Date: ${effectiveEndDate ? format(effectiveEndDate, 'MMM dd, yyyy') : 'Not selected'}
- Available Packages: ${packages.length}
- User Entitlement: ${customerEntitlement}

Availability Status:
- Are dates available: ${areDatesAvailable ? 'Yes' : 'No'}
- Currently checking availability: ${isCheckingAvailability ? 'Yes' : 'No'}
${parsedDates.startDate && parsedDates.endDate ? `\nIMPORTANT: User just requested dates: ${format(parsedDates.startDate, 'MMM dd, yyyy')} to ${format(parsedDates.endDate, 'MMM dd, yyyy')}. Use these dates in your response, not any previously mentioned dates.` : ''}
      `
      
      const response = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          message: `${contextString}\n\nUser question: ${message}`,
          context: 'smart-estimate'
        })
      })
      
      if (!response.ok) {
        if (response.status === 401) {
          throw new Error('Please log in to use the AI assistant.')
        }
        throw new Error(`Server error: ${response.status}`)
      }
      
      const data = await response.json()
      if (activeThreadRef.current !== threadId) return
      
      if (!data.message) {
        throw new Error('No response from AI assistant.')
      }
      
      const assistantMessage: Message = {
        role: 'assistant',
        content: data.message,
        type: 'text',
      }
      appendMessageToThread(threadId, assistantMessage)
      speakSafely(data.message)

      if (data.showPackages === true) {
        setTimeout(() => showAvailablePackages(threadId), 300)
      } else if (
        typeof data.message === 'string' &&
        (data.message.toLowerCase().includes('package') || data.message.toLowerCase().includes('option'))
      ) {
        // Back-compat fallback for older API responses
        setTimeout(() => showAvailablePackages(threadId), 1000)
      }
      
    } catch (error) {
      console.error('Error:', error)
      if (activeThreadRef.current === threadId) {
        const errorMessage: Message = {
          role: 'assistant',
          content:
            error instanceof Error
              ? error.message
              : 'Sorry, I encountered an error. Please try again or use the quick actions above.',
          type: 'text',
        }
        appendMessageToThread(threadId, errorMessage)
        speakSafely(error instanceof Error ? error.message : 'Sorry, I encountered an error.')
      }
    } finally {
      if (activeThreadRef.current === threadId) {
        setIsLoading(false)
      }
    }
  }
  
  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    handleAIRequest(input)
  }

  const handlePromptSubmit = (message: PromptInputMessage) => {
    if (message.text?.trim()) {
      handleAIRequest(message.text)
      setInput('')
    }
  }
  
  const renderMessage = (message: Message, index: number) => {
    if (message.type === 'package_suggestion') {
      const { packages: suggestedPackages } = message.data || { packages: [] }
      return (
        <>
          <div className="rounded-2xl rounded-tl-sm px-4 py-3 text-sm leading-6 bg-zinc-100 dark:bg-zinc-800 text-slate-900 dark:text-slate-100 mb-4">
            {message.content || 'Here are the available packages:'}
          </div>
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ delay: 0.2 }}
            className="mt-4 w-full max-w-md"
          >
            {suggestedPackages.map((pkg: Package, pkgIndex: number) => (
              <motion.div
                key={`${pkg.id}-${pkgIndex}`}
                whileHover={{ scale: 1.02 }}
                className="cursor-pointer bg-white dark:bg-zinc-800 text-slate-950 dark:text-slate-100 shadow-sm border border-zinc-200 dark:border-zinc-700 rounded-xl overflow-hidden hover:shadow-md transition-shadow group mb-4"
                onClick={() => {
                  userSelectedPackageRef.current = true
                  setSelectedPackage(pkg)
                  const confirmMessage: Message = {
                    role: 'assistant',
                    content: `Great choice! You've selected "${pkg.name}". This package includes: ${pkg.features.join(', ')}. Would you like to proceed with booking or do you have any questions?`,
                    type: 'text'
                  }
                  appendMessageToThread(activeThreadRef.current, confirmMessage)
                }}
              >
                <div className="p-5 border-b border-zinc-100 dark:border-zinc-700 bg-gradient-to-br from-teal-50/50 dark:from-teal-900/20 to-transparent">
                  <div className="flex items-start justify-between gap-4">
                    <div>
                      <h3 className="text-base font-semibold text-slate-900 dark:text-slate-100">
                        {pkg.name}
                      </h3>
                      <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                        {pkg.description}
                      </p>
                    </div>
                    <div className="text-right">
                      <div className="text-xl font-bold text-teal-600 dark:text-teal-400">
                        R{pkg.baseRate || calculateTotal(baseRate, duration, pkg.multiplier).toFixed(0)}
                      </div>
                      <div className="text-xs text-slate-400 dark:text-slate-500">
                        {pkg.baseRate ? 'Fixed price' : pkg.multiplier === 1 ? 'Base rate' : `${pkg.multiplier}x multiplier`}
                      </div>
                    </div>
                  </div>
                </div>
                <div className="p-4 bg-white dark:bg-zinc-800">
                  <div className="space-y-2">
                    {pkg.features.slice(0, 3).map((feature, idx) => (
                      <div key={idx} className="flex items-center text-xs text-slate-600 dark:text-slate-300">
                        <span className="w-1.5 h-1.5 bg-teal-400 rounded-full mr-2"></span>
                        {typeof feature === 'string' ? feature : (feature as any).feature}
                      </div>
                    ))}
                  </div>
                </div>
              </motion.div>
            ))}
          </motion.div>
        </>
      )
    }
    
    if (message.type === 'date_suggestion') {
      const { suggestedDates } = message.data || { suggestedDates: [] }
      console.log('🎯 Rendering date_suggestion message:', {
        messageType: message.type,
        suggestedDatesCount: suggestedDates.length,
        suggestedDates,
        messageData: message.data,
      })
      
      if (!suggestedDates || suggestedDates.length === 0) {
        console.warn('⚠️ date_suggestion message has no suggestedDates')
        // Fall back to text message if no suggestions
        return (
          <div key={index} className="bg-muted dark:bg-zinc-800 p-3 rounded-lg">
            <p className="text-sm text-slate-900 dark:text-slate-100">{message.content}</p>
          </div>
        )
      }
      
      return (
        <Message key={index} from="assistant">
          <MessageContent>
            <MessageResponse>{message.content}</MessageResponse>
            {suggestedDates.length > 0 && (
              <div className="mt-4">
                <Suggestions>
                  {suggestedDates.map((suggestion: { startDate: string; endDate: string; duration: number }, idx: number) => {
                    const suggestionStart = new Date(suggestion.startDate)
                    const suggestionEnd = new Date(suggestion.endDate)
                    
                    // Validate dates
                    if (isNaN(suggestionStart.getTime()) || isNaN(suggestionEnd.getTime())) {
                      console.error('❌ Invalid date in suggestion:', suggestion)
                      return null
                    }
                    
                    const suggestionText = `${format(suggestionStart, 'MMM dd')} - ${format(suggestionEnd, 'MMM dd')}`
                    
                    return (
                      <Suggestion
                        key={idx}
                        suggestion={suggestionText}
                        onClick={() => {
                          setStartDate(suggestionStart)
                          setEndDate(suggestionEnd)
                          setDuration(suggestion.duration)
                          preservedStartDateRef.current = suggestionStart
                          
                          // Check availability for the new dates
                          checkDateAvailability(suggestionStart, suggestionEnd, activeThreadRef.current, false)
                          
                          const confirmMessage: Message = {
                            role: 'assistant',
                            content: `Great! I've updated your dates to ${format(suggestionStart, 'MMM dd')} - ${format(suggestionEnd, 'MMM dd, yyyy')} (${suggestion.duration} ${suggestion.duration === 1 ? 'night' : 'nights'}).`,
                            type: 'text'
                          }
                          appendMessageToThread(activeThreadRef.current, confirmMessage)
                        }}
                        className="text-xs"
                      />
                    )
                  })}
                </Suggestions>
              </div>
            )}
          </MessageContent>
        </Message>
      )
    }
    
    if (message.type === 'date_selection') {
      // Log when date selection UI is rendered to verify unavailableDates are loaded
      console.log('📅 Date selection UI rendered:', {
        unavailableDatesCount: unavailableDates.length,
        unavailableDates: unavailableDates.slice(0, 5),
        isLoggedIn,
      })
      
      return (
        <div key={index} className="space-y-4">
          <div className="bg-muted dark:bg-zinc-800 p-3 rounded-lg">
            <p className="text-sm text-slate-900 dark:text-slate-100">{message.content}</p>
            {startDate && endDate && (
              <p className="text-xs text-muted-foreground dark:text-slate-400 mt-2">
                Current selection: {format(startDate, 'MMM dd')} - {format(endDate, 'MMM dd, yyyy')} ({duration} {duration === 1 ? 'night' : 'nights'})
              </p>
            )}
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="text-xs text-muted-foreground dark:text-slate-400 mb-1 block">Start Date</label>
              <Popover>
                <PopoverTrigger asChild>
                  <Button
                    variant="outline"
                    className={cn(
                      'w-full justify-start text-left font-normal text-xs h-9',
                      !startDate && 'text-muted-foreground',
                    )}
                  >
                    <CalendarIcon className="mr-2 h-3 w-3" />
                    {startDate ? formatDateNatural(startDate) : <span>Select start date</span>}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="start">
                  <CalendarComponent
                    mode="single"
                    selected={startDate || undefined}
                    onSelect={(date) => {
                      if (date) {
                        // Normalize to start of day
                        const normalizedDate = new Date(date)
                        normalizedDate.setHours(0, 0, 0, 0)
                        
                        // Update preserved date
                        preservedStartDateRef.current = normalizedDate
                        setStartDate(normalizedDate)
                        packagesSuggestedRef.current = false
                        
                        // Only adjust endDate if it's before the new startDate
                        if (endDate && normalizedDate > endDate) {
                          setEndDate(new Date(normalizedDate.getTime() + duration * 24 * 60 * 60 * 1000))
                        }
                      }
                    }}
                    disabled={(date) => {
                      // Normalize to UTC midnight for consistent comparison with unavailable dates
                      const today = new Date()
                      const todayUTC = new Date(Date.UTC(
                        today.getUTCFullYear(),
                        today.getUTCMonth(),
                        today.getUTCDate()
                      ))
                      
                      const checkDateUTC = new Date(Date.UTC(
                        date.getUTCFullYear(),
                        date.getUTCMonth(),
                        date.getUTCDate()
                      ))
                      
                      // Disable past dates
                      if (checkDateUTC < todayUTC) return true
                      
                      // Normalize date to YYYY-MM-DD format for comparison (UTC)
                      const dateStr = normalizeDateToString(checkDateUTC)
                      
                      // Check if this date is unavailable by comparing date parts
                      const isUnavailable = unavailableDates.some((unavailableDateStr) => {
                        const unavailableDatePart = normalizeDateToString(unavailableDateStr)
                        return unavailableDatePart === dateStr
                      })
                      
                      // Debug logging for unavailable dates check
                      if (isUnavailable && unavailableDates.length > 0) {
                        console.log('📅 Calendar: Date disabled as unavailable', {
                          checkDate: dateStr,
                          unavailableDatesCount: unavailableDates.length,
                          sampleUnavailableDates: unavailableDates.slice(0, 3).map(d => normalizeDateToString(d)),
                        })
                      }
                      
                      if (isUnavailable) return true
                      
                      return false
                    }}
                  />
                </PopoverContent>
              </Popover>
            </div>
            <div>
              <label className="text-xs text-muted-foreground dark:text-slate-400 mb-1 block">End Date</label>
              <Popover>
                <PopoverTrigger asChild>
                  <Button
                    variant="outline"
                    className={cn(
                      'w-full justify-start text-left font-normal text-xs h-9',
                      !endDate && 'text-muted-foreground',
                    )}
                  >
                    <CalendarIcon className="mr-2 h-3 w-3" />
                    {endDate ? formatDateNatural(endDate) : <span>Select end date</span>}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="start">
                  <CalendarComponent
                    mode="single"
                    selected={endDate || undefined}
                    onSelect={(date) => {
                      if (date) {
                        // Normalize to start of day
                        const normalizedDate = new Date(date)
                        normalizedDate.setHours(0, 0, 0, 0)
                        
                        setEndDate(normalizedDate)
                        packagesSuggestedRef.current = false
                        
                        // CRITICAL FIX: Preserve startDate when selecting endDate
                        // Only adjust startDate if endDate is actually before startDate (user error case)
                        if (startDate && preservedStartDateRef.current) {
                          const startDateOnly = new Date(startDate)
                          startDateOnly.setHours(0, 0, 0, 0)
                          const endDateOnly = new Date(normalizedDate)
                          endDateOnly.setHours(0, 0, 0, 0)
                          
                          // Only adjust if end date is actually before start date (not equal)
                          if (endDateOnly < startDateOnly) {
                            // Calculate new start date based on duration, but don't go before today
                            const today = new Date()
                            today.setHours(0, 0, 0, 0)
                            const newStartDate = new Date(endDateOnly.getTime() - duration * 24 * 60 * 60 * 1000)
                            // Only update if the calculated date is valid and not before today
                            if (newStartDate >= today) {
                              setStartDate(newStartDate)
                              preservedStartDateRef.current = newStartDate
                            }
                          } else {
                            // If endDate is valid and >= startDate, ensure startDate is preserved
                            if (preservedStartDateRef.current && startDate.getTime() !== preservedStartDateRef.current.getTime()) {
                              setStartDate(preservedStartDateRef.current)
                            }
                          }
                        }
                      }
                    }}
                    disabled={(date) => {
                      // Normalize to UTC midnight for consistent comparison with unavailable dates
                      const today = new Date()
                      const todayUTC = new Date(Date.UTC(
                        today.getUTCFullYear(),
                        today.getUTCMonth(),
                        today.getUTCDate()
                      ))
                      
                      const checkDateUTC = new Date(Date.UTC(
                        date.getUTCFullYear(),
                        date.getUTCMonth(),
                        date.getUTCDate()
                      ))
                      
                      // Disable if no start date selected
                      if (!startDate) return true
                      
                      // Disable past dates
                      if (checkDateUTC < todayUTC) return true
                      
                      // Disable dates before or equal to start date (normalize startDate to UTC)
                      const startDateUTC = new Date(Date.UTC(
                        startDate.getUTCFullYear(),
                        startDate.getUTCMonth(),
                        startDate.getUTCDate()
                      ))
                      if (checkDateUTC <= startDateUTC) return true
                      
                      // Normalize date to YYYY-MM-DD format for comparison (UTC)
                      const dateStr = normalizeDateToString(checkDateUTC)
                      
                      // Check if this date is unavailable by comparing date parts
                      const isUnavailable = unavailableDates.some((unavailableDateStr) => {
                        const unavailableDatePart = normalizeDateToString(unavailableDateStr)
                        return unavailableDatePart === dateStr
                      })
                      
                      if (isUnavailable) return true
                      
                      // Disable if there are unavailable dates between startDate and this date
                      if (hasUnavailableDateBetween(unavailableDates, startDate, date)) return true
                      
                      return false
                    }}
                  />
                </PopoverContent>
              </Popover>
            </div>
          </div>
          {/* Show suggested dates when unavailable */}
          {suggestedDates.length > 0 && (
            <div className="space-y-2">
              <p className="text-xs text-muted-foreground dark:text-slate-400">Suggested available dates:</p>
              <Suggestions>
                {suggestedDates.map((suggestion, idx) => {
                  const suggestionStart = new Date(suggestion.startDate)
                  const suggestionEnd = new Date(suggestion.endDate)
                  
                  if (isNaN(suggestionStart.getTime()) || isNaN(suggestionEnd.getTime())) {
                    return null
                  }
                  
                  const suggestionText = `${format(suggestionStart, 'MMM dd')} - ${format(suggestionEnd, 'MMM dd')}`
                  
                  return (
                    <Suggestion
                      key={idx}
                      suggestion={suggestionText}
                      onClick={() => {
                        setStartDate(suggestionStart)
                        setEndDate(suggestionEnd)
                        setDuration(suggestion.duration)
                        preservedStartDateRef.current = suggestionStart
                        setSuggestedDates([]) // Clear suggestions after selection
                        checkDateAvailability(suggestionStart, suggestionEnd, activeThreadRef.current, false)
                      }}
                    />
                  )
                })}
              </Suggestions>
            </div>
          )}
          <div className="flex gap-2 items-center">
            <div className="flex items-center gap-2 px-3 py-1.5 border border-zinc-200 dark:border-zinc-700 rounded-md bg-white dark:bg-zinc-800">
              <Switch
                id="per-hour-toggle"
                checked={showPerHourPackages}
                onCheckedChange={(checked) => {
                  setShowPerHourPackages(checked)
                  if (checked) {
                    // Preserve existing start date if one is selected, otherwise default to tomorrow
                    const today = new Date()
                    today.setHours(0, 0, 0, 0)
                    const tomorrow = new Date(today.getTime() + 24 * 60 * 60 * 1000)
                    tomorrow.setHours(0, 0, 0, 0)
                    
                    // Use existing start date if it's valid and in the future, otherwise use tomorrow
                    const newStartDate = (startDate && startDate >= today) ? startDate : tomorrow
                    const newEndDate = new Date(newStartDate.getTime() + 24 * 60 * 60 * 1000) // 1 night
                    
                    setStartDate(newStartDate)
                    setEndDate(newEndDate)
                    setDuration(0.5)
                    // Reset to allow new package suggestions
                    packagesSuggestedRef.current = false
                  }
                }}
              />
              <Label htmlFor="per-hour-toggle" className="text-xs cursor-pointer text-slate-700 dark:text-slate-300">
                per hour
              </Label>
            </div>
            <Button 
              size="sm" 
              variant="outline"
              onClick={() => {
                const today = new Date()
                const tomorrow = new Date(today.getTime() + 24 * 60 * 60 * 1000)
                const endDate = new Date(today.getTime() + 3 * 24 * 60 * 60 * 1000) // 3 nights
                setStartDate(tomorrow)
                setEndDate(endDate)
                setShowPerHourPackages(false) // Turn off per-hour toggle
                // Reset to allow new package suggestions
                packagesSuggestedRef.current = false
              }}
            >
              Quick 3 Nights
            </Button>
            <Button 
              size="sm" 
              variant="outline"
              onClick={() => {
                const today = new Date()
                const nextWeek = new Date(today.getTime() + 7 * 24 * 60 * 60 * 1000)
                const endDate = new Date(nextWeek.getTime() + 5 * 24 * 60 * 60 * 1000) // 5 nights
                setStartDate(nextWeek)
                setEndDate(endDate)
                setShowPerHourPackages(false) // Turn off per-hour toggle
                // Reset to allow new package suggestions
                packagesSuggestedRef.current = false
              }}
            >
              Next Week (5 Nights)
            </Button>
            {/* Removed Confirm Dates button - dates update automatically when user requests them */}
          </div>
        </div>
      )
    }
    
    // Default text message rendering with Magic Patterns styling
    return (
      <div
        className={`rounded-2xl px-4 py-3 text-sm leading-6 ${message.role === 'user' ? 'bg-slate-900 dark:bg-slate-100 text-white dark:text-slate-900 rounded-tr-sm' : 'bg-zinc-100 dark:bg-zinc-800 text-slate-900 dark:text-slate-100 rounded-tl-sm'}`}
      >
        {message.content || 'No content'}
      </div>
    )
  }
  
  // Save booking journey to session storage
  const saveBookingJourney = () => {
    if (typeof window === 'undefined') return
    
    // Clear existing timeout
    if (saveTimeoutRef.current) {
      clearTimeout(saveTimeoutRef.current)
    }
    
    // Debounce the save operation
    saveTimeoutRef.current = setTimeout(() => {
      const journeyData = {
        messages,
        selectedPackage,
        duration,
        startDate: startDate?.toISOString(),
        endDate: endDate?.toISOString(),
        timestamp: Date.now()
      }
      
      try {
        sessionStorage.setItem(sessionKey, JSON.stringify(journeyData))
        // Removed excessive logging
      } catch (error) {
        console.error('Error saving booking journey:', error)
      }
    }, 1000) // Save after 1 second of inactivity
  }

  // Load booking journey from session storage
  const loadBookingJourney = () => {
    if (typeof window === 'undefined' || journeyLoadedRef.current) return
    
    try {
      const savedData = sessionStorage.getItem(sessionKey)
      if (savedData) {
        const journeyData = JSON.parse(savedData)
        const now = Date.now()
        const oneHour = 60 * 60 * 1000 // 1 hour in milliseconds
        
        // Only restore if data is less than 1 hour old
        if (now - journeyData.timestamp < oneHour) {
          journeyLoadedRef.current = true
          
          setMessages(journeyData.messages || [])
          setSelectedPackage(journeyData.selectedPackage || null)
          setDuration(journeyData.duration || 1)
          setStartDate(journeyData.startDate ? new Date(journeyData.startDate) : null)
          setEndDate(journeyData.endDate ? new Date(journeyData.endDate) : null)
          
          // Show welcome back message if we have a selected package
          if (journeyData.selectedPackage) {
            const welcomeBackMessage: Message = {
              role: 'assistant',
              content: `Welcome back! I see you were looking at the "${journeyData.selectedPackage.name}" package. Your selected dates are ${journeyData.startDate ? format(new Date(journeyData.startDate), 'MMM dd') : 'not set'} to ${journeyData.endDate ? format(new Date(journeyData.endDate), 'MMM dd, yyyy') : 'not set'}. Would you like to continue with your booking?`,
              type: 'text'
            }
            appendMessageToThread(activeThreadRef.current, welcomeBackMessage)
          }
          
          return true
        } else {
          sessionStorage.removeItem(sessionKey)
        }
      }
    } catch (error) {
      console.error('Error loading booking journey:', error)
      sessionStorage.removeItem(sessionKey)
    }
    
    return false
  }

  // Clear booking journey
  const clearBookingJourney = () => {
    if (typeof window === 'undefined') return
    sessionStorage.removeItem(sessionKey)
  }
  
  // Auto-suggest packages after date selection
  const suggestPackagesAfterDateSelection = () => {
    if (startDate && endDate) {
      const threadId = activeThreadRef.current
      const suggestionMessage: Message = {
        role: 'assistant',
        content: `Great! I see you've selected ${duration} ${duration === 1 ? 'night' : 'nights'} from ${format(startDate, 'MMM dd')} to ${format(endDate, 'MMM dd, yyyy')}. Let me find the perfect packages for your stay...`,
        type: 'text'
      }
      appendMessageToThread(threadId, suggestionMessage)
      
      // Show packages after a brief delay
      setTimeout(() => {
        showAvailablePackages(threadId)
      }, 1000)
    }
  }

  // Update duration when dates change, re-check availability, and decide when to show packages
  useEffect(() => {
    if (!startDate || !endDate) return

    const newDuration = computeSelectedDuration(startDate, endDate, showPerHourPackages) ?? duration
    if (newDuration !== duration) {
      setDuration(newDuration)
    }

    // Check availability without adding messages automatically (to prevent infinite loops)
    // Only check if dates have actually changed
    const lastChecked = lastCheckedDatesRef.current
    if (!lastChecked || lastChecked.start !== startDate.toISOString() || lastChecked.end !== endDate.toISOString()) {
      // Check availability when dates change
      // If dates are unavailable, show suggestions (addMessage = true)
      // This ensures users see alternative dates when they select unavailable dates
      checkDateAvailability(startDate, endDate, activeThreadRef.current, true)
    }

    if (packagesSuggestedRef.current) {
      // Don't spam messages, but still allow re-suggesting when the selection changes
    }

    const selectionKey = `${startDate.toISOString()}|${endDate.toISOString()}|${showPerHourPackages ? 'per_hour' : 'per_night'}`
    if (lastPackageSuggestionKeyRef.current === selectionKey) {
      return
    }
    lastPackageSuggestionKeyRef.current = selectionKey

    if (latestEstimate && latestEstimate.fromDate && latestEstimate.toDate) {
      const estimateFrom = new Date(latestEstimate.fromDate)
      const estimateTo = new Date(latestEstimate.toDate)
      const isFromEstimate =
        startDate.getTime() === estimateFrom.getTime() && endDate.getTime() === estimateTo.getTime()

      if (isFromEstimate && messages.length > 0) {
        packagesSuggestedRef.current = true
        const threadId = activeThreadRef.current
        setTimeout(() => {
          if (activeThreadRef.current !== threadId) {
            return
          }
          const welcomeBackMessage: Message = {
            role: 'assistant',
            content: `I've loaded your previous booking for ${newDuration} ${
              newDuration === 1 ? 'night' : 'nights'
            } from ${format(startDate, 'MMM dd')} to ${format(
              endDate,
              'MMM dd, yyyy',
            )}. Here are the available packages for your stay:`,
            type: 'text',
          }
          appendMessageToThread(threadId, welcomeBackMessage)

          setTimeout(() => {
            showAvailablePackages(threadId)
          }, 500)
        }, 1000)
        return
      }
    }

    // If user is actively changing dates, re-suggest packages for the new selection
    packagesSuggestedRef.current = true
    suggestPackagesAfterDateSelection()
  }, [startDate, endDate, latestEstimate, duration, showPerHourPackages, computeSelectedDuration])

  useEffect(() => {
    if (typeof window === 'undefined') return

    const key = `ai:estimateHistory:${postId}_${currentUser?.id || 'guest'}`
    historyKeyRef.current = key

    try {
      const existing: any[] = JSON.parse(window.localStorage.getItem(key) ?? '[]')
      window.dispatchEvent(
        new CustomEvent('aiHistoryUpdate', {
          detail: { key, history: existing },
        }),
      )
    } catch {
      // ignore parse errors
    }

    return () => {
      if (historyKeyRef.current === key) {
        historyKeyRef.current = null
      }
    }
  }, [postId, currentUser?.id])

  // Avoid layout jumps: wait for subscription, then use server index + client package load.
  if (isSubscriptionLoading) {
    return null
  }

  if (!isSubscribed) {
    if (guestBookableFromServer === false) {
      return null
    }

    const guestAssistantAllowed =
      Boolean(guestBookableFromServer) || hasPublicBookablePackages

    if (!guestAssistantAllowed) {
      if (!loadedRef.current) return null
      return null
    }

    if (!loadedRef.current && !guestBookableFromServer) {
      return null
    }
  }
  
  return (
    <div className={cn("w-full max-w-[672px] mx-auto bg-zinc-50 dark:bg-zinc-900 text-slate-950 dark:text-slate-100 shadow-sm border border-zinc-200 dark:border-zinc-700 rounded-lg overflow-hidden flex flex-col h-[800px]", className)}>
      {/* Header */}
      <div className="flex flex-col border-b border-zinc-200 dark:border-zinc-700 p-6 bg-white dark:bg-zinc-800 z-10">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="p-1.5 bg-teal-50 dark:bg-teal-900/20 rounded-md">
              <Bot className="h-5 w-5 text-teal-500 dark:text-teal-400" />
            </div>
            <h3 className="text-xl font-semibold tracking-tight text-slate-900 dark:text-slate-100">
              AI Booking Assistant
            </h3>
          </div>
          {messages.length > 1 && (
            <button
              onClick={() => {
                clearBookingJourney()
                setMessages([{
                  role: 'assistant',
                  content: `Hi! I'm here to help you book ${postTitle}. I can help you find the perfect dates, recommend packages based on your needs, and handle your booking. What would you like to know?`,
                  type: 'text'
                }])
                setSelectedPackage(null)
                setStartDate(null)
                setEndDate(null)
                setDuration(1)
                setBookingError(null)
                setSelectedAddons(new Set())
                setSuggestedAddons([])
                // Reset refs to allow new package suggestions
                packagesSuggestedRef.current = false
                estimateLoadedRef.current = false
                journeyLoadedRef.current = false
              }}
              className="text-xs font-medium text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-100 bg-transparent cursor-pointer px-3 py-1.5 rounded-md transition-colors hover:bg-zinc-100 dark:hover:bg-zinc-700"
            >
              Start Over
            </button>
          )}
        </div>
        <p className="text-sm text-slate-500 dark:text-slate-400 mt-2">
          Get personalized recommendations and book your perfect stay
        </p>
      </div>
      
      {/* Chat Area */}
      <div className="flex-1 overflow-hidden relative bg-white dark:bg-zinc-900">
        <div className="h-full overflow-y-auto scroll-smooth p-6 space-y-6">
          {/* Quick Actions */}
          <div className="flex flex-wrap gap-2">
            <motion.button
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
              onClick={() => handleQuickAction('select_dates')}
              className="text-xs font-medium text-slate-700 dark:text-slate-300 bg-white dark:bg-zinc-800 cursor-pointer flex items-center h-8 border border-zinc-200 dark:border-zinc-700 px-3 rounded-full shadow-sm transition-colors hover:bg-zinc-50 dark:hover:bg-zinc-700"
            >
              <Calendar className="mr-1.5 h-3.5 w-3.5 text-slate-500 dark:text-slate-400" />
              Select Dates
            </motion.button>
            <motion.button
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
              onClick={() => handleQuickAction('smart_action')}
              className="text-xs font-medium text-slate-700 dark:text-slate-300 bg-white dark:bg-zinc-800 cursor-pointer flex items-center h-8 border border-zinc-200 dark:border-zinc-700 px-3 rounded-full shadow-sm transition-colors hover:bg-zinc-50 dark:hover:bg-zinc-700"
            >
              <Sparkles className="mr-1.5 h-3.5 w-3.5 text-slate-500 dark:text-slate-400" />
              {startDate && endDate ? 'Get Recommendations' : 'Help Me Choose'}
            </motion.button>
          </div>

          <AnimatePresence initial={false}>
            {messages.map((message, index) => {
              const checkpoint = checkpoints.find(cp => cp.messageIndex === index)
              return (
                <React.Fragment key={index}>
                  <motion.div
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.3 }}
                    className={`flex gap-4 ${message.role === 'user' ? 'flex-row-reverse' : ''}`}
                  >
                    <div
                      className={`flex-shrink-0 w-8 h-8 rounded-full flex items-center justify-center ${message.role === 'assistant' ? 'bg-teal-50 dark:bg-teal-900/20 text-teal-600 dark:text-teal-400' : 'bg-slate-100 dark:bg-zinc-700 text-slate-600 dark:text-slate-300'}`}
                    >
                      {message.role === 'assistant' ? (
                        <Bot className="h-5 w-5" />
                      ) : (
                        <User className="h-5 w-5" />
                      )}
                    </div>

                    <div
                      className={`flex flex-col max-w-[85%] ${message.role === 'user' ? 'items-end' : 'items-start'}`}
                    >
                      {renderMessage(message, index)}
                      
                      {checkpoint && (
                        <div className="mt-6 mb-2 flex items-center gap-3 w-full opacity-60">
                          <Bookmark className="h-3.5 w-3.5 text-slate-400 dark:text-slate-500" />
                          <span className="text-xs text-slate-500 dark:text-slate-400 font-medium">
                            Checkpoint restored
                          </span>
                          <div className="h-px flex-1 bg-zinc-200 dark:bg-zinc-700"></div>
                        </div>
                      )}
                    </div>
                  </motion.div>
                </React.Fragment>
              )
            })}
          </AnimatePresence>

          {isLoading && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="flex gap-4"
            >
              <div className="flex-shrink-0 w-8 h-8 rounded-full bg-teal-50 dark:bg-teal-900/20 text-teal-600 dark:text-teal-400 flex items-center justify-center">
                <Bot className="h-5 w-5" />
              </div>
              <div className="bg-zinc-100 dark:bg-zinc-800 rounded-2xl rounded-tl-sm px-4 py-3 flex items-center gap-1">
                <motion.div
                  animate={{ scale: [1, 1.2, 1] }}
                  transition={{ repeat: Infinity, duration: 1, delay: 0 }}
                  className="w-1.5 h-1.5 bg-slate-400 rounded-full"
                />
                <motion.div
                  animate={{ scale: [1, 1.2, 1] }}
                  transition={{ repeat: Infinity, duration: 1, delay: 0.2 }}
                  className="w-1.5 h-1.5 bg-slate-400 rounded-full"
                />
                <motion.div
                  animate={{ scale: [1, 1.2, 1] }}
                  transition={{ repeat: Infinity, duration: 1, delay: 0.4 }}
                  className="w-1.5 h-1.5 bg-slate-400 rounded-full"
                />
              </div>
            </motion.div>
          )}
        </div>
      </div>
        
      {/* Input Area */}
      <div className="border-t border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-800 p-4">
        {!isLoggedIn && (
          <div className="mb-4 p-3 bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-lg">
            <p className="text-sm text-amber-800 dark:text-amber-300 mb-2">
              To use the AI assistant and complete bookings, please log in.
            </p>
            <Button size="sm" asChild>
              <a href="/login">Log In</a>
            </Button>
          </div>
        )}

        {/* Selected Package Summary */}
        {selectedPackage && (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className="mb-4 bg-teal-50/50 dark:bg-teal-900/20 border border-teal-100 dark:border-teal-800 rounded-lg p-3 flex items-center justify-between"
          >
            <div>
              <div className="flex items-center gap-2">
                <span className="text-sm font-medium text-slate-900 dark:text-slate-100">
                  {selectedPackage.name}
                </span>
                {areDatesAvailable && (
                  <span className="text-xs text-green-600 dark:text-green-400 bg-green-50 dark:bg-green-900/20 px-1.5 py-0.5 rounded font-medium">
                    Available
                  </span>
                )}
              </div>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                {startDate && endDate 
                  ? `${format(startDate, 'MMM dd')} - ${format(endDate, 'MMM dd, yyyy')} • ${duration} ${duration === 1 ? 'night' : 'nights'}`
                  : 'Select dates to see pricing'}
              </p>
            </div>
            <div className="flex items-center gap-3">
              {totalWithAddons && (
                <div className="text-right mr-2">
                  <div className="text-sm font-bold text-teal-600 dark:text-teal-400">R{totalWithAddons.toFixed(0)}</div>
                  <div className="text-[10px] text-slate-400">
                    {selectedAddons.size > 0 ? `Total (+${selectedAddons.size} addon${selectedAddons.size > 1 ? 's' : ''})` : 'Total'}
                  </div>
                </div>
              )}
              {isLoggedIn && (
                <>
                  <button 
                    onClick={handleBooking}
                    disabled={isBooking || !areDatesAvailable || isCheckingAvailability}
                    className="text-xs font-medium text-white dark:text-slate-900 bg-slate-900 dark:bg-slate-100 hover:bg-slate-800 dark:hover:bg-slate-200 px-3 py-1.5 rounded-md transition-colors shadow-sm disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    Book Now
                  </button>
                  <button 
                    onClick={handleGoToEstimate}
                    disabled={isCreatingEstimate}
                    className="text-xs font-medium text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-slate-100 bg-white dark:bg-zinc-700 border border-zinc-200 dark:border-zinc-600 hover:bg-zinc-50 dark:hover:bg-zinc-600 px-3 py-1.5 rounded-md transition-colors shadow-sm disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    Invite someone
                  </button>
                </>
              )}
            </div>
          </motion.div>
        )}

        {/* AI-Suggested Addons */}
        {selectedPackage && startDate && endDate && (
          <div className="mb-4 space-y-2">
            {isLoadingAddons ? (
              <div className="flex items-center justify-center p-3 bg-white dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-lg">
                <Loader2 className="h-4 w-4 animate-spin text-teal-500 dark:text-teal-400 mr-2" />
                <span className="text-xs text-slate-500 dark:text-slate-400">Finding relevant addons...</span>
              </div>
            ) : suggestedAddons.length > 0 ? (
              <>
                <div className="text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400 mb-2">
                  Suggested Add-ons
                </div>
                {suggestedAddons.map((addon) => {
                  const isSelected = selectedAddons.has(addon.id)
                  return (
                    <motion.div
                      key={addon.id}
                      initial={{ opacity: 0, y: 5 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: 0.1 }}
                      className="flex items-center justify-between p-3 bg-white dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-lg hover:border-zinc-300 dark:hover:border-zinc-600 transition-colors"
                    >
                      <div className="flex items-center gap-3 flex-1">
                        <div className="p-2 bg-teal-50 dark:bg-teal-900/20 rounded-md">
                          <Package className="h-4 w-4 text-teal-600 dark:text-teal-400" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="text-sm font-medium text-slate-900 dark:text-slate-100">
                            {addon.name}
                          </div>
                          {addon.description && (
                            <div className="text-xs text-slate-500 dark:text-slate-400 line-clamp-1">
                              {addon.description}
                            </div>
                          )}
                          <div className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                            +R{addon.baseRate.toFixed(0)}
                          </div>
                        </div>
                      </div>
                      <button
                        onClick={() => {
                          const newSelected = new Set(selectedAddons)
                          if (isSelected) {
                            newSelected.delete(addon.id)
                          } else {
                            newSelected.add(addon.id)
                          }
                          setSelectedAddons(newSelected)
                          
                          // Notify assistant
                          const message: Message = {
                            role: 'assistant',
                            content: isSelected
                              ? `Removed "${addon.name}" addon from your booking.`
                              : `Added "${addon.name}" addon (+R${addon.baseRate.toFixed(0)}) to your booking.`,
                            type: 'text'
                          }
                          appendMessageToThread(activeThreadRef.current, message)
                        }}
                        className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ml-3 ${isSelected ? 'bg-teal-500' : 'bg-zinc-200 dark:bg-zinc-600'}`}
                      >
                        <motion.span
                          layout
                          transition={{ type: 'spring', stiffness: 500, damping: 30 }}
                          className={`inline-block h-4 w-4 transform rounded-full bg-white shadow-sm transition ${isSelected ? 'translate-x-6' : 'translate-x-1'}`}
                        />
                      </button>
                    </motion.div>
                  )
                })}
              </>
            ) : null}
          </div>
        )}

        {/* Date Suggestions */}
        {dateSuggestions.length > 0 && (
          <div className="mb-3 overflow-x-auto scrollbar-none pb-1">
            <div className="flex gap-2 w-max">
              {dateSuggestions.map((suggestion, i) => {
                const startDay = format(suggestion.startDate, 'EEE')
                const endDay = format(suggestion.endDate, 'EEE')
                const dateRange = `${format(suggestion.startDate, 'MMM dd')} - ${format(suggestion.endDate, 'MMM dd')}`
                const dayRange = `${startDay} - ${endDay}`
                
                return (
                  <motion.button
                    key={i}
                    whileHover={{ scale: 1.05 }}
                    whileTap={{ scale: 0.95 }}
                    onClick={() => {
                      const newStartDate = suggestion.startDate
                      const newEndDate = suggestion.endDate
                      const newDuration = Math.ceil((suggestion.endDate.getTime() - suggestion.startDate.getTime()) / (24 * 60 * 60 * 1000))
                      
                      setStartDate(newStartDate)
                      setEndDate(newEndDate)
                      setDuration(newDuration)
                      preservedStartDateRef.current = newStartDate
                      
                      // Check availability
                      checkDateAvailability(newStartDate, newEndDate, activeThreadRef.current, false).then((isAvailable) => {
                        // Notify the assistant about the date selection
                        const confirmMessage: Message = {
                          role: 'assistant',
                          content: isAvailable
                            ? `Great! I've updated your dates to ${format(newStartDate, 'MMM dd')} - ${format(newEndDate, 'MMM dd, yyyy')} (${newDuration} ${newDuration === 1 ? 'night' : 'nights'}). These dates are available for booking.`
                            : `I've updated your dates to ${format(newStartDate, 'MMM dd')} - ${format(newEndDate, 'MMM dd, yyyy')} (${newDuration} ${newDuration === 1 ? 'night' : 'nights'}), but these dates may not be available. Please check availability.`,
                          type: 'text'
                        }
                        appendMessageToThread(activeThreadRef.current, confirmMessage)
                      })
                    }}
                    className="text-xs font-medium text-slate-600 dark:text-slate-300 bg-white dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 px-3 py-2 rounded-full transition-colors whitespace-nowrap hover:text-teal-600 dark:hover:text-teal-400 hover:bg-zinc-50 dark:hover:bg-zinc-700 flex flex-col items-center gap-0.5"
                  >
                    <span className="font-semibold">{dateRange}</span>
                    <span className="text-[10px] text-slate-400 dark:text-slate-500">{dayRange}</span>
                  </motion.button>
                )
              })}
            </div>
          </div>
        )}

        {/* Input Form */}
        <form onSubmit={handleSubmit} className="relative">
          <div className="relative flex items-end gap-2 bg-white dark:bg-zinc-800 border border-zinc-300 dark:border-zinc-600 rounded-xl px-3 py-3 shadow-sm focus-within:ring-2 focus-within:ring-teal-500/20 focus-within:border-teal-500 transition-all">
            <textarea
              ref={textareaRef}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !e.shiftKey) {
                  e.preventDefault()
                  handleSubmit(e)
                }
              }}
              placeholder={isListening 
                ? "I'm listening..." 
                : isLoggedIn 
                  ? "Ask me anything about booking..."
                  : "Ask about packages (log in for full AI assistance)..."}
              disabled={isLoading || isListening || !isLoggedIn}
              className="w-full max-h-[120px] min-h-[24px] bg-transparent border-0 p-0 text-sm text-slate-900 dark:text-slate-100 placeholder:text-slate-400 dark:placeholder:text-slate-500 focus:ring-0 resize-none leading-6"
              rows={1}
              style={{ height: 'auto', minHeight: '24px' }}
            />
            <div className="flex items-center gap-2 pb-0.5">
              <button
                type="button"
                onClick={isListening ? stopListening : startListening}
                className="text-slate-400 dark:text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 p-1.5 rounded-md hover:bg-zinc-100 dark:hover:bg-zinc-700 transition-colors"
              >
                {isListening ? <MicOff className="h-4 w-4" /> : <Mic className="h-4 w-4" />}
              </button>
              <button
                type="submit"
                disabled={!input.trim() || isLoading || isListening || !isLoggedIn}
                className={`p-1.5 rounded-md transition-all ${input.trim() && !isLoading && !isListening && isLoggedIn ? 'bg-teal-500 text-white shadow-sm hover:bg-teal-600' : 'bg-zinc-100 dark:bg-zinc-700 text-zinc-300 dark:text-zinc-500 cursor-not-allowed'}`}
              >
                <Send className="h-4 w-4" />
              </button>
            </div>
          </div>
          <div className="text-[10px] text-center text-slate-400 dark:text-slate-500 mt-2">
            AI can make mistakes. Please double check important info.
          </div>
        </form>
        {micError && <p className="text-sm text-destructive mt-2 text-center">{micError}</p>}
      </div>
    </div>
  )
} 
