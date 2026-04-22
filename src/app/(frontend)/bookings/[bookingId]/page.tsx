import { getPayload } from 'payload'
import React from 'react'
import configPromise from '@/payload.config'
import { getMeUser } from '@/utilities/getMeUser'
import { notFound, redirect } from 'next/navigation'
import BookingDetailsClientPage from './page.client'

type Params = Promise<{
  bookingId: string
}>

export default async function BookingDetails({ params }: { params: Params }) {
  const { bookingId } = await params

  const { user } = await getMeUser()

  if (!user) {
    redirect('/login')
  }

  const data = await fetchBookingDetails(bookingId, user.id)

  if (!data) {
    notFound()
  }

  return <BookingDetailsClientPage data={data} user={user} />
}

const fetchBookingDetails = async (bookingId: string, currentUserId: string) => {
  const payload = await getPayload({ config: configPromise })

  const booking = await payload.find({
    collection: 'bookings',
    where: {
      and: [
        {
          id: {
            equals: bookingId,
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
    depth: 2,
    pagination: false,
    limit: 1,
  })

  if (booking.docs.length === 0) {
    return null
  }

  return booking.docs[0]
}
