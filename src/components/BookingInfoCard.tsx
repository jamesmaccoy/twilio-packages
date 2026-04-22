'use client'

import { useMemo, useState, useEffect, useCallback } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Calendar } from '@/components/ui/calendar'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { Badge } from '@/components/ui/badge'
import { Calendar as CalendarIcon, Clock, Users, MapPin } from 'lucide-react'
import type { DateRange } from 'react-day-picker'
import { format } from 'date-fns'
import { Media } from '@/components/Media'
import { hasUnavailableDateBetween } from '@/utilities/hasUnavailableDateBetween'
import { Suggestions, Suggestion } from '@/components/ai-elements/suggestion'
import { cn } from '@/utilities/cn'

interface BookingInfoCardProps {
  postImage?: any
  guests?: Array<any>
  createdAt?: string | Date | null
  variant?: 'booking' | 'default'
  postUrl?: string
  onEstimateRequest?: (dates: { from: Date; to: Date }) => Promise<void> | void
  isSubmittingEstimate?: boolean
  estimateError?: string | null
  postId?: string
  postTitle?: string
  baseRate?: number
  packageMinNights?: number | null
  packageMaxNights?: number | null
  isReschedule?: boolean
  originalBookingDates?: { from: Date; to: Date } | null
}

export const BookingInfoCard: React.FC<BookingInfoCardProps> = ({
  postImage,
  guests = [],
  createdAt,
  variant = 'default',
  postUrl,
  onEstimateRequest,
  isSubmittingEstimate = false,
  estimateError,
  postTitle,
  baseRate,
  postId,
  packageMinNights,
  packageMaxNights,
  isReschedule = false,
  originalBookingDates = null,
}) => {
  const [dateRange, setDateRange] = useState<DateRange | undefined>()
  const [isCalendarOpen, setIsCalendarOpen] = useState(false)
  const [unavailableDates, setUnavailableDates] = useState<string[]>([])
  const [isLoadingUnavailableDates, setIsLoadingUnavailableDates] = useState(false)
  const [suggestedDates, setSuggestedDates] = useState<Array<{ startDate: string; endDate: string; duration: number }>>([])
  const [isCheckingAvailability, setIsCheckingAvailability] = useState(false)
  const [availabilityError, setAvailabilityError] = useState<string | null>(null)

  const guestCount = useMemo(() => {
    if (!Array.isArray(guests)) return 0
    return guests.length
  }, [guests])

  const createdDisplay = useMemo(() => {
    if (!createdAt) return 'Unknown'
    const date = createdAt instanceof Date ? createdAt : new Date(createdAt)
    if (Number.isNaN(date.getTime())) return 'Unknown'
    return format(date, 'PPP')
  }, [createdAt])

  // Generate initial suggested dates based on package duration constraints
  const generateInitialSuggestedDates = useCallback((unavailableDatesList: string[]) => {
    const unavailableSet = new Set(unavailableDatesList.map(d => d.split('T')[0]))
    const today = new Date()
    today.setHours(0, 0, 0, 0)
    
    const suggestions: Array<{ startDate: string; endDate: string; duration: number }> = []
    
    // Use package duration constraints if available, otherwise use common durations
    let durations: number[] = []
    if (packageMinNights !== null && packageMinNights !== undefined && packageMaxNights !== null && packageMaxNights !== undefined) {
      // Generate durations within the package's min/max range
      const min = Math.max(1, packageMinNights)
      const max = packageMaxNights
      // Generate a few durations within the range (prefer min, mid, and max)
      if (min === max) {
        durations = [min]
      } else {
        const mid = Math.round((min + max) / 2)
        durations = [min, mid, max].filter((d, i, arr) => arr.indexOf(d) === i) // Remove duplicates
      }
    } else if (packageMinNights !== null && packageMinNights !== undefined) {
      // Only minNights specified - use min and a few increments
      durations = [packageMinNights, packageMinNights + 2, packageMinNights + 4].filter(d => d > 0)
    } else {
      // No package constraints - use common durations
      durations = [3, 5, 7]
    }
    
    // Helper to normalize dates to midnight UTC
    const normalizeDate = (date: Date): Date => {
      const normalized = new Date(date)
      normalized.setUTCHours(0, 0, 0, 0)
      return normalized
    }
    
    // Helper to check if a date range conflicts with unavailable dates
    const hasConflict = (testStart: Date, testEnd: Date): boolean => {
      const checkDate = new Date(testStart)
      while (checkDate < testEnd) {
        const dateStr = checkDate.toISOString().split('T')[0]
        if (unavailableSet.has(dateStr)) {
          return true
        }
        checkDate.setUTCDate(checkDate.getUTCDate() + 1)
      }
      return false
    }
    
    // Generate suggestions for different start dates: 1 week, 2 weeks, 1 month from now
    const startOffsets = [7, 14, 30]
    
    for (const offset of startOffsets) {
      for (const duration of durations) {
        const startDate = normalizeDate(new Date(today))
        startDate.setUTCDate(startDate.getUTCDate() + offset)
        
        const endDate = normalizeDate(new Date(startDate))
        endDate.setUTCDate(endDate.getUTCDate() + duration)
        
        // Only add if no conflicts and we don't have too many suggestions yet
        if (!hasConflict(startDate, endDate) && suggestions.length < 6) {
          suggestions.push({
            startDate: startDate.toISOString(),
            endDate: endDate.toISOString(),
            duration,
          })
        }
      }
    }
    
    // Sort by start date and limit to 6 suggestions
    suggestions.sort((a, b) => new Date(a.startDate).getTime() - new Date(b.startDate).getTime())
    setSuggestedDates(suggestions.slice(0, 6))
  }, [packageMinNights, packageMaxNights])

  // Load unavailable dates and generate initial suggested dates
  useEffect(() => {
    if (!postId) return

    const loadUnavailableDates = async () => {
      setIsLoadingUnavailableDates(true)
      try {
        const response = await fetch(`/api/bookings/unavailable-dates?postId=${postId}`, {
          credentials: 'include',
        })
        if (response.ok) {
          const data = await response.json()
          const dates = data.unavailableDates || []
          setUnavailableDates(dates)
          
          // Generate initial suggested dates based on unavailable dates
          generateInitialSuggestedDates(dates)
        } else if (response.status === 401) {
          // User not authenticated - unavailable dates require subscription
          console.log('Unavailable dates require authentication/subscription')
        }
      } catch (error) {
        console.error('Error loading unavailable dates:', error)
      } finally {
        setIsLoadingUnavailableDates(false)
      }
    }

    loadUnavailableDates()
  }, [postId, generateInitialSuggestedDates])

  // Helper to normalize date to string for comparison
  const normalizeDateToString = useCallback((date: Date | string): string => {
    if (typeof date === 'string') {
      const datePart = date.split('T')[0]
      return datePart || ''
    }
    const isoString = date.toISOString()
    return isoString.split('T')[0] || ''
  }, [])

  // Check availability when dates are selected
  const checkAvailability = useCallback(async (fromDate: Date, toDate: Date) => {
    if (!postId) return true

    setIsCheckingAvailability(true)
    setAvailabilityError(null)
    setSuggestedDates([])

    try {
      const params = new URLSearchParams({
        postId,
        startDate: fromDate.toISOString(),
        endDate: toDate.toISOString(),
      })

      const response = await fetch(`/api/bookings/check-availability?${params.toString()}`)
      
      if (response.ok) {
        const data = await response.json()
        const suggestedDatesFromAPI = data.suggestedDates || []
        
        if (!data.isAvailable) {
          // Store suggested dates if available
          if (suggestedDatesFromAPI.length > 0) {
            setSuggestedDates(suggestedDatesFromAPI)
            setAvailabilityError('The selected dates are not available. Please see suggested dates below.')
          } else {
            setAvailabilityError('The selected dates are not available. Please choose different dates.')
          }
          return false
        }
        
        // Clear suggested dates if dates are available
        setSuggestedDates([])
        setAvailabilityError(null)
        return true
      }
      return false
    } catch (error) {
      console.error('Error checking availability:', error)
      setAvailabilityError('Failed to check availability. Please try again.')
      return false
    } finally {
      setIsCheckingAvailability(false)
    }
  }, [postId])

  // Handle date selection changes
  const handleDateRangeChange = useCallback(async (range: DateRange | undefined) => {
    setDateRange(range)
    setAvailabilityError(null)
    setSuggestedDates([])
    
    // Validate when both dates are selected
    if (range?.from && range?.to) {
      await checkAvailability(range.from, range.to)
    }
  }, [checkAvailability])

  const [showConfirmation, setShowConfirmation] = useState(false)
  const [pendingDates, setPendingDates] = useState<{ from: Date; to: Date } | null>(null)

  const canSubmit = !!dateRange?.from && !!dateRange?.to && !!onEstimateRequest && !isSubmittingEstimate && !isCheckingAvailability && !availabilityError

  const handleSubmit = async () => {
    if (!canSubmit || !dateRange?.from || !dateRange?.to || !onEstimateRequest) return
    
    // Final availability check before submitting
    const isAvailable = await checkAvailability(dateRange.from, dateRange.to)
    if (!isAvailable) {
      return
    }
    
    // For reschedule, show confirmation dialog
    if (isReschedule) {
      setPendingDates({ from: dateRange.from, to: dateRange.to })
      setShowConfirmation(true)
      setIsCalendarOpen(false)
      return
    }
    
    await onEstimateRequest({ from: dateRange.from, to: dateRange.to })
    setIsCalendarOpen(false)
    setDateRange(undefined)
    setSuggestedDates([])
  }

  const handleConfirmReschedule = async () => {
    if (!pendingDates || !onEstimateRequest) return
    
    await onEstimateRequest({ from: pendingDates.from, to: pendingDates.to })
    setShowConfirmation(false)
    setPendingDates(null)
    setDateRange(undefined)
    setSuggestedDates([])
  }

  const handleCancelReschedule = () => {
    setShowConfirmation(false)
    setPendingDates(null)
    // Restore the date range so user can try again
    if (dateRange) {
      setDateRange(dateRange)
    }
  }

  const selectedLabel = dateRange?.from && dateRange?.to
    ? `${format(dateRange.from, 'MMM dd, yyyy')} → ${format(dateRange.to, 'MMM dd, yyyy')}`
    : isReschedule 
      ? 'Select new dates for reschedule'
      : 'Select dates for a new estimate'

  return (
    <Card id="booking-reschedule" className="overflow-hidden border-2">
      <CardHeader className="space-y-4 bg-muted/40">
        <div className="flex items-center justify-between gap-2">
          <div>
            <CardTitle className="text-lg">Reschedule Booking</CardTitle>
            {postTitle ? <CardDescription>{postTitle}</CardDescription> : null}Select new dates that match your original package duration. Your booking will be updated once confirmed.
          </div>
          {postUrl ? (
            <Button asChild variant="outline" size="sm">
              <a href={postUrl} target="_blank" rel="noopener noreferrer">
                View Listing
              </a>
            </Button>
          ) : null}
        </div>
        {postImage ? (
          <div className="overflow-hidden rounded-md border">
            <Media resource={postImage} className="h-40 w-full object-cover" />
          </div>
        ) : null}
      </CardHeader>
      <CardContent className="space-y-6">
        {!isReschedule && (
          <div className="grid gap-4 text-sm">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-full bg-primary/10 text-primary">
                <Users className="h-4 w-4" />
              </div>
              <div>
                <div className="font-medium">Guests</div>
                <div className="text-muted-foreground">{guestCount} {guestCount === 1 ? 'guest' : 'guests'} invited</div>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-full bg-primary/10 text-primary">
                <Clock className="h-4 w-4" />
              </div>
              <div>
                <div className="font-medium">Created</div>
                <div className="text-muted-foreground">{createdDisplay}</div>
              </div>
            </div>
            {baseRate ? (
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-full bg-primary/10 text-primary">
                  <MapPin className="h-4 w-4" />
                </div>
                <div>
                  <div className="font-medium">Base rate</div>
                  <div className="text-muted-foreground">R{baseRate.toFixed(2)}</div>
                </div>
              </div>
            ) : null}
          </div>
        )}

        <div className="space-y-3">
          {isReschedule ? (
            <div className="space-y-2">
              
              {originalBookingDates && (
                <div className="text-xs text-muted-foreground bg-muted/50 p-2 rounded">
                  <span className="font-medium">Current dates:</span> {format(originalBookingDates.from, 'MMM dd, yyyy')} → {format(originalBookingDates.to, 'MMM dd, yyyy')}
                </div>
              )}
            </div>
          ) : (
            <div className="text-sm font-medium">Request a new estimate</div>
          )}
          {/* Show suggested dates when unavailable */}
          {suggestedDates.length > 0 && (
            <div className="space-y-2 rounded-md border bg-muted/30 p-3">
              <p className="text-xs font-medium text-muted-foreground">Suggested available dates:</p>
              <Suggestions>
                {suggestedDates.map((suggestion, idx) => {
                  const suggestionStart = new Date(suggestion.startDate)
                  const suggestionEnd = new Date(suggestion.endDate)
                  
                  if (isNaN(suggestionStart.getTime()) || isNaN(suggestionEnd.getTime())) {
                    return null
                  }
                  
                  const suggestionText = `${format(suggestionStart, 'MMM dd')} - ${format(suggestionEnd, 'MMM dd')} (${packageMinNights !== null && packageMinNights !== undefined && packageMinNights <= 1 && suggestion.duration === 1 ? 'hourly' : `${suggestion.duration} ${suggestion.duration === 1 ? 'night' : 'nights'}`})`
                  
                  return (
                    <Suggestion
                      key={idx}
                      suggestion={suggestionText}
                      onClick={() => {
                        setDateRange({
                          from: suggestionStart,
                          to: suggestionEnd,
                        })
                        setIsCalendarOpen(false) // Close calendar when suggestion is selected
                        // Validate the new dates
                        checkAvailability(suggestionStart, suggestionEnd)
                      }}
                    />
                  )
                })}
              </Suggestions>
            </div>
          )}
          <Popover open={isCalendarOpen} onOpenChange={setIsCalendarOpen}>
            <PopoverTrigger asChild>
              <Button variant="outline" size="lg" className="justify-start gap-2 text-left font-normal">
                <CalendarIcon className="h-4 w-4" />
                {selectedLabel}
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-auto p-0" align="start">
              <div className={cn("p-3", isReschedule && "p-2")}>
                <Calendar
                  mode="range"
                  selected={dateRange}
                  onSelect={handleDateRangeChange}
                  numberOfMonths={isReschedule ? 1 : 2}
                  initialFocus
                  disabled={(date) => {
                    const today = new Date()
                    today.setHours(0, 0, 0, 0)
                    const checkDate = new Date(date)
                    checkDate.setHours(0, 0, 0, 0)

                    // Disable past dates
                    if (checkDate < today) return true

                    // Normalize date to YYYY-MM-DD format for comparison
                    const dateStr = normalizeDateToString(checkDate)

                    // Always check if this date itself is unavailable
                    const isUnavailable = unavailableDates.some((unavailableDateStr) => {
                      const unavailableDatePart = normalizeDateToString(unavailableDateStr)
                      return unavailableDatePart === dateStr
                    })

                    if (isUnavailable) return true

                    // If selecting start date (no from date yet), allow all non-unavailable future dates
                    if (!dateRange?.from) {
                      return false
                    }

                    // If we have a start date, we're selecting end date
                    const startDateOnly = new Date(dateRange.from)
                    startDateOnly.setHours(0, 0, 0, 0)
                    
                    // Disable dates before or equal to start date
                    if (checkDate <= startDateOnly) return true

                    // Disable if there are unavailable dates between startDate and this date
                    if (hasUnavailableDateBetween(unavailableDates, dateRange.from, date)) {
                      return true
                    }

                    return false
                  }}
                />
              </div>
            </PopoverContent>
          </Popover>
          {showConfirmation && pendingDates ? (
            <div className="space-y-3 rounded-lg border-2 border-primary/20 bg-primary/5 p-4">
              <div className="space-y-2">
                <div className="flex items-center gap-2">
                  <div className="text-sm font-semibold text-foreground">⚠️ Confirm Reschedule</div>
                  <Badge variant="destructive" className="text-xs">Important</Badge>
                </div>
                <div className="text-xs text-muted-foreground space-y-2">
                  <p className="font-medium text-foreground">You are about to change your booking dates:</p>
                  <div className="space-y-1 pl-2 border-l-2 border-muted">
                    {originalBookingDates && (
                      <div>
                        <span className="font-medium">Current:</span> {format(originalBookingDates.from, 'MMM dd, yyyy')} → {format(originalBookingDates.to, 'MMM dd, yyyy')}
                        <span className="ml-2 text-muted-foreground">
                          ({Math.round((originalBookingDates.to.getTime() - originalBookingDates.from.getTime()) / (1000 * 60 * 60 * 24))} {Math.round((originalBookingDates.to.getTime() - originalBookingDates.from.getTime()) / (1000 * 60 * 60 * 24)) === 1 ? 'night' : 'nights'})
                        </span>
                      </div>
                    )}
                    <div className="font-medium text-primary">
                      <span className="font-semibold">New:</span> {format(pendingDates.from, 'MMM dd, yyyy')} → {format(pendingDates.to, 'MMM dd, yyyy')}
                      <span className="ml-2 text-muted-foreground">
                        ({Math.round((pendingDates.to.getTime() - pendingDates.from.getTime()) / (1000 * 60 * 60 * 24))} {Math.round((pendingDates.to.getTime() - pendingDates.from.getTime()) / (1000 * 60 * 60 * 24)) === 1 ? 'night' : 'nights'})
                      </span>
                    </div>
                  </div>
                  <p className="pt-1 text-xs">
                    Your package and pricing will remain the same. A new estimate will be created for your review.
                  </p>
                </div>
              </div>
              <div className="flex gap-2">
                <Button 
                  onClick={handleConfirmReschedule} 
                  disabled={isSubmittingEstimate}
                  className="flex-1"
                  variant="default"
                >
                  {isSubmittingEstimate ? 'Processing…' : 'Confirm Reschedule'}
                </Button>
                <Button 
                  onClick={handleCancelReschedule}
                  disabled={isSubmittingEstimate}
                  variant="outline"
                  className="flex-1"
                >
                  Cancel
                </Button>
              </div>
            </div>
          ) : (
            <Button onClick={handleSubmit} disabled={!canSubmit} className="w-full">
              {isSubmittingEstimate 
                ? 'Preparing estimate…' 
                : isCheckingAvailability 
                  ? 'Checking availability…' 
                  : isReschedule
                    ? 'Continue to Reschedule'
                    : 'Create New Estimate'}
            </Button>
          )}
          {availabilityError && (
            <div className="rounded-md border border-destructive/40 bg-destructive/10 p-3 text-sm text-destructive">
              {isReschedule && (
                <div className="font-semibold mb-1">⚠️ Cannot reschedule to these dates</div>
              )}
              {availabilityError}
            </div>
          )}
          {estimateError && (
            <div className="rounded-md border border-destructive/40 bg-destructive/10 p-3 text-sm text-destructive">
              {estimateError}
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  )
}

export default BookingInfoCard
