'use client'

import React, { useEffect, useState } from 'react'
import { Lock, Image as ImageIcon } from 'lucide-react'
import { motion } from 'framer-motion'
import { useSubscription } from '@/hooks/useSubscription'

type AddonPackage = {
  id: string
  name: string
  description?: string
  baseRate?: number
  postTitle?: string
  image?: string | null
}

export function ContentPreview() {
  const [addons, setAddons] = useState<AddonPackage[]>([])
  const [loading, setLoading] = useState(true)
  const subscriptionStatus = useSubscription()
  const isSubscribed = subscriptionStatus.isSubscribed

  useEffect(() => {
    const fetchAddons = async () => {
      try {
        const response = await fetch('/api/packages/addons/sample?limit=4')
        const data = await response.json()
        setAddons(data.addons || [])
      } catch (error) {
        console.error('Failed to fetch addon packages:', error)
      } finally {
        setLoading(false)
      }
    }

    fetchAddons()
  }, [])

  // If subscribed, show clear images; if not, show blurred preview
  const displayAddons: (AddonPackage & { type?: string })[] = addons.length > 0 
    ? addons 
    : [
        { id: '1', name: 'Garden Retreat Gallery', type: 'image' },
        { id: '2', name: 'Wine Curation Masterclass', type: 'video' },
        { id: '3', name: 'Community Event Photos', type: 'image' },
        { id: '4', name: 'Exclusive Member Updates', type: 'image' },
      ]

  return (
    <div className="relative w-full overflow-hidden rounded-lg border border-[#c9c9cf] bg-[#f4f4f5] p-1">
      <div className="grid grid-cols-2 gap-1 sm:grid-cols-4">
        {displayAddons.slice(0, 4).map((item, idx) => {
          const hasImage = 'image' in item && item.image && typeof item.image === 'string'
          return (
            <div
              key={item.id}
              className="group relative aspect-square overflow-hidden rounded bg-slate-200"
            >
              {/* Abstract placeholder or actual image */}
              {isSubscribed && hasImage ? (
                <img
                  src={item.image as string}
                  alt={item.name}
                  className="h-full w-full object-cover"
                />
              ) : (
                <div
                  className={`h-full w-full bg-gradient-to-br from-slate-300 to-slate-400 opacity-50 blur-md transition-all duration-700 group-hover:scale-110 ${idx % 2 === 0 ? 'scale-105' : 'scale-100'}`}
                />
              )}

              {/* Lock Overlay - only show if not subscribed */}
              {!isSubscribed && (
                <div className="absolute inset-0 flex flex-col items-center justify-center bg-black/10 backdrop-blur-[2px] transition-all duration-300">
                  <div className="rounded-full bg-white/90 p-2 shadow-sm">
                    <Lock className="h-4 w-4 text-slate-700" />
                  </div>
                </div>
              )}
            </div>
          )
        })}
      </div>

      {/* Call to Action Overlay - only show if not subscribed */}
      {!isSubscribed && (
        <div className="absolute inset-0 flex items-center justify-center bg-gradient-to-t from-white/90 via-white/60 to-transparent">
          <motion.div
            initial={{
              opacity: 0,
              y: 10,
            }}
            animate={{
              opacity: 1,
              y: 0,
            }}
            transition={{
              delay: 0.2,
            }}
            className="text-center"
          >
            <div className="mb-2 flex items-center justify-center gap-2 text-sm font-medium text-slate-900">
              <ImageIcon className="h-4 w-4" />
              <span>+{addons.length || 124} Member Add-ons</span>
            </div>
            <p className="text-xs text-slate-500">
              Join to unlock full gallery access
            </p>
          </motion.div>
        </div>
      )}
    </div>
  )
}

