'use client'

import React from 'react'
import { motion, useTransform } from 'framer-motion'
import { ScrollSection } from './ScrollSection'
import { ImageReveal } from './ImageReveal'
import { ParallaxLayer } from './ParallaxLayer'
import { LuxuryButton } from './ui/LuxuryButton'
import { ArrowDown } from 'lucide-react'
import type { Post, Media } from '@/payload-types'

interface ScrollAnimationPageProps {
  featuredPosts?: Post[]
  heroMedia?: Media | string | null
}

export function ScrollAnimationPage({ featuredPosts = [], heroMedia }: ScrollAnimationPageProps) {
  const featured = featuredPosts.slice(0, 3)
  
  // Collect all images for multi-layer hero reveal (Spain Collection style)
  const heroImages = [
    heroMedia || featured[0]?.meta?.image || featured[0]?.heroImage,
    featured[0]?.meta?.image || featured[0]?.heroImage,
    featured[1]?.meta?.image || featured[1]?.heroImage,
    featured[2]?.meta?.image || featured[2]?.heroImage,
  ].filter(Boolean)

  return (
    <main className="bg-[#faf9f7] text-[#0a0a0a] selection:bg-secondary selection:text-white">
      {/* SECTION 1: HERO - Multi-Layer Mask Reveal (Spain Collection Style) */}
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

              <div className="relative z-10 text-center text-white px-6 max-w-4xl mx-auto">
                <motion.div
                  style={{
                    y: textY,
                    scale: textScale,
                  }}
                >
                  <motion.p 
                    className="font-serif-text italic text-2xl md:text-3xl mb-4 tracking-wide"
                    style={{
                      opacity: useTransform(progress, [0, 0.2], [0, 1]),
                    }}
                  >
                    Curated Collections
                  </motion.p>
                  <motion.h1 
                    className="font-serif-display text-5xl md:text-7xl lg:text-8xl mb-8 leading-none"
                    style={{
                      opacity: useTransform(progress, [0.1, 0.3], [0, 1]),
                    }}
                  >
                    Ethereal
                    <br />
                    Sanctuaries
                  </motion.h1>
                  <motion.p 
                    className="max-w-lg mx-auto text-lg md:text-xl font-light opacity-90 leading-relaxed"
                    style={{
                      opacity: useTransform(progress, [0.2, 0.4], [0, 1]),
                    }}
                  >
                    Discover exceptional stays and experiences in our most coveted destinations.
                  </motion.p>
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

      {/* SECTION 2: SPLIT LAYOUT - Parallax */}
      <ScrollSection height="300vh">
        {(progress) => {
          // Fade out previous section transition
          const containerOpacity = useTransform(progress, [0, 0.1], [0, 1])
          return (
            <motion.div
              style={{
                opacity: containerOpacity,
              }}
              className="w-full h-full flex flex-col md:flex-row items-center justify-center px-6 md:px-20 gap-12 md:gap-24 bg-[#faf9f7]"
            >
              {/* Left Image - Moves Up */}
              <ParallaxLayer
                progress={progress}
                speed={-0.2}
                className="w-full md:w-1/2 h-[60vh] md:h-[80vh]"
              >
                <ImageReveal
                  image={featured[1]?.meta?.image || featured[1]?.heroImage}
                  alt="Architectural Detail"
                  progress={progress}
                  type="wipe-up"
                  range={[0.1, 0.5]}
                  className="w-full h-full shadow-2xl"
                />
              </ParallaxLayer>

              {/* Right Content - Moves Down */}
              <ParallaxLayer
                progress={progress}
                speed={0.2}
                className="w-full md:w-1/3 flex flex-col justify-center"
              >
                <motion.div
                  style={{
                    opacity: useTransform(progress, [0.2, 0.4], [0, 1]),
                    y: useTransform(progress, [0.2, 0.4], [50, 0]),
                  }}
                >
                  <span className="font-serif-text italic text-secondary text-2xl mb-4 block">
                    01. Architecture
                  </span>
                  <h2 className="font-serif-display text-5xl md:text-6xl text-[#0a0a0a] mb-8 leading-tight">
                    Timeless <br />
                    Design
                  </h2>
                  <p className="text-[#0a0a0a]/70 leading-relaxed mb-8 font-serif-text">
                    Every curve and corner tells a story of heritage meeting
                    modernity. Our spaces are designed not just to be seen, but
                    to be felt.
                  </p>
                  <LuxuryButton
                    href="/posts/page/1"
                    variant="text"
                    className="text-left"
                  >
                    View Gallery
                  </LuxuryButton>
                </motion.div>
              </ParallaxLayer>
            </motion.div>
          )
        }}
      </ScrollSection>

      {/* SECTION 3: FULL BLEED - Horizontal Reveal */}
      <ScrollSection height="250vh">
        {(progress) => {
          const textOpacity = useTransform(progress, [0.3, 0.5], [0, 1])
          const textScale = useTransform(progress, [0.3, 0.8], [0.9, 1])
          return (
            <div className="w-full h-full relative bg-[#0a0a0a] text-[#faf9f7]">
              <div className="absolute inset-0">
                <ImageReveal
                  image={featured[2]?.meta?.image || featured[2]?.heroImage}
                  alt="Poolside Luxury"
                  progress={progress}
                  type="wipe-right"
                  range={[0, 0.4]}
                  className="w-full h-full opacity-60"
                />
              </div>

              <div className="absolute inset-0 flex items-center justify-center z-10">
                <motion.div
                  style={{
                    opacity: textOpacity,
                    scale: textScale,
                  }}
                  className="text-center max-w-5xl px-6"
                >
                  <h2 className="font-serif-display text-5xl md:text-7xl lg:text-8xl leading-none mb-6 mix-blend-difference">
                    Serenity
                  </h2>
                  <p className="font-serif-text italic text-2xl md:text-3xl text-[#faf9f7]/90">
                    Where time stands still and the world fades away.
                  </p>
                </motion.div>
              </div>
            </div>
          )
        }}
      </ScrollSection>

      {/* SECTION 4: GRID COMPOSITION */}
      <ScrollSection height="300vh">
        {(progress) => {
          return (
            <div className="w-full h-full bg-[#faf9f7] flex items-center justify-center px-4 md:px-12">
              <div className="grid grid-cols-12 gap-4 w-full max-w-7xl h-[80vh]">
                {/* Title Block */}
                <div className="col-span-12 md:col-span-4 flex flex-col justify-center p-8">
                  <motion.div
                    style={{
                      opacity: useTransform(progress, [0, 0.2], [0, 1]),
                      x: useTransform(progress, [0, 0.2], [-50, 0]),
                    }}
                  >
                    <h2 className="font-serif-display text-5xl mb-6">
                      The Collection
                    </h2>
                    <p className="text-gray-600 mb-8 font-serif-text">
                      From coastal villas to mountain retreats, explore our
                      exclusive portfolio of properties.
                    </p>
                    <div className="h-px w-24 bg-secondary" />
                  </motion.div>
                </div>

                {/* Grid Image 1 */}
                <div className="col-span-6 md:col-span-4 h-full pt-12">
                  <ParallaxLayer
                    progress={progress}
                    speed={0.1}
                    className="h-[60%] w-full"
                  >
                    <ImageReveal
                      image={featured[0]?.meta?.image || featured[0]?.heroImage}
                      alt="Modern Villa"
                      progress={progress}
                      type="inset"
                      range={[0.1, 0.4]}
                      className="w-full h-full object-cover"
                    />
                  </ParallaxLayer>
                </div>

                {/* Grid Image 2 */}
                <div className="col-span-6 md:col-span-4 h-full pb-12">
                  <ParallaxLayer
                    progress={progress}
                    speed={-0.1}
                    className="h-[70%] w-full mt-auto"
                  >
                    <ImageReveal
                      image={featured[1]?.meta?.image || featured[1]?.heroImage}
                      alt="Classic Interior"
                      progress={progress}
                      type="inset"
                      range={[0.2, 0.5]}
                      className="w-full h-full object-cover"
                    />
                  </ParallaxLayer>
                </div>
              </div>
            </div>
          )
        }}
      </ScrollSection>

      {/* Footer / End Section */}
      <section className="h-[50vh] bg-[#0a0a0a] text-[#faf9f7] flex items-center justify-center">
        <div className="text-center">
          <p className="font-serif-text italic text-2xl mb-4">
            Begin your journey
          </p>
          <h2 className="font-serif-display text-4xl md:text-6xl">
            Curated Collections
          </h2>
        </div>
      </section>
    </main>
  )
}

