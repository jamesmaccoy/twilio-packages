import React from 'react'
import { getMeUser } from '@/utilities/getMeUser'
import AccountClient from './page.client'

// Force dynamic rendering since this page uses cookies for authentication
export const dynamic = 'force-dynamic'

export default async function Account() {
  let user = null

  try {
    const { user: currentUser } = await getMeUser({
      nullUserRedirect: `/login?redirect=${encodeURIComponent('/account')}`,
    })
    user = currentUser
  } catch (error) {
    console.error('Error fetching user:', error)
    // Will redirect due to nullUserRedirect above
  }

  return <AccountClient user={user} />
} 