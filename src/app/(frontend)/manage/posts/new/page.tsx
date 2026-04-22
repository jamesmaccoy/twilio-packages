import { redirect } from 'next/navigation'
import { getMeUser } from '@/utilities/getMeUser'
import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Create New Post',
  description: 'Create a new property post',
}

export const dynamic = 'force-dynamic'
export const revalidate = 0

export default async function NewPostPage() {
  try {
    const meUser = await getMeUser()
    
    // Check if user is authenticated and has host/admin role
    if (!meUser?.user) {
      redirect('/login?redirect=/manage/properties/new')
    }
    
    const role = meUser.user.role
    const roleArray = Array.isArray(role) ? role : role ? [role] : []
    
    if (!roleArray.includes('admin') && !roleArray.includes('host')) {
      redirect('/')
    }
    
    // Legacy route: forward to the new onboarding flow
    redirect('/manage/properties/new')
  } catch (error) {
    // Fallback redirect if there's any error
    console.error('Error in NewPostPage:', error)
    redirect('/login?redirect=/manage/properties/new')
  }
}

