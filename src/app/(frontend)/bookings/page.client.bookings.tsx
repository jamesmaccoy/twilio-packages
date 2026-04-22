'use client'

import { useState, useCallback } from 'react'
import { BookingCarousel } from '@/components/Bookings/BookingCarousel'

interface Booking {
  fromDate: string
  toDate?: string | null | undefined
  guests: (string | any)[] | null | undefined
  id: string
  slug?: string | null | undefined
  title: string
  duration?: number | undefined
  packageName?: string | null
  packageMinNights?: number | null
  total?: number
  paymentStatus?: 'paid' | 'unpaid' | 'cancelled' | null
  addons?: Array<{
    id: string
    name: string
    price: number
    enabled: boolean
  }>
  meta?: {
    title?: string | null | undefined
    image?: string | any | null | undefined
  } | undefined
}

interface BookingsClientProps {
  upcomingBookings: Booking[]
  pastBookings: Booking[]
}

export function BookingsClient({ upcomingBookings, pastBookings }: BookingsClientProps) {
  const [upcoming, setUpcoming] = useState<Booking[]>(upcomingBookings)
  const [past, setPast] = useState<Booking[]>(pastBookings)

  const handleToggleAddon = useCallback((bookingId: string, addonId: string) => {
    // Find the booking
    const booking = [...upcoming, ...past].find(b => b.id === bookingId)
    if (!booking) return

    // Don't allow toggling for inactive bookings
    const now = new Date()
    const fromDate = new Date(booking.fromDate)
    const toDate = booking.toDate ? new Date(booking.toDate) : null
    
    const isActive = fromDate > now || (toDate && fromDate <= now && toDate >= now)
    if (!isActive) return

    // Update local state
    const updateBooking = (bookings: Booking[]) =>
      bookings.map((b) => {
        if (b.id !== bookingId) return b
        return {
          ...b,
          addons: b.addons?.map((addon) => {
            if (addon.id !== addonId) return addon
            return {
              ...addon,
              enabled: !addon.enabled,
            }
          }),
        }
      })

    setUpcoming(updateBooking)
    setPast(updateBooking)
  }, [upcoming, past])

  return (
    <>
      {upcoming.length > 0 && (
        <BookingCarousel
          title="Upcoming Bookings"
          bookings={upcoming}
          onToggleAddon={handleToggleAddon}
        />
      )}

      {past.length > 0 && (
        <div className="opacity-80 hover:opacity-100 transition-opacity duration-300">
          <BookingCarousel
            title="Past Bookings"
            bookings={past}
            onToggleAddon={handleToggleAddon}
          />
        </div>
      )}
    </>
  )
}

