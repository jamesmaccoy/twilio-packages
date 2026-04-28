import { getMeUser } from '@/utilities/getMeUser'
import { redirect } from 'next/navigation'
import PreviewBookingTool from './preview.client'

type Params = Promise<{ bookingId: string }>

export default async function ManageBookingPreviewPage({ params }: { params: Params }) {
  const { bookingId } = await params
  const { user } = await getMeUser()

  if (!user) redirect('/login')

  const roleValue = (user as any).role
  const roleArray = Array.isArray(roleValue) ? roleValue : roleValue ? [roleValue] : []
  const isAdminOrHost = roleArray.includes('admin') || roleArray.includes('host')
  if (!isAdminOrHost) redirect('/manage')

  return <PreviewBookingTool bookingId={bookingId} />
}

