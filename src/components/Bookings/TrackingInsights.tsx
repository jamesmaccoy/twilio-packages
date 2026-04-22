'use client'

import React, { useState, useEffect } from 'react'
import { useChat } from '@ai-sdk/react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { 
  TrendingUp, 
  TrendingDown, 
  Package, 
  Calendar,
  Sparkles,
  BarChart3,
  ArrowRight,
  Home,
  Star,
  CheckCircle
} from 'lucide-react'
import { Conversation, ConversationContent } from '@/components/ai-elements/conversation'
import { Loader } from '@/components/ai-elements/loader'
import { Message, MessageContent, MessageResponse } from '@/components/ai-elements/message'
import {
  PromptInput,
  PromptInputBody,
  PromptInputTextarea,
  PromptInputSubmit,
} from '@/components/ai-elements/prompt-input'

interface TrackingInsightsProps {
  userId: string
}

interface InsightsStats {
  bookings: {
    totalBookings: number
    upcomingBookings: number
    totalSpent: number
    averageBookingValue: number
    addonPurchases: number
    favoriteProperties: Array<{ count: number; title: string; totalSpent: number }>
    bookingFrequency?: {
      averageDaysBetweenBookings: number
      isRegularCustomer: boolean
    } | null
  }
  estimates: {
    totalEstimates: number
    convertedToBookings: number
    conversionRate: number
  }
  addons: {
    totalAddonsPurchased: number
    addonPurchaseRate: number
    popularAddons: Array<{ count: number; name: string; totalValue: number }>
  }
  engagementScore: number
  insights: {
    isRegularCustomer: boolean
    averageBookingValue: number
    conversionRate: number
    addonEngagement: 'high' | 'medium' | 'low'
  }
}

/**
 * Component that displays tracking insights using generative UI
 * Shows user behavior patterns and AI-powered recommendations
 */
export default function TrackingInsights({ userId }: TrackingInsightsProps) {
  const [insights, setInsights] = useState<InsightsStats | null>(null)
  const [loading, setLoading] = useState(true)
  const [showChat, setShowChat] = useState(false)

  const chatHelpers = useChat({
    baseUrl: '/api/tracking-insights/chat',
  } as any)
  const messages = chatHelpers.messages || []
  const input = (chatHelpers as any).input || ''
  const handleInputChange = (chatHelpers as any).handleInputChange || (() => {})
  const handleSubmit = (chatHelpers as any).handleSubmit || (() => {})
  const isLoading = (chatHelpers as any).isLoading || false

  useEffect(() => {
    const fetchInsights = async () => {
      try {
        setLoading(true)
        const response = await fetch('/api/tracking-insights')
        const data = await response.json()
        setInsights(data.stats)
      } catch (error) {
        console.error('Error fetching tracking insights:', error)
      } finally {
        setLoading(false)
      }
    }

    if (userId) {
      fetchInsights()
    }
  }, [userId])

  if (loading) {
    return (
      <Card>
        <CardContent className="p-6">
          <Loader />
        </CardContent>
      </Card>
    )
  }

  if (!insights) {
    return null
  }

  const getEngagementColor = (score: number) => {
    if (score >= 70) return 'text-green-500'
    if (score >= 40) return 'text-yellow-500'
    return 'text-gray-500'
  }

  const favoriteProperty = insights.bookings.favoriteProperties[0]?.title || 'No bookings yet'
  const popularAddon = insights.addons.popularAddons[0]?.name || 'No addons purchased'
  const addonPurchaseRate = insights.addons.addonPurchaseRate

  // Generate AI recommendation based on insights
  const getRecommendation = () => {
    if (insights.insights.isRegularCustomer) {
      return 'As a regular customer, you may be eligible for loyalty discounts on your next booking.'
    }
    if (insights.addons.addonPurchaseRate < 50) {
      return 'Based on your history, consider adding premium addons to enhance your stay experience.'
    }
    if (insights.estimates.conversionRate < 50) {
      return 'Try booking sooner to secure your preferred dates and packages.'
    }
    return 'You\'re doing great! Consider exploring new properties to discover different experiences.'
  }

  return (
    <div className="space-y-6">
      {/* Main Insights Panel - Clean Design */}
      <div className="w-full mb-8">
        <div className="flex items-center gap-2 mb-4">
          <Sparkles className="w-5 h-5 text-purple-500" />
          <h2 className="text-xl font-bold text-foreground">
            AI Insights & Recommendations
          </h2>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {/* Engagement Score Card */}
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

          {/* Favorite Property Card */}
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
                  {favoriteProperty}
                </span>
                <p className="text-xs text-muted-foreground mt-1">
                  {insights.bookings.favoriteProperties[0]?.count || insights.bookings.totalBookings} {insights.bookings.favoriteProperties[0]?.count === 1 || insights.bookings.totalBookings === 1 ? 'stay' : 'stays'} total
                </p>
              </div>
            </CardContent>
          </Card>

          {/* Top Addon Card */}
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
                  {popularAddon}
                </span>
                <p className="text-xs text-muted-foreground mt-1">
                  {addonPurchaseRate > 0 
                    ? `Added to ${Math.round(addonPurchaseRate)}% of trips`
                    : 'No addons purchased yet'}
                </p>
              </div>
            </CardContent>
          </Card>

          {/* Recommendation Card */}
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
                  {getRecommendation()}
                </p>
                <Button
                  variant="secondary"
                  size="sm"
                  className="mt-4 w-full"
                  onClick={() => setShowChat(true)}
                >
                  Get More Insights
                  <ArrowRight className="ml-2 h-3 w-3" />
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Detailed Stats - Enhanced */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card className="hover:shadow-md transition-shadow border-l-4 border-l-blue-500">
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <CardTitle className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">
                Total Bookings
              </CardTitle>
              <Calendar className="w-4 h-4 text-blue-500" />
            </div>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-foreground">{insights.bookings.totalBookings}</div>
            <div className="flex items-center gap-2 mt-2">
              <div className="flex-1 bg-muted rounded-full h-1.5 overflow-hidden">
                <div 
                  className="h-full rounded-full bg-blue-500 transition-all duration-500"
                  style={{ width: `${insights.bookings.totalBookings > 0 ? Math.min((insights.bookings.upcomingBookings / insights.bookings.totalBookings) * 100, 100) : 0}%` }}
                />
              </div>
              <p className="text-xs font-medium text-muted-foreground whitespace-nowrap">
                {insights.bookings.upcomingBookings} upcoming
              </p>
            </div>
          </CardContent>
        </Card>

        <Card className="hover:shadow-md transition-shadow border-l-4 border-l-green-500">
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <CardTitle className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">
                Total Spent
              </CardTitle>
              <TrendingUp className="w-4 h-4 text-green-500" />
            </div>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-foreground">
              R{insights.bookings.totalSpent.toLocaleString('en-ZA')}
            </div>
            <p className="text-xs text-muted-foreground mt-2 flex items-center gap-1">
              <span>Avg booking:</span>
              <span className="font-semibold">R{insights.bookings.averageBookingValue.toFixed(0)}</span>
            </p>
          </CardContent>
        </Card>

        <Card className="hover:shadow-md transition-shadow border-l-4 border-l-purple-500">
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <CardTitle className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">
                Conversion Rate
              </CardTitle>
              <BarChart3 className="w-4 h-4 text-purple-500" />
            </div>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-foreground">
              {insights.estimates.conversionRate.toFixed(1)}%
            </div>
            <div className="flex items-center gap-2 mt-2">
              <div className="flex-1 bg-muted rounded-full h-1.5 overflow-hidden">
                <div 
                  className={`h-full rounded-full transition-all duration-500 ${
                    insights.estimates.conversionRate >= 50 ? 'bg-green-500' :
                    insights.estimates.conversionRate >= 25 ? 'bg-yellow-500' :
                    'bg-red-500'
                  }`}
                  style={{ width: `${insights.estimates.conversionRate}%` }}
                />
              </div>
              <p className="text-xs font-medium text-muted-foreground whitespace-nowrap">
                {insights.estimates.convertedToBookings}/{insights.estimates.totalEstimates}
              </p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Additional Insights - Enhanced */}
      <Card className="border-2">
        <CardHeader className="pb-4">
          <div className="flex items-center justify-between">
            <CardTitle className="flex items-center gap-2 text-lg">
              <div className="p-2 rounded-lg bg-teal-500/10">
                <BarChart3 className="h-5 w-5 text-teal-400" />
              </div>
              Detailed Insights
            </CardTitle>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setShowChat(!showChat)}
              className="gap-2"
            >
              {showChat ? 'Hide' : 'Show'} AI Chat
              <Sparkles className="h-4 w-4" />
            </Button>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Addon Engagement - Enhanced */}
          <div className="group p-4 rounded-xl bg-gradient-to-r from-muted/50 to-muted/30 border border-border/50 hover:border-teal-500/50 transition-all duration-300">
            <div className="flex items-start justify-between">
              <div className="flex-1">
                <div className="flex items-center gap-2 mb-2">
                  <div className="p-1.5 rounded-lg bg-teal-500/10">
                    <Package className="h-4 w-4 text-teal-400" />
                  </div>
                  <span className="font-semibold">Addon Engagement</span>
                </div>
                <p className="text-sm text-muted-foreground mb-3">
                  {insights.addons.totalAddonsPurchased} addons purchased across {insights.bookings.totalBookings} bookings
                </p>
                {insights.addons.popularAddons.length > 0 && (
                  <div className="flex flex-wrap gap-2">
                    {insights.addons.popularAddons.slice(0, 3).map((addon, idx) => (
                      <Badge key={idx} variant="outline" className="text-xs bg-background/50">
                        <Star className="w-3 h-3 mr-1 text-yellow-500 fill-yellow-500" />
                        {addon.name} ({addon.count}x)
                      </Badge>
                    ))}
                  </div>
                )}
              </div>
              <Badge className={
                insights.insights.addonEngagement === 'high' ? 'bg-green-500 hover:bg-green-600' :
                insights.insights.addonEngagement === 'medium' ? 'bg-yellow-500 hover:bg-yellow-600' :
                'bg-gray-500 hover:bg-gray-600'
              }>
                {insights.insights.addonEngagement.toUpperCase()}
              </Badge>
            </div>
            <div className="mt-3 flex items-center gap-2">
              <div className="flex-1 bg-muted rounded-full h-2 overflow-hidden">
                <div 
                  className={`h-full rounded-full transition-all duration-500 ${
                    insights.insights.addonEngagement === 'high' ? 'bg-green-500' :
                    insights.insights.addonEngagement === 'medium' ? 'bg-yellow-500' :
                    'bg-gray-400'
                  }`}
                  style={{ width: `${insights.addons.addonPurchaseRate}%` }}
                />
              </div>
              <span className="text-xs font-semibold text-muted-foreground">
                {insights.addons.addonPurchaseRate.toFixed(0)}%
              </span>
            </div>
          </div>

          {/* Booking Frequency - Enhanced */}
          {insights.bookings.bookingFrequency && (
            <div className="group p-4 rounded-xl bg-gradient-to-r from-muted/50 to-muted/30 border border-border/50 hover:border-teal-500/50 transition-all duration-300">
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-2">
                    <div className="p-1.5 rounded-lg bg-blue-500/10">
                      <Calendar className="h-4 w-4 text-blue-500" />
                    </div>
                    <span className="font-semibold">Booking Frequency</span>
                  </div>
                  <p className="text-sm text-muted-foreground">
                    Average <span className="font-semibold text-foreground">{insights.bookings.bookingFrequency.averageDaysBetweenBookings}</span> days between bookings
                  </p>
                </div>
                {insights.bookings.bookingFrequency.isRegularCustomer && (
                  <Badge className="bg-teal-500 hover:bg-teal-600">
                    <CheckCircle className="w-3 h-3 mr-1" />
                    Regular Customer
                  </Badge>
                )}
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Generative UI Chat - Enhanced */}
      {showChat && (
        <Card className="border-2 border-teal-500/20 bg-gradient-to-br from-background to-teal-50/30 dark:to-teal-900/10">
          <CardHeader className="pb-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-lg bg-teal-500/10">
                  <Sparkles className="h-5 w-5 text-teal-400" />
                </div>
                <div>
                  <CardTitle className="text-lg">AI Insights Assistant</CardTitle>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    Ask questions about your booking patterns and get personalized recommendations
                  </p>
                </div>
              </div>
              <Button
                variant="ghost"
                size="icon"
                onClick={() => setShowChat(false)}
                className="h-8 w-8"
              >
                ×
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            <Conversation>
              <ConversationContent>
                {messages.length === 0 && (
                  <div className="text-sm text-muted-foreground p-4 text-center">
                    Ask me about your booking patterns, addon preferences, or get personalized recommendations.
                  </div>
                )}
                {messages.map((message) => (
                  <Message key={message.id} from={message.role === 'user' ? 'user' : 'assistant'}>
                    <MessageContent>
                      {message.parts.map((part: any, index: number) => {
                        if (part.type === 'text') {
                          return (
                            <MessageResponse key={index}>
                              {part.text}
                            </MessageResponse>
                          )
                        }

                        // Handle tool calls using generative UI pattern
                        if (part.type?.startsWith('tool-')) {
                          const toolName = part.type.replace('tool-', '')
                          const toolPart = part as any
                          
                          if (toolPart.state === 'input-available') {
                            return (
                              <div key={index} className="text-sm text-muted-foreground">
                                Analyzing {toolName}...
                              </div>
                            )
                          }
                          
                          if (toolPart.state === 'output-available') {
                            // Render tool-specific UI components
                            if (toolName === 'recommendAddons' && toolPart.output) {
                              const output = toolPart.output as any
                              return (
                                <div key={index} className="space-y-2">
                                  <p className="font-medium">{output.message}</p>
                                  {output.recommendations?.map((rec: any, idx: number) => (
                                    <div key={idx} className="p-2 rounded border bg-muted/50">
                                      <div className="font-medium">{rec.name}</div>
                                      <div className="text-sm text-muted-foreground">{rec.reason}</div>
                                      <div className="text-sm font-medium mt-1">R{rec.value}</div>
                                    </div>
                                  ))}
                                </div>
                              )
                            }
                            // Default: render JSON output
                            return (
                              <div key={index} className="text-sm">
                                <pre className="bg-muted p-2 rounded text-xs overflow-auto">
                                  {JSON.stringify(toolPart.output || {}, null, 2)}
                                </pre>
                              </div>
                            )
                          }
                          
                          if (toolPart.state === 'output-error') {
                            return (
                              <div key={index} className="text-sm text-destructive">
                                Error: {toolPart.errorText || 'Unknown error'}
                              </div>
                            )
                          }
                        }

                        return null
                      })}
                    </MessageContent>
                  </Message>
                ))}
                {isLoading && (
                  <Message from="assistant">
                    <MessageContent>
                      <Loader />
                    </MessageContent>
                  </Message>
                )}
              </ConversationContent>
            </Conversation>

            <div className="mt-4">
              <PromptInput
                onSubmit={(message, e) => {
                  e.preventDefault()
                  if (message.text?.trim()) {
                    // Update input and submit
                    handleInputChange({ target: { value: message.text } } as any)
                    // Use setTimeout to ensure state updates before submit
                    setTimeout(() => {
                      handleSubmit(e as any)
                    }, 0)
                  }
                }}
              >
                <PromptInputBody>
                  <PromptInputTextarea
                    name="text"
                    value={input || ''}
                    onChange={handleInputChange}
                    placeholder="Ask about your booking patterns, addon preferences, or get recommendations..."
                  />
                </PromptInputBody>
                <PromptInputSubmit disabled={isLoading} />
              </PromptInput>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  )
}

