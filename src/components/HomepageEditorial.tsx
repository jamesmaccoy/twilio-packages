'use client'

import React, { useEffect, useState } from 'react'
import { motion } from 'framer-motion'
import { LuxuryCard } from './ui/LuxuryCard'
import { EditorialSection } from './EditorialSection'
import { CinematicSection } from './CinematicSection'
import { LuxuryButton } from './ui/LuxuryButton'
import type { Post } from '@/payload-types'

interface HomepageEditorialProps {
  featuredPosts?: Post[]
}

interface ActivityItem {
  id: string
  estimateId: string
  estimateTitle: string
  user: string
  userName: string
  type: string
  content: string
  timestamp: string
}

export function HomepageEditorial({ featuredPosts = [] }: HomepageEditorialProps) {
  // Get first 3 posts for featured section
  const featured = featuredPosts.slice(0, 3)
  const [latestActivity, setLatestActivity] = useState<ActivityItem[]>([])
  const [loadingActivity, setLoadingActivity] = useState(true)

  useEffect(() => {
    const fetchLatestActivity = async () => {
      try {
        const response = await fetch('/api/estimates/activity/latest?limit=5')
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

  return (
    <main className="bg-[#ffffff] min-h-screen w-full overflow-x-hidden">
      {/* Intro Text Section */}
      <section className="py-24 px-6 md:px-12 text-center bg-[#faf9f7]">
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
          className="max-w-4xl mx-auto"
        >
          <h2 className="font-serif-display text-4xl md:text-6xl text-[#0a0a0a] leading-tight mb-8">
            Curated sanctuaries for the{' '}
            <span className="italic font-serif-text text-secondary">
              modern traveler
            </span>{' '}
            seeking solace and style.
          </h2>
        </motion.div>
      </section>

      {/* Featured Collection Grid */}
      {featured.length > 0 && (
        <section className="px-6 md:px-12 pb-24 bg-[#faf9f7]">
          <div className="flex justify-between items-end mb-12 border-b border-[#e5e5e5] pb-6">
            <h3 className="font-serif-display text-3xl text-[#0a0a0a]">
              Featured Collections
            </h3>
            <LuxuryButton
              href="/posts/page/1"
              variant="text"
              className="hidden md:block"
            >
              View All
            </LuxuryButton>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-8 md:gap-12">
            {featured.map((post, index) => {
              const { slug, categories, meta, title } = post
              const { description, image: metaImage } = meta || {}
              
              const categoryTitles = categories
                ?.filter((cat): cat is NonNullable<typeof cat> => 
                  typeof cat === 'object' && cat !== null && 'title' in cat
                )
                .map((cat) => (typeof cat === 'object' && cat !== null && 'title' in cat ? cat.title : null))
                .filter((title): title is string => Boolean(title)) || []
              
              const subtitle = categoryTitles.length > 0 ? categoryTitles[0] : undefined
              const tags = categoryTitles.length > 1 
                ? categoryTitles.slice(1).join(' • ') 
                : undefined

              const href = `/posts/${slug}`

              return (
                <LuxuryCard
                  key={slug || index}
                  image={metaImage}
                  title={title || 'Untitled'}
                  subtitle={subtitle}
                  description={description || undefined}
                  tags={tags}
                  href={href}
                  delay={index * 0.1}
                  layoutId={slug || undefined}
                />
              )
            })}
          </div>
        </section>
      )}

      {/* Latest Activity Section */}
      {latestActivity.length > 0 && (
        <section className="px-6 md:px-12 py-24 bg-[#ffffff]">
          <div className="max-w-6xl mx-auto">
            <div className="flex justify-between items-end mb-12 border-b border-[#e5e5e5] pb-6">
              <h3 className="font-serif-display text-3xl text-[#0a0a0a]">
                Latest Activity
              </h3>
            </div>

            <div className="space-y-6">
              {latestActivity.map((activity, index) => {
                const date = new Date(activity.timestamp)
                const formattedDate = date.toLocaleDateString('en-US', {
                  month: 'short',
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
                      delay: index * 0.1,
                    }}
                    className="border-b border-[#e5e5e5] pb-6 last:border-b-0"
                  >
                    <div className="flex flex-col md:flex-row md:items-start md:justify-between gap-4">
                      <div className="flex-1">
                        <div className="flex items-center gap-3 mb-2">
                          <span className="font-medium text-[#0a0a0a]">
                            {activity.userName}
                          </span>
                          <span className="text-[#666] text-sm">
                            {activity.type === 'comment' ? 'commented' : activity.type}
                          </span>
                          <span className="text-[#999] text-sm">
                            on {activity.estimateTitle}
                          </span>
                        </div>
                        {activity.content && (
                          <p className="text-[#666] text-sm leading-relaxed">
                            {activity.content}
                          </p>
                        )}
                      </div>
                      <div className="text-[#999] text-xs md:text-sm whitespace-nowrap">
                        {formattedDate} at {formattedTime}
                      </div>
                    </div>
                  </motion.div>
                )
              })}
            </div>
          </div>
        </section>
      )}

      {/* Cinematic Video Section */}
      <CinematicSection
        videoUrl="https://youtube.com/shorts/kSWCaxAttHg?si=4NbhwEo96rNVQgVA"
        title="Unforgettable Moments"
        subtitle="Experience"
        ctaText="Discover Our Story"
        ctaLink="/about"
      />

      {/* Editorial Sections */}
      <EditorialSection
        image={featured[1]?.meta?.image || featured[1]?.heroImage}
        title="Southern Peninsula Escapes"
        subtitle="Cape Point • Hout Bay • Kommetjie"
        description="Discover the raw beauty of the Southern Peninsula. From the dramatic cliffs of Cape Point to the serene beaches of Kommetjie, experience a coastal lifestyle unlike any other."
        ctaText="Explore the Peninsula"
        ctaLink="https://www.simpleplek.co.za/southern-peninsula"
        align="left"
      />

      <EditorialSection
        image={featuredPosts.find(p => p.slug === 'park-estate')?.meta?.image || featuredPosts.find(p => p.slug === 'park-estate')?.heroImage || featured[2]?.meta?.image || featured[2]?.heroImage}
        title="City Centre & Suburbs"
        subtitle="Gardens • Vredehoek • Rondebosch"
        description="Immerse yourself in the vibrant culture of Cape Town. Stay in the heart of the city, surrounded by world-class dining, art, and history, all within reach of the mountain."
        ctaText="View City Stays"
        ctaLink="https://www.simpleplek.co.za/cape-town"
        align="right"
      />
    </main>
  )
}

