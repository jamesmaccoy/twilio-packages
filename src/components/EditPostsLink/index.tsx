'use client'

import { useRouter } from 'next/navigation'
import React from 'react'
import { useSubscription } from '@/hooks/useSubscription'
import { useUserContext } from '@/context/UserContext'
import Link from 'next/link'

interface EditPostsLinkProps {
  children: React.ReactNode
  className?: string
}

export const EditPostsLink: React.FC<EditPostsLinkProps> = ({ children, className }) => {
  const router = useRouter()
  const { currentUser } = useUserContext()
  const { isSubscribed } = useSubscription()

  const handleClick = (e: React.MouseEvent) => {
    e.preventDefault()
    
    if (!currentUser) {
      router.push('/login?redirect=/admin/collections/posts')
      return
    }

    // Check if user has admin or customer role
    const userRoles = Array.isArray(currentUser.role) ? currentUser.role : []
    const hasRequiredRole = userRoles.includes('admin') || userRoles.includes('customer')
    
    if (!hasRequiredRole) {
      router.push('/account') // Redirect to account page for role upgrade
      return
    }

    if (!isSubscribed) {
      router.push('/subscribe?redirect=/admin/collections/posts')
      return
    }

    router.push('/admin/collections/posts')
  }

  // Only show the link if user has the required role
  const userRoles = Array.isArray(currentUser?.role) ? currentUser.role : []
  const hasRequiredRole = userRoles.includes('admin') || userRoles.includes('customer')
  
  if (!hasRequiredRole) {
    return null
  }

  return (
    <Link href="/admin/collections/posts" onClick={handleClick} className={className}>
      {children}
    </Link>
  )
} 