// src/app/api/estimates/latest/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { getPayload } from 'payload'
import configPromise from '@payload-config'
import { trackEstimateView } from '@/lib/metaConversions'

const PACKAGE_RATES = {
    standard: 1,
    wine: 1.5,
    hiking: 1.2,
    film: 2,
  }
  
export async function GET(req: NextRequest) {
  const userId = req.nextUrl.searchParams.get('userId')
  const slug = req.nextUrl.searchParams.get('slug')
  const postId = req.nextUrl.searchParams.get('postId')
  const payload = await getPayload({ config: configPromise })

  const where: any[] = []

  if (slug) {
    // First, resolve the post by slug to get its ID
    const postResult = await payload.find({
      collection: 'posts',
      where: { slug: { equals: slug } },
      limit: 1,
    })
    const post = postResult.docs[0]
    if (!post) return NextResponse.json({ error: 'Post not found' }, { status: 404 })
    const resolvedPostId = post.id
    where.push({ post: { equals: resolvedPostId } })
  } else if (postId) {
    // Use postId directly if provided
    where.push({ post: { equals: postId } })
  }

  if (userId) {
    where.push({ customer: { equals: userId } })
  }

  let estimates;
  if (where.length > 0) {
    estimates = await payload.find({
      collection: 'estimates',
      where: { and: where },
      sort: '-createdAt',
      limit: 1,
      depth: 2,
    })
  } else {
    estimates = await payload.find({
      collection: 'estimates',
      sort: '-createdAt',
      limit: 1,
      depth: 2,
    })
  }
  const estimate = estimates.docs[0] || null

  // Infer packageType if not present
  if (estimate) {
    let packageType: string | null = null
    if (estimate.title) {
      const lower = estimate.title.toLowerCase()
      if (lower.includes('wine')) packageType = 'wine'
      else if (lower.includes('hiking')) packageType = 'hiking'
      else if (lower.includes('film')) packageType = 'film'
      else if (lower.includes('standard')) packageType = 'standard'
    }
    if (!packageType && estimate.fromDate && estimate.toDate && estimate.total && estimate.post && typeof estimate.post === 'object') {
      const baseRate = estimate.post.baseRate || 150
      const duration = Math.ceil((new Date(estimate.toDate).getTime() - new Date(estimate.fromDate).getTime()) / (1000 * 60 * 60 * 24))
      for (const [key, multiplier] of Object.entries(PACKAGE_RATES)) {
        if (Math.abs(estimate.total - baseRate * duration * (multiplier as number)) < 1) {
          packageType = key
          break
        }
      }
    }
    (estimate as any).packageType = packageType

    // Track EstimateView event for Meta Pixel
    try {
      const clientIp = req.headers.get('x-forwarded-for')?.split(',')[0] || 
                       req.headers.get('x-real-ip') || 
                       'unknown'
      const userAgent = req.headers.get('user-agent') || 'unknown'
      
      const postData = estimate.post && typeof estimate.post === 'object' ? estimate.post : null
      const customerData = estimate.customer && typeof estimate.customer === 'object' ? estimate.customer : null
      
      await trackEstimateView({
        estimateId: estimate.id,
        estimateValue: estimate.total,
        postId: typeof estimate.post === 'string' ? estimate.post : postData?.id,
        postTitle: postData?.title || estimate.title,
        packageType: packageType || undefined,
        userId: typeof estimate.customer === 'string' ? estimate.customer : customerData?.id,
        userEmail: customerData?.email,
        clientIp,
        userAgent,
        eventSourceUrl: req.url,
      })
    } catch (error) {
      // Don't fail the request if tracking fails
      console.error('Failed to track estimate view:', error)
    }
  }

  return NextResponse.json(estimate)
}