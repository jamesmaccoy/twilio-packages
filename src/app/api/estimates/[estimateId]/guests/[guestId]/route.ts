import { NextRequest, NextResponse } from 'next/server'
import { getPayload } from 'payload'
import configPromise from '@/payload.config'

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ estimateId: string; guestId: string }> }) {
  try {
    const { estimateId, guestId } = await params
    const payload = await getPayload({ config: configPromise })

    // Get the current estimate
    const estimate = await payload.findByID({
      collection: 'estimates',
      id: estimateId,
    })

    if (!estimate) {
      return NextResponse.json({ error: 'Estimate not found' }, { status: 404 })
    }

    // Remove the guest from the estimate
    const updatedEstimate = await payload.update({
      collection: 'estimates',
      id: estimateId,
      data: {
        guests: estimate.guests?.filter((guest: any) => {
          if (typeof guest === 'string') {
            return guest !== guestId
          }
          return guest.id !== guestId
        }) || []
      }
    })

    return NextResponse.json(updatedEstimate)
  } catch (error) {
    console.error('Error removing guest from estimate:', error)
    return NextResponse.json(
      { error: 'Failed to remove guest from estimate' },
      { status: 500 }
    )
  }
}
