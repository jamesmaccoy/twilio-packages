'use client'

import { useEffect, useState } from 'react'

import type { Media, Post } from '@/payload-types'

type CardImageSource = Pick<Post, 'heroImage' | 'meta'>

function mediaIdFromSource(source: CardImageSource): string | null {
  const { heroImage, meta } = source
  if (typeof heroImage === 'string' && heroImage.length > 0) return heroImage
  if (typeof meta?.image === 'string' && meta.image.length > 0) return meta.image
  return null
}

function objectMediaFromSource(source: CardImageSource): Media | null {
  const { heroImage, meta } = source
  if (heroImage && typeof heroImage === 'object') return heroImage
  if (meta?.image && typeof meta.image === 'object') return meta.image
  return null
}

export function useCardDisplayImage(source: CardImageSource | undefined) {
  const heroImage = source?.heroImage
  const metaImage = source?.meta?.image
  const pendingMediaId = mediaIdFromSource(source || {})
  const initialObject = source ? objectMediaFromSource(source) : null

  const heroImageKey =
    typeof heroImage === 'string' ? heroImage : typeof heroImage === 'object' && heroImage?.id ? heroImage.id : null
  const metaImageKey =
    typeof metaImage === 'string' ? metaImage : typeof metaImage === 'object' && metaImage?.id ? metaImage.id : null

  const [displayImage, setDisplayImage] = useState<Media | null>(initialObject)
  const [isLoading, setIsLoading] = useState(Boolean(pendingMediaId && !initialObject))

  useEffect(() => {
    const objectImage = source ? objectMediaFromSource(source) : null
    if (objectImage) {
      setDisplayImage(objectImage)
      setIsLoading(false)
      return
    }

    const mediaId = mediaIdFromSource(source || {})
    if (!mediaId) {
      setDisplayImage(null)
      setIsLoading(false)
      return
    }

    let cancelled = false
    setIsLoading(true)

    fetch(`/api/media/${mediaId}?depth=0`)
      .then((res) => (res.ok ? res.json() : null))
      .then((doc) => {
        if (cancelled) return
        setDisplayImage(doc?.id ? (doc as Media) : null)
      })
      .catch(() => {
        if (!cancelled) setDisplayImage(null)
      })
      .finally(() => {
        if (!cancelled) setIsLoading(false)
      })

    return () => {
      cancelled = true
    }
  }, [heroImageKey, metaImageKey])

  return { displayImage, isLoading, pendingMediaId }
}
