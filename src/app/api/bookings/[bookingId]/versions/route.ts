import { NextRequest, NextResponse } from 'next/server'
import { getPayload } from 'payload'
import configPromise from '@/payload.config'
import { getMeUser } from '@/utilities/getMeUser'

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ bookingId: string }> }
) {
  try {
    const { user } = await getMeUser()
    
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { bookingId } = await params
    const payload = await getPayload({ config: configPromise })

    // Fetch the booking to verify access
    const booking = await payload.findByID({
      collection: 'bookings',
      id: bookingId,
      depth: 0,
    })

    if (!booking) {
      return NextResponse.json({ error: 'Booking not found' }, { status: 404 })
    }

    // Check if user is authorized (admin or booking owner)
    const isAdmin = Array.isArray(user.role) ? user.role.includes('admin') : user.role === 'admin'
    const bookingCustomerId = typeof booking.customer === 'string' ? booking.customer : booking.customer?.id
    const isOwner = bookingCustomerId === user.id

    if (!isAdmin && !isOwner) {
      return NextResponse.json({ error: 'Not authorized' }, { status: 403 })
    }

    // Fetch versions using Payload's versions API
    // Payload stores versions in a separate collection: `bookings_versions`
    // The version document has a `doc` property containing the full document data at that point in time
    const versions = await payload.find({
      collection: 'bookings_versions',
      where: {
        parent: {
          equals: bookingId,
        },
      },
      sort: '-createdAt',
      limit: 50,
      depth: 2, // Populate relationships in the doc
    })

    return NextResponse.json({
      bookingId,
      versions: versions.docs.map((version: any) => {
        // Payload stores the document snapshot in version.doc (as shown in the example)
        // The version document structure: { id, version, createdAt, updatedAt, autosave, parent, doc: {...} }
        const doc = version.doc || {}
        
        return {
          id: version.id,
          version: version.version,
          createdAt: version.createdAt,
          updatedAt: version.updatedAt || version.createdAt,
          autosave: version.autosave || false,
          // Include the full doc snapshot for complete history tracking
          doc: {
            fromDate: doc.fromDate,
            toDate: doc.toDate,
            paymentStatus: doc.paymentStatus,
            total: doc.total,
            packageType: doc.packageType,
            selectedPackage: doc.selectedPackage,
            title: doc.title,
            customer: typeof doc.customer === 'object' ? doc.customer?.id : doc.customer,
            post: typeof doc.post === 'object' ? {
              id: doc.post?.id,
              title: doc.post?.title,
              slug: doc.post?.slug,
            } : doc.post,
            guests: doc.guests,
            createdAt: doc.createdAt,
            updatedAt: doc.updatedAt,
          },
        }
      }),
    })
  } catch (error) {
    console.error('Error fetching booking versions:', error)
    return NextResponse.json(
      { error: 'Failed to fetch versions', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    )
  }
}

