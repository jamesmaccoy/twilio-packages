import { NextRequest, NextResponse } from 'next/server'
import { getPayload } from 'payload'
import configPromise from '@/payload.config'
import { getMeUser } from '@/utilities/getMeUser'

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ transactionId: string }> }
) {
  try {
    const { user } = await getMeUser()
    
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { transactionId } = await params
    const payload = await getPayload({ config: configPromise })

    // Fetch the transaction to verify access
    const transaction = await payload.findByID({
      collection: 'yoco-transactions',
      id: transactionId,
      depth: 0,
    })

    if (!transaction) {
      return NextResponse.json({ error: 'Transaction not found' }, { status: 404 })
    }

    // Check if user is authorized (admin or transaction owner)
    const isAdmin = Array.isArray(user.role) ? user.role.includes('admin') : user.role === 'admin'
    const transactionUserId = typeof transaction.user === 'string' ? transaction.user : transaction.user?.id
    const isOwner = transactionUserId === user.id

    if (!isAdmin && !isOwner) {
      return NextResponse.json({ error: 'Not authorized' }, { status: 403 })
    }

    // Fetch versions using Payload's versions API
    // Payload stores versions in a separate collection: `yoco-transactions_versions`
    // The version document has a `doc` property containing the full document data at that point in time
    const versions = await payload.find({
      collection: 'yoco-transactions_versions',
      where: {
        parent: {
          equals: transactionId,
        },
      },
      sort: '-createdAt',
      limit: 20,
      depth: 2, // Populate relationships in the doc
    })

    return NextResponse.json({
      transactionId,
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
          // Include the full doc snapshot for complete history tracking (transaction + notification fields)
          doc: {
            // Notification fields
            type: doc.type,
            title: doc.title,
            description: doc.description,
            read: doc.read,
            actionUrl: doc.actionUrl,
            relatedBooking: typeof doc.relatedBooking === 'object' ? doc.relatedBooking?.id : doc.relatedBooking,
            relatedEstimate: typeof doc.relatedEstimate === 'object' ? doc.relatedEstimate?.id : doc.relatedEstimate,
            relatedTransaction: typeof doc.relatedTransaction === 'object' ? doc.relatedTransaction?.id : doc.relatedTransaction,
            // Transaction fields
            status: doc.status,
            amount: doc.amount,
            packageName: doc.packageName,
            intent: doc.intent,
            entitlement: doc.entitlement,
            plan: doc.plan,
            user: typeof doc.user === 'object' ? doc.user?.id : doc.user,
            currency: doc.currency || 'ZAR',
            completedAt: doc.completedAt,
            expiresAt: doc.expiresAt,
            productId: doc.productId,
            paymentLinkId: doc.paymentLinkId,
            createdAt: doc.createdAt,
            updatedAt: doc.updatedAt,
            metadata: doc.metadata,
          },
        }
      }),
    })
  } catch (error) {
    console.error('Error fetching transaction versions:', error)
    return NextResponse.json(
      { error: 'Failed to fetch versions', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    )
  }
}

