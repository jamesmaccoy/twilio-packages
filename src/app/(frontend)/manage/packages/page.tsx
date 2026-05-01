import { getMeUser } from '@/utilities/getMeUser'
import { redirect } from 'next/navigation'
import { getPayload } from 'payload'
import configPromise from '@/payload.config'
import type { Post } from '@/payload-types'

export default async function PackageManagePage() {
  const meUser = await getMeUser()
  if (!meUser?.user) {
    redirect('/login')
  }
  const role = meUser.user.role as string | string[] | undefined
  const roleArray = Array.isArray(role) ? role : role ? [role] : []
  if (!roleArray.includes('admin') && !roleArray.includes('host')) {
    redirect('/')
  }

  // Use Payload directly instead of server-side fetch to avoid URL issues
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
    // Optionally, render an error message in your component
  }

  // Remove legacy index UI: send hosts straight to the first listing's packages dashboard.
  if (posts[0]?.id) {
    redirect(`/manage/packages/${posts[0].id}`)
  }

  // No posts yet.
  redirect('/manage/posts/new')
} 