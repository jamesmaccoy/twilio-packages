import { getPayload } from 'payload'
import React from 'react'
import configPromise from '@/payload.config'
import { getMeUser } from '@/utilities/getMeUser'
import { notFound, redirect } from 'next/navigation'
import EstimateDetailsClientPage from './page.client'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import Link from 'next/link'
import { AlertCircleIcon } from 'lucide-react'

type Params = Promise<{
  estimateId: string
}>

export default async function EstimateDetails({ params }: { params: Params }) {
  const { estimateId } = await params

  const { user } = await getMeUser()

  if (!user) {
    redirect('/login')
  }

  const data = await fetchEstimateDetails(estimateId, user.id)

  if (!data) {
    notFound()
  }

  const customerId = typeof data.customer === 'string' ? data.customer : data.customer?.id
  const isCustomer = Boolean(customerId && customerId === user.id)
  const toDate = data.toDate ? new Date(data.toDate) : null
  const isExpired = Boolean(toDate && toDate.getTime() < Date.now())

  // Guests should not be able to view expired/past-date estimates.
  // Customers can still access them for history.
  if (!isCustomer && isExpired) {
    return (
      <div className="container mx-auto flex min-h-[70vh] max-w-2xl items-center px-4 py-12">
        <Card className="w-full">
          <CardHeader className="space-y-1 text-center">
            <div className="mx-auto mb-3 flex h-14 w-14 items-center justify-center rounded-full bg-destructive/10">
              <AlertCircleIcon className="h-7 w-7 text-destructive" />
            </div>
            <CardTitle className="text-2xl">This estimate has expired</CardTitle>
            <CardDescription>
              This invite was for dates that have already passed. Please ask the customer to create and share a new
              estimate.
            </CardDescription>
          </CardHeader>
          <CardContent className="flex justify-center">
            <Button asChild variant="outline">
              <Link href="/bookings">Go to bookings</Link>
            </Button>
          </CardContent>
        </Card>
      </div>
    )
  }

  return <EstimateDetailsClientPage data={data} user={user} />
}

const fetchEstimateDetails = async (estimateId: string, currentUserId: string) => {
  const payload = await getPayload({ config: configPromise })

  const estimate = await payload.find({
    collection: 'estimates',
    where: {
      and: [
        {
          id: {
            equals: estimateId,
          },
        },
        {
          or: [
            {
              customer: {
                equals: currentUserId,
              },
            },
            {
              guests: {
                contains: currentUserId,
              },
            },
          ],
        },
      ],
    },
    depth: 3, // Increased depth to include originalBooking and its paymentStatus
    pagination: false,
    limit: 1,
  })

  if (estimate.docs.length === 0) {
    return null
  }

  return estimate.docs[0]
} 