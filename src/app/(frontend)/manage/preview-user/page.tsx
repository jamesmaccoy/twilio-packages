import { getMeUser } from '@/utilities/getMeUser'
import { redirect } from 'next/navigation'
import PreviewUserClient from './preview-user.client'

export default async function PreviewUserPage() {
  const { user } = await getMeUser({ nullUserRedirect: '/login' })

  const roleValue = (user as any).role
  const roleArray = Array.isArray(roleValue) ? roleValue : roleValue ? [roleValue] : []
  const isAdminOrHost = roleArray.includes('admin') || roleArray.includes('host')
  if (!isAdminOrHost) redirect('/manage')

  return <PreviewUserClient />
}

