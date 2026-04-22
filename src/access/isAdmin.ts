import { User } from '@/payload-types'
import { Access } from 'payload'

export const isAdmin: Access<User> = ({ req: { user } }) => {
  if (!user) return false

  if (user?.role?.includes('admin')) {
    return true
  }

  return false
}
