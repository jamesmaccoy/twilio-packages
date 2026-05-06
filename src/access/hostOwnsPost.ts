import type { Access, Where } from 'payload'
import type { User } from '@/payload-types'
import { isAdminUser, isHostUser } from './isAdminOrHasRole'

/**
 * Hosts can only access posts they own.
 *
 * Ownership is defined as:
 * - `host` field equals the user id (preferred), OR
 * - `authors` contains the user id (backwards-compatible with existing data).
 *
 * Admins can access all posts.
 * Unauthenticated users can only access published posts.
 */
export const hostOwnsPost: Access<User> = ({ req: { user } }) => {
  if (!user) {
    return {
      _status: { equals: 'published' },
    } satisfies Where
  }

  if (isAdminUser(user)) return true

  if (isHostUser(user)) {
    return {
      or: [
        // Hosts should be able to browse the public site like anyone else.
        { _status: { equals: 'published' } },
        { host: { equals: user.id } },
        // `authors` is a hasMany relationship; `equals` matches if any item equals the value.
        { authors: { equals: user.id } },
      ],
    } satisfies Where
  }

  // Non-host authenticated users: only published posts.
  return {
    _status: { equals: 'published' },
  } satisfies Where
}

