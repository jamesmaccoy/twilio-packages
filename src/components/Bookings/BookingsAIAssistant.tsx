'use client'

import React, { useState, useEffect, useRef } from 'react'
import { PageAIAssistant } from '@/components/AIAssistant/PageAIAssistant'
import { useSearchParams } from 'next/navigation'

interface BookingsAIAssistantProps {
  userId: string
  upcomingBookings: any[]
  pastBookings: any[]
}

export function BookingsAIAssistant({ userId, upcomingBookings, pastBookings }: BookingsAIAssistantProps) {
  const [insights, setInsights] = useState<any>(null)
  const [latestEstimate, setLatestEstimate] = useState<any>(null)
  const [shouldRestoreEstimate, setShouldRestoreEstimate] = useState(false)
  const [loading, setLoading] = useState(true)
  const estimateRestoredRef = useRef(false)
  const searchParams = useSearchParams()

  useEffect(() => {
    const fetchInsights = async () => {
      try {
        setLoading(true)
        const [insightsResponse, estimateResponse] = await Promise.all([
          fetch('/api/tracking-insights'),
          fetch(`/api/estimates/latest?userId=${userId}`)
        ])
        
        const insightsData = await insightsResponse.json()
        const estimate = estimateResponse.ok ? await estimateResponse.json() : null
        
        // Check for restoreEstimate URL parameter
        const restoreEstimateId = searchParams?.get('restoreEstimate')
        let estimateToRestore = estimate
        
        if (restoreEstimateId && !estimateRestoredRef.current) {
          // Fetch the specific estimate to restore
          try {
            const restoreResponse = await fetch(`/api/estimates/${restoreEstimateId}`)
            if (restoreResponse.ok) {
              const restoreEstimate = await restoreResponse.json()
              // Verify it belongs to the user
              const estimateCustomerId = typeof restoreEstimate.customer === 'string' 
                ? restoreEstimate.customer 
                : restoreEstimate.customer?.id
              if (estimateCustomerId === userId) {
                estimateToRestore = restoreEstimate
                estimateRestoredRef.current = true
              }
            }
          } catch (error) {
            console.error('Error fetching estimate to restore:', error)
          }
        }
        
        setLatestEstimate(estimateToRestore)
        
        // Get estimate link if available
        let estimateLink: { postSlug: string; estimateId: string } | null = null
        if (estimateToRestore) {
          const post = typeof estimateToRestore.post === 'object' ? estimateToRestore.post : null
          const postSlug = post?.slug
          if (postSlug && estimateToRestore.id) {
            estimateLink = {
              postSlug,
              estimateId: estimateToRestore.id
            }
          }
        }
        
        // Transform the API response
        const stats = insightsData.stats
        const transformedInsights = {
          engagementScore: stats.engagementScore || 0,
          totalBookings: stats.bookings?.totalBookings || 0,
          favoriteProperty: stats.bookings?.favoriteProperties?.[0]?.title || 'No bookings yet',
          popularAddon: stats.addons?.popularAddons?.[0]?.name || 'No addons purchased',
          estimateLink,
        }
        
        setInsights(transformedInsights)
        
        // Auto-restore if there's a latest estimate
        // Set restoreEstimate flag if we have an estimate (either from URL param or latest)
        if (estimateToRestore) {
          setShouldRestoreEstimate(true)
          if (restoreEstimateId) {
            estimateRestoredRef.current = true
          }
        }
      } catch (error) {
        console.error('Error fetching insights:', error)
      } finally {
        setLoading(false)
      }
    }

    if (userId) {
      fetchInsights()
    }
  }, [userId, searchParams])

  return (
    <PageAIAssistant
      context={{
        type: 'bookings',
        data: {
          bookings: {
            upcoming: upcomingBookings,
            past: pastBookings,
          },
          insights: insights,
          latestEstimate: latestEstimate, // Pass latest estimate for restoration
          restoreEstimate: shouldRestoreEstimate, // Flag to indicate restoration
        },
      }}
      variant="primary"
    />
  )
}

