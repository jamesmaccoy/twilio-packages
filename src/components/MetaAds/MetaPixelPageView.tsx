'use client'

import { useEffect } from 'react'
import { usePathname, useSearchParams } from 'next/navigation'

/**
 * Next.js route-change PageView tracking for Meta Pixel.
 * Meta's base pixel tracks the initial PageView; SPAs should track PageView on navigation.
 */
export function MetaPixelPageView() {
  const pathname = usePathname()
  const searchParams = useSearchParams()

  useEffect(() => {
    if (typeof window === 'undefined') return
    const fbq = (window as any).fbq
    if (typeof fbq !== 'function') return

    fbq('track', 'PageView')
  }, [pathname, searchParams])

  return null
}

