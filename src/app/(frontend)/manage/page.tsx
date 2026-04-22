import { redirect } from 'next/navigation'
import { getMeUser } from '@/utilities/getMeUser'
import { getPayload } from 'payload'
import configPromise from '@/payload.config'
import type { Post } from '@/payload-types'
import ManagePageClient from './page.client'

const fetchLatestEstimate = async (userId: string) => {
  const payload = await getPayload({ config: configPromise })
  const estimates = await payload.find({
    collection: 'estimates',
    where: {
      customer: { equals: userId },
    },
    sort: '-createdAt',
    limit: 1,
    depth: 2,
  })
  return estimates.docs[0] || null
}

export default async function ManagePage() {
  const meUser = await getMeUser()
  
  // Check if user is authenticated and has host role
  if (!meUser?.user) {
    redirect('/login?redirect=/manage')
  }
  
  if (!(meUser.user as any).role?.includes('host') && !(meUser.user as any).role?.includes('admin')) {
    redirect('/')
  }

  // Fetch posts for package management
  let posts: Post[] = []
  try {
    const payload = await getPayload({ config: configPromise })
    const result = await payload.find({
      collection: 'posts',
      limit: 100,
      depth: 1,
      user: meUser.user
    })
    posts = result.docs || []
  } catch (err) {
    console.error('Error fetching posts:', err)
  }

  // Fetch latest estimate to get postId for annual statement
  const latestEstimate = await fetchLatestEstimate(meUser.user.id)
  const latestEstimatePostId =
    typeof latestEstimate?.post === 'string'
      ? latestEstimate.post
      : latestEstimate?.post?.id ?? null

  return <ManagePageClient posts={posts} latestEstimatePostId={latestEstimatePostId} />
} 