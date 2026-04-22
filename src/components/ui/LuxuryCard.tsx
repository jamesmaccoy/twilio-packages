'use client'

import React from 'react'
import { motion } from 'framer-motion'
import { ArrowRight } from 'lucide-react'
import Link from 'next/link'
import type { Media } from '@/payload-types'
import { getMediaUrl } from '@/utilities/getMediaUrl'

interface LuxuryCardProps {
  image?: Media | string | null
  title: string
  subtitle?: string
  description?: string
  tags?: string
  href: string
  delay?: number
  layoutId?: string
}

export function LuxuryCard({
  image,
  title,
  subtitle,
  description,
  tags,
  href,
  delay = 0,
  layoutId,
}: LuxuryCardProps) {
  // Extract image URL from Media object or use string directly
  let imageUrl = ''
  if (typeof image === 'string') {
    imageUrl = image
  } else if (image && typeof image === 'object' && 'url' in image) {
    imageUrl = getMediaUrl(image.url, image.updatedAt)
  }

  return (
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
        delay,
        ease: [0.22, 1, 0.36, 1],
      }}
    >
      <Link href={href} className="group block w-full cursor-pointer">
        <motion.div 
          className="relative overflow-hidden aspect-[3/4] mb-6 bg-[#f0f0f0]"
          layoutId={layoutId ? `post-image-${layoutId}` : undefined}
        >
          <div className="absolute inset-0 bg-black/10 group-hover:bg-black/0 transition-colors duration-500 z-10" />
          {imageUrl ? (
            <motion.img
              src={imageUrl}
              alt={title}
              className="object-cover w-full h-full transition-transform duration-1000 ease-out group-hover:scale-105"
              layoutId={layoutId ? `post-image-content-${layoutId}` : undefined}
            />
          ) : (
            <div className="w-full h-full flex items-center justify-center text-gray-400">
              No image
            </div>
          )}

          {/* Overlay Content */}
          <div className="absolute bottom-0 left-0 right-0 p-6 z-20 opacity-0 group-hover:opacity-100 transition-opacity duration-500 translate-y-4 group-hover:translate-y-0">
            <span className="inline-flex items-center text-white text-sm tracking-widest uppercase">
              View Property <ArrowRight className="ml-2 w-4 h-4" />
            </span>
          </div>
        </motion.div>

        <div className="space-y-3">
          <div className="flex flex-col">
            {subtitle && (
              <span className="text-xs tracking-[0.2em] uppercase text-secondary mb-2">
                {subtitle}
              </span>
            )}
            <h3 className="font-serif-display text-3xl text-[#0a0a0a] leading-tight group-hover:text-secondary transition-colors duration-300">
              {title}
            </h3>
          </div>

          {tags && (
            <p className="text-xs text-gray-500 uppercase tracking-wider border-t border-gray-200 pt-3 mt-3">
              {tags}
            </p>
          )}

          {description && (
            <p className="font-serif-text text-lg text-gray-600 leading-relaxed line-clamp-2">
              {description}
            </p>
          )}
        </div>
      </Link>
    </motion.div>
  )
}

