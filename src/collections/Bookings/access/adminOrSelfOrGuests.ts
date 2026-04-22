import { User } from '@/payload-types'
import { Access } from 'payload'

export const adminOrSelfOrGuests =
  (userField: string, guestsField: string): Access<User> =>
  ({ req: { user } }) => {
    if (!user) return false

    if (user?.role?.includes('admin')) {
      return true
    }

    return {
      or: [
        {
          [userField]: {
            equals: user?.id,
          },
        },
        {
          [guestsField]: {
            contains: user?.id,
          },
        },
      ],
    }
  }
