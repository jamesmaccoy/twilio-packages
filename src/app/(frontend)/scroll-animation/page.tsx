import type { Metadata } from 'next/types'
import { getPayload } from 'payload'
import configPromise from '@payload-config'
import React from 'react'
import { ScrollAnimationPage } from '@/components/ScrollAnimationPage'
import { homeStatic } from '@/endpoints/seed/home-static'
import { draftMode } from 'next/headers'
import { cache } from 'react'
import type { RequiredDataFromCollectionSlug } from 'payload'

export const revalidate = 600

export default async function ScrollAnimationDemoPage() {
  const { isEnabled: draft } = await draftMode()
  
  // Get homepage hero (same as home-editorial page)
  let page: RequiredDataFromCollectionSlug<'pages'> | null = await queryPageBySlug({ slug: 'home' })
  if (!page) {
    page = homeStatic
  }

  // Get featured posts for the scroll animation sections (same as home-editorial page)
  const payload = await getPayload({ config: configPromise })
  const posts = await payload.find({
    collection: 'posts',
    depth: 1,
    limit: 3,
    page: 1,
    overrideAccess: false,
    sort: '-publishedAt',
  })

  // Extract hero media from page
  const heroMedia = page?.hero?.media && typeof page.hero.media === 'object' 
    ? page.hero.media 
    : null

  return (
    <ScrollAnimationPage 
      featuredPosts={posts.docs} 
      heroMedia={heroMedia}
    />
  )
}

const queryPageBySlug = cache(async ({ slug }: { slug: string }) => {
  const { isEnabled: draft } = await draftMode()
  const payload = await getPayload({ config: configPromise })

  const result = await payload.find({
    collection: 'pages',
    draft,
    limit: 1,
    pagination: false,
    overrideAccess: draft,
    where: {
      slug: {
        equals: slug,
      },
    },
  })

  return result.docs?.[0] || null
})

export async function generateMetadata(): Promise<Metadata> {
  return {
    title: 'Scroll Animation Demo - Plek',
    description: 'Experience our luxury scroll-driven animation system with fixed sections and mask reveals.',
  }
}

