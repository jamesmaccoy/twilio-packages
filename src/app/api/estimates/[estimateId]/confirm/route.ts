import { NextRequest, NextResponse } from 'next/server'
import { getPayload } from 'payload'
import configPromise from '@payload-config'

export async function POST(req: NextRequest, { params }: { params: Promise<{ estimateId: string }> }) {
  try {
    const { estimateId } = await params
    const body = await req.json()

    const payload = await getPayload({ config: configPromise })

    // Get the current estimate
    const estimate = await payload.findByID({
      collection: 'estimates',
      id: estimateId,
    })

    if (!estimate) {
      return NextResponse.json({ error: 'Estimate not found' }, { status: 404 })
    }

    // Validate that payment was actually processed
    if (!body.paymentValidated) {
      return NextResponse.json({ error: 'Payment validation required' }, { status: 400 })
    }

    const updateData: Record<string, unknown> = {
      paymentStatus: 'paid',
      packageType: body.packageType,
      total: body.baseRate,
      confirmedAt: new Date().toISOString(),
    }

    if (body.selectedPackage) {
      updateData.selectedPackage = body.selectedPackage
    }

    const updatedEstimate = await payload.update({
      collection: 'estimates',
      id: estimateId,
      data: updateData,
    })

    return NextResponse.json(updatedEstimate)
  } catch (error) {
    console.error('Error confirming estimate:', error)
    return NextResponse.json(
      { error: 'Failed to confirm estimate' },
      { status: 500 }
    )
  }
} 