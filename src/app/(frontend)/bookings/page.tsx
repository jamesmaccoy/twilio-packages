import { Where } from 'payload'
import configPromise from '@payload-config'
import React from 'react'
import { Post, User } from '@/payload-types'
import { getMeUser } from '@/utilities/getMeUser'
import PageClient from './page.client'
import SuggestedPackages from '@/components/Bookings/SuggestedPackages'
import { BookingsAIAssistant } from '@/components/Bookings/BookingsAIAssistant'
import { BookingsClient } from './page.client.bookings'
import { redirect } from 'next/navigation'
import { getPayload } from 'payload'
import { Estimate } from '@/payload-types'
import { EstimateAds } from '@/components/MetaAds/EstimateAds'
// import { fetchLatestEstimate } from '@/utilities/fetchLatestEstimate'
// import { BookingsList } from './BookingsList'

// Force dynamic rendering since this page uses cookies for authentication
export const dynamic = 'force-dynamic'

const fetchLatestEstimate = async (userId: string) => {
  const payload = await getPayload({ config: configPromise });
  const estimates = await payload.find({
    collection: 'estimates',
    where: {
      customer: { equals: userId },
    },
    sort: '-createdAt',
    limit: 1,
    depth: 2,
  });
  return estimates.docs[0] || null;
};

export default async function Bookings() {
  const { user } = await getMeUser()

  if (!user) {
    redirect('/login?next=/bookings')
  }

  if (!user.mobileVerified) {
    redirect('/onboarding/mobile?next=/bookings')
  }

  const [upcomingBookings, pastBookings] = await Promise.all([
    getBookings('upcoming', user),
    getBookings('past', user),
  ])

  // Helper function to extract addons from addonTransactions
  const extractAddons = (booking: any) => {
    const addons: Array<{ id: string; name: string; price: number; enabled: boolean }> = []
    
    if (booking.addonTransactions && Array.isArray(booking.addonTransactions)) {
      booking.addonTransactions.forEach((tx: any) => {
        if (typeof tx === 'object' && tx) {
          const metadata = typeof tx.metadata === 'object' && tx.metadata !== null 
            ? tx.metadata as Record<string, any> 
            : {}
          
          const addonName = tx.packageName || tx.productName || metadata.packageName || metadata.productName || tx.title || 'Addon'
          const addonPrice = tx.amount ? tx.amount / 100 : 0 // Convert cents to rands
          
          addons.push({
            id: tx.id,
            name: addonName,
            price: addonPrice,
            enabled: true, // Addons in transactions are already purchased/enabled
          })
        }
      })
    }
    
    return addons
  }

  const formattedUpcomingBookings = upcomingBookings.docs.map((booking) => {
    const duration = booking.fromDate && booking.toDate
      ? Math.max(1, Math.round((new Date(booking.toDate).getTime() - new Date(booking.fromDate).getTime()) / (1000 * 60 * 60 * 24)))
      : undefined

    const packageName = booking.selectedPackage && typeof booking.selectedPackage === 'object' && booking.selectedPackage.package
      ? (typeof booking.selectedPackage.package === 'object' && booking.selectedPackage.package?.name
        ? booking.selectedPackage.package.name
        : booking.selectedPackage.customName || 'Package')
      : booking.selectedPackage?.customName || null

    // Extract minNights from package to determine if it's hourly
    const packageMinNights = booking.selectedPackage && typeof booking.selectedPackage === 'object' && booking.selectedPackage.package
      ? (typeof booking.selectedPackage.package === 'object' && booking.selectedPackage.package?.minNights !== undefined
        ? Number(booking.selectedPackage.package.minNights)
        : null)
      : null

    const post = typeof booking.post === 'object' ? booking.post : null

    return {
      ...(post as Pick<Post, 'meta' | 'slug' | 'title'>),
      fromDate: booking.fromDate,
      toDate: booking.toDate || undefined,
      guests: booking.guests,
      id: booking.id,
      duration,
      packageName,
      packageMinNights,
      total: booking.total,
      paymentStatus: booking.paymentStatus,
      addons: extractAddons(booking),
    }
  })

  const formattedPastBookings = pastBookings.docs.map((booking) => {
    const duration = booking.fromDate && booking.toDate
      ? Math.max(1, Math.round((new Date(booking.toDate).getTime() - new Date(booking.fromDate).getTime()) / (1000 * 60 * 60 * 24)))
      : undefined

    const packageName = booking.selectedPackage && typeof booking.selectedPackage === 'object' && booking.selectedPackage.package
      ? (typeof booking.selectedPackage.package === 'object' && booking.selectedPackage.package?.name
        ? booking.selectedPackage.package.name
        : booking.selectedPackage.customName || 'Package')
      : booking.selectedPackage?.customName || null

    // Extract minNights from package to determine if it's hourly
    const packageMinNights = booking.selectedPackage && typeof booking.selectedPackage === 'object' && booking.selectedPackage.package
      ? (typeof booking.selectedPackage.package === 'object' && booking.selectedPackage.package?.minNights !== undefined
        ? Number(booking.selectedPackage.package.minNights)
        : null)
      : null

    const post = typeof booking.post === 'object' ? booking.post : null

    return {
      ...(post as Pick<Post, 'meta' | 'slug' | 'title'>),
      fromDate: booking.fromDate,
      toDate: booking.toDate || undefined,
      guests: booking.guests,
      id: booking.id,
      duration,
      packageName,
      packageMinNights,
      total: booking.total,
      paymentStatus: booking.paymentStatus,
      addons: extractAddons(booking),
    }
  })

  console.log(upcomingBookings, pastBookings)
  const latestEstimate = await fetchLatestEstimate(user.id)

  // Transform estimate for EstimateAds component
  const estimateForAds = latestEstimate ? {
    id: latestEstimate.id,
    total: latestEstimate.total || undefined,
    title: latestEstimate.title || undefined,
    post: typeof latestEstimate.post === 'object' ? {
      id: latestEstimate.post.id,
      title: latestEstimate.post.title || undefined,
      slug: latestEstimate.post.slug || undefined,
      meta: latestEstimate.post.meta ? {
        image: latestEstimate.post.meta.image && typeof latestEstimate.post.meta.image === 'object' ? {
          url: (latestEstimate.post.meta.image as any).url || undefined
        } : undefined
      } : undefined
    } : latestEstimate.post,
    packageType: latestEstimate.packageType || undefined
  } : null

  return (
    <>
      <PageClient />
      <EstimateAds estimate={estimateForAds} />
      <div className="flex min-h-screen bg-white dark:bg-background font-sans text-slate-900 dark:text-foreground">
        <main className="flex-1 overflow-y-auto h-screen">
          <div className="max-w-5xl mx-auto px-8 py-12">
            {/* AI Assistant - Primary Tool */}
            <BookingsAIAssistant
              userId={user.id}
              upcomingBookings={formattedUpcomingBookings}
              pastBookings={formattedPastBookings}
            />

            {/* Bookings Content */}
            <div className="border-t border-slate-100 dark:border-border pt-12">
              {upcomingBookings.docs.length === 0 && pastBookings.docs.length === 0 ? (
                <div className="text-center py-10">
                  <h2 className="text-4xl font-medium tracking-tighter mb-4 text-foreground">No bookings</h2>
                  <p className="text-muted-foreground">
                    You don&apos;t have any upcoming or past bookings.
                  </p>
                </div>
              ) : (
                <BookingsClient
                  upcomingBookings={formattedUpcomingBookings}
                  pastBookings={formattedPastBookings}
                />
              )}
            </div>
          </div>
        </main>
      </div>
    </>
  )
}

const getBookings = async (type: 'upcoming' | 'past', currentUser: User) => {
  const payload = await getPayload({ config: configPromise })

  let whereQuery: Where

  if (type === 'upcoming') {
    whereQuery = {
      and: [
        {
          fromDate: {
            greater_than_equal: new Date(),
          },
        },
        {
          or: [
            {
              customer: {
                equals: currentUser.id,
              },
            },
            {
              guests: {
                contains: currentUser.id,
              },
            },
          ],
        },
      ],
    }
  } else {
    whereQuery = {
      and: [
        {
          fromDate: {
            less_than: new Date(),
          },
        },
        {
          or: [
            {
              customer: {
                equals: currentUser.id,
              },
            },
            {
              guests: {
                contains: currentUser.id,
              },
            },
          ],
        },
      ],
    }
  }

  const bookings = await payload.find({
    collection: 'bookings',
    limit: 100,
    where: whereQuery,
    depth: 2,
    sort: '-fromDate',
    select: {
      slug: true,
      post: true,
      guests: true,
      fromDate: true,
      toDate: true,
      selectedPackage: true,
      total: true,
      paymentStatus: true,
      addonTransactions: true,
    },
  })

  return bookings
}
