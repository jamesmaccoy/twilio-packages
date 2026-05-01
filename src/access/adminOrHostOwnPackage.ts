import type { Access, Where } from 'payload'
import type { User } from '@/payload-types'
import { isAdminUser, isHostUser } from './isAdminOrHasRole'

export const adminOrHostOwnPackage: Access<User> = ({ req: { user } }) => {
  if (!user) return false
  if (isAdminUser(user)) return true
  if (!isHostUser(user)) return false

  return {
    host: { equals: user.id },
  } satisfies Where
}

