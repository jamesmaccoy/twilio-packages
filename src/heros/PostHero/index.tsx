'use client'

import { formatDateTime } from 'src/utilities/formatDateTime'
import React, { useEffect, useRef } from 'react'
import { motion } from 'framer-motion'
import Link from 'next/link'
import { Lock } from 'lucide-react'

import type { Media, Post } from '@/payload-types'

import { formatAuthors } from '@/utilities/formatAuthors'
import { Media as MediaComponent } from '@/components/Media'
import { usePostViewerImageAccess } from '@/hooks/usePostViewerImageAccess'
import { trackImageView } from '@/lib/imageTracking'
import { useUserContext } from '@/context/UserContext'

export const PostHero: React.FC<{
  post: Post
  /** Server index: post has entitlement "none" packages */
  guestBookable?: boolean
}> = ({ post, guestBookable: guestBookableFromServer }) => {
  const { categories, heroImage, meta, populatedAuthors, publishedAt, title, slug } = post
  const { currentUser } = useUserContext()
  const trackedRef = useRef(false)

  const {
    canViewFullImage,
    isAccessPending,
    showRestrictedPlaceholder,
  } = usePostViewerImageAccess(post.id, guestBookableFromServer)

  const hasAuthors =
    populatedAuthors && populatedAuthors.length > 0 && formatAuthors(populatedAuthors) !== ''

  const displayImage = heroImage || meta?.image
  const heroMedia =
    displayImage && typeof displayImage === 'object' ? (displayImage as Media) : null

  const shouldShowImage = Boolean(heroMedia && canViewFullImage)

  useEffect(() => {
    if (showRestrictedPlaceholder && heroMedia && !trackedRef.current) {
      trackedRef.current = true
      trackImageView({
        postId: post.id,
        postTitle: title,
        imageId: heroMedia.id,
        isRestricted: true,
        userId: currentUser?.id,
        userEmail: currentUser?.email,
      })
    }
  }, [showRestrictedPlaceholder, heroMedia, post.id, title, currentUser])

  return (
    <div className="relative -mt-[10.4rem] flex items-end" style={{ paddingTop: '22rem' }}>
      <div className="container z-10 relative lg:grid lg:grid-cols-[1fr_48rem_1fr] text-white pb-8">
        <div className="col-start-1 col-span-1 md:col-start-2 md:col-span-2">
          <div className="uppercase text-sm mb-6 text-secondary">
            {categories?.map((category, index) => {
              if (typeof category === 'object' && category !== null) {
                const { title: categoryTitle } = category

                const titleToUse = categoryTitle || 'Untitled category'

                const isLast = index === categories.length - 1

                return (
                  <React.Fragment key={index}>
                    {titleToUse}
                    {!isLast && <React.Fragment>, &nbsp;</React.Fragment>}
                  </React.Fragment>
                )
              }
              return null
            })}
          </div>

          <div className="">
            <h1 className="mb-6 text-3xl md:text-5xl lg:text-6xl">{title}</h1>
          </div>

          <div className="flex flex-col md:flex-row gap-4 md:gap-16">
            {hasAuthors && (
              <div className="flex flex-col gap-4">
                <div className="flex flex-col gap-1">
                  <p className="text-sm">Author</p>

                  <p>{formatAuthors(populatedAuthors)}</p>
                </div>
              </div>
            )}
            {publishedAt && (
              <div className="flex flex-col gap-1">
                <p className="text-sm">Date Published</p>

                <time dateTime={publishedAt}>{formatDateTime(publishedAt)}</time>
              </div>
            )}
          </div>
        </div>
      </div>
      <motion.div
        className="absolute inset-0 min-h-[80vh] select-none bg-gray-900"
        layoutId={slug ? `post-image-${slug}` : undefined}
        transition={{ type: 'spring', bounce: 0.2, duration: 0.6 }}
        style={{ zIndex: -1 }}
      >
        {shouldShowImage ? (
          <motion.div
            className="absolute inset-0 h-full w-full"
            layoutId={slug ? `post-image-content-${slug}` : undefined}
            transition={{ type: 'spring', bounce: 0.2, duration: 0.6 }}
          >
            <MediaComponent
              fill
              priority
              className="absolute inset-0 h-full w-full"
              imgClassName="object-cover"
              resource={heroMedia}
              postId={post.id}
              postTitle={title}
              disableThrottling
            />
          </motion.div>
        ) : showRestrictedPlaceholder ? (
          <div className="absolute inset-0 h-full w-full bg-gradient-to-b from-gray-900 via-gray-800 to-gray-900" />
        ) : isAccessPending ? (
          <div className="absolute inset-0 h-full w-full bg-gradient-to-b from-gray-900 via-gray-800 to-gray-900 animate-pulse" />
        ) : null}
        <div className="absolute pointer-events-none left-0 bottom-0 w-full h-1/2 bg-gradient-to-t from-black to-transparent z-10" />
      </motion.div>
      {showRestrictedPlaceholder && heroMedia && (
        <div className="absolute bottom-4 left-4 md:bottom-6 md:right-6 md:left-auto z-[60] pointer-events-auto">
          <Link
            href="/subscribe"
            className="flex items-center gap-2 bg-black/50 text-white/90 backdrop-blur-sm border border-white/10 px-4 py-2 text-sm leading-5 no-underline hover:bg-black/70 transition-colors rounded-sm pointer-events-auto"
          >
            <Lock size={14} className="text-white/80" />
            <span className="hidden sm:inline">Members only</span>
            <span className="sm:hidden">Members</span>
          </Link>
        </div>
      )}
    </div>
  )
}
