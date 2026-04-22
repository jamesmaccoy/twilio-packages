'use client'

import { useScroll, useSpring, MotionValue } from 'framer-motion'
import { RefObject } from 'react'

export function useScrollProgress(ref: RefObject<HTMLElement>): MotionValue<number> {
  const { scrollYProgress } = useScroll({
    target: ref,
    offset: ['start start', 'end end'],
  })

  // Add a smooth spring physics to the scroll progress for a more "luxurious" feel
  const smoothProgress = useSpring(scrollYProgress, {
    stiffness: 100,
    damping: 30,
    restDelta: 0.001,
  })

  return smoothProgress
}

