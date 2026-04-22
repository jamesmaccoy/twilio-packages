import { NextRequest, NextResponse } from 'next/server'
import { getPayload } from 'payload'
import configPromise from '@payload-config'

/**
 * Meta Catalog Feed API
 * Generates a product catalog feed for Meta (Facebook) Dynamic Product Ads
 * 
 * This endpoint provides product data in a format Meta can use for:
 * - Dynamic Product Ads
 * - Catalog Sales campaigns
 * - Product retargeting
 * 
 * Usage:
 * - Add this URL to Meta Business Manager → Commerce → Catalogs → Data Sources
 * - Format: XML (Meta's preferred format for product catalogs)
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
  custom_label_0?: string // Package category
  custom_label_1?: string // Min nights
  custom_label_2?: string // Max nights
  custom_label_3?: string // Revenue Cat ID
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const postId = searchParams.get('postId')
    const format = searchParams.get('format') || 'json' // json or xml

    if (!postId) {
      return NextResponse.json(
        { error: 'postId parameter is required' },
        { status: 400 }
      )
    }

    const payload = await getPayload({ config: configPromise })

    // Fetch packages for the post
    const packagesResult = await fetch(
      `${request.nextUrl.origin}/api/packages/post/${postId}`
    )
    
    if (!packagesResult.ok) {
      return NextResponse.json(
        { error: 'Failed to fetch packages' },
        { status: 500 }
      )
    }

    const packagesData = await packagesResult.json()
    const packages = packagesData.packages || []

    // Fetch post details for image and link
    const post = await payload.findByID({
      collection: 'posts',
      id: postId,
      depth: 2,
    })

    const postImage = post?.meta?.image && typeof post.meta.image === 'object'
      ? post.meta.image
      : null

    const imageUrl = postImage?.url
      ? postImage.url.startsWith('http')
        ? postImage.url
        : `${request.nextUrl.origin}${postImage.url}`
      : `${request.nextUrl.origin}/placeholder-image.jpg`

    const postSlug = post?.slug || postId
    const postTitle = post?.title || 'Property'

    // Transform packages to Meta catalog format
    const catalogProducts: MetaCatalogProduct[] = packages.map((pkg: any) => {
      const packageId = pkg.id
      const packageName = pkg.name || pkg.originalName || 'Package'
      const packageDescription = pkg.description || ''
      const baseRate = pkg.baseRate || 0
      const currency = 'ZAR'

      // Build package URL - link to post with package pre-selected
      const packageLink = `${request.nextUrl.origin}/posts/${postSlug}?packageId=${packageId}`

      return {
        id: packageId,
        title: `${postTitle} - ${packageName}`,
        description: packageDescription,
        availability: pkg.isEnabled ? 'in stock' : 'out of stock',
        condition: 'new',
        price: `${baseRate.toFixed(2)} ${currency}`,
        currency: currency,
        link: packageLink,
        image_link: imageUrl,
        brand: 'Simpleplek',
        category: pkg.category || 'standard',
        custom_label_0: pkg.category || 'standard',
        custom_label_1: pkg.minNights?.toString() || '0',
        custom_label_2: pkg.maxNights?.toString() || '7',
        custom_label_3: pkg.revenueCatId || '',
      }
    })

    // Return in requested format
    if (format === 'xml') {
      return new NextResponse(generateXMLFeed(catalogProducts), {
        headers: {
          'Content-Type': 'application/xml',
        },
      })
    }

    // Default: JSON format
    return NextResponse.json({
      products: catalogProducts,
      total: catalogProducts.length,
      postId,
      postTitle,
    })
  } catch (error) {
    console.error('Error generating Meta catalog:', error)
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
    <title>Simpleplek Packages Catalog</title>
    <link>https://www.simpleplek.co.za</link>
    <description>Product catalog for Meta Dynamic Product Ads</description>
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

