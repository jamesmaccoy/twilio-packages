'use client'
import { useHeaderTheme } from '@/providers/HeaderTheme'
import React, { useEffect } from 'react'
import type { Page as PageType } from '@/payload-types'

export interface PageClientProps {
  page: PageType | null
  draft: boolean
  url: string
  baseRate?: number
}

const PageClient: React.FC<PageClientProps> = ({ page, draft, url, baseRate }) => {
  /* Force the header to be dark mode while we have an image behind it */
  const { setHeaderTheme } = useHeaderTheme()

  useEffect(() => {
    setHeaderTheme('light')
  }, [setHeaderTheme])
  return <React.Fragment />
}

export default PageClient
