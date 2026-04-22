'use client'

import { type Media as MediaType, User } from '@/payload-types'
import { formatDate } from 'date-fns'
import { Calendar, MapPin, CheckCircle, XCircle, Clock } from 'lucide-react'
import Link from 'next/link'
import React, { FC } from 'react'
import { Media } from '../Media'
import { Card } from '../ui/card'
import { Button } from '../ui/button'
import { AddonToggle } from './AddonToggle'

type BookingStatus = 'upcoming' | 'active' | 'completed' | 'cancelled'

type Props = {
  booking: {
    fromDate: string
    toDate?: string | null | undefined
    guests: (string | User)[] | null | undefined
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
    meta?:
      | {
          title?: string | null | undefined
          image?: string | MediaType | null | undefined
        }
      | undefined
  }
  onToggleAddon?: (bookingId: string, addonId: string) => void
}

const BookingCard: FC<Props> = ({ booking, onToggleAddon }) => {
  // Determine booking status
  const getBookingStatus = (): BookingStatus => {
    if (booking.paymentStatus === 'cancelled') return 'cancelled'
    
    const now = new Date()
    const fromDate = new Date(booking.fromDate)
    const toDate = booking.toDate ? new Date(booking.toDate) : null
    
    if (fromDate > now) return 'upcoming'
    if (toDate && fromDate <= now && toDate >= now) return 'active'
    if (toDate && toDate < now) return 'completed'
    
    return 'upcoming'
  }

  const status = getBookingStatus()
  const isActive = status === 'upcoming' || status === 'active'

  const statusColors = {
    upcoming: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300',
    active: 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300',
    completed: 'bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300',
    cancelled: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300',
  }

  const statusIcons = {
    upcoming: <Clock className="w-3 h-3 mr-1" />,
    active: <CheckCircle className="w-3 h-3 mr-1" />,
    completed: <CheckCircle className="w-3 h-3 mr-1" />,
    cancelled: <XCircle className="w-3 h-3 mr-1" />,
  }

  const formatPrice = (price?: number) => {
    if (!price) return 'R0'
    return `R${price.toLocaleString('en-ZA')}`
  }

  // Get image URL
  const imageUrl = booking.meta?.image && typeof booking.meta.image !== 'string' 
    ? (typeof booking.meta.image === 'object' && 'url' in booking.meta.image 
        ? booking.meta.image.url 
        : null)
    : null

  return (
    <Card
      className={`
        h-full overflow-hidden transition-all duration-300 hover:shadow-md p-0
        ${isActive ? 'border-l-4 border-l-green-500' : 'opacity-90 grayscale-[0.3] hover:grayscale-0'}
        min-w-[300px] max-w-[350px] w-full snap-center flex flex-col
      `}
    >
      {/* Image Header */}
      <div className="relative h-40 w-full bg-muted">
        {imageUrl ? (
          <img
            src={imageUrl}
            alt={booking.title}
            className="w-full h-full object-cover"
          />
        ) : booking.meta?.image && typeof booking.meta.image !== 'string' ? (
          <Media 
            resource={booking.meta.image} 
            size="50vw" 
            className="w-full h-full object-cover"
            postId={booking.id}
            postTitle={booking.title}
          />
        ) : (
          <div className="w-full h-full bg-gradient-to-br from-teal-100 to-teal-200 dark:from-teal-900/20 dark:to-teal-800/20" />
        )}
        <div
          className={`absolute top-3 right-3 px-2 py-1 rounded-full text-xs font-medium flex items-center ${statusColors[status]}`}
        >
          {statusIcons[status]}
          {status.charAt(0).toUpperCase() + status.slice(1)}
        </div>
      </div>

      {/* Content */}
      <div className="p-5 flex-1 flex flex-col">
        <div className="mb-4">
          <h3 className="text-lg font-semibold text-foreground mb-1 line-clamp-1">
            {booking.title}
          </h3>
          <div className="flex items-center text-muted-foreground text-sm mb-1">
            <MapPin className="w-3.5 h-3.5 mr-1" />
            <span className="line-clamp-1">Property Location</span>
          </div>
          <div className="flex items-center text-muted-foreground text-sm">
            <Calendar className="w-3.5 h-3.5 mr-1" />
            {formatDate(new Date(booking.fromDate), 'dd/MM/yyyy')} -{' '}
            {booking.toDate ? formatDate(new Date(booking.toDate), 'dd/MM/yyyy') : 'TBD'}
          </div>
        </div>

        {/* Addons Section */}
        {booking.addons && booking.addons.length > 0 && (
          <div className="mb-4 flex-1">
            <h4 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-2">
              Add-ons
            </h4>
            <div className="space-y-1">
              {booking.addons.map((addon) => (
                <AddonToggle
                  key={addon.id}
                  label={addon.name}
                  price={addon.price}
                  isOn={addon.enabled}
                  onToggle={() => onToggleAddon?.(booking.id, addon.id)}
                  disabled={!isActive}
                />
              ))}
            </div>
          </div>
        )}

        {/* Footer */}
        <div className="pt-4 mt-auto border-t flex items-center justify-between">
          <div className="flex flex-col">
            <span className="text-xs text-muted-foreground">Total</span>
            <span className="font-bold text-lg">{formatPrice(booking.total)}</span>
          </div>
          <Link href={`/bookings/${booking.id}`}>
            <Button
              variant={isActive ? 'default' : 'outline'}
              size="sm"
              disabled={!isActive}
            >
              {isActive ? 'Manage Booking' : 'View Details'}
            </Button>
          </Link>
        </div>
      </div>
    </Card>
  )
}

export default BookingCard
