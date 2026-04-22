'use client'

import React, { useState, useEffect } from 'react'
import { cn } from '@/utilities/cn'
import { format } from 'date-fns'
import { Calendar } from '@/components/ui/calendar'
import { Button } from '@/components/ui/button'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { CalendarIcon } from 'lucide-react'
import type { EstimateBlockType } from './types'
import { useUserContext } from '@/context/UserContext'
import { useSubscription } from '@/hooks/useSubscription'
import { getCustomerEntitlement, type CustomerEntitlement } from '@/utils/packageSuggestions'

import { calculateTotal } from '@/lib/calculateTotal'
import { hasUnavailableDateBetween } from '@/utilities/hasUnavailableDateBetween'

interface Package {
  id: string
  name: string
  originalName?: string // Keep track of original name
  description: string
  multiplier: number
  category: string
  minNights: number
  maxNights: number
  revenueCatId?: string
  baseRate?: number
  isEnabled: boolean
  features: string[]
  source: 'database' | 'yoco'
  hasCustomName?: boolean // Indicates if this package has a custom name set by host
}

export type EstimateBlockProps = EstimateBlockType & {
  className?: string
  /** The unique post ID (not the slug) */
  postId: string
  baseRate: number
  baseRateOverride?: number
}

// Helper to get a valid base rate
function getValidBaseRate(baseRate: unknown, baseRateOverride: unknown): number {
  const override = Number(baseRateOverride)
  const base = Number(baseRate)
  if (!isNaN(override) && override > 0) return override
  if (!isNaN(base) && base > 0) return base
  return 150 // fallback default
}

function fetchUnavailableDates(postId: string): Promise<string[]> {
  return fetch(`/api/bookings/unavailable-dates?postId=${postId}`)
    .then((res) => res.json())
    .then((data) => data.unavailableDates || [])
}

function fetchPackages(postId: string): Promise<Package[]> {
  return fetch(`/api/packages/post/${postId}`)
    .then((res) => res.json())
    .then((data) => data.packages || [])
}

export const EstimateBlock: React.FC<EstimateBlockProps> = ({
  className,
  baseRate = 150,
  baseRateOverride,
  blockType,
  postId,
}) => {
  const effectiveBaseRate = getValidBaseRate(baseRate, baseRateOverride)
  const [startDate, setStartDate] = useState<Date | null>(null)
  const [endDate, setEndDate] = useState<Date | null>(null)
  const [selectedDuration, setSelectedDuration] = useState(1)
  const [unavailableDates, setUnavailableDates] = useState<string[]>([])
  const [packages, setPackages] = useState<Package[]>([])
  const [selectedPackage, setSelectedPackage] = useState<Package | null>(null)
  const [loading, setLoading] = useState(true)

  const { currentUser } = useUserContext()
  const subscriptionStatus = useSubscription()
  const isCustomer = !!currentUser
  const canSeeDiscount = isCustomer && subscriptionStatus.isSubscribed
  
  // Get customer entitlement for package filtering
  const [customerEntitlement, setCustomerEntitlement] = useState<CustomerEntitlement>('none')
  
  // Update customer entitlement when subscription status changes
  useEffect(() => {
    const entitlement = getCustomerEntitlement(subscriptionStatus)
    setCustomerEntitlement(entitlement)
  }, [subscriptionStatus])

  // Calculate pricing
  const packageTotal = selectedPackage
    ? calculateTotal(effectiveBaseRate, selectedDuration, selectedPackage.multiplier)
    : calculateTotal(effectiveBaseRate, selectedDuration, 1)
  const baseTotal = calculateTotal(effectiveBaseRate, selectedDuration, 1)

  // Fetch packages and unavailable dates
  useEffect(() => {
    const loadData = async () => {
      try {
        const [packagesData, unavailableDatesData] = await Promise.all([
          fetchPackages(postId),
          fetchUnavailableDates(postId)
        ])
        setPackages(packagesData)
        setUnavailableDates(unavailableDatesData)
      } catch (error) {
        console.error('Error loading data:', error)
      } finally {
        setLoading(false)
      }
    }
    loadData()
  }, [postId])

  // Calculate duration when dates change
  useEffect(() => {
    if (startDate && endDate) {
      const diffTime = Math.abs(endDate.getTime() - startDate.getTime())
      const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24))

      if (diffDays < 1 || startDate >= endDate) {
        setEndDate(null)
        return
      }

      setSelectedDuration(diffDays)
    }
  }, [startDate, endDate])

  // Auto-select appropriate package when duration changes
  useEffect(() => {
    if (selectedDuration > 0 && packages.length > 0) {
      // Find the best package for this duration
      const suitablePackages = packages.filter(pkg => 
        pkg.isEnabled && 
        selectedDuration >= pkg.minNights && 
        selectedDuration <= pkg.maxNights
      )
      
      if (suitablePackages.length > 0) {
        // Prefer Yoco packages, then database packages
        const yocoPackage = suitablePackages.find(pkg => pkg.source === 'yoco')
        const databasePackage = suitablePackages.find(pkg => pkg.source === 'database')
        
        const selectedPkg = yocoPackage || databasePackage || suitablePackages[0]
        setSelectedPackage(selectedPkg || null)
      } else {
        setSelectedPackage(null)
      }
    }
  }, [selectedDuration, packages])

  if (blockType !== 'stayDuration') {
    return null
  }

  if (loading) {
    return (
      <div className={cn(
        'flex flex-col space-y-4 p-6 bg-card rounded-lg border border-border',
        className,
      )}>
        <div className="animate-pulse">
          <div className="h-6 bg-gray-200 rounded mb-4"></div>
          <div className="h-10 bg-gray-200 rounded mb-2"></div>
          <div className="h-10 bg-gray-200 rounded mb-4"></div>
          <div className="h-20 bg-gray-200 rounded"></div>
        </div>
      </div>
    )
  }

  // Filter packages to show only suitable ones for the selected duration
  // Also filter out pro-only packages for non-pro users
  const suitablePackages = packages.filter(pkg => {
    // Basic filtering for enabled packages that match duration
    const isSuitable = pkg.isEnabled && 
      selectedDuration >= pkg.minNights && 
      selectedDuration <= pkg.maxNights
    
    if (!isSuitable) return false
    
    // Filter out pro-only packages for non-pro users
    if (pkg.revenueCatId === 'gathering_monthly' && customerEntitlement !== 'pro') {
      console.log('🚫 Filtering out gathering_monthly package for non-pro user. Entitlement:', customerEntitlement)
      return false
    }
    
    return true
  })
  
  // Debug logging
  console.log('📦 EstimateBlock Package Filtering:', {
    totalPackages: packages.length,
    suitablePackages: suitablePackages.length,
    customerEntitlement,
    selectedDuration,
    gatheringMonthlyVisible: suitablePackages.some(pkg => pkg.revenueCatId === 'gathering_monthly')
  })

  return (
    <div
      data-stay-duration
      className={cn(
        'flex flex-col space-y-4 p-6 bg-card rounded-lg border border-border',
        className,
      )}
    >
      <h3 className="text-lg font-semibold">Estimate</h3>

      {/* Date Selection */}
      <div className="flex flex-col space-y-2">
        <label className="text-sm font-medium">Duration</label>
        <div className="flex space-x-2">
          <Popover>
            <PopoverTrigger asChild>
              <Button
                variant="outline"
                className={cn(
                  'w-full justify-start text-left font-normal',
                  !startDate && 'text-muted-foreground',
                )}
              >
                <CalendarIcon className="mr-2 h-4 w-4" />
                {startDate ? format(startDate, 'PPP') : <span>When</span>}
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-auto p-0">
              <Calendar
                mode="single"
                selected={startDate || undefined}
                onSelect={(date) => setStartDate(date || null)}
                disabled={(date) =>
                  date < new Date() || unavailableDates.includes(date.toISOString())
                }
              />
            </PopoverContent>
          </Popover>

          <Popover>
            <PopoverTrigger asChild>
              <Button
                variant="outline"
                className={cn(
                  'w-full justify-start text-left font-normal',
                  !endDate && 'text-muted-foreground',
                )}
              >
                <CalendarIcon className="mr-2 h-4 w-4" />
                {endDate ? format(endDate, 'PPP') : <span>Until</span>}
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-auto p-0">
              <Calendar
                mode="single"
                selected={endDate || undefined}
                onSelect={(date) => setEndDate(date || null)}
                disabled={(date) =>
                  !startDate ||
                  date <= startDate ||
                  unavailableDates.includes(date.toISOString()) ||
                  hasUnavailableDateBetween(unavailableDates, startDate, date)
                }
              />
            </PopoverContent>
          </Popover>
        </div>
      </div>

      {/* Available Packages */}
      {suitablePackages.length > 0 && (
        <div className="space-y-3">
          <label className="text-sm font-medium">Available Packages</label>
          <div className="space-y-2">
            {suitablePackages.map((pkg) => (
              <div
                key={pkg.id}
                className={cn(
                  'p-3 rounded-lg border cursor-pointer transition-all',
                  selectedPackage?.id === pkg.id
                    ? 'border-primary bg-primary/5'
                    : 'border-border hover:border-primary/50',
                )}
                onClick={() => setSelectedPackage(pkg)}
              >
                <div className="flex justify-between items-start">
                  <div className="flex-1">
                    <div className="flex items-center gap-2">
                      <h4 className="font-medium text-sm">{pkg.name}</h4>
                      {pkg.source === 'yoco' && (
                        <span className="text-xs bg-blue-100 text-blue-800 px-2 py-1 rounded">
                          Yoco
                        </span>
                      )}
                    </div>
                    <p className="text-xs text-muted-foreground mt-1">{pkg.description}</p>
                    {pkg.features.length > 0 && (
                      <div className="mt-2">
                        <p className="text-xs text-gray-600">Features:</p>
                        <ul className="text-xs text-gray-500 mt-1 space-y-1">
                          {pkg.features.slice(0, 3).map((feature, index) => (
                            <li key={index}>• {feature}</li>
                          ))}
                        </ul>
                      </div>
                    )}
                  </div>
                  <div className="text-right">
                    <span className="text-sm font-medium">
                      {pkg.multiplier === 1 
                        ? 'Base rate' 
                        : pkg.multiplier > 1 
                          ? `+${((pkg.multiplier - 1) * 100).toFixed(0)}%`
                          : `-${((1 - pkg.multiplier) * 100).toFixed(0)}%`
                      }
                    </span>
                    {pkg.baseRate && (
                      <div className="text-xs text-gray-500 mt-1">
                        ${pkg.baseRate}/night
                      </div>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Package Information */}
      {selectedPackage && (
        <div className="space-y-2">
          <div className="flex justify-between items-center">
            <span className="text-sm text-muted-foreground">Selected Package:</span>
            <span className="font-medium">{selectedPackage.name}</span>
          </div>
          <div className="flex justify-between items-center">
            <span className="text-sm text-muted-foreground">Base Rate:</span>
            <span className="font-medium">R{effectiveBaseRate}/night</span>
          </div>
          <div className="flex justify-between items-center">
            <span className="text-sm text-muted-foreground">Duration:</span>
            <span className="font-medium">
              {selectedDuration} night{selectedDuration !== 1 ? 's' : ''}
            </span>
          </div>
          {/* Show discount/premium info */}
          {selectedPackage.multiplier !== 1 && (
            <div className="flex justify-between items-center text-green-600">
              <span className="text-sm">
                {selectedPackage.multiplier > 1 ? 'Premium:' : 'Discount:'}
              </span>
              <span className="font-medium">
                {selectedPackage.multiplier > 1 
                  ? `+${((selectedPackage.multiplier - 1) * 100).toFixed(0)}%`
                  : `${((1 - selectedPackage.multiplier) * 100).toFixed(0)}% off`
                }
              </span>
            </div>
          )}
          {/* Show locked pricing for non-subscribers */}
          {selectedPackage.multiplier !== 1 && !canSeeDiscount && (
            <div className="flex justify-between items-center text-gray-500">
              <span className="text-sm">With membership:</span>
              <span className="font-medium">
                R{packageTotal.toFixed(2)}{' '}
                <span className="ml-2 text-xs">(Login & subscribe to unlock)</span>
              </span>
            </div>
          )}
        </div>
      )}

      {/* Total Price */}
      <div className="pt-4 border-t border-border">
        <div className="flex justify-between items-center">
          <span className="text-lg font-medium">Total:</span>
          <span className="text-2xl font-bold">
            {canSeeDiscount ? `R${packageTotal.toFixed(2)}` : `R${baseTotal.toFixed(2)}`}
          </span>
        </div>
      </div>

      {/* Book Now Button */}
      <Button
        className="w-full bg-primary text-primary-foreground hover:bg-primary/90"
        disabled={!startDate || !endDate || !selectedPackage}
        onClick={async () => {
          if (!startDate || !endDate || !selectedPackage) return
          if (!currentUser?.id) {
            alert('You must be logged in to create an estimate.')
            return
          }
          const res = await fetch('/api/estimates', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              postId,
              fromDate: startDate.toISOString(),
              toDate: endDate.toISOString(),
              guests: [], // or your guests data
              total: canSeeDiscount ? packageTotal : baseTotal,
              customer: currentUser.id,
              packageType: selectedPackage.id,
            }),
          })
          if (res.ok) {
            const estimate = await res.json()
            window.location.href = `/estimate/${estimate.id}`
          } else {
            const errorText = await res.text()
            alert('Failed to create estimate: ' + errorText)
          }
        }}
      >
        {!startDate || !endDate 
          ? 'Select dates to book' 
          : !selectedPackage 
            ? 'Select a package'
            : 'Request Availability'
        }
      </Button>
    </div>
  )
}
