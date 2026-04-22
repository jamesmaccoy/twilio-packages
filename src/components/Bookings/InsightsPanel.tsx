'use client'

import React, { useState, useEffect } from 'react'
import { Sparkles, TrendingUp, Home, Star } from 'lucide-react'
import { Card, CardContent } from '@/components/ui/card'
import Link from 'next/link'

interface UserInsights {
  engagementScore: number
  totalBookings: number
  favoriteProperty: string
  popularAddon: string
  recommendation: string
  estimateLink?: {
    postSlug: string
    estimateId: string
  } | null
}

interface InsightsPanelProps {
  userId: string
}

export function InsightsPanel({ userId }: InsightsPanelProps) {
  const [insights, setInsights] = useState<UserInsights | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const fetchInsights = async () => {
      try {
        setLoading(true)
        const [insightsResponse, estimateResponse] = await Promise.all([
          fetch('/api/tracking-insights'),
          fetch(`/api/estimates/latest?userId=${userId}`)
        ])
        
        const insightsData = await insightsResponse.json()
        const latestEstimate = estimateResponse.ok ? await estimateResponse.json() : null
        
        // Get estimate link if available
        let estimateLink: { postSlug: string; estimateId: string } | null = null
        if (latestEstimate) {
          const post = typeof latestEstimate.post === 'object' ? latestEstimate.post : null
          const postSlug = post?.slug
          if (postSlug && latestEstimate.id) {
            estimateLink = {
              postSlug,
              estimateId: latestEstimate.id
            }
          }
        }
        
        // Transform the API response to match UserInsights interface
        const stats = insightsData.stats
        const transformedInsights: UserInsights = {
          engagementScore: stats.engagementScore || 0,
          totalBookings: stats.bookings?.totalBookings || 0,
          favoriteProperty: stats.bookings?.favoriteProperties?.[0]?.title || 'No bookings yet',
          popularAddon: stats.addons?.popularAddons?.[0]?.name || 'No addons purchased',
          recommendation: generateRecommendation(stats),
          estimateLink,
        }
        
        setInsights(transformedInsights)
      } catch (error) {
        console.error('Error fetching insights:', error)
      } finally {
        setLoading(false)
      }
    }

    if (userId) {
      fetchInsights()
    }
  }, [userId])

  const generateRecommendation = (stats: any): string => {
    if (!stats) return 'Start exploring our properties to get personalized recommendations.'
    
    const { bookings, estimates, addons } = stats
    
    if (bookings?.totalBookings === 0) {
      return 'Start your first booking to unlock personalized recommendations.'
    }
    
    if (estimates?.conversionRate < 50) {
      return 'Try booking sooner to secure your preferred dates and packages.'
    }
    
    if (addons?.addonPurchaseRate < 50) {
      return 'Consider adding addons to enhance your stay experience.'
    }
    
    return 'You\'re doing great! Consider exploring new properties to discover different experiences.'
  }

  if (loading) {
    return (
      <div className="w-full mb-8">
        <Card>
          <CardContent className="p-6">
            <div className="animate-pulse space-y-4">
              <div className="h-4 bg-muted rounded w-1/4"></div>
              <div className="h-8 bg-muted rounded w-1/2"></div>
            </div>
          </CardContent>
        </Card>
      </div>
    )
  }

  if (!insights) {
    return null
  }

  return (
    <div className="w-full mb-8">
      <div className="flex items-center gap-2 mb-4">
        <Sparkles className="w-5 h-5 text-purple-500" />
        <h2 className="text-xl font-bold text-foreground">
          AI Insights & Recommendations
        </h2>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card className="bg-gradient-to-br from-purple-50 to-white dark:from-purple-900/20 dark:to-background border-purple-100 dark:border-purple-900">
          <CardContent className="flex flex-col h-full p-6">
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm font-medium text-muted-foreground">
                Engagement Score
              </span>
              <TrendingUp className="w-4 h-4 text-purple-500" />
            </div>
            <div className="mt-auto">
              <span className="text-3xl font-bold text-foreground">
                {insights.engagementScore}
              </span>
              <span className="text-sm text-muted-foreground ml-1">/ 100</span>
              <p className="text-xs text-muted-foreground mt-1">
                {insights.engagementScore >= 70 
                  ? 'Top 10% of travelers' 
                  : insights.engagementScore >= 40 
                  ? 'Active traveler'
                  : 'Getting started'}
              </p>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="flex flex-col h-full p-6">
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm font-medium text-muted-foreground">
                Favorite Property
              </span>
              <Home className="w-4 h-4 text-blue-500" />
            </div>
            <div className="mt-auto">
              <span className="text-lg font-bold text-foreground line-clamp-2">
                {insights.favoriteProperty}
              </span>
              <p className="text-xs text-muted-foreground mt-1">
                {insights.totalBookings} {insights.totalBookings === 1 ? 'stay' : 'stays'} total
              </p>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="flex flex-col h-full p-6">
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm font-medium text-muted-foreground">
                Top Add-on
              </span>
              <Star className="w-4 h-4 text-yellow-500" />
            </div>
            <div className="mt-auto">
              <span className="text-lg font-bold text-foreground">
                {insights.popularAddon}
              </span>
              <p className="text-xs text-muted-foreground mt-1">
                Added to 80% of trips
              </p>
            </div>
          </CardContent>
        </Card>

        {insights.estimateLink ? (
          <Link href={`/posts/${insights.estimateLink.postSlug}?restoreEstimate=${insights.estimateLink.estimateId}`}>
            <Card className="bg-primary text-primary-foreground cursor-pointer hover:opacity-90 transition-opacity">
              <CardContent className="flex flex-col h-full p-6">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm font-medium opacity-90">
                    Recommendation
                  </span>
                  <Sparkles className="w-4 h-4" />
                </div>
                <div className="mt-auto">
                  <p className="text-sm font-medium leading-relaxed">
                    {insights.recommendation}
                  </p>
                  <p className="text-xs opacity-75 mt-2 underline">
                    Click to restore your estimate →
                  </p>
                </div>
              </CardContent>
            </Card>
          </Link>
        ) : (
          <Card className="bg-primary text-primary-foreground">
            <CardContent className="flex flex-col h-full p-6">
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm font-medium opacity-90">
                  Recommendation
                </span>
                <Sparkles className="w-4 h-4" />
              </div>
              <div className="mt-auto">
                <p className="text-sm font-medium leading-relaxed">
                  {insights.recommendation}
                </p>
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  )
}

