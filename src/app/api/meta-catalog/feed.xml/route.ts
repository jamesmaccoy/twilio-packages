import { NextRequest, NextResponse } from 'next/server'
import { getPayload } from 'payload'
import configPromise from '@payload-config'

/**
 * Meta Catalog Feed - XML File Endpoint
 * 
 * This endpoint provides a direct XML file that Meta can validate
 * Use this URL in Meta Business Manager: https://www.simpleplek.co.za/api/meta-catalog/feed.xml
 * 
 * For user-specific feeds, use: /api/meta-catalog/estimates?userId=[id]&format=xml
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
  custom_label_0?: string
  custom_label_1?: string
  custom_label_2?: string
  custom_label_3?: string
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const postId = searchParams.get('postId')
    const userId = searchParams.get('userId')

    const payload = await getPayload({ config: configPromise })
    let catalogProducts: MetaCatalogProduct[] = []

    // If postId provided, get packages for that post
    if (postId) {
      try {
        const packagesResult = await fetch(
          `${request.nextUrl.origin}/api/packages/post/${postId}`
        )
        
        if (packagesResult.ok) {
          const packagesData = await packagesResult.json()
          const packages = packagesData.packages || []

          // Fetch post details
          const post = await payload.findByID({
            collection: 'posts',
            id: postId,
            depth: 2,
          })

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

          const postSlug = post?.slug || postId
          const postTitle = post?.title || 'Property'

          // Transform packages to Meta catalog format
          catalogProducts = packages.map((pkg: any) => {
            const packageId = pkg.id
            const packageName = pkg.name || pkg.originalName || 'Package'
            const packageDescription = pkg.description || ''
            const baseRate = pkg.baseRate || 0
            const currency = 'ZAR'

            const packageLink = `${request.nextUrl.origin}/posts/${postSlug}?packageId=${packageId}`
            
            // Ensure image URL is absolute HTTPS
            const absoluteImageUrl = imageUrl.startsWith('http')
              ? imageUrl.replace(/^http:/, 'https:') // Force HTTPS
              : imageUrl.startsWith('//')
              ? `https:${imageUrl}`
              : `${request.nextUrl.origin}${imageUrl.startsWith('/') ? imageUrl : `/${imageUrl}`}`
            
            // Ensure link URL is absolute HTTPS
            const absoluteLink = packageLink.startsWith('http')
              ? packageLink.replace(/^http:/, 'https:') // Force HTTPS
              : `https://${request.nextUrl.host}${packageLink.startsWith('/') ? packageLink : `/${packageLink}`}`
            
            // Ensure description is not empty
            const validDescription = packageDescription && packageDescription.trim().length > 0
              ? packageDescription.trim()
              : `${packageName} package for ${postTitle}`
            
            // Ensure title is not empty
            const validTitle = postTitle && postTitle.trim().length > 0
              ? `${postTitle} - ${packageName}`
              : `Package - ${packageName}`

            // Build internal labels for packages
            const packageLabels: string[] = []
            if (pkg.category) packageLabels.push(`category-${pkg.category}`)
            if (pkg.minNights) packageLabels.push(`min-nights-${pkg.minNights}`)
            if (pkg.maxNights) packageLabels.push(`max-nights-${pkg.maxNights}`)
            if (postId) packageLabels.push(`post-${postId}`)
            if (pkg.isEnabled) packageLabels.push('enabled')
            const packageInternalLabel = packageLabels.join(',')

            return {
              id: packageId,
              title: validTitle,
              description: validDescription,
              availability: pkg.isEnabled ? 'in stock' : 'out of stock',
              condition: 'new',
              price: `${baseRate.toFixed(2)} ${currency}`,
              currency: currency,
              link: absoluteLink,
              image_link: absoluteImageUrl,
              brand: 'Simpleplek',
              category: pkg.category || 'accommodation',
              internal_label: packageInternalLabel, // Internal labels for filtering and product sets
              custom_label_0: pkg.category || 'standard',
              custom_label_1: pkg.minNights?.toString() || '0',
              custom_label_2: pkg.maxNights?.toString() || '7',
              custom_label_3: pkg.revenueCatId || '',
            }
          })
        }
      } catch (error) {
        console.error('Error fetching packages:', error)
      }
    }

    // If userId provided, get estimates for that user
    if (userId && catalogProducts.length === 0) {
      try {
        const estimates = await payload.find({
          collection: 'estimates',
          where: {
            customer: { equals: userId },
          },
          sort: '-createdAt',
          limit: 50,
          depth: 2,
        })

        catalogProducts = estimates.docs
          .filter((estimate) => estimate.post && estimate.total && estimate.total > 0)
          .map((estimate) => {
            const post = typeof estimate.post === 'object' ? estimate.post : null
            const postId = typeof estimate.post === 'string' ? estimate.post : post?.id
            const postSlug = post?.slug || postId
            const postTitle = post?.title || 'Property'
            const estimateId = estimate.id

            const duration = estimate.fromDate && estimate.toDate
              ? Math.max(1, Math.round(
                  (new Date(estimate.toDate).getTime() - new Date(estimate.fromDate).getTime()) /
                    (1000 * 60 * 60 * 24)
                ))
              : 1

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
            
            // Ensure description is not empty and has minimum length
            const validDescription = estimate.description && estimate.description.trim().length > 0
              ? estimate.description.trim()
              : `${postTitle} - ${duration} ${duration === 1 ? 'night' : 'nights'} accommodation stay`
            
            // Ensure title is not empty
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
      } catch (error) {
        console.error('Error fetching estimates:', error)
      }
    }

    // Generate XML feed
    return new NextResponse(generateXMLFeed(catalogProducts), {
      headers: {
        'Content-Type': 'application/xml; charset=utf-8',
        'Cache-Control': 'public, max-age=3600', // Cache for 1 hour
      },
    })
  } catch (error) {
    console.error('Error generating Meta catalog feed:', error)
    // Return empty but valid XML for Meta validation
    return new NextResponse(generateEmptyXMLFeed(), {
      headers: {
        'Content-Type': 'application/xml; charset=utf-8',
      },
      status: 200, // Return 200 even on error so Meta can validate the format
    })
  }
}

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
    <title>Simpleplek Catalog</title>
    <link>https://www.simpleplek.co.za</link>
    <description>Product catalog for Meta Dynamic Product Ads</description>
${items || '    <!-- No products available. Add ?postId=[id] or ?userId=[id] parameter -->'}
  </channel>
</rss>`
}

function generateEmptyXMLFeed(): string {
  return `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0" xmlns:g="http://base.google.com/ns/1.0">
  <channel>
    <title>Simpleplek Catalog</title>
    <link>https://www.simpleplek.co.za</link>
    <description>Product catalog for Meta Dynamic Product Ads. Add ?postId=[id] or ?userId=[id] parameter to get products.</description>
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

