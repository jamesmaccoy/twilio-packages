import { NextRequest, NextResponse } from 'next/server'
import { getPayload } from 'payload'
import configPromise from '@payload-config'
import { getMeUser } from '@/utilities/getMeUser'

/**
 * Meta Catalog Feed for Estimates
 * Generates a product catalog feed based on user's estimates for Meta Dynamic Product Ads
 * 
 * This creates ads based on what users have estimated/booked
 * Each estimate becomes a product in the catalog
 */

interface MetaCatalogProduct {
  id: string
  title: string
  description: string
  availability: 'in stock' | 'out of stock'
  condition: 'new' | 'refurbished' | 'used'
  price: string
  currency: string
  link: string
  image_link: string
  brand?: string
  category?: string
  internal_label?: string // Internal label for organizing products (comma-separated)
  custom_label_0?: string // Package type
  custom_label_1?: string // Duration
  custom_label_2?: string // Post ID
  custom_label_3?: string // Estimate ID
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const userId = searchParams.get('userId')
    const format = searchParams.get('format') || 'xml' // Default to XML for Meta

    // Get authenticated user (optional - for per-user feeds)
    let user
    try {
      const authResult = await getMeUser()
      user = authResult.user
    } catch (error) {
      // If no auth, we'll return empty catalog or use a default approach
      // Meta needs a valid XML file even if empty
    }

    // Use provided userId or authenticated user's ID
    // If neither, return empty catalog (Meta needs valid XML format)
    const targetUserId = userId || user?.id

    if (!targetUserId) {
      // Return empty but valid XML feed for Meta validation
      // Meta defaults to XML format, so always return XML when format is not explicitly JSON
      if (format === 'xml' || !format || format === '') {
        return new NextResponse(generateEmptyXMLFeed(), {
          headers: {
            'Content-Type': 'application/xml; charset=utf-8',
            'Cache-Control': 'public, max-age=3600', // Cache for 1 hour
          },
        })
      }
      return NextResponse.json({
        products: [],
        total: 0,
        message: 'User ID is required. Provide ?userId=[user-id] parameter.',
      })
    }

    const payload = await getPayload({ config: configPromise })

    // Fetch user's estimates
    const estimates = await payload.find({
      collection: 'estimates',
      where: {
        customer: { equals: targetUserId },
      },
      sort: '-createdAt',
      limit: 50, // Get recent estimates
      depth: 2, // Include post and customer data
    })

    if (estimates.docs.length === 0) {
      // Meta requires XML format, so return empty XML feed instead of JSON
      if (format === 'xml' || !format || format === '') {
        return new NextResponse(generateEmptyXMLFeed(), {
          headers: {
            'Content-Type': 'application/xml; charset=utf-8',
            'Cache-Control': 'public, max-age=3600', // Cache for 1 hour
          },
        })
      }
      return NextResponse.json({
        products: [],
        total: 0,
        message: 'No estimates found for this user',
      })
    }

    // Transform estimates to Meta catalog format
    const catalogProducts: MetaCatalogProduct[] = estimates.docs
      .filter((estimate) => {
        // Only include estimates with valid post and total
        return estimate.post && estimate.total && estimate.total > 0
      })
      .map((estimate) => {
        const post = typeof estimate.post === 'object' ? estimate.post : null
        const postId = typeof estimate.post === 'string' ? estimate.post : post?.id
        const postSlug = post?.slug || postId
        const postTitle = post?.title || 'Property'
        const estimateId = estimate.id

        // Calculate duration
        const duration = estimate.fromDate && estimate.toDate
          ? Math.max(1, Math.round(
              (new Date(estimate.toDate).getTime() - new Date(estimate.fromDate).getTime()) /
                (1000 * 60 * 60 * 24)
            ))
          : 1

        // Get package type
        const packageType = (estimate as any).packageType || 'standard'

        // Get post meta image - use OG size (1200x630) if available, perfect for Meta Commerce Manager
        const postImage = post?.meta?.image && typeof post.meta.image === 'object'
          ? post.meta.image
          : null

        // Prefer OG image size for Meta (1200x630 optimized for social media)
        let imageUrl = `${request.nextUrl.origin}/placeholder-image.jpg`
        if (postImage) {
          // Check for OG size first (optimized for Meta/social media)
          const ogImageUrl = (postImage as any)?.sizes?.og?.url
          if (ogImageUrl) {
            imageUrl = ogImageUrl.startsWith('http')
              ? ogImageUrl
              : `${request.nextUrl.origin}${ogImageUrl}`
          } else if (postImage.url) {
            // Fall back to regular image URL
            imageUrl = postImage.url.startsWith('http')
              ? postImage.url
              : `${request.nextUrl.origin}${postImage.url}`
          }
        }

        // Build estimate URL - link to estimate detail page (ensure absolute HTTPS)
        const estimateLink = `${request.nextUrl.origin}/estimate/${estimateId}`
        
        // Ensure image URL is absolute HTTPS
        const absoluteImageUrl = imageUrl.startsWith('http')
          ? imageUrl.replace(/^http:/, 'https:') // Force HTTPS
          : imageUrl.startsWith('//')
          ? `https:${imageUrl}`
          : `${request.nextUrl.origin}${imageUrl.startsWith('/') ? imageUrl : `/${imageUrl}`}`
        
        // Ensure link URL is absolute HTTPS
        const absoluteLink = estimateLink.startsWith('http')
          ? estimateLink.replace(/^http:/, 'https:') // Force HTTPS
          : `https://${request.nextUrl.host}${estimateLink.startsWith('/') ? estimateLink : `/${estimateLink}`}`
        
        // Meta requires price format: "NUMBER CURRENCY" (e.g., "5400.00 ZAR")
        const priceValue = (estimate.total || 0).toFixed(2)
        const formattedPrice = `${priceValue} ZAR`
        
        // Ensure description is not empty and has minimum length (Meta requires meaningful descriptions)
        const validDescription = estimate.description && estimate.description.trim().length > 0
          ? estimate.description.trim()
          : `${postTitle} - ${duration} ${duration === 1 ? 'night' : 'nights'} accommodation stay`
        
        // Ensure title is not empty and meaningful
        const validTitle = postTitle && postTitle.trim().length > 0
          ? `${postTitle} - ${duration} ${duration === 1 ? 'Night' : 'Nights'}`
          : `Property Estimate - ${duration} ${duration === 1 ? 'Night' : 'Nights'}`

        return {
          id: `estimate-${estimateId}`,
          title: validTitle,
          description: validDescription,
          availability: 'in stock',
          condition: 'new',
          price: formattedPrice,
          currency: 'ZAR',
          link: absoluteLink,
          image_link: absoluteImageUrl,
          brand: 'Simpleplek',
          category: packageType || 'accommodation',
          custom_label_0: packageType || '',
          custom_label_1: duration.toString(),
          custom_label_2: postId || '',
          custom_label_3: estimateId,
        }
      })

    // Return in requested format
    if (format === 'xml' || !format || format === '') {
      return new NextResponse(generateXMLFeed(catalogProducts), {
        headers: {
          'Content-Type': 'application/xml; charset=utf-8',
          'Cache-Control': 'public, max-age=3600', // Cache for 1 hour
        },
      })
    }

    // Default: JSON format
    return NextResponse.json({
      products: catalogProducts,
      total: catalogProducts.length,
      userId: targetUserId,
    })
  } catch (error) {
    console.error('Error generating Meta catalog from estimates:', error)
    // Meta requires XML format and valid response, so return empty XML feed
    // Return 200 status so Meta can validate the format even on error
    const format = new URL(request.url).searchParams.get('format') || 'xml'
    if (format === 'xml' || !format || format === '') {
      return new NextResponse(generateEmptyXMLFeed(), {
        status: 200, // Return 200 even on error so Meta can validate the format
        headers: {
          'Content-Type': 'application/xml; charset=utf-8',
        },
      })
    }
    return NextResponse.json(
      {
        error: 'Failed to generate catalog',
        details: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    )
  }
}

/**
 * Generate XML feed for Meta Catalog (Facebook Product Feed format)
 */
function generateXMLFeed(products: MetaCatalogProduct[]): string {
  const items = products
    .map(
      (product) => `  <item>
    <g:id>${escapeXML(product.id)}</g:id>
    <g:title>${escapeXML(product.title)}</g:title>
    <g:description>${escapeXML(product.description)}</g:description>
    <g:link>${escapeXML(product.link)}</g:link>
    <g:image_link>${escapeXML(product.image_link)}</g:image_link>
    <g:availability>${product.availability}</g:availability>
    <g:condition>${product.condition}</g:condition>
    <g:price>${escapeXML(product.price)}</g:price>
    <g:currency>${product.currency}</g:currency>
    <g:brand>${escapeXML(product.brand || 'Simpleplek')}</g:brand>
    <g:product_type>${escapeXML(product.category || 'standard')}</g:product_type>
    <g:internal_label>${escapeXML(product.internal_label || '')}</g:internal_label>
    <g:custom_label_0>${escapeXML(product.custom_label_0 || '')}</g:custom_label_0>
    <g:custom_label_1>${escapeXML(product.custom_label_1 || '')}</g:custom_label_1>
    <g:custom_label_2>${escapeXML(product.custom_label_2 || '')}</g:custom_label_2>
    <g:custom_label_3>${escapeXML(product.custom_label_3 || '')}</g:custom_label_3>
  </item>`
    )
    .join('\n')

  return `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0" xmlns:g="http://base.google.com/ns/1.0">
  <channel>
    <title>Simpleplek Estimates Catalog</title>
    <link>https://www.simpleplek.co.za</link>
    <description>Product catalog based on user estimates for Meta Dynamic Product Ads</description>
${items}
  </channel>
</rss>`
}

function escapeXML(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;')
}

/**
 * Generate empty XML feed for Meta validation
 * Meta needs a valid XML file even if empty
 */
function generateEmptyXMLFeed(): string {
  return `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0" xmlns:g="http://base.google.com/ns/1.0">
  <channel>
    <title>Simpleplek Estimates Catalog</title>
    <link>https://www.simpleplek.co.za</link>
    <description>Product catalog based on user estimates for Meta Dynamic Product Ads. Add ?userId=[user-id] parameter to get user-specific estimates.</description>
  </channel>
</rss>`
}

