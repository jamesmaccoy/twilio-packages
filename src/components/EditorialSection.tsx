'use client'

import React from 'react'
import { motion } from 'framer-motion'
import { LuxuryButton } from './ui/LuxuryButton'
import { Media } from './Media'
import type { Media as MediaType } from '@/payload-types'

interface EditorialSectionProps {
  image?: MediaType | string | null
  title: string
  subtitle?: string
  description: string
  ctaText?: string
  ctaLink?: string
  align?: 'left' | 'right'
}

export function EditorialSection({
  image,
  title,
  subtitle,
  description,
  ctaText,
  ctaLink,
  align = 'left',
}: EditorialSectionProps) {
  return (
    <section className="py-24 md:py-32 overflow-hidden bg-[#faf9f7]">
      <div className="container mx-auto px-6 md:px-12">
        <div
          className={`flex flex-col ${align === 'right' ? 'md:flex-row-reverse' : 'md:flex-row'} items-center gap-12 md:gap-24`}
        >
          {/* Image Side */}
          {image && (
            <motion.div
              initial={{
                opacity: 0,
                x: align === 'left' ? -50 : 50,
              }}
              whileInView={{
                opacity: 1,
                x: 0,
              }}
              viewport={{
                once: true,
              }}
              transition={{
                duration: 1,
                ease: [0.22, 1, 0.36, 1],
              }}
              className="w-full md:w-1/2"
            >
              <div className="relative aspect-[4/5] overflow-hidden">
                {typeof image === 'object' && image !== null ? (
                  <Media 
                    resource={image} 
                    pictureClassName="w-full h-full"
                    imgClassName="w-full h-full object-cover" 
                  />
                ) : (
                  <img
                    src={typeof image === 'string' ? image : ''}
                    alt={title}
                    className="w-full h-full object-cover"
                  />
                )}
              </div>
            </motion.div>
          )}

          {/* Text Side */}
          <motion.div
            initial={{
              opacity: 0,
              y: 30,
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
              delay: 0.2,
              ease: [0.22, 1, 0.36, 1],
            }}
            className="w-full md:w-1/2 text-center md:text-left"
          >
            {subtitle && (
              <span className="block text-secondary text-sm tracking-[0.2em] uppercase mb-6">
                {subtitle}
              </span>
            )}

            <h2 className="font-serif-display text-4xl md:text-5xl lg:text-6xl text-[#0a0a0a] leading-tight mb-8">
              {title}
            </h2>

            <p className="font-serif-text text-xl text-gray-600 leading-relaxed mb-10 max-w-xl mx-auto md:mx-0">
              {description}
            </p>

            {ctaText && ctaLink && (
              <LuxuryButton href={ctaLink} variant="secondary">
                {ctaText}
              </LuxuryButton>
            )}
          </motion.div>
        </div>
      </div>
    </section>
  )
}

