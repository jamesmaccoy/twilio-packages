import type { Metadata } from 'next'

import { RelatedPosts } from '@/blocks/RelatedPosts/Component'
import { PayloadRedirects } from '@/components/PayloadRedirects'
import configPromise from '@payload-config'
import { getPayload } from 'payload'
import { draftMode } from 'next/headers'
import React, { cache, Suspense } from 'react'
import RichText from '@/components/RichText'
import { SmartEstimateBlock } from '@/blocks/EstimateBlock/SmartEstimateBlock'
import { PostContentPreview } from '@/components/PostContentPreview'

import type { Post } from '@/payload-types'

import { PostHeroWrapper } from '@/heros/PostHero/PostHeroWrapper'
import { generateMeta } from '@/utilities/generateMeta'
import PageClient from './page.client'
import { LivePreviewListener } from '@/components/LivePreviewListener'
import { getPostPackageAccessIndex } from '@/lib/post-package-access'
import { populateRelatedPostsMedia } from '@/utilities/populatePostMediaFields'

export async function generateStaticParams() {
  const payload = await getPayload({ config: configPromise })
  const posts = await payload.find({
    collection: 'posts',
    draft: false,
    limit: 1000,
    overrideAccess: false,
    pagination: false,
    select: {
      slug: true,
    },
  })

  const params = posts.docs.map(({ slug }) => {
    return { slug }
  })

  return params
}

type Args = {
  params: Promise<{
    slug?: string
  }>
}

export default async function Post({ params: paramsPromise }: Args) {
  const { isEnabled: draft } = await draftMode()
  const { slug = '' } = await paramsPromise
  const url = '/posts/' + slug
  const post = await queryPostBySlug({ slug })

  if (!post || !post.id) return <PayloadRedirects url={url} />

  // Extract values to ensure they're available
  const postId = post.id
  const postTitle = post.title || ''
  const postBaseRate = typeof post.baseRate === 'number' ? post.baseRate : 0
  const postDescription = post.meta?.description || ''

  const payload = await getPayload({ config: configPromise })
  const packageAccess = await getPostPackageAccessIndex(payload, postId, post)

  // Ensure all required post properties are available
  const postForClient = {
    id: postId,
    title: postTitle,
    content: post.content,
    meta: post.meta,
    baseRate: postBaseRate,
    relatedPosts: post.relatedPosts,
    heroImage: (post as any).heroImage || null,
    categories: (post as any).categories || [],
  }

  return (
    <article className="pt-16 pb-16">
      <PageClient post={postForClient as any} />

      {/* Allows redirects for valid pages too */}
      <PayloadRedirects disableNotFound url={url} />

      {draft && <LivePreviewListener />}

      <PostHeroWrapper post={post as Post} />

      <div className="flex flex-col items-center gap-4 pt-8">
        <div className="container">
        <Suspense fallback={<div className="w-full max-w-2xl mx-auto p-4">Loading booking assistant...</div>}>
          <SmartEstimateBlock 
            postId={postId} 
            baseRate={postBaseRate}
            postTitle={postTitle}
            postDescription={postDescription}
            guestBookable={packageAccess.guestBookable}
            relatedPosts={post.relatedPosts 
              ? post.relatedPosts.map((rp: any) => 
                  typeof rp === 'object' && rp !== null
                    ? { id: rp.id, title: rp.title || undefined, slug: rp.slug || undefined }
                    : rp
                )
              : undefined}
            postContent={post.content}
          />
        </Suspense>
        <PostContentPreview
          post={post as Post}
          guestBookable={packageAccess.guestBookable}
        />
          {post.relatedPosts && post.relatedPosts.length > 0 && (
            <RelatedPosts
              className="mt-12 max-w-[52rem] lg:grid lg:grid-cols-subgrid col-start-1 col-span-3 grid-rows-[2fr]"
              docs={post.relatedPosts.filter((relatedPost) => typeof relatedPost === 'object')}
            />
          )}
        </div>
      </div>
    </article>
  )
}

export async function generateMetadata({ params: paramsPromise }: Args): Promise<Metadata> {
  const { slug = '' } = await paramsPromise
  const post = await queryPostBySlug({ slug })

  if (!post || !post.id) {
    return {
      title: 'Post not found',
      description: 'The requested post could not be found.',
    }
  }

  return generateMeta({ doc: post })
}

const queryPostBySlug = cache(async ({ slug }: { slug: string }) => {
  const { isEnabled: draft } = await draftMode()

  const payload = await getPayload({ config: configPromise })

  const result = await payload.find({
    collection: 'posts',
    draft,
    depth: 1, // Reduced from 2 to avoid nested relationship issues during static generation
    limit: 1,
    overrideAccess: draft,
    pagination: false,
    where: {
      slug: {
        equals: slug,
      },
    },
  })

  const post = result.docs?.[0]
  
  // Ensure post has required fields before returning
  if (!post) {
    return null
  }

  // Explicitly check and ensure id exists
  const postId = (post as any).id
  if (!postId || typeof postId !== 'string') {
    return null
  }

  // depth:1 leaves nested relatedPosts.heroImage/meta.image as IDs — populate for Card thumbnails
  const relatedPosts = post.relatedPosts?.length
    ? await populateRelatedPostsMedia(payload, post.relatedPosts as Post['relatedPosts'])
    : post.relatedPosts

  // Return post with guaranteed id
  return {
    ...post,
    id: postId,
    relatedPosts,
  } as Post
})
