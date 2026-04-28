import { getPayload } from 'payload'
import configPromise from '@/payload.config'
import jwt from 'jsonwebtoken'
import { notFound } from 'next/navigation'
import BookingDetailsClientPage from '@/app/(frontend)/bookings/[bookingId]/page.client'

type SearchParams = Promise<{ token?: string }>
type Params = Promise<{ bookingId: string }>

type PreviewTokenPayload = {
  type: 'booking-preview'
  bookingId: string
  userId: string
  email: string
}

const SECRET_KEY = process.env.JWT_SECRET || process.env.PAYLOAD_SECRET || ''

export default async function PreviewBookingPage({
  params,
  searchParams,
}: {
  params: Params
  searchParams: SearchParams
}) {
  if (!SECRET_KEY) notFound()

  const { bookingId } = await params
  const { token } = await searchParams

  if (!token) notFound()

  let decoded: PreviewTokenPayload | null = null
  try {
    decoded = jwt.verify(token, SECRET_KEY) as PreviewTokenPayload
  } catch {
    decoded = null
  }

  if (!decoded || decoded.type !== 'booking-preview') notFound()
  if (String(decoded.bookingId) !== String(bookingId)) notFound()

  const payload = await getPayload({ config: configPromise })

  // Load booking (as admin) but enforce "would this user see it?"
  const booking = await payload.findByID({
    collection: 'bookings',
    id: bookingId,
    depth: 2,
    overrideAccess: true,
  })

  if (!booking) notFound()

  const bookingCustomerId =
    typeof (booking as any).customer === 'string' ? (booking as any).customer : (booking as any).customer?.id
  const guestIds: string[] = Array.isArray((booking as any).guests)
    ? (booking as any).guests.map((g: any) => (typeof g === 'string' ? g : g?.id)).filter(Boolean)
    : []

  const allowedUserIds = new Set([bookingCustomerId, ...guestIds].filter(Boolean))
  if (!allowedUserIds.has(String(decoded.userId))) notFound()

  const user = await payload.findByID({
    collection: 'users',
    id: String(decoded.userId),
    depth: 0,
    overrideAccess: true,
  })

  if (!user) notFound()

  return <BookingDetailsClientPage data={booking as any} user={user as any} isPreview />
}

