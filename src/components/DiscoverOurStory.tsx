'use client'

import React, { useEffect, useState } from 'react'
import { motion } from 'framer-motion'
import { MessageSquare, Clock, User, Share2, ExternalLink, Loader2 } from 'lucide-react'
import Link from 'next/link'
import { Gravatar } from '@/components/Gravatar'

interface ActivityItem {
  id: string
  estimateId: string
  estimateTitle: string
  estimateSlug?: string | null
  postId: string
  postTitle?: string
  postSlug?: string
  fromDate?: string
  toDate?: string
  packageType?: string | null
  selectedPackage?: {
    package?: string | null
    customName?: string | null
  } | null
  user: string
  userName: string
  userEmail?: string | null
  type: string
  content: string
  timestamp: string
}

export function DiscoverOurStory() {
  const [latestActivity, setLatestActivity] = useState<ActivityItem[]>([])
  const [loadingActivity, setLoadingActivity] = useState(true)
  const [sharingEstimateId, setSharingEstimateId] = useState<string | null>(null)
  const [sharedUrls, setSharedUrls] = useState<Record<string, string>>({})

  useEffect(() => {
    const fetchLatestActivity = async () => {
      try {
        const response = await fetch('/api/estimates/activity/latest?limit=20')
        if (response.ok) {
          const data = await response.json()
          setLatestActivity(data.activity || [])
        }
      } catch (error) {
        console.error('Error fetching latest activity:', error)
      } finally {
        setLoadingActivity(false)
      }
    }

    fetchLatestActivity()
  }, [])

  const formatTimeAgo = (timestamp: string) => {
    const date = new Date(timestamp)
    const now = new Date()
    const diffInSeconds = Math.floor((now.getTime() - date.getTime()) / 1000)

    if (diffInSeconds < 60) return 'just now'
    if (diffInSeconds < 3600) return `${Math.floor(diffInSeconds / 60)} minutes ago`
    if (diffInSeconds < 86400) return `${Math.floor(diffInSeconds / 3600)} hours ago`
    if (diffInSeconds < 604800) return `${Math.floor(diffInSeconds / 86400)} days ago`
    
    return date.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    })
  }

  const handleShareEstimate = async (activity: ActivityItem) => {
    if (sharingEstimateId === activity.estimateId) return
    
    // If already shared, copy to clipboard
    if (sharedUrls[activity.estimateId]) {
      try {
        await navigator.clipboard.writeText(sharedUrls[activity.estimateId])
        alert('Share link copied to clipboard!')
      } catch (error) {
        console.error('Failed to copy to clipboard:', error)
      }
      return
    }

    setSharingEstimateId(activity.estimateId)
    
    try {
      const response = await fetch(`/api/estimates/${activity.estimateId}/share`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
      })

      if (!response.ok) {
        const error = await response.json()
        throw new Error(error.error || 'Failed to share estimate')
      }

      const data = await response.json()
      const newEstimateId = data.estimateId || data.estimate?.id
      
      // Construct share URL using postSlug from activity if available
      const baseUrl = window.location.origin
      let shareUrl = data.shareUrl
      
      // Override with postSlug format if we have it
      if (activity.postSlug && newEstimateId) {
        shareUrl = `${baseUrl}/posts/${activity.postSlug}?restoreEstimate=${newEstimateId}`
      } else if (newEstimateId) {
        // Fallback to estimate URL if no postSlug
        shareUrl = `${baseUrl}/estimate/${newEstimateId}`
      }

      // Store the shared URL
      setSharedUrls(prev => ({
        ...prev,
        [activity.estimateId]: shareUrl,
      }))

      // Copy to clipboard
      try {
        await navigator.clipboard.writeText(shareUrl)
        alert('Estimate created and share link copied to clipboard!')
      } catch (error) {
        console.error('Failed to copy to clipboard:', error)
        alert(`Estimate created! Share URL: ${shareUrl}`)
      }
    } catch (error) {
      console.error('Error sharing estimate:', error)
      alert(error instanceof Error ? error.message : 'Failed to share estimate')
    } finally {
      setSharingEstimateId(null)
    }
  }

  const getEstimateUrl = (activity: ActivityItem) => {
    if (activity.postSlug) {
      return `/posts/${activity.postSlug}?restoreEstimate=${activity.estimateId}`
    }
    return `/estimate/${activity.estimateId}`
  }

  const getPackageDisplayName = (activity: ActivityItem) => {
    if (activity.selectedPackage?.customName) {
      return activity.selectedPackage.customName
    }
    if (activity.packageType) {
      return activity.packageType.charAt(0).toUpperCase() + activity.packageType.slice(1)
    }
    return null
  }

  return (
    <main className="bg-[#ffffff] min-h-screen w-full overflow-x-hidden">
      {/* Hero Section */}
      <section className="py-32 px-6 md:px-12 text-center bg-gradient-to-b from-[#faf9f7] to-[#ffffff]">
        <motion.div
          initial={{
            opacity: 0,
            y: 20,
          }}
          animate={{
            opacity: 1,
            y: 0,
          }}
          transition={{
            duration: 0.8,
          }}
          className="max-w-4xl mx-auto"
        >
          <h1 className="font-serif-display text-5xl md:text-7xl text-[#0a0a0a] leading-tight mb-6">
            Discover Our Story
          </h1>
          <p className="text-xl md:text-2xl text-[#666] font-serif-text leading-relaxed max-w-2xl mx-auto">
            Curated sanctuaries for the modern traveler seeking solace and style.
            Join our community and be part of the journey.
          </p>
        </motion.div>
      </section>

      {/* Latest Chat Activity Section */}
      <section className="px-6 md:px-12 py-24 bg-[#ffffff]">
        <div className="max-w-6xl mx-auto">
          <motion.div
            initial={{
              opacity: 0,
              y: 20,
            }}
            whileInView={{
              opacity: 1,
              y: 0,
            }}
            viewport={{
              once: true,
            }}
            transition={{
              duration: 0.6,
            }}
            className="flex items-center gap-4 mb-12 border-b border-[#e5e5e5] pb-6"
          >
            <MessageSquare className="w-8 h-8 text-[#0a0a0a]" />
            <h2 className="font-serif-display text-4xl text-[#0a0a0a]">
              Latest Chat Activity
            </h2>
          </motion.div>

          {loadingActivity ? (
            <div className="text-center py-12">
              <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-[#0a0a0a]"></div>
              <p className="mt-4 text-[#666]">Loading activity...</p>
            </div>
          ) : latestActivity.length > 0 ? (
            <div className="space-y-6">
              {latestActivity.map((activity, index) => {
                const date = new Date(activity.timestamp)
                const formattedDate = date.toLocaleDateString('en-US', {
                  month: 'long',
                  day: 'numeric',
                  year: 'numeric',
                })
                const formattedTime = date.toLocaleTimeString('en-US', {
                  hour: 'numeric',
                  minute: '2-digit',
                })

                return (
                  <motion.div
                    key={activity.id}
                    initial={{
                      opacity: 0,
                      y: 20,
                    }}
                    whileInView={{
                      opacity: 1,
                      y: 0,
                    }}
                    viewport={{
                      once: true,
                    }}
                    transition={{
                      duration: 0.5,
                      delay: index * 0.05,
                    }}
                    className="bg-[#faf9f7] rounded-lg p-8 md:p-10 border border-[#e5e5e5] hover:border-[#0a0a0a] transition-colors"
                  >
                    <div className="flex flex-col gap-6">
                      {/* Comment Content - Primary Focus */}
                      {activity.content ? (
                        <div className="mb-2">
                          <p className="text-xl md:text-2xl text-[#0a0a0a] leading-relaxed font-serif-text">
                            {activity.content}
                          </p>
                        </div>
                      ) : (
                        <div className="mb-2">
                          <p className="text-lg md:text-xl text-[#999] italic font-serif-text">
                            {activity.type === 'viewed' ? 'Viewed estimate' : activity.type === 'approved' ? 'Approved estimate' : 'Activity'}
                          </p>
                        </div>
                      )}

                      {/* Header - Secondary */}
                      <div className={`flex flex-col md:flex-row md:items-center md:justify-between gap-4 ${activity.content ? 'pt-4 border-t border-[#e5e5e5]' : ''}`}>
                        <div className="flex items-center gap-4">
                          <Gravatar
                            email={activity.userEmail}
                            size={48}
                            alt={activity.userName}
                            className="h-12 w-12 rounded-full object-cover flex-shrink-0 border border-[#e5e5e5]"
                            fallback={
                              <div className="w-12 h-12 rounded-full bg-[#0a0a0a] flex items-center justify-center flex-shrink-0">
                                <User className="w-6 h-6 text-white" />
                              </div>
                            }
                          />
                          <div>
                            <p className="font-medium text-[#0a0a0a] text-base">
                              {activity.userName}
                            </p>
                            <div className="text-sm text-[#666] flex flex-col gap-1">
                              <p className="flex items-center gap-2 flex-wrap">
                                <span className="capitalize">
                                  {activity.type === 'comment' ? 'commented' : activity.type}
                                </span>
                                <span>•</span>
                                <Link 
                                  href={getEstimateUrl(activity)}
                                  className="hover:text-[#0a0a0a] hover:underline flex items-center gap-1 transition-colors"
                                >
                                  <span>{activity.estimateTitle}</span>
                                  <ExternalLink className="w-3 h-3" />
                                </Link>
                              </p>
                              {getPackageDisplayName(activity) && (
                                <p className="text-xs text-[#999]">
                                  Package: {getPackageDisplayName(activity)}
                                </p>
                              )}
                            </div>
                          </div>
                        </div>
                        <div className="flex items-center gap-4">
                          <div className="flex items-center gap-2 text-sm text-[#999]">
                            <Clock className="w-4 h-4" />
                            <span>{formatTimeAgo(activity.timestamp)}</span>
                          </div>
                          <button
                            onClick={() => handleShareEstimate(activity)}
                            disabled={sharingEstimateId === activity.estimateId}
                            className="flex items-center gap-2 px-4 py-2 bg-[#0a0a0a] text-white rounded-md hover:bg-[#333] transition-colors disabled:opacity-50 disabled:cursor-not-allowed text-sm"
                            title={sharedUrls[activity.estimateId] ? 'Copy share link' : 'Create and share this estimate'}
                          >
                            {sharingEstimateId === activity.estimateId ? (
                              <>
                                <Loader2 className="w-4 h-4 animate-spin" />
                                <span>Creating...</span>
                              </>
                            ) : sharedUrls[activity.estimateId] ? (
                              <>
                                <Share2 className="w-4 h-4" />
                                <span>Copy Link</span>
                              </>
                            ) : (
                              <>
                                <Share2 className="w-4 h-4" />
                                <span>Share</span>
                              </>
                            )}
                          </button>
                        </div>
                      </div>

                      {/* Footer */}
                      <div className="pt-2 border-t border-[#e5e5e5]">
                        <p className="text-xs text-[#999]">
                          {formattedDate} at {formattedTime}
                        </p>
                      </div>
                    </div>
                  </motion.div>
                )
              })}
            </div>
          ) : (
            <div className="text-center py-12">
              <MessageSquare className="w-12 h-12 text-[#999] mx-auto mb-4" />
              <p className="text-[#666] text-lg">No activity yet. Be the first to join the conversation!</p>
            </div>
          )}
        </div>
      </section>

      {/* Story Section */}
      <section className="px-6 md:px-12 py-24 bg-[#faf9f7]">
        <div className="max-w-4xl mx-auto">
          <motion.div
            initial={{
              opacity: 0,
              y: 20,
            }}
            whileInView={{
              opacity: 1,
              y: 0,
            }}
            viewport={{
              once: true,
            }}
            transition={{
              duration: 0.8,
            }}
            className="prose prose-lg max-w-none"
          >
            <h2 className="font-serif-display text-4xl text-[#0a0a0a] mb-6">
              Our Journey
            </h2>
            <div className="space-y-6 text-[#666] font-serif-text leading-relaxed">
              <p>
                At Plek, we believe that travel should be transformative. Every stay is an opportunity 
                to discover new perspectives, create lasting memories, and find moments of peace in 
                beautifully curated spaces.
              </p>
              <p>
                Our mission is to connect discerning travelers with exceptional properties that offer 
                more than just accommodation—they provide experiences that enrich the soul and inspire 
                the mind.
              </p>
              <p>
                From the dramatic coastlines of the Southern Peninsula to the vibrant heart of Cape Town, 
                each property in our collection has been carefully selected for its unique character, 
                exceptional quality, and ability to create unforgettable moments.
              </p>
            </div>
          </motion.div>
        </div>
      </section>
    </main>
  )
}

