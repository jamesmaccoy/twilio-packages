'use client'

import React, { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { motion } from 'framer-motion'

type ActivityItem = {
  id: string
  postTitle?: string
  postSlug?: string
  userName: string
  type: string
  content: string
  timestamp: string
}

export function PropertyReviews({ limit = 6 }: { limit?: number }) {
  const [loading, setLoading] = useState(true)
  const [activity, setActivity] = useState<ActivityItem[]>([])

  useEffect(() => {
    let cancelled = false
    const run = async () => {
      try {
        const res = await fetch(`/api/estimates/activity/latest?limit=${limit}`, { credentials: 'include' })
        if (!res.ok) return
        const data = await res.json()
        const items = Array.isArray(data?.activity) ? (data.activity as ActivityItem[]) : []
        if (!cancelled) setActivity(items)
      } catch (e) {
        // non-fatal
      } finally {
        if (!cancelled) setLoading(false)
      }
    }
    run()
    return () => {
      cancelled = true
    }
  }, [limit])

  const reviews = useMemo(() => {
    return activity
      .filter((a) => a && a.type === 'comment' && String(a.content || '').trim().length > 0)
      .slice(0, limit)
  }, [activity, limit])

  if (loading) return null
  if (reviews.length === 0) return null

  return (
    <section className="container mb-16">
      <div className="flex items-end justify-between gap-6 border-b border-[#e5e5e5] pb-6 mb-10">
        <div>
          <h2 className="font-serif-display text-3xl text-[#0a0a0a]">Property reviews</h2>
          <p className="text-[#666] mt-2">Recent guest comments across listings.</p>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {reviews.map((r, idx) => {
          const date = new Date(r.timestamp)
          const when = Number.isNaN(date.getTime())
            ? ''
            : date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })

          const href = r.postSlug ? `/posts/${r.postSlug}` : '/posts/page/1'

          return (
            <motion.div
              key={r.id || idx}
              initial={{ opacity: 0, y: 12 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.4, delay: idx * 0.05 }}
              className="bg-white border border-[#e5e5e5] rounded-lg p-6"
            >
              <p className="text-[#0a0a0a] font-serif-text text-lg leading-relaxed mb-4">
                “{r.content}”
              </p>
              <div className="flex flex-wrap items-center justify-between gap-3 pt-4 border-t border-[#f0f0f0]">
                <div className="text-sm text-[#666]">
                  <span className="font-medium text-[#0a0a0a]">{r.userName || 'Guest'}</span>
                  {when ? <span className="text-[#999]"> • {when}</span> : null}
                </div>
                <Link href={href} className="text-sm text-secondary hover:underline">
                  {r.postTitle ? `View ${r.postTitle}` : 'View property'}
                </Link>
              </div>
            </motion.div>
          )
        })}
      </div>
    </section>
  )
}

