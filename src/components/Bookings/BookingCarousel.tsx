'use client'

import React, { useRef } from 'react'
import { ChevronLeft, ChevronRight } from 'lucide-react'
import { Button } from '@/components/ui/button'
import BookingCard from './BookingCard'

interface BookingCarouselProps {
  title: string
  bookings: Array<{
    fromDate: string
    toDate?: string | null | undefined
    guests: (string | any)[] | null | undefined
    id: string
    slug?: string | null | undefined
    title: string
    duration?: number | undefined
    packageName?: string | null
    packageMinNights?: number | null
    meta?: {
      title?: string | null | undefined
      image?: string | any | null | undefined
    } | undefined
  }>
  onToggleAddon?: (bookingId: string, addonId: string) => void
}

export function BookingCarousel({
  title,
  bookings,
  onToggleAddon,
}: BookingCarouselProps) {
  const scrollContainerRef = useRef<HTMLDivElement>(null)

  const scroll = (direction: 'left' | 'right') => {
    if (scrollContainerRef.current) {
      const scrollAmount = 320 // Approx card width + gap
      const newScrollLeft =
        scrollContainerRef.current.scrollLeft +
        (direction === 'left' ? -scrollAmount : scrollAmount)
      scrollContainerRef.current.scrollTo({
        left: newScrollLeft,
        behavior: 'smooth',
      })
    }
  }

  if (bookings.length === 0) {
    return null
  }

  return (
    <div className="w-full py-6">
      <div className="flex items-center justify-between mb-4 px-1">
        <h2 className="text-xl font-bold text-foreground">{title}</h2>
        <div className="flex gap-2">
          <Button
            variant="outline"
            size="icon"
            onClick={() => scroll('left')}
            aria-label="Scroll left"
            className="h-8 w-8 rounded-full"
          >
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <Button
            variant="outline"
            size="icon"
            onClick={() => scroll('right')}
            aria-label="Scroll right"
            className="h-8 w-8 rounded-full"
          >
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>
      </div>

      <div
        ref={scrollContainerRef}
        className="flex gap-6 overflow-x-auto pb-6 px-1 snap-x snap-mandatory [&::-webkit-scrollbar]:hidden [-ms-overflow-style:none] [scrollbar-width:none]"
      >
        {bookings.map((booking) => (
          <div key={booking.id} className="min-w-[300px] max-w-[350px] w-full snap-center flex-shrink-0">
            <BookingCard booking={booking} onToggleAddon={onToggleAddon} />
          </div>
        ))}
        {/* Spacer for right padding */}
        <div className="w-1 flex-shrink-0" />
      </div>
    </div>
  )
}

