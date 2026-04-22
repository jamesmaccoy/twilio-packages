import { cn } from '@/utilities/ui'
import React from 'react'

import { CardPostData } from '@/components/Card'
import { LuxuryCard } from '@/components/ui/LuxuryCard'
import { getMediaUrl } from '@/utilities/getMediaUrl'
import type { Media } from '@/payload-types'

export type Props = {
  posts: CardPostData[]
}

export const CollectionArchive: React.FC<Props> = (props) => {
  const { posts } = props

  return (
    <div className={cn('container')}>
      <div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8 md:gap-12">
          {posts?.map((result, index) => {
            if (typeof result === 'object' && result !== null) {
              const { slug, categories, meta, title, heroImage } = result
              const { description, image: metaImage } = meta || {}

              const imageCandidate = heroImage || metaImage
              let thumbnailUrl: string | null = null
              if (typeof imageCandidate === 'string') {
                thumbnailUrl = imageCandidate
              } else if (imageCandidate && typeof imageCandidate === 'object') {
                const m = imageCandidate as Media
                const url = m.sizes?.thumbnail?.url || m.thumbnailURL || m.url
                thumbnailUrl = url ? getMediaUrl(url, m.updatedAt) : null
              }
              
              // Format categories for subtitle/tags
              const categoryTitles = categories
                ?.filter((cat): cat is NonNullable<typeof cat> => 
                  typeof cat === 'object' && cat !== null && 'title' in cat
                )
                .map((cat) => cat.title)
                .filter(Boolean) || []
              
              const subtitle = categoryTitles.length > 0 ? categoryTitles[0] : undefined
              const tags = categoryTitles.length > 1 
                ? categoryTitles.slice(1).join(' • ') 
                : undefined

              const href = `/posts/${slug}`

              return (
                <LuxuryCard
                  key={slug || index}
                  image={thumbnailUrl}
                  title={title || 'Untitled'}
                  subtitle={subtitle}
                  description={description || undefined}
                  tags={tags}
                  href={href}
                  delay={index * 0.1}
                  layoutId={slug || undefined}
                />
              )
            }

            return null
          })}
        </div>
      </div>
    </div>
  )
}
