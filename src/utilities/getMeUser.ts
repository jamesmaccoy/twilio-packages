import { cookies, headers } from 'next/headers'
import { redirect } from 'next/navigation'

import type { User } from '../payload-types'
import { getPayload } from 'payload'
import configPromise from '@/payload.config'

export const getMeUser = async (args?: {
  nullUserRedirect?: string
  validUserRedirect?: string
}): Promise<{
  token: string
  user: User
}> => {
  const { nullUserRedirect, validUserRedirect } = args || {}
  const cookieStore = await cookies()
  const token =
    cookieStore.get('payload-token')?.value ||
    cookieStore.getAll().find((c) => c.name.endsWith('-token'))?.value ||
    ''

  let user: User | null = null
  let ok = false

  try {
    const payload = await getPayload({ config: configPromise })
    const requestHeaders = await headers()
    const authResult = await payload.auth({ headers: requestHeaders })
    user = (authResult.user as User) || null
    ok = Boolean(user)
  } catch (error) {
    console.error('Error getting current user:', error)
  }

  if (validUserRedirect && ok && user) {
    redirect(validUserRedirect)
  }

  if (nullUserRedirect && (!ok || !user)) {
    redirect(nullUserRedirect)
  }

  // Token will exist here because if it doesn't the user will be redirected
  return {
    token: token || '',
    user: user!,
  }
}
