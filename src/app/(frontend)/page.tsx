import type { Metadata } from 'next/types'
import { getPayload } from 'payload'
import configPromise from '@payload-config'
import React from 'react'
import { HomepageEditorial } from '@/components/HomepageEditorial'
import { homeStatic } from '@/endpoints/seed/home-static'
import { draftMode } from 'next/headers'
import { cache } from 'react'
import type { RequiredDataFromCollectionSlug } from 'payload'

// Google Ads is already loaded in layout.tsx - no need to import here

export const revalidate = 600

export default async function HomeEditorialPage() {
  const { isEnabled: draft } = await draftMode()

  // Get homepage hero
  let page: RequiredDataFromCollectionSlug<'pages'> | null = await queryPageBySlug({ slug: 'home' })
  if (!page) {
    page = homeStatic
  }

  // Get featured posts for the editorial sections
  const payload = await getPayload({ config: configPromise })
  const posts = await payload.find({
    collection: 'posts',
    depth: 2, // populate meta.image + categories
    limit: 24,
    page: 1,
    overrideAccess: false,
    sort: '-publishedAt',
    where: {
      _status: {
        equals: 'published',
      },
    },
  })

  // Extract hero media from page
  const heroMedia = page?.hero?.media && typeof page.hero.media === 'object'
    ? page.hero.media
    : null

  return (
    <>
      <HomepageEditorial featuredPosts={posts.docs} />
    </>
  )
}

export async function generateMetadata(): Promise<Metadata> {
  return {
    title: 'Plek - Curated Luxury Stays',
    description: 'Discover exceptional stays and experiences in our most coveted destinations.',
  }
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
