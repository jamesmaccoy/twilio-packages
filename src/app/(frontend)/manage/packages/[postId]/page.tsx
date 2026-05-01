import { getMeUser } from '@/utilities/getMeUser'
import { redirect } from 'next/navigation'
import { getPayload } from 'payload'
import configPromise from '@/payload.config'
import type { Post } from '@/payload-types'
import PackageDashboard from '../PackageDashboard'
import { PageAIAssistant } from '@/components/AIAssistant/PageAIAssistant'

interface Props {
  params: Promise<{ postId: string }>
}

export default async function ManagePackagesForPostPage({ params }: Props) {
  const meUser = await getMeUser()

  // Check if user is authenticated and has host role
  if (!meUser?.user) {
    redirect('/login?redirect=/manage/packages')
  }

  const role = (meUser.user as any).role
  const roleArray = Array.isArray(role) ? role : role ? [role] : []
  const isAdminOrHost = roleArray.includes('admin') || roleArray.includes('host')
  if (!isAdminOrHost) {
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

  return (
    <div className="container py-10 max-w-7xl">
      <PageAIAssistant
        variant="primary"
        context={{
          type: 'manage',
          data: {
            posts,
            postId,
          },
        }}
      />

      <div className="mt-10">
        <PackageDashboard postId={postId} />
      </div>
    </div>
  )
} 