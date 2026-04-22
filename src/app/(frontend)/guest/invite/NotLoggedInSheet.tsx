'use client'

import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from '@/components/ui/sheet'
import { Skeleton } from '@/components/ui/skeleton'
import { Button } from '@/components/ui/button'
import { CalendarIcon, MapPinIcon, ClockIcon } from 'lucide-react'
import Link from 'next/link'

type Props = {
  token: string
}

export function NotLoggedInSheet({ token }: Props) {
  return (
    <Sheet defaultOpen={true}>
      <SheetContent className="w-full sm:max-w-[450px] overflow-y-auto bg-neutral-950 border-l border-neutral-800">
        <SheetHeader className="mb-8">
          <SheetTitle className="text-slate-50">Booking Invite</SheetTitle>
          <SheetDescription className="text-slate-400">
            You've been invited to a session. Please review the details below.
          </SheetDescription>
        </SheetHeader>

        {/* Skeleton Booking Details */}
        <div className="space-y-6 mb-8">
          {/* Title Skeleton */}
          <div className="space-y-2">
            <Skeleton className="h-8 w-3/4 bg-neutral-800" />
            <Skeleton className="h-4 w-1/2 bg-neutral-800" />
          </div>

          {/* Meta Data Skeletons */}
          <div className="space-y-4">
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-full bg-neutral-800 flex items-center justify-center">
                <CalendarIcon className="h-5 w-5 text-neutral-600" />
              </div>
              <div className="space-y-1.5 flex-1">
                <Skeleton className="h-4 w-32 bg-neutral-800" />
                <Skeleton className="h-3 w-24 bg-neutral-800" />
              </div>
            </div>

            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-full bg-neutral-800 flex items-center justify-center">
                <ClockIcon className="h-5 w-5 text-neutral-600" />
              </div>
              <div className="space-y-1.5 flex-1">
                <Skeleton className="h-4 w-20 bg-neutral-800" />
                <Skeleton className="h-3 w-16 bg-neutral-800" />
              </div>
            </div>

            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-full bg-neutral-800 flex items-center justify-center">
                <MapPinIcon className="h-5 w-5 text-neutral-600" />
              </div>
              <div className="space-y-1.5 flex-1">
                <Skeleton className="h-4 w-40 bg-neutral-800" />
                <Skeleton className="h-3 w-28 bg-neutral-800" />
              </div>
            </div>
          </div>

          {/* Host Skeleton */}
          <div className="flex items-center gap-3 p-3 rounded-lg border border-neutral-800 bg-neutral-900/50">
            <Skeleton className="h-10 w-10 rounded-full bg-neutral-800" />
            <div className="space-y-1.5 flex-1">
              <Skeleton className="h-4 w-24 bg-neutral-800" />
              <Skeleton className="h-3 w-32 bg-neutral-800" />
            </div>
          </div>

          {/* Description Skeleton */}
          <div className="space-y-2 pt-2">
            <Skeleton className="h-4 w-full bg-neutral-800" />
            <Skeleton className="h-4 w-full bg-neutral-800" />
            <Skeleton className="h-4 w-2/3 bg-neutral-800" />
          </div>
        </div>

        {/* Divider */}
        <div className="h-px bg-neutral-800 w-full mb-8" />

        {/* Login/Register Card */}
        <div className="bg-[rgb(10,10,10)] text-slate-50 shadow-sm border border-neutral-800/80 rounded-sm w-full text-base leading-6">
          <div className="flex flex-col p-6">
            <h3 className="text-xl font-semibold leading-6 tracking-tight m-0">
              You are not logged in
            </h3>
            <p className="text-sm leading-5 text-slate-400 mt-1.5 mb-0">
              Please log in or create an account to accept the invite as a
              guest.
            </p>
          </div>
          <div className="px-6 pb-6">
            <div className="flex gap-2">
              <Button
                asChild
                variant="default"
                className="flex-1 bg-slate-50 text-slate-900 hover:bg-slate-200"
              >
                <Link href={`/login?next=/i/${token}`}>Login</Link>
              </Button>
              <Button
                asChild
                variant="secondary"
                className="flex-1 bg-slate-800 text-slate-50 hover:bg-slate-700 border border-neutral-700"
              >
                <Link href={`/login?next=/i/${token}`}>Continue</Link>
              </Button>
            </div>
          </div>
        </div>
      </SheetContent>
    </Sheet>
  )
}

