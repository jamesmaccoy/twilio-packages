import type { Metadata } from 'next/types'
import React from 'react'
import { DiscoverOurStory } from '@/components/DiscoverOurStory'

export const revalidate = 600

export default async function AboutPage() {
  return <DiscoverOurStory />
}

export async function generateMetadata(): Promise<Metadata> {
  return {
    title: 'Discover Our Story - Plek',
    description: 'Learn about our journey and see the latest activity from our community.',
  }
}

