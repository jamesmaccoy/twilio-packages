import { NextRequest, NextResponse } from 'next/server'
import { getPayload } from 'payload'
import configPromise from '@/payload.config'

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const limit = parseInt(searchParams.get('limit') || '10', 10)
    
    const payload = await getPayload({ config: configPromise })

    // Fetch recent estimates with full details
    const estimates = await payload.find({
      collection: 'estimates',
      sort: '-updatedAt',
      limit: 100, // Get more estimates to find ones with activity
      depth: 2, // Include post and package details
    })

    // Collect all activity entries from estimates
    const allActivity: Array<{
      id: string
      estimateId: string
      estimateTitle: string
      estimateSlug?: string | null
      postId: string
      postTitle?: string
      postSlug?: string
      fromDate?: string
      toDate?: string
      packageType?: string | null
      selectedPackage?: {
        package?: string | null
        customName?: string | null
      } | null
              user: string
              userName: string
              userEmail?: string | null
              type: string
              content: string
              timestamp: string
    }> = []

    estimates.docs.forEach((estimate) => {
      if (estimate.activity && Array.isArray(estimate.activity)) {
        const post = typeof estimate.post === 'object' && estimate.post ? estimate.post : null
        
        estimate.activity.forEach((activity) => {
          if (activity && activity.timestamp) {
            allActivity.push({
              id: activity.id || `${estimate.id}-${activity.timestamp}`,
              estimateId: estimate.id,
              estimateTitle: estimate.title || 'Untitled Estimate',
              estimateSlug: estimate.slug || null,
              postId: typeof estimate.post === 'string' ? estimate.post : post?.id || '',
              postTitle: post?.title || undefined,
              postSlug: post?.slug || undefined,
              fromDate: estimate.fromDate || undefined,
              toDate: estimate.toDate || undefined,
              packageType: estimate.packageType || null,
              selectedPackage: estimate.selectedPackage || null,
              user: typeof activity.user === 'string' ? activity.user : activity.user?.id || '',
              userName: activity.userName || 'Unknown User',
              userEmail: typeof activity.user === 'object' && activity.user ? activity.user.email : null,
              type: activity.type || 'comment',
              content: activity.content || '',
              timestamp: activity.timestamp,
            })
          }
        })
      }
    })

    // Sort by timestamp (newest first) and limit
    const latestActivity = allActivity
      .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())
      .slice(0, limit)

    return NextResponse.json({ activity: latestActivity })
  } catch (error) {
    console.error('Error fetching latest activity:', error)
    return NextResponse.json(
      { error: 'Failed to fetch latest activity' },
      { status: 500 }
    )
  }
}

