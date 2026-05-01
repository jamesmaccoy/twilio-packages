import type { Access, Where } from 'payload'
import type { User } from '@/payload-types'
import { isAdminUser, isHostUser } from './isAdminOrHasRole'

export const adminOrHostOwnPost: Access<User> = ({ req: { user } }) => {
  if (!user) return false

  if (isAdminUser(user)) return true

  if (!isHostUser(user)) return false

  return {
    or: [
      { host: { equals: user.id } },
      { authors: { equals: user.id } },
    ],
  } satisfies Where
}

