import { getMeUser } from '@/utilities/getMeUser'
import Link from 'next/link'
import { redirect } from 'next/navigation'
import { getPayload } from 'payload'
import configPromise from '@/payload.config'
import type { Post } from '@/payload-types'

export default async function PackageManagePage() {
  const meUser = await getMeUser()
  if (!meUser?.user) {
    redirect('/login')
  }
  if (!meUser.user.role?.includes('admin') && !meUser.user.role?.includes('host')) {
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

  return (
    <div className="container py-10">
      <h1 className="text-3xl font-bold mb-6">Your Posts</h1>
      {posts.length === 0 ? (
        <div className="text-gray-500">
          You have no posts yet. <Link href="/manage/properties/new" className="text-primary underline">Create your first property</Link>.
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {posts.map((post) => (
            <div key={post.id} className="border rounded-lg p-4 flex flex-col gap-2 shadow-sm">
              <div className="font-semibold text-lg">{post.title}</div>
              <div className="text-sm text-gray-500">Slug: {post.slug}</div>
              <Link href={`/manage/packages/${post.id}`} className="mt-2 inline-block bg-primary text-white px-4 py-2 rounded hover:bg-primary/80 transition">Manage Packages</Link>
            </div>
          ))}
        </div>
      )}
    </div>
  )
} 