import { NextRequest, NextResponse } from 'next/server'
import { getPayload } from 'payload'
import configPromise from '@/payload.config'
import { getMeUser } from '@/utilities/getMeUser'

/**
 * API endpoint to aggregate tracking data for insights
 * Returns user's booking patterns, addon preferences, conversion rates, etc.
 */
export async function GET(request: NextRequest) {
  try {
    const { user } = await getMeUser()
    
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const payload = await getPayload({ config: configPromise })

    // Fetch user's bookings with addon transactions
    const bookings = await payload.find({
      collection: 'bookings',
      where: {
        or: [
          { customer: { equals: user.id } },
          { guests: { contains: user.id } }
        ]
      },
      depth: 2,
      sort: '-fromDate',
      limit: 100
    })

    // Fetch user's estimates
    const estimates = await payload.find({
      collection: 'estimates',
      where: {
        customer: { equals: user.id }
      },
      depth: 2,
      sort: '-createdAt',
      limit: 100
    })

    // Analyze booking patterns
    const bookingStats = {
      totalBookings: bookings.docs.length,
      upcomingBookings: bookings.docs.filter((b: any) => 
        new Date(b.fromDate) >= new Date()
      ).length,
      pastBookings: bookings.docs.filter((b: any) => 
        new Date(b.fromDate) < new Date()
      ).length,
      totalSpent: bookings.docs.reduce((sum: number, b: any) => 
        sum + (b.total || 0), 0
      ),
      averageBookingValue: bookings.docs.length > 0
        ? bookings.docs.reduce((sum: number, b: any) => sum + (b.total || 0), 0) / bookings.docs.length
        : 0,
      addonPurchases: bookings.docs.reduce((count: number, b: any) => {
        const addons = b.addonTransactions || []
        return count + (Array.isArray(addons) ? addons.length : 0)
      }, 0),
      favoriteProperties: (() => {
        const propertyCounts: Record<string, { count: number; title: string; totalSpent: number }> = {}
        bookings.docs.forEach((b: any) => {
          const post = typeof b.post === 'object' ? b.post : null
          const postId = post?.id || 'unknown'
          const postTitle = post?.title || 'Unknown Property'
          
          if (!propertyCounts[postId]) {
            propertyCounts[postId] = { count: 0, title: postTitle, totalSpent: 0 }
          }
          propertyCounts[postId].count++
          propertyCounts[postId].totalSpent += b.total || 0
        })
        return Object.values(propertyCounts)
          .sort((a, b) => b.count - a.count)
          .slice(0, 5)
      })(),
      bookingFrequency: (() => {
        if (bookings.docs.length < 2) return null
        const dates = bookings.docs
          .map((b: any) => new Date(b.fromDate).getTime())
          .sort((a, b) => a - b)
        const intervals = []
        for (let i = 1; i < dates.length; i++) {
          intervals.push((dates[i] - dates[i-1]) / (1000 * 60 * 60 * 24)) // days
        }
        const avgInterval = intervals.reduce((a, b) => a + b, 0) / intervals.length
        return {
          averageDaysBetweenBookings: Math.round(avgInterval),
          isRegularCustomer: avgInterval < 90 // Books at least every 3 months
        }
      })()
    }

    // Analyze estimate conversion
    const convertedToBookings = estimates.docs.filter((e: any) => {
      // Check if estimate was converted to booking
      return bookings.docs.some((b: any) => {
        const estimateId = typeof e.id === 'string' ? e.id : String(e.id)
        // Check if booking references this estimate or was created around the same time
        return b.estimateId === estimateId || 
               (Math.abs(new Date(b.createdAt).getTime() - new Date(e.createdAt).getTime()) < 24 * 60 * 60 * 1000)
      })
    }).length

    const estimateStats = {
      totalEstimates: estimates.docs.length,
      convertedToBookings,
      averageEstimateValue: estimates.docs.length > 0
        ? estimates.docs.reduce((sum: number, e: any) => sum + (e.total || 0), 0) / estimates.docs.length
        : 0,
      conversionRate: estimates.docs.length > 0
        ? (convertedToBookings / estimates.docs.length) * 100
        : 0
    }

    // Analyze addon preferences
    const addonStats = {
      totalAddonsPurchased: bookingStats.addonPurchases,
      addonPurchaseRate: bookings.docs.length > 0
        ? (bookingStats.addonPurchases / bookings.docs.length) * 100
        : 0,
      popularAddons: (() => {
        const addonCounts: Record<string, { count: number; name: string; totalValue: number }> = {}
        bookings.docs.forEach((b: any) => {
          const addons = b.addonTransactions || []
          if (Array.isArray(addons)) {
            addons.forEach((tx: any) => {
              const addon = typeof tx === 'object' ? tx : null
              const addonName = addon?.packageName || addon?.productName || addon?.title || 'Unknown Addon'
              const addonId = addon?.id || addonName
              const addonValue = addon?.amount || addon?.value || 0
              
              if (!addonCounts[addonId]) {
                addonCounts[addonId] = { count: 0, name: addonName, totalValue: 0 }
              }
              addonCounts[addonId].count++
              addonCounts[addonId].totalValue += addonValue
            })
          }
        })
        return Object.values(addonCounts)
          .sort((a, b) => b.count - a.count)
          .slice(0, 5)
      })()
    }

    // Calculate engagement score
    const engagementScore = (() => {
      let score = 0
      // Bookings
      score += bookingStats.totalBookings * 10
      // Addons
      score += addonStats.totalAddonsPurchased * 5
      // Estimates (shows interest)
      score += estimateStats.totalEstimates * 2
      // Conversion rate
      score += estimateStats.conversionRate * 2
      // Regular customer bonus
      if (bookingStats.bookingFrequency?.isRegularCustomer) {
        score += 20
      }
      return Math.min(100, score) // Cap at 100
    })()

    return NextResponse.json({
      userId: user.id,
      userEmail: user.email,
      stats: {
        bookings: bookingStats,
        estimates: estimateStats,
        addons: addonStats,
        engagementScore,
        insights: {
          isRegularCustomer: bookingStats.bookingFrequency?.isRegularCustomer || false,
          averageBookingValue: bookingStats.averageBookingValue,
          conversionRate: estimateStats.conversionRate,
          addonEngagement: addonStats.addonPurchaseRate > 50 ? 'high' : addonStats.addonPurchaseRate > 25 ? 'medium' : 'low'
        }
      },
      timestamp: new Date().toISOString()
    })
  } catch (error) {
    console.error('Error fetching tracking insights:', error)
    return NextResponse.json(
      { error: 'Failed to fetch tracking insights', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    )
  }
}

