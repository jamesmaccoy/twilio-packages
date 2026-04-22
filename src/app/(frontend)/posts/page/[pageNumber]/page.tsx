import type { Metadata } from 'next/types'

import { CollectionArchive } from '@/components/CollectionArchive'
import { PageRange } from '@/components/PageRange'
import { Pagination } from '@/components/Pagination'
import configPromise from '@payload-config'
import { getPayload } from 'payload'
import React from 'react'
import PageClient from './page.client'
import { notFound } from 'next/navigation'

export const revalidate = 600

type Args = {
  params: Promise<{
    pageNumber: string
  }>
}

export default async function Page({ params: paramsPromise }: Args) {
  const { pageNumber } = await paramsPromise
  const payload = await getPayload({ config: configPromise })

  const sanitizedPageNumber = Number(pageNumber)

  if (!Number.isInteger(sanitizedPageNumber)) notFound()

  const posts = await payload.find({
    collection: 'posts',
    depth: 1,
    limit: 12,
    page: sanitizedPageNumber,
    overrideAccess: false,
    select: {
      title: true,
      slug: true,
      categories: true,
      heroImage: true,
      meta: true,
    },
  })

  return (
    <main className="bg-[#faf9f7] min-h-screen">
      <PageClient />
      <div className="pt-24 pb-24">
        {/* Header Section */}
        <div className="container mb-16">
          <div className="max-w-4xl">
            <h1 className="font-serif-display text-5xl md:text-6xl lg:text-7xl text-[#0a0a0a] leading-tight mb-4">
              Curated{' '}
              <span className="italic font-serif-text text-secondary">Collections</span>
            </h1>
            <p className="font-serif-text text-xl text-gray-600 leading-relaxed">
              Discover exceptional stays and experiences in our most coveted destinations.
            </p>
          </div>
        </div>

        {/* Page Range */}
        <div className="container mb-12">
          <div className="flex justify-between items-center border-b border-[#e5e5e5] pb-6">
            <PageRange
              collection="posts"
              currentPage={posts.page}
              limit={12}
              totalDocs={posts.totalDocs}
            />
          </div>
        </div>

        {/* Posts Grid */}
        <CollectionArchive posts={posts.docs} />

        {/* Pagination */}
        <div className="container mt-16">
          {posts?.page && posts?.totalPages > 1 && (
            <Pagination page={posts.page} totalPages={posts.totalPages} />
          )}
        </div>
      </div>
    </main>
  )
}

export async function generateMetadata({ params: paramsPromise }: Args): Promise<Metadata> {
  const { pageNumber } = await paramsPromise
  return {
    title: `Plek Posts Page ${pageNumber || ''}`,
  }
}

export async function generateStaticParams() {
  const payload = await getPayload({ config: configPromise })
  const { totalDocs } = await payload.count({
    collection: 'posts',
    overrideAccess: false,
  })

  const totalPages = Math.ceil(totalDocs / 12)

  const pages: { pageNumber: string }[] = []

  for (let i = 1; i <= totalPages; i++) {
    pages.push({ pageNumber: String(i) })
  }

  return pages
}
