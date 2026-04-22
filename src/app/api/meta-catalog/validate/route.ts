import { NextRequest, NextResponse } from 'next/server'
import { getPayload } from 'payload'
import configPromise from '@payload-config'

/**
 * Meta Catalog Feed Validator
 * Validates feed data and returns diagnostic information
 * 
 * Usage: /api/meta-catalog/validate?userId=[user-id]
 */

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const userId = searchParams.get('userId')
    
    const payload = await getPayload({ config: configPromise })
    
    // Build where clause
    const where: any = {}
    if (userId) {
      where.customer = { equals: userId }
    }
    
    // Fetch estimates
    const estimates = await payload.find({
      collection: 'estimates',
      where: Object.keys(where).length > 0 ? where : undefined,
      sort: '-createdAt',
      limit: 10, // Sample first 10 for validation
      depth: 2,
    })
    
    const validationResults = {
      totalEstimates: estimates.docs.length,
      validProducts: 0,
      invalidProducts: 0,
      issues: [] as Array<{ estimateId: string; issue: string; field?: string }>,
      sampleProducts: [] as Array<{
        id: string
        title: string
        price: string
        link: string
        image_link: string
        hasAllRequiredFields: boolean
      }>,
    }
    
    estimates.docs.forEach((estimate: any) => {
      const post = typeof estimate.post === 'object' ? estimate.post : null
      const postId = typeof estimate.post === 'string' ? estimate.post : post?.id
      const postTitle = post?.title || 'Property'
      const estimateId = estimate.id
      
      // Check required fields
      const issues: string[] = []
      
      if (!estimateId) issues.push('Missing estimate ID')
      if (!post) issues.push('Missing post')
      if (!estimate.total || estimate.total <= 0) issues.push('Invalid or missing total')
      
      const duration = estimate.fromDate && estimate.toDate
        ? Math.max(1, Math.round(
            (new Date(estimate.toDate).getTime() - new Date(estimate.fromDate).getTime()) /
              (1000 * 60 * 60 * 24)
          ))
        : 1
      
      const title = `${postTitle} - ${duration} ${duration === 1 ? 'Night' : 'Nights'}`
      const description = estimate.description || `${postTitle} - ${duration} ${duration === 1 ? 'night' : 'nights'} stay`
      const price = `${(estimate.total || 0).toFixed(2)} ZAR`
      const link = `https://${request.nextUrl.host}/estimate/${estimateId}`
      
      // Check image
      const postImage = post?.meta?.image && typeof post.meta.image === 'object'
        ? post.meta.image
        : null
      
      let imageUrl = `https://${request.nextUrl.host}/placeholder-image.jpg`
      if (postImage) {
        const ogImageUrl = (postImage as any)?.sizes?.og?.url
        if (ogImageUrl) {
          imageUrl = ogImageUrl.startsWith('http')
            ? ogImageUrl.replace(/^http:/, 'https:')
            : `https://${request.nextUrl.host}${ogImageUrl}`
        } else if (postImage.url) {
          imageUrl = postImage.url.startsWith('http')
            ? postImage.url.replace(/^http:/, 'https:')
            : `https://${request.nextUrl.host}${postImage.url}`
        }
      }
      
      if (!title || title.length < 3) issues.push('Invalid title')
      if (!description || description.length < 10) issues.push('Description too short')
      if (!price || !price.includes('ZAR')) issues.push('Invalid price format')
      if (!link || !link.startsWith('https://')) issues.push('Invalid link URL')
      if (!imageUrl || !imageUrl.startsWith('https://')) issues.push('Invalid image URL')
      
      if (issues.length > 0) {
        validationResults.invalidProducts++
        issues.forEach(issue => {
          validationResults.issues.push({
            estimateId: estimateId || 'unknown',
            issue,
          })
        })
      } else {
        validationResults.validProducts++
      }
      
      // Add sample product (first 3 valid ones)
      if (validationResults.sampleProducts.length < 3 && issues.length === 0) {
        validationResults.sampleProducts.push({
          id: `estimate-${estimateId}`,
          title,
          price,
          link,
          image_link: imageUrl,
          hasAllRequiredFields: true,
        })
      }
    })
    
    return NextResponse.json({
      success: true,
      validation: validationResults,
      feedUrl: userId
        ? `https://${request.nextUrl.host}/api/meta-catalog/estimates-csv?userId=${userId}&format=csv`
        : `https://${request.nextUrl.host}/api/meta-catalog/estimates-csv?format=csv`,
      recommendations: validationResults.invalidProducts > 0
        ? [
            'Some products have validation issues. Check the issues array for details.',
            'Ensure all estimates have valid posts with images.',
            'Verify all URLs are accessible and use HTTPS.',
          ]
        : [
            'All sampled products are valid!',
            'Your feed should work with Meta Commerce Manager.',
          ],
    })
  } catch (error) {
    console.error('Error validating Meta catalog feed:', error)
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    )
  }
}

