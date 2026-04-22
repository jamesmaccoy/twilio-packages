'use client'

import React from 'react'
import { motion, useTransform } from 'framer-motion'
import { ScrollSection } from './ScrollSection'
import { ImageReveal } from './ImageReveal'
import { ArrowDown } from 'lucide-react'
import type { Post, Media } from '@/payload-types'

interface ScrollAnimationHeroProps {
  featuredPosts?: Post[]
  heroMedia?: Media | string | null
}

export function ScrollAnimationHero({ featuredPosts = [], heroMedia }: ScrollAnimationHeroProps) {
  const featured = featuredPosts.slice(0, 3)
  
  // Collect all images for multi-layer hero reveal (Spain Collection style)
  const heroImages = [
    heroMedia || featured[0]?.meta?.image || featured[0]?.heroImage,
    featured[0]?.meta?.image || featured[0]?.heroImage,
    featured[1]?.meta?.image || featured[1]?.heroImage,
    featured[2]?.meta?.image || featured[2]?.heroImage,
  ].filter(Boolean)

  return (
    <ScrollSection height="300vh">
      {(progress) => {
        const opacity = useTransform(progress, [0.85, 1], [1, 0])
        const textY = useTransform(progress, [0, 0.4], [0, -80])
        const textScale = useTransform(progress, [0, 0.3], [1, 0.95])
        
        return (
          <motion.div
            style={{
              opacity,
            }}
            className="relative w-full h-full flex items-center justify-center"
          >
            {/* Multiple layered image reveals */}
            <div className="absolute inset-0 w-full h-full">
              {heroImages.map((image, index) => {
                // Stagger the reveal animations for each image layer
                const startProgress = index * 0.15
                const endProgress = 0.3 + (index * 0.15)
                const revealType = index === 0 ? 'center-circle' : 
                                  index === 1 ? 'wipe-up' : 
                                  index === 2 ? 'wipe-right' : 'inset'
                
                return (
                  <div key={index} className="absolute inset-0">
                    <ImageReveal
                      image={image}
                      alt={`Hero Layer ${index + 1}`}
                      progress={progress}
                      type={revealType}
                      range={[startProgress, Math.min(endProgress, 0.7)]}
                      className="w-full h-full"
                    />
                  </div>
                )
              })}
              {/* Overlay gradient for text readability */}
              <div className="absolute inset-0 bg-black/30 pointer-events-none" />
            </div>

            <div className="relative z-10 text-center text-white px-6 w-full mx-auto">
              <motion.div
                style={{
                  y: textY,
                  scale: textScale,
                }}
                className="relative min-h-[400px] flex items-center justify-center w-full"
              >
                {/* Simple Plek section - fades out */}
                <motion.div
                  style={{
                    opacity: useTransform(progress, [0, 0.2, 0.3], [1, 1, 0]),
                  }}
                  className="absolute inset-0 flex flex-col items-center justify-center w-full px-4"
                >
                  <motion.h1 
                    className="font-serif-display text-5xl md:text-7xl lg:text-8xl mb-4 leading-none whitespace-nowrap"
                  >
                    Simple{' '}
                    <span className="italic font-serif-text text-secondary">Plek</span>
                  </motion.h1>
                  
                  <motion.p 
                    className="font-serif-text text-xl md:text-2xl tracking-wide whitespace-nowrap"
                    style={{
                      opacity: useTransform(progress, [0, 0.15], [0, 1]),
                    }}
                  >
                    Short term bookings for members
                  </motion.p>
                </motion.div>
                
                {/* Curated Collections section - fades in */}
                <motion.div
                  style={{
                    opacity: useTransform(progress, [0.2, 0.3, 0.4], [0, 0, 1]),
                  }}
                  className="absolute inset-0 flex flex-col items-center justify-center w-full px-4"
                >
                  <motion.p 
                    className="font-serif-text italic text-4xl md:text-6xl lg:text-7xl mb-4 tracking-wide whitespace-nowrap"
                  >
                    Curated Collections
                  </motion.p>
                  
                  <motion.p 
                    className="max-w-2xl mx-auto text-lg md:text-xl font-light opacity-90 leading-relaxed font-serif-text"
                  >
                    Discover exceptional stays and experiences in our most coveted destinations.
                  </motion.p>
                </motion.div>
              </motion.div>
            </div>

            <motion.div
              className="absolute bottom-12 left-1/2 -translate-x-1/2 text-white flex flex-col items-center gap-2"
              style={{
                opacity: useTransform(progress, [0, 0.2], [1, 0]),
              }}
            >
              <span className="text-xs uppercase tracking-widest">
                Scroll to Explore
              </span>
              <ArrowDown className="w-4 h-4 animate-bounce" />
            </motion.div>
          </motion.div>
        )
      }}
    </ScrollSection>
  )
}

