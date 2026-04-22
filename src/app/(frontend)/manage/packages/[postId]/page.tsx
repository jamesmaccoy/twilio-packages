import { getMeUser } from '@/utilities/getMeUser'
import { redirect } from 'next/navigation'
import { getPayload } from 'payload'
import configPromise from '@/payload.config'
import type { Post } from '@/payload-types'
import ManagePackagesForPost from './page.client'

interface Props {
  params: Promise<{ postId: string }>
}

export default async function ManagePackagesForPostPage({ params }: Props) {
  const meUser = await getMeUser()

  // Check if user is authenticated and has host role
  if (!meUser?.user) {
    redirect('/login?redirect=/manage/packages')
  }

  if (!(meUser.user as any).role?.includes('host') && !(meUser.user as any).role?.includes('admin')) {
    redirect('/')
  }

  const { postId } = await params

  let posts: Post[] = []
  try {
    const payload = await getPayload({ config: configPromise })
    const result = await payload.find({
      collection: 'posts',
      limit: 100,
      depth: 1,
      user: meUser.user,
    })
    posts = result.docs || []
  } catch {
    // non-fatal: assistant still works with current postId only
  }

  return <ManagePackagesForPost postId={postId} posts={posts} />
} 