'use client'

import React from 'react'

import type { Header as HeaderType } from '@/payload-types'

import { CMSLink } from '@/components/Link'
import Link from 'next/link'
import { SearchIcon } from 'lucide-react'
import { buttonVariants } from '@/components/ui/button'
import { useUserContext } from '@/context/UserContext'
import { AdminLink } from '@/components/AdminLink'
import { EditPostsLink } from '@/components/EditPostsLink'
import { useSubscription } from '@/hooks/useSubscription'
import { getCustomerEntitlement } from '@/utils/packageSuggestions'
import { Button } from '@/components/ui/button'

export const HeaderNav: React.FC<{ data: HeaderType }> = ({ data }) => {
  const navItems = data?.navItems || []

  const hasBookingsInCmsNav = navItems.some((item) => {
    const link = item.link
    const url = link?.type === 'custom' ? link?.url : null
    if (typeof url !== 'string' || !url.trim()) return false
    const path = (url.trim().split('?')[0] ?? '').replace(/\/$/, '') || '/'
    return path === '/bookings'
  })

  const { currentUser, actorUser, isPreview, previewEmail, handleAuthChange } = useUserContext()
  const subscriptionStatus = useSubscription()
  const customerEntitlement = getCustomerEntitlement(subscriptionStatus)

  const roleValue = (currentUser as any)?.role
  const roleArray = Array.isArray(roleValue) ? roleValue : roleValue ? [roleValue] : []
  const isAdminOrHost = roleArray.includes('admin') || roleArray.includes('host')

  const userPlan = (currentUser as any)?.subscriptionStatus?.plan as string | undefined
  const hasProSubscription =
    userPlan === 'pro' || customerEntitlement === 'pro'

  // Hosts/admins manage listings; customers only see Manage with Pro (subscription or entitlement).
  const canShowManageLink = isAdminOrHost || hasProSubscription

  const stopPreview = async () => {
    try {
      await fetch('/api/admin/user-preview/stop', {
        method: 'POST',
        credentials: 'include',
        headers: { 'content-type': 'application/json' },
      })
    } finally {
      handleAuthChange()
      // hard refresh to ensure server components re-render with the new user
      window.location.reload()
    }
  }

  return (
    <nav className="flex gap-3 items-center">
      {isPreview ? (
        <div className="flex items-center gap-2 rounded-md border border-amber-300 bg-amber-50 px-2 py-1 text-xs text-amber-900 dark:border-amber-800/60 dark:bg-amber-950/30 dark:text-amber-100">
          <span>
            Previewing as <strong>{currentUser?.email || previewEmail || currentUser?.name || 'user'}</strong>
            {actorUser?.email ? <span className="opacity-70"> (actor: {actorUser.email})</span> : null}
          </span>
          <Button type="button" variant="outline" size="sm" className="h-7 px-2 text-xs" onClick={stopPreview}>
            Exit
          </Button>
        </div>
      ) : null}

      {navItems.map(({ link }, i) => {
        if (link.url === '/admin') {
          return (
            <AdminLink key={i} className={buttonVariants({ variant: "link" })}>
              {link.label}
            </AdminLink>
          )
        }
        return <CMSLink key={i} {...link} appearance="link" />
      })}
      
      {currentUser && !hasBookingsInCmsNav ? (
        <Link href="/bookings" className={buttonVariants({ variant: 'link' })}>
          Bookings
        </Link>
      ) : null}

      {canShowManageLink && (
        <Link 
          href="/manage" 
          className={buttonVariants({ variant: "link" })}
        >
          Manage
        </Link>
      )}

      {/* Edit Posts link with proper subscription checking */}
      <EditPostsLink className={buttonVariants({ variant: "link" })}>
        Edit Posts
      </EditPostsLink>
      
      <Link href="/search">
        <span className="sr-only">Search</span>
        <SearchIcon className="w-5 text-primary" />
      </Link>
      {!currentUser ? (
        <Link className={buttonVariants({})} href={'/login'}>
          Login
        </Link>
      ) : (
        <Link 
          href="/account" 
          className="font-medium text-sm text-primary hover:underline"
        >
          Hello, {currentUser.name}
        </Link>
      )}
    </nav>
  )
}
