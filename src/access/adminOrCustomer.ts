import { User } from '@/payload-types'
import { Access } from 'payload'

/**
 * @deprecated This access control is a security risk - it allows customers admin-level access.
 * Use adminOrHost or isAdmin instead.
 * 
 * SECURITY WARNING: This function allows customers to access admin functionality.
 * It should NOT be used for any collection or endpoint that requires admin privileges.
 */
export const adminOrCustomer: Access<User> = ({ req: { user } }) => {
  if (!user) return false

  if ((user as any)?.role?.includes('admin') || (user as any)?.role?.includes('customer')) {
    return true
  }

  return false
} 