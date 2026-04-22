'use client'

import React, { ReactNode } from 'react'
import { motion, MotionValue, useTransform } from 'framer-motion'

interface ParallaxLayerProps {
  children: ReactNode
  progress: MotionValue<number>
  speed?: number // Negative for upward movement, positive for downward
  className?: string
  range?: [number, number]
}

export function ParallaxLayer({
  children,
  progress,
  speed = 0.5,
  className = '',
  range = [0, 1],
}: ParallaxLayerProps) {
  const y = useTransform(progress, range, ['0%', `${speed * 100}%`])

  return (
    <motion.div
      style={{
        y,
      }}
      className={className}
    >
      {children}
    </motion.div>
  )
}

