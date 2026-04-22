import { NextRequest, NextResponse } from 'next/server'
import { getPayload } from 'payload'
import configPromise from '@/payload.config'
import { getMeUser } from '@/utilities/getMeUser'

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ estimateId: string }> }
) {
  try {
    const { estimateId } = await params
    const { user } = await getMeUser()

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const payload = await getPayload({ config: configPromise })

    // Fetch the original estimate
    const originalEstimate = await payload.findByID({
      collection: 'estimates',
      id: estimateId,
      depth: 2,
    })

    if (!originalEstimate) {
      return NextResponse.json({ error: 'Estimate not found' }, { status: 404 })
    }

    // Extract post ID
    const postId = typeof originalEstimate.post === 'string' 
      ? originalEstimate.post 
      : originalEstimate.post?.id

    if (!postId) {
      return NextResponse.json({ error: 'Invalid estimate: missing post' }, { status: 400 })
    }

    // Calculate duration from dates if available
    let duration = 1
    if (originalEstimate.fromDate && originalEstimate.toDate) {
      const from = new Date(originalEstimate.fromDate)
      const to = new Date(originalEstimate.toDate)
      duration = Math.ceil((to.getTime() - from.getTime()) / (1000 * 60 * 60 * 24))
    }

    // Get post details for title and slug
    let post = typeof originalEstimate.post === 'object' && originalEstimate.post
      ? originalEstimate.post
      : null
    
    // If post wasn't populated, fetch it with depth 1 to ensure we get all fields including slug
    if (!post) {
      post = await payload.findByID({ collection: 'posts', id: postId, depth: 1 })
    }

    const postTitle = typeof post === 'object' && post ? post.title : 'Property'
    const postSlug = typeof post === 'object' && post && 'slug' in post && post.slug 
      ? String(post.slug) 
      : null

    // Debug logging (can be removed in production)
    if (process.env.NODE_ENV === 'development') {
      console.log('Share estimate - Post details:', {
        postId,
        postSlug,
        hasPost: !!post,
        postType: typeof post,
        postKeys: post && typeof post === 'object' ? Object.keys(post) : null,
      })
    }

    // Create new estimate based on the original
    const newEstimateData: any = {
      title: `Estimate for ${postTitle} - ${duration} ${duration === 1 ? 'night' : 'nights'}`,
      post: postId,
      customer: user.id,
      total: originalEstimate.total || 0,
      packageType: originalEstimate.packageType || null,
    }

    // Copy dates if available
    if (originalEstimate.fromDate) {
      newEstimateData.fromDate = originalEstimate.fromDate
    }
    if (originalEstimate.toDate) {
      newEstimateData.toDate = originalEstimate.toDate
    }

    // Copy selected package if available
    if (originalEstimate.selectedPackage) {
      newEstimateData.selectedPackage = {
        package: typeof originalEstimate.selectedPackage.package === 'string'
          ? originalEstimate.selectedPackage.package
          : typeof originalEstimate.selectedPackage.package === 'object' && originalEstimate.selectedPackage.package
          ? originalEstimate.selectedPackage.package.id
          : null,
        customName: originalEstimate.selectedPackage.customName || null,
        enabled: originalEstimate.selectedPackage.enabled !== false,
      }
    }

    // Create the new estimate
    const newEstimate = await payload.create({
      collection: 'estimates',
      data: newEstimateData,
      user: user,
    })

    // Return the new estimate with shareable URL
    const baseUrl = process.env.NEXT_PUBLIC_URL || request.nextUrl.origin
    
    // Use post slug format if available, otherwise fallback to estimate ID
    const shareUrl = postSlug 
      ? `${baseUrl}/posts/${postSlug}?restoreEstimate=${newEstimate.id}`
      : `${baseUrl}/estimate/${newEstimate.id}`

    return NextResponse.json({
      success: true,
      estimate: newEstimate,
      shareUrl,
      estimateId: newEstimate.id,
    })
  } catch (error) {
    console.error('Error sharing estimate:', error)
    return NextResponse.json(
      { error: 'Failed to share estimate' },
      { status: 500 }
    )
  }
}

