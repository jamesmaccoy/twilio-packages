import type { Access, Where } from 'payload'
import type { User } from '@/payload-types'
import { isAdminUser, isHostUser } from './isAdminOrHasRole'

/**
 * Hosts can only access packages that belong to their posts.
 *
 * Preferred ownership field: `host` on the package.
 * Backwards-compatible: packages whose `post` points at a post owned by the host.
 */
export const hostOwnsPackage: Access<User> = async ({ req, req: { user } }) => {
  if (!user) return true // public read is allowed; host scoping happens below

  if (isAdminUser(user)) return true

  if (!isHostUser(user)) return true

  const clauses: Where[] = [{ host: { equals: user.id } }]

  try {
    const payload = (req as any)?.payload
    if (payload && typeof payload.find === 'function') {
      const ownedPosts = await payload.find({
        collection: 'posts',
        depth: 0,
        limit: 500,
        where: {
          or: [{ host: { equals: user.id } }, { authors: { equals: user.id } }],
        },
        overrideAccess: false,
        user,
      })

      const ids = (ownedPosts?.docs || []).map((d: any) => d?.id).filter(Boolean)
      if (ids.length > 0) {
        clauses.push({ post: { in: ids } })
      }
    }
  } catch {
    // If we can't resolve post ownership, fall back to the explicit package.host check.
  }

  return { or: clauses } satisfies Where
}

