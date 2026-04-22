'use client'

import React from 'react'
import { motion, MotionValue, useTransform } from 'framer-motion'
import { getMediaUrl } from '@/utilities/getMediaUrl'
import type { Media } from '@/payload-types'

interface ImageRevealProps {
  src?: string
  image?: Media | string | null
  alt: string
  progress: MotionValue<number>
  type?: 'center-circle' | 'wipe-up' | 'wipe-right' | 'inset'
  className?: string
  range?: [number, number] // The range of progress [0-1] during which the animation occurs
}

export function ImageReveal({
  src,
  image,
  alt,
  progress,
  type = 'inset',
  className = '',
  range = [0, 1],
}: ImageRevealProps) {
  // Map the global section progress to the specific range for this animation
  // e.g. if range is [0.2, 0.8], the animation runs from 0% to 100% while scroll is between 20% and 80%
  const localProgress = useTransform(progress, range, [0, 1])

  const clipPaths = {
    'center-circle': useTransform(
      localProgress,
      [0, 1],
      ['circle(0% at 50% 50%)', 'circle(150% at 50% 50%)'],
    ),
    'wipe-up': useTransform(
      localProgress,
      [0, 1],
      ['inset(100% 0 0 0)', 'inset(0% 0 0 0)'],
    ),
    'wipe-right': useTransform(
      localProgress,
      [0, 1],
      ['inset(0 100% 0 0)', 'inset(0 0% 0 0)'],
    ),
    inset: useTransform(
      localProgress,
      [0, 1],
      ['inset(20% 20% 20% 20%)', 'inset(0% 0% 0% 0%)'],
    ),
  }

  const scales = {
    'center-circle': useTransform(localProgress, [0, 1], [1.2, 1]),
    'wipe-up': useTransform(localProgress, [0, 1], [1.1, 1]),
    'wipe-right': useTransform(localProgress, [0, 1], [1.1, 1]),
    inset: useTransform(localProgress, [0, 1], [1.1, 1]),
  }

  // Get image URL from various sources
  let imageUrl = src || ''
  if (!imageUrl && image) {
    if (typeof image === 'string') {
      imageUrl = image
    } else if (typeof image === 'object' && 'url' in image) {
      imageUrl = getMediaUrl(image.url, image.updatedAt)
    }
  }

  if (!imageUrl) {
    return null
  }

  return (
    <div className={`relative overflow-hidden ${className}`}>
      <motion.div
        className="w-full h-full"
        style={{
          clipPath: clipPaths[type],
        }}
      >
        <motion.img
          src={imageUrl}
          alt={alt}
          className="w-full h-full object-cover"
          style={{
            scale: scales[type],
          }}
        />
      </motion.div>
    </div>
  )
}

