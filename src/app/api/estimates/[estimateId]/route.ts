import { NextRequest, NextResponse } from 'next/server'
import { getPayload } from 'payload'
import configPromise from '@/payload.config'

export async function GET(req: NextRequest, { params }: { params: Promise<{ estimateId: string }> }) {
  try {
    const { estimateId } = await params
    const payload = await getPayload({ config: configPromise })

    const { user } = await payload.auth({ headers: req.headers })
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const isAdmin = Boolean((user as any)?.role?.includes?.('admin'))

    // Restrict access: admin, customer, or invited guest only
    const estimateResult = await payload.find({
      collection: 'estimates',
      where: isAdmin
        ? {
            id: {
              equals: estimateId,
            },
          }
        : {
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
                      equals: user.id,
                    },
                  },
                  {
                    guests: {
                      contains: user.id,
                    },
                  },
                ],
              },
            ],
          },
      depth: 2, // Include post data with baseRate
      limit: 1,
      pagination: false,
    })

    const estimate = estimateResult.docs?.[0] || null

    if (!estimate) {
      return NextResponse.json({ error: 'Estimate not found' }, { status: 404 })
    }

    // Guests should not be able to view expired/past-date estimates
    const customerId = typeof estimate.customer === 'string' ? estimate.customer : estimate.customer?.id
    const isCustomer = Boolean(customerId && customerId === user.id)
    if (!isCustomer && estimate.toDate) {
      const toDate = new Date(estimate.toDate as any)
      if (!Number.isNaN(toDate.getTime()) && toDate.getTime() < Date.now()) {
        return NextResponse.json({ error: 'Estimate has expired' }, { status: 410 })
      }
    }

    // Ensure the estimate has proper pricing information
    const post = estimate.post
    if (typeof post === 'object' && post) {
      // If the estimate total is NaN or 0, recalculate it using the post's baseRate
      if (!estimate.total || isNaN(Number(estimate.total)) || Number(estimate.total) === 0) {
        const baseRate = post.baseRate || 150 // Default fallback
        const duration = estimate.fromDate && estimate.toDate 
          ? Math.ceil((new Date(estimate.toDate).getTime() - new Date(estimate.fromDate).getTime()) / (1000 * 60 * 60 * 24))
          : 1
        
        // Update the estimate with the correct total
        const correctedEstimate = await payload.update({
          collection: 'estimates',
          id: estimateId,
          data: {
            total: baseRate * duration
          }
        })
        
        return NextResponse.json(correctedEstimate)
      }
    }

    return NextResponse.json(estimate)
  } catch (error) {
    console.error('Error fetching estimate:', error)
    return NextResponse.json(
      { error: 'Failed to fetch estimate' },
      { status: 500 }
    )
  }
}
