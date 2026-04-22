'use client'

import React from 'react'
import { motion } from 'framer-motion'
import { LuxuryButton } from './ui/LuxuryButton'
import { Media } from './Media'
import type { Media as MediaType } from '@/payload-types'

interface CinematicSectionProps {
  image?: MediaType | string | null
  videoUrl?: string
  title: string
  subtitle?: string
  ctaText?: string
  ctaLink?: string
}

// Extract YouTube video ID from various URL formats
function getYouTubeVideoId(url: string): string | null {
  if (!url) return null
  
  // Handle various YouTube URL formats
  const patterns = [
    /youtube\.com\/shorts\/([^&\n?#]+)/, // YouTube Shorts format
    /(?:youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/embed\/)([^&\n?#]+)/,
    /youtube\.com\/watch\?.*v=([^&\n?#]+)/,
  ]
  
  for (const pattern of patterns) {
    const match = url.match(pattern)
    if (match && match[1]) {
      return match[1]
    }
  }
  
  return null
}

export function CinematicSection({
  image,
  videoUrl,
  title,
  subtitle,
  ctaText,
  ctaLink,
}: CinematicSectionProps) {
  const youtubeVideoId = videoUrl ? getYouTubeVideoId(videoUrl) : null
  
  return (
    <section className="relative w-full h-[80vh] overflow-hidden">
      <motion.div
        initial={{
          scale: 1.1,
        }}
        whileInView={{
          scale: 1,
        }}
        viewport={{
          once: true,
        }}
        transition={{
          duration: 1.5,
        }}
        className="absolute inset-0"
      >
        {youtubeVideoId ? (
          // YouTube video background
          <div className="absolute inset-0 w-full h-full">
            <iframe
              className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[177.77777778vh] h-[56.25vw] min-w-full min-h-full"
              src={`https://www.youtube.com/embed/${youtubeVideoId}?autoplay=1&mute=1&loop=1&playlist=${youtubeVideoId}&controls=0&showinfo=0&rel=0&iv_load_policy=3&modestbranding=1&playsinline=1&enablejsapi=1`}
              title={title}
              allow="autoplay; encrypted-media"
              allowFullScreen
              style={{
                pointerEvents: 'none',
              }}
            />
          </div>
        ) : image && typeof image === 'object' && image !== null ? (
          <Media fill resource={image} imgClassName="object-cover" />
        ) : image ? (
          <img
            src={typeof image === 'string' ? image : ''}
            alt={title}
            className="w-full h-full object-cover"
          />
        ) : null}
        <div className="absolute inset-0 bg-black/20" />
      </motion.div>

      <div className="absolute inset-0 flex items-center justify-center text-center px-6 z-10">
        <div className="max-w-3xl">
          {subtitle && (
            <motion.span
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.8, delay: 0.2 }}
              className="block text-white text-sm md:text-base tracking-[0.3em] uppercase mb-6"
            >
              {subtitle}
            </motion.span>
          )}
          <motion.h2
            initial={{ opacity: 0, y: 30 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.8, delay: 0.4 }}
            className="font-serif-display text-5xl md:text-7xl lg:text-8xl text-white leading-tight mb-8"
          >
            {title}
          </motion.h2>
          {ctaText && ctaLink && (
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.8, delay: 0.6 }}
            >
              <LuxuryButton variant="outline" href={ctaLink}>
                {ctaText}
              </LuxuryButton>
            </motion.div>
          )}
        </div>
      </div>
    </section>
  )
}

