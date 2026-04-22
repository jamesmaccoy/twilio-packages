'use client'

import { useState } from 'react'
import { UserIcon } from 'lucide-react'
import { getGravatarUrl } from '@/utils/gravatar'

interface GravatarProps {
  email: string | null | undefined
  size?: number
  alt?: string
  className?: string
  fallback?: React.ReactNode
  fallbackClassName?: string
}

export function Gravatar({ 
  email, 
  size = 40, 
  alt = 'Avatar',
  className = '',
  fallback,
  fallbackClassName = ''
}: GravatarProps) {
  const [imageError, setImageError] = useState(false)
  const gravatarUrl = getGravatarUrl(email, size)

  // If no email or error loading image, show fallback
  if (!gravatarUrl || imageError) {
    if (fallback) {
      return <>{fallback}</>
    }
    return (
      <div className={`rounded-full bg-muted flex items-center justify-center ${fallbackClassName}`} style={{ width: size, height: size }}>
        <UserIcon className="text-muted-foreground" style={{ width: size * 0.5, height: size * 0.5 }} />
      </div>
    )
  }

  return (
    <img
      src={gravatarUrl}
      alt={alt}
      className={className}
      onError={() => setImageError(true)}
      loading="lazy"
    />
  )
}

