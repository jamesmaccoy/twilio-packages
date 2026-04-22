import { getPayload } from 'payload'
import configPromise from '@/payload.config'
import { getMeUser } from '@/utilities/getMeUser'
import { redirect } from 'next/navigation'
import NotificationsClient from './page.client'

export default async function NotificationsPage() {
  const { user } = await getMeUser()

  if (!user) {
    redirect('/login')
  }

  const payload = await getPayload({ config: configPromise })

  // Fetch notifications from yoco-transactions (where type field exists)
  const notifications = await payload.find({
    collection: 'yoco-transactions',
    where: {
      user: {
        equals: user.id,
      },
      type: {
        exists: true,
      },
    },
    limit: 100,
    sort: '-createdAt',
    depth: 2, // Populate relationships
  })

  return <NotificationsClient initialNotifications={notifications.docs} user={user} />
}

