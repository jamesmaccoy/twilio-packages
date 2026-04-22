'use client'

import React, { useRef, ReactNode } from 'react'
import { MotionValue } from 'framer-motion'
import { useScrollProgress } from '@/hooks/useScrollProgress'

interface ScrollSectionProps {
  children: (progress: MotionValue<number>) => ReactNode
  className?: string
  height?: string // e.g., "200vh", "300vh" - determines how long the animation lasts
}

export function ScrollSection({
  children,
  className = '',
  height = '200vh',
}: ScrollSectionProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const progress = useScrollProgress(containerRef)

  return (
    <div
      ref={containerRef}
      className={`relative w-full ${className}`}
      style={{
        height,
      }}
    >
      <div className="sticky top-0 left-0 w-full h-screen overflow-hidden">
        {children(progress)}
      </div>
    </div>
  )
}

