import { getMeUser } from '@/utilities/getMeUser'
import { redirect } from 'next/navigation'
import NewPropertyOnboardingClient from './page.client'

export const dynamic = 'force-dynamic'
export const revalidate = 0

export default async function NewPropertyOnboardingPage() {
  const meUser = await getMeUser()
  if (!meUser?.user) {
    redirect('/login?redirect=/manage/properties/new')
  }
  const role = (meUser.user as any).role
  const roleArray = Array.isArray(role) ? role : role ? [role] : []
  if (!roleArray.includes('admin') && !roleArray.includes('host')) {
    redirect('/')
  }

  return <NewPropertyOnboardingClient />
}

