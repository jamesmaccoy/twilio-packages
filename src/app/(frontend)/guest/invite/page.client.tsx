'use client'

import { Button } from '@/components/ui/button'
import {
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
  CardFooter,
  Card,
} from '@/components/ui/card'

import { Check, CircleAlert, Loader2Icon, Calendar as CalendarIcon, Clock } from 'lucide-react'
import Link from 'next/link'
import { notFound, useRouter } from 'next/navigation'
import React, { useMemo } from 'react'
import { format } from 'date-fns'

type Props = {
  booking?: Pick<import('@/payload-types').Booking, 'post' | 'fromDate' | 'toDate' | 'createdAt' | 'customer'>
  estimate?: Pick<import('@/payload-types').Estimate, 'post' | 'fromDate' | 'toDate' | 'createdAt' | 'customer'>
  tokenPayload: Record<string, string>
  token: string
}

export default function InviteClientPage({ booking, estimate, tokenPayload, token }: Props) {
  const isBooking = !!booking
  const isEstimate = !!estimate
  const data = booking || estimate

  if (
    !data ||
    typeof data.post === 'string' ||
    typeof data.customer === 'string' ||
    (!('id' in tokenPayload))
  ) {
    notFound()
  }

  const router = useRouter()
  const [isLoading, setIsLoading] = React.useState(false)
  const [error, setError] = React.useState<string | null>(null)

  // Parse dates
  const fromDate = data.fromDate ? new Date(data.fromDate) : null
  const toDate = data.toDate ? new Date(data.toDate) : null
  const createdAt = data.createdAt ? new Date(data.createdAt) : null

  // Calendar calculations
  const calendarData = useMemo(() => {
    if (!fromDate) return null

    const month = fromDate.getMonth()
    const year = fromDate.getFullYear()
    const monthName = format(fromDate, 'MMMM yyyy')
    
    // Get first day of month and number of days
    const firstDay = new Date(year, month, 1)
    const lastDay = new Date(year, month + 1, 0)
    const daysInMonth = lastDay.getDate()
    const startDayOffset = firstDay.getDay() // 0 = Sunday, 1 = Monday, etc.

    // Calculate which days are in the trip
    const arrivalDay = fromDate.getDate()
    const departureDay = toDate ? toDate.getDate() : arrivalDay
    
    // Check if trip spans multiple months
    const tripEndMonth = toDate ? toDate.getMonth() : month
    const tripEndYear = toDate ? toDate.getFullYear() : year
    const spansMonths = tripEndMonth !== month || tripEndYear !== year

    // Calculate days in trip for current month
    const tripEndDayInMonth = spansMonths && tripEndMonth === month && tripEndYear === year
      ? departureDay
      : spansMonths
        ? daysInMonth // Trip continues past this month
        : departureDay

    return {
      month,
      year,
      monthName,
      daysInMonth,
      startDayOffset,
      arrivalDay,
      departureDay,
      tripEndDayInMonth,
      spansMonths,
      tripEndMonth,
      tripEndYear,
      tripEndDate: toDate,
    }
  }, [fromDate, toDate])

  const trackInviteAcceptEvent = () => {
    if (typeof window === 'undefined' || !(window as any).gtag) {
      return
    }

    const gtag = (window as any).gtag as (...args: any[]) => void
    const isBookingEvent = isBooking
    const id = tokenPayload.id

    gtag('event', 'invite_accept', {
      event_category: isBookingEvent ? 'booking' : 'estimate',
      event_label: isBookingEvent ? 'booking_invite_accept' : 'estimate_invite_accept',
      booking_id: isBookingEvent ? id : undefined,
      estimate_id: !isBookingEvent ? id : undefined,
      token,
    })
  }

  const handleInviteAccept = async () => {
    try {
      setIsLoading(true)
      let res: Response | undefined
      if (isBooking) {
        res = await fetch(`/api/bookings/${tokenPayload.id}/accept-invite/${token}`, {
          method: 'POST',
          credentials: 'include',
          headers: {
            'Content-Type': 'application/json',
          },
        })
      } else if (isEstimate) {
        res = await fetch(`/api/estimates/${tokenPayload.id}/accept-invite/${token}`, {
          method: 'POST',
          credentials: 'include',
          headers: {
            'Content-Type': 'application/json',
          },
        })
      }
      
      if (!res) {
        setError('Invalid request')
        return
      }
      
      const responseData = await res.json()
      if (!res.ok) {
        setError(responseData.message || 'Unknown error')
        return
      }
      trackInviteAcceptEvent()
      if (isBooking) {
        router.push(`/bookings/${tokenPayload.id}`)
      } else if (isEstimate) {
        router.push(`/estimate/${tokenPayload.id}`)
      }
    } catch (err) {
      setError('Error accepting invite')
    } finally {
      setIsLoading(false)
    }
  }

  if (error) {
    return (
      <div className="border-2 flex items-center gap-6 mt-10 flex-col border-red-500 bg-red-100 dark:bg-red-900/20 dark:border-red-600 max-w-[450px] w-full mx-auto p-6 rounded-xl">
        <div>
          <CircleAlert className="size-8 text-red-600 dark:text-red-400" />
        </div>
        <div className="text-center">
          <h2 className="text-lg font-medium tracking-tight text-red-900 dark:text-red-100">Something went wrong</h2>
          <p className="tracking-wide text-red-800 dark:text-red-200">{error}</p>
        </div>
        <Button asChild variant="default" className="w-full">
          <Link href={'/'}>Return Home</Link>
        </Button>
      </div>
    )
  }

  // Format dates for display
  const formatCheckInDate = () => {
    if (!fromDate) return ''
    return format(fromDate, 'EEE, MMM d')
  }

  const formatCheckOutDate = () => {
    if (!toDate) return ''
    return format(toDate, 'EEE, MMM d')
  }

  const formatCheckInYear = () => {
    if (!fromDate) return ''
    return format(fromDate, 'yyyy')
  }

  const formatCheckOutYear = () => {
    if (!toDate) return ''
    return format(toDate, 'yyyy')
  }

  const formatCreatedDate = () => {
    if (!createdAt) return ''
    return format(createdAt, 'MMM d, yyyy')
  }

  return (
    <div className="mx-4 w-full bg-white dark:bg-background text-slate-950 dark:text-foreground text-base font-sans flex items-center justify-center min-h-screen">
      <div className="w-full max-w-2xl my-10">
        <div className="bg-white dark:bg-card shadow-xl border border-zinc-200 dark:border-border rounded-lg overflow-hidden">
          {/* Header */}
          <div className="bg-zinc-50 dark:bg-zinc-900/50 p-6 border-b border-zinc-100 dark:border-border">
            <h3 className="text-2xl font-semibold leading-tight text-zinc-900 dark:text-foreground m-0">
              Join{' '}
              <strong className="font-black text-teal-600 dark:text-teal-400">
                {data.post.title}
              </strong>{' '}
              as a guest
            </h3>
            <p className="text-sm text-zinc-500 dark:text-muted-foreground mt-2 m-0 flex items-center gap-2">
              Invited by{' '}
              <strong className="font-bold text-zinc-700 dark:text-foreground">{data.customer?.name}</strong>
            </p>
          </div>

          <div className="p-6 md:p-8 grid md:grid-cols-2 gap-8">
            {/* Calendar Section */}
            {calendarData && (
              <div className="bg-white dark:bg-card rounded-xl border border-zinc-100 dark:border-border shadow-sm p-4">
                <div className="flex items-center justify-between mb-4">
                  <span className="font-bold text-zinc-800 dark:text-foreground">{calendarData.monthName}</span>
                  <CalendarIcon className="w-4 h-4 text-zinc-400 dark:text-muted-foreground" />
                </div>

                <div className="grid grid-cols-7 gap-1 text-center text-xs mb-2">
                  {['S', 'M', 'T', 'W', 'T', 'F', 'S'].map((d) => (
                    <div key={d} className="text-zinc-400 dark:text-muted-foreground font-medium py-1">
                      {d}
                    </div>
                  ))}
                </div>

                <div className="grid grid-cols-7 gap-1 text-sm">
                  {/* Empty slots for start offset */}
                  {Array.from({ length: calendarData.startDayOffset }).map((_, i) => (
                    <div key={`empty-${i}`} className="aspect-square" />
                  ))}

                  {/* Days of the month */}
                  {Array.from({ length: calendarData.daysInMonth }, (_, i) => i + 1).map((day) => {
                    const isArrival = day === calendarData.arrivalDay
                    const isInTrip = day >= calendarData.arrivalDay && day <= calendarData.tripEndDayInMonth

                    return (
                      <div
                        key={day}
                        className={`
                          aspect-square flex items-center justify-center rounded-full relative
                          ${isArrival ? 'bg-teal-600 dark:bg-teal-500 text-white font-bold shadow-md z-10' : ''}
                          ${isInTrip && !isArrival ? 'bg-teal-50 dark:bg-teal-900/30 text-teal-700 dark:text-teal-300 font-medium' : ''}
                          ${!isInTrip ? 'text-zinc-600 dark:text-muted-foreground hover:bg-zinc-50 dark:hover:bg-zinc-800/50' : ''}
                        `}
                      >
                        {day}
                        {isArrival && (
                          <div className="absolute -bottom-1 w-1 h-1 bg-white rounded-full opacity-50"></div>
                        )}
                      </div>
                    )
                  })}
                </div>
                {calendarData.spansMonths && toDate && (
                  <div className="mt-3 text-xs text-center text-zinc-400 dark:text-muted-foreground font-medium">
                    Trip continues to {format(toDate, 'MMM d')}
                  </div>
                )}
              </div>
            )}

            {/* Trip Details */}
            <div className="flex flex-col justify-center space-y-6">
              <div className="space-y-4">
                <div className="flex items-start gap-4 group">
                  <div className="w-10 h-10 rounded-full bg-teal-50 dark:bg-teal-900/30 flex items-center justify-center flex-shrink-0 group-hover:bg-teal-100 dark:group-hover:bg-teal-900/50 transition-colors">
                    <div className="w-2.5 h-2.5 rounded-full bg-teal-500 dark:bg-teal-400"></div>
                  </div>
                  <div>
                    <p className="text-xs font-bold text-zinc-400 dark:text-muted-foreground uppercase tracking-wider mb-0.5">
                      Check-in
                    </p>
                    <p className="text-lg font-semibold text-zinc-900 dark:text-foreground">
                      {fromDate ? formatCheckInDate() : 'TBD'}
                    </p>
                    <p className="text-sm text-zinc-500 dark:text-muted-foreground">
                      {fromDate ? `${formatCheckInYear()} • After 3:00 PM` : 'Date not set'}
                    </p>
                  </div>
                </div>

                <div className="w-0.5 h-8 bg-zinc-100 dark:bg-zinc-800 ml-5"></div>

                <div className="flex items-start gap-4 group">
                  <div className="w-10 h-10 rounded-full bg-zinc-50 dark:bg-zinc-800 flex items-center justify-center flex-shrink-0 group-hover:bg-zinc-100 dark:group-hover:bg-zinc-700 transition-colors">
                    <div className="w-2.5 h-2.5 rounded-full border-2 border-zinc-300 dark:border-zinc-500"></div>
                  </div>
                  <div>
                    <p className="text-xs font-bold text-zinc-400 dark:text-muted-foreground uppercase tracking-wider mb-0.5">
                      Check-out
                    </p>
                    <p className="text-lg font-semibold text-zinc-900 dark:text-foreground">
                      {toDate ? formatCheckOutDate() : 'TBD'}
                    </p>
                    <p className="text-sm text-zinc-500 dark:text-muted-foreground">
                      {toDate ? `${formatCheckOutYear()} • Before 11:00 AM` : 'Date not set'}
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Footer Actions */}
          <div className="bg-zinc-50 dark:bg-zinc-900/50 px-6 py-4 border-t border-zinc-100 dark:border-border flex flex-col md:flex-row items-center justify-between gap-4">
            <div className="flex items-center gap-2 text-xs text-zinc-400 dark:text-muted-foreground">
              <Clock className="w-3.5 h-3.5" />
              <span>{isBooking ? 'Booking' : 'Estimate'} created on {createdAt ? formatCreatedDate() : 'Unknown date'}</span>
            </div>

            <button 
              onClick={handleInviteAccept} 
              disabled={isLoading}
              className="w-full md:w-auto text-sm font-semibold text-white bg-teal-600 dark:bg-teal-500 hover:bg-teal-700 dark:hover:bg-teal-600 h-10 flex items-center justify-center gap-2 px-6 rounded-md shadow-sm transition-all active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {!isLoading ? (
                <>
                  <Check className="w-4 h-4" />
                  Accept Invitation
                </>
              ) : (
                <>
                  <Loader2Icon className="w-4 h-4 animate-spin" />
                  Accepting...
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
