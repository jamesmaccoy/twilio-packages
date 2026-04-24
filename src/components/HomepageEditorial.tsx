'use client'

import React, { useEffect, useMemo, useState } from 'react'
import { motion } from 'framer-motion'
import { LuxuryCard } from './ui/LuxuryCard'
import { EditorialSection } from './EditorialSection'
import { CinematicSection } from './CinematicSection'
import { LuxuryButton } from './ui/LuxuryButton'
import type { Post } from '@/payload-types'

interface HomepageEditorialProps {
  featuredPosts?: Post[]
}

type PackageListItem = {
  id: string
  name: string
  description?: string | null
  multiplier?: number | null
  category?: string | null
  minNights: number
  maxNights: number
  revenueCatId?: string | null
  yocoId?: string | null
  baseRate?: number | null
  isEnabled: boolean
}

function toISODateInputValue(d: Date) {
  const yyyy = d.getFullYear()
  const mm = String(d.getMonth() + 1).padStart(2, '0')
  const dd = String(d.getDate()).padStart(2, '0')
  return `${yyyy}-${mm}-${dd}`
}

function diffNights(fromISO: string, toISO: string) {
  if (fromISO && toISO && fromISO === toISO) return 0.5
  const from = new Date(fromISO)
  const to = new Date(toISO)
  if (Number.isNaN(from.getTime()) || Number.isNaN(to.getTime())) return 0
  const ms = to.getTime() - from.getTime()
  if (ms <= 0) return 0
  return Math.ceil(ms / (1000 * 60 * 60 * 24))
}

function selectBestPackage(packages: PackageListItem[], nights: number) {
  const enabled = packages.filter((p) => p.isEnabled)
  if (enabled.length === 0 || nights <= 0) return null

  let best = enabled.find((p) => nights >= p.minNights && nights <= p.maxNights) || null

  if (!best) {
    const accommodating = enabled.filter((p) => p.maxNights >= nights || p.maxNights === 1)
    if (accommodating.length > 0) {
      best = accommodating.reduce((prev, current) => {
        const prevScore = Math.abs(prev.minNights - nights)
        const currentScore = Math.abs(current.minNights - nights)
        return currentScore < prevScore ? current : prev
      })
    } else {
      best = enabled[0] || null
    }
  }

  return best
}

export function HomepageEditorial({ featuredPosts = [] }: HomepageEditorialProps) {
  const posts = featuredPosts

  const uniqueCategories = useMemo(() => {
    const map = new Map<string, { id: string; title: string }>()
    for (const post of posts) {
      const cats = Array.isArray((post as any)?.categories) ? ((post as any).categories as any[]) : []
      for (const cat of cats) {
        if (!cat || typeof cat !== 'object') continue
        const id = String((cat as any).id || '')
        const title = String((cat as any).title || '')
        if (!id || !title) continue
        if (!map.has(id)) map.set(id, { id, title })
      }
    }
    return Array.from(map.values()).sort((a, b) => a.title.localeCompare(b.title))
  }, [posts])

  const [activeCategoryId, setActiveCategoryId] = useState<string>('all')

  const today = useMemo(() => new Date(), [])
  const [fromDate, setFromDate] = useState(() => toISODateInputValue(today))
  const [toDate, setToDate] = useState(() => {
    const d = new Date(today)
    d.setDate(d.getDate() + 2)
    return toISODateInputValue(d)
  })

  const nights = useMemo(() => diffNights(fromDate, toDate), [fromDate, toDate])

  const filteredPosts = useMemo(() => {
    if (activeCategoryId === 'all') return posts
    return posts.filter((post) => {
      const cats = Array.isArray((post as any)?.categories) ? ((post as any).categories as any[]) : []
      return cats.some((cat) => typeof cat === 'object' && cat !== null && String((cat as any).id) === activeCategoryId)
    })
  }, [activeCategoryId, posts])

  const [packagesByPostId, setPackagesByPostId] = useState<Record<string, PackageListItem[]>>({})
  const [packagesLoading, setPackagesLoading] = useState<Record<string, boolean>>({})

  useEffect(() => {
    // Prefetch packages for currently visible posts so the "ideal package" feels instant.
    const visible = filteredPosts.slice(0, 12)
    for (const post of visible) {
      const postId = String((post as any)?.id || '')
      if (!postId) continue
      if (packagesByPostId[postId] || packagesLoading[postId]) continue

      setPackagesLoading((prev) => ({ ...prev, [postId]: true }))

      fetch(`/api/packages/post/${postId}`, { credentials: 'include' })
        .then(async (res) => {
          if (!res.ok) return { packages: [] as PackageListItem[] }
          return (await res.json()) as { packages?: PackageListItem[] }
        })
        .then((data) => {
          const pkgs = Array.isArray(data?.packages) ? data.packages : []
          setPackagesByPostId((prev) => ({ ...prev, [postId]: pkgs }))
        })
        .catch((err) => {
          console.warn('Failed to load packages for post', postId, err)
        })
        .finally(() => {
          setPackagesLoading((prev) => ({ ...prev, [postId]: false }))
        })
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filteredPosts])

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

      {/* Property Explorer (Airbnb-style) */}
      <section className="px-6 md:px-12 pb-24 bg-[#faf9f7]">
        <div className="max-w-6xl mx-auto">
          <div className="flex flex-col md:flex-row md:items-end md:justify-between gap-6 mb-10 border-b border-[#e5e5e5] pb-6">
            <div>
              <h3 className="font-serif-display text-3xl text-[#0a0a0a]">Find your Plek</h3>
              <p className="text-[#666] mt-2">Pick a region, choose your dates, and we’ll surface the ideal package.</p>
            </div>
            <LuxuryButton href="/posts/page/1" variant="text" className="self-start md:self-auto">
              View All
            </LuxuryButton>
          </div>

          {/* Filters */}
          <div className="flex flex-col gap-4 mb-10">
            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={() => setActiveCategoryId('all')}
                className={`px-4 py-2 rounded-full text-sm border transition-colors ${
                  activeCategoryId === 'all'
                    ? 'bg-[#0a0a0a] text-white border-[#0a0a0a]'
                    : 'bg-white text-[#0a0a0a] border-[#e5e5e5] hover:border-[#0a0a0a]'
                }`}
              >
                All
              </button>
              {uniqueCategories.map((c) => (
                <button
                  key={c.id}
                  type="button"
                  onClick={() => setActiveCategoryId(c.id)}
                  className={`px-4 py-2 rounded-full text-sm border transition-colors ${
                    activeCategoryId === c.id
                      ? 'bg-[#0a0a0a] text-white border-[#0a0a0a]'
                      : 'bg-white text-[#0a0a0a] border-[#e5e5e5] hover:border-[#0a0a0a]'
                  }`}
                >
                  {c.title}
                </button>
              ))}
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div className="bg-white border border-[#e5e5e5] rounded-lg p-4">
                <label className="block text-xs uppercase tracking-wider text-[#666] mb-2">Check in</label>
                <input
                  type="date"
                  value={fromDate}
                  onChange={(e) => setFromDate(e.target.value)}
                  className="w-full text-[#0a0a0a] bg-transparent outline-none"
                />
              </div>
              <div className="bg-white border border-[#e5e5e5] rounded-lg p-4">
                <label className="block text-xs uppercase tracking-wider text-[#666] mb-2">Check out</label>
                <input
                  type="date"
                  value={toDate}
                  onChange={(e) => setToDate(e.target.value)}
                  className="w-full text-[#0a0a0a] bg-transparent outline-none"
                />
              </div>
              <div className="bg-white border border-[#e5e5e5] rounded-lg p-4 flex items-center justify-between">
                <div>
                  <p className="text-xs uppercase tracking-wider text-[#666]">Stay length</p>
                  <p className="text-lg text-[#0a0a0a] font-medium">{nights > 0 ? `${nights} night${nights === 1 ? '' : 's'}` : '—'}</p>
                </div>
                <p className="text-xs text-[#999]">Drives ideal package</p>
              </div>
            </div>
          </div>

          {/* Posts Grid */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8 md:gap-12">
            {filteredPosts.slice(0, 12).map((post, index) => {
              const slug = (post as any)?.slug
              const title = (post as any)?.title || 'Untitled'
              const meta = (post as any)?.meta || {}
              const metaImage = meta?.image || (post as any)?.heroImage
              const description = meta?.description || undefined

              const cats = Array.isArray((post as any)?.categories) ? ((post as any).categories as any[]) : []
              const categoryTitles = cats
                .filter((cat) => typeof cat === 'object' && cat !== null && 'title' in cat)
                .map((cat) => String((cat as any).title || ''))
                .filter(Boolean)
              const subtitle = categoryTitles.length > 0 ? categoryTitles[0] : undefined
              const tags = categoryTitles.length > 1 ? categoryTitles.slice(1).join(' • ') : undefined

              const postId = String((post as any)?.id || '')
              const pkgs = postId ? packagesByPostId[postId] || [] : []
              const best = selectBestPackage(pkgs, nights)

              const href = `/posts/${slug}`

              return (
                <LuxuryCard
                  key={slug || postId || index}
                  image={metaImage}
                  title={title}
                  subtitle={subtitle}
                  description={description}
                  tags={tags}
                  href={href}
                  delay={index * 0.08}
                  layoutId={slug || undefined}
                  packageLabel={best ? best.name : nights > 0 ? 'Loading ideal package…' : undefined}
                  packageMeta={best ? `${best.minNights}-${best.maxNights} nights` : undefined}
                />
              )
            })}
          </div>

          {filteredPosts.length > 12 && (
            <div className="mt-12 flex justify-center">
              <LuxuryButton href="/posts/page/1" variant="primary">
                Browse all properties
              </LuxuryButton>
            </div>
          )}
        </div>
      </section>

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
        image={posts[1]?.meta?.image || (posts[1] as any)?.heroImage}
        title="Southern Peninsula Escapes"
        subtitle="Cape Point • Hout Bay • Kommetjie"
        description="Discover the raw beauty of the Southern Peninsula. From the dramatic cliffs of Cape Point to the serene beaches of Kommetjie, experience a coastal lifestyle unlike any other."
        ctaText="Explore the Peninsula"
        ctaLink="https://www.simpleplek.co.za/southern-peninsula"
        align="left"
      />

      <EditorialSection
        image={
          posts.find((p) => (p as any)?.slug === 'park-estate')?.meta?.image ||
          (posts.find((p) => (p as any)?.slug === 'park-estate') as any)?.heroImage ||
          posts[2]?.meta?.image ||
          (posts[2] as any)?.heroImage
        }
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

