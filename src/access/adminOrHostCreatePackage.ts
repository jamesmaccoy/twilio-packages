import type { Access } from 'payload'
import type { User } from '@/payload-types'
import { isAdminUser, isHostUser } from './isAdminOrHasRole'

export const adminOrHostCreatePackage: Access<User> = async ({ req, req: { user }, data }) => {
  if (!user) return false
  if (isAdminUser(user)) return true
  if (!isHostUser(user)) return false

  const postValue = (data as any)?.post
  const postId =
    typeof postValue === 'string' ? postValue : typeof postValue === 'object' && postValue ? postValue?.id : null
  if (!postId) return false

  try {
    const payload = (req as any)?.payload
    if (!payload || typeof payload.findByID !== 'function') return false

    const post = await payload.findByID({
      collection: 'posts',
      id: String(postId),
      depth: 0,
      overrideAccess: false,
      user,
    })

    const hostId = typeof (post as any)?.host === 'string' ? (post as any).host : (post as any)?.host?.id
    const authors = Array.isArray((post as any)?.authors) ? (post as any).authors : []
    const authorIds = authors
      .map((a: any) => (typeof a === 'string' ? a : a?.id))
      .filter((v: any): v is string => typeof v === 'string')

    return String(hostId || '') === String(user.id) || authorIds.includes(String(user.id))
  } catch {
    return false
  }
}

