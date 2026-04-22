'use client'

import { useHeaderTheme } from '@/providers/HeaderTheme'
import { useTheme } from '@/providers/Theme'
import React, { useEffect } from 'react'

const PageClient: React.FC = () => {
  const { theme } = useTheme()
  const { setHeaderTheme } = useHeaderTheme()

  useEffect(() => {
    if (theme) {
      setHeaderTheme(theme)
    }
  }, [theme, setHeaderTheme])

  return null
}

export default PageClient