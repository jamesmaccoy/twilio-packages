import { NextRequest, NextResponse } from 'next/server'
import { getPayload } from 'payload'
import configPromise from '@payload-config'
import { getMeUser } from '@/utilities/getMeUser'

/**
 * Meta Commerce Manager Destinations Catalog CSV Feed for Estimates
 * Generates a CSV file compatible with Meta Commerce Manager Destinations catalog format
 * 
 * Usage:
 * - For all estimates: /api/meta-catalog/estimates-csv?format=csv
 * - For specific user: /api/meta-catalog/estimates-csv?userId=[user-id]&format=csv
 * - For Google Sheets: Import this CSV URL directly into Google Sheets
 * - For Meta: Upload CSV file or use scheduled feed URL
 * 
 * Meta Destinations Catalog Required Fields:
 * - destination_id: Unique identifier for the destination
 * - name: Destination name
 * - address: Full address (street, city, state, postal code, country)
 * - url: Website link to the destination
 * - image: Image URL
 * - type: Destination type (e.g., "hotel", "accommodation")
 * - product_tags: Comma-separated tags (format: "tag1,tag2,tag3")
 * 
 * Meta accepts CSV, TSV, XML (RSS/ATOM), or XLSX files up to 4 GB
 * See: https://www.facebook.com/business/help/384041892421495
 */

interface MetaDestination {
  destination_id: string
  name: string
  description?: string // Recommended field for better catalog quality
  address: string
  url: string
  image: string
  type: string
  product_tags?: string // Comma-separated tags without spaces or special formatting
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const userId = searchParams.get('userId')
    const format = searchParams.get('format') || 'csv' // Default to CSV for Meta

    // Get authenticated user (optional - for per-user feeds)
    let user
    try {
      const authResult = await getMeUser()
      user = authResult.user
    } catch (error) {
      // If no auth, we'll return empty catalog or use a default approach
      // Meta needs a valid CSV file even if empty
    }

    // Use provided userId or authenticated user's ID
    // If neither, return all estimates (for admin) or empty catalog
    // NOTE: For Meta Commerce Manager, the feed should be publicly accessible
    // Meta's crawler will access this URL without authentication
    const targetUserId = userId || user?.id

    const payload = await getPayload({ config: configPromise })

    // Build where clause
    const where: any = {}
    if (targetUserId) {
      where.customer = { equals: targetUserId }
    }

    // Fetch user's estimates
    let estimates = await payload.find({
      collection: 'estimates',
      where: Object.keys(where).length > 0 ? where : undefined,
      sort: '-createdAt',
      limit: 1000, // Get more estimates for CSV export
      depth: 2, // Include post and customer data
    })

    console.log(`[Meta CSV Feed] Found ${estimates.docs.length} estimates for userId: ${targetUserId || 'all'}`)

    // Meta requires non-empty CSV files. If a specific userId was provided but has no estimates,
    // fall back to all estimates to ensure Meta always receives a valid feed.
    if (estimates.docs.length === 0 && targetUserId) {
      console.warn(`[Meta CSV Feed] No estimates found for userId ${targetUserId}, falling back to all estimates`)
      estimates = await payload.find({
        collection: 'estimates',
        where: undefined, // Get all estimates
        sort: '-createdAt',
        limit: 1000,
        depth: 2,
      })
      console.log(`[Meta CSV Feed] Fallback: Found ${estimates.docs.length} total estimates`)
    }

    // Transform estimates to Meta Destinations catalog format with validation
    const catalogDestinations: MetaDestination[] = estimates.docs
      .filter((estimate) => {
        // Only include estimates with valid post and total
        const hasPost = !!estimate.post
        const hasValidTotal = estimate.total && estimate.total > 0
        const hasEstimateId = !!estimate.id
        
        if (!hasPost) {
          console.warn(`Estimate ${estimate.id} skipped: missing post`)
        }
        if (!hasValidTotal) {
          console.warn(`Estimate ${estimate.id} skipped: invalid total (${estimate.total})`)
        }
        if (!hasEstimateId) {
          console.warn(`Estimate skipped: missing ID`)
        }
        
        return hasPost && hasValidTotal && hasEstimateId
      })
      .map((estimate): MetaDestination | null => {
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
        const packageType = estimate.packageType || 'standard'
        const packageName = (estimate as any).selectedPackage?.package && typeof (estimate as any).selectedPackage.package === 'object'
          ? ((estimate as any).selectedPackage.package as any).name || packageType
          : packageType

        // Get post meta image - use OG size (1200x630) if available, perfect for Meta Commerce Manager
        const postImage = post?.meta?.image && typeof post.meta.image === 'object'
          ? post.meta.image
          : null

        // Helper function to properly format and encode image URLs for Meta's crawler
        // IMPORTANT: Uses direct static file paths from /public/media to bypass any throttling/restrictions
        const formatImageUrl = (url: string | null | undefined, imageData?: any): string => {
          const origin = request.nextUrl.origin
          if (!url) return `${origin}/placeholder-image.jpg`
          
          // If already absolute URL, ensure HTTPS and encode
          if (url.startsWith('http://') || url.startsWith('https://')) {
            const httpsUrl = url.replace(/^http:/, 'https:')
            // URL encode the path portion to handle spaces and special characters
            try {
              const urlObj = new URL(httpsUrl)
              // Reconstruct URL with encoded path
              return `${urlObj.protocol}//${urlObj.host}${encodeURI(urlObj.pathname)}${urlObj.search}${urlObj.hash}`
            } catch {
              // If URL parsing fails, return as-is (shouldn't happen but safety check)
              return httpsUrl
            }
          }
          
          // For relative URLs, ensure they start with / and encode
          // CRITICAL: Ensure we're using direct static paths, not API endpoints
          // Payload stores media in /public/media, so URLs should be /media/filename.jpg
          let cleanPath = url.startsWith('/') ? url : `/${url}`
          
          // If URL points to API endpoint, convert to static path
          // /api/media/file/... -> /media/...
          if (cleanPath.startsWith('/api/media/')) {
            cleanPath = cleanPath.replace('/api/media/file/', '/media/').replace('/api/media/', '/media/')
          }
          
          // Ensure path points to /media/ directory (public static files)
          // This bypasses any throttling/restrictions for Meta's crawler
          if (!cleanPath.startsWith('/media/') && imageData?.filename) {
            // If we have a filename, construct direct path to public/media
            cleanPath = `/media/${imageData.filename}`
          }
          
          // Encode the path to handle spaces and special characters
          const encodedPath = encodeURI(cleanPath)
          return `${origin}${encodedPath}`
        }

        // Prefer OG size first (optimized for Meta/social media)
        // Use direct static file paths to ensure Meta's crawler can access images
        // CRITICAL: Bypasses throttling by using direct /media/ paths (public static files)
        let imageUrl = `${request.nextUrl.origin}/placeholder-image.jpg`
        if (postImage) {
          // Check for OG size first (optimized for Meta/social media)
          const ogImageUrl = (postImage as any)?.sizes?.og?.url
          if (ogImageUrl) {
            imageUrl = formatImageUrl(ogImageUrl, postImage)
          } else if (postImage.url) {
            // Fall back to regular image URL
            imageUrl = formatImageUrl(postImage.url, postImage)
          } else if ((postImage as any)?.filename) {
            // If we have filename, construct direct path to public/media
            // This ensures Meta's crawler can access the image directly (bypasses throttling)
            const filename = (postImage as any).filename
            imageUrl = formatImageUrl(`/media/${filename}`, postImage)
          }
        }

        // Build post URL - link to post page (not estimate, as destinations are properties)
        const postUrl = postSlug 
          ? `${request.nextUrl.origin}/${postSlug}`
          : `${request.nextUrl.origin}/post/${postId}`

        // Ensure image URL is absolute HTTPS and properly encoded
        let absoluteImageUrl = formatImageUrl(imageUrl)
        
        // Validate image URL format (must be valid HTTPS URL)
        if (!absoluteImageUrl.match(/^https:\/\/[^\s]+\.[^\s]+/)) {
          console.warn(`Invalid image URL format for estimate ${estimateId}: ${absoluteImageUrl}, using placeholder`)
          absoluteImageUrl = `https://${request.nextUrl.host}/placeholder-image.jpg`
        }
        
        // Final validation: ensure no spaces in URL (should be encoded by formatImageUrl)
        if (absoluteImageUrl.includes(' ')) {
          console.warn(`Image URL contains spaces for estimate ${estimateId}, encoding...`)
          absoluteImageUrl = absoluteImageUrl.replace(/ /g, '%20')
        }
        
        // Additional validation: ensure URL doesn't have double slashes (except after protocol)
        absoluteImageUrl = absoluteImageUrl.replace(/([^:]\/)\/+/g, '$1')
        
        // Log image URL for debugging broken links
        console.log(`[Meta Feed] Estimate ${estimateId} image URL: ${absoluteImageUrl}`)
        
        // Ensure link URL is absolute HTTPS (Meta requires valid URLs)
        let absoluteUrl = postUrl.startsWith('http')
          ? postUrl.replace(/^http:/, 'https:') // Force HTTPS
          : `https://${request.nextUrl.host}${postUrl.startsWith('/') ? postUrl : `/${postUrl}`}`
        
        // Validate link URL format
        if (!absoluteUrl.match(/^https:\/\/.+\..+/)) {
          console.warn(`Invalid URL for estimate ${estimateId}: ${absoluteUrl}`)
        }
        
        // Build destination name (required field)
        const destinationName = postTitle && postTitle.trim().length > 0
          ? postTitle.trim()
          : `Property ${postId || estimateId}`
        
        // Build description (recommended field) - use post meta description or generate from post title and duration
        const postMetaDesc = post?.meta?.description || ''
        const description = postMetaDesc || 
          `${postTitle} - ${duration} ${duration === 1 ? 'night' : 'nights'} accommodation stay in South Africa`
        
        // Build address (required field) - using placeholder since address is not stored in Post
        // Format: "Street Address, City, State/Province, Postal Code, Country"
        // Meta requires a complete address format
        // Note: If you need specific addresses, add an address field to the Post collection
        const address = `${postTitle || 'Property'}, Cape Town, Western Cape, South Africa`
        
        // Build product tags (comma-separated, no spaces, no special characters)
        // Format: "tag1,tag2,tag3" (no emojis or special formatting)
        // Meta requires tags to be alphanumeric with hyphens/underscores only
        const tags: string[] = []
        if (packageType) {
          // Clean package name - remove emojis and special characters, keep only alphanumeric and hyphens
          const cleanPackageName = packageName
            .replace(/[^\w\s-]/g, '') // Remove special characters except word chars, spaces, hyphens
            .trim()
            .replace(/\s+/g, '-') // Replace spaces with hyphens
            .toLowerCase()
            .replace(/[^a-z0-9-]/g, '') // Final cleanup - only alphanumeric and hyphens
          if (cleanPackageName) {
            tags.push(`package-${cleanPackageName}`)
          }
        }
        if (duration) {
          tags.push(`duration-${duration}`)
        }
        if (postId) {
          // Ensure postId is alphanumeric only
          const cleanPostId = postId.replace(/[^a-z0-9-]/gi, '')
          if (cleanPostId) {
            tags.push(`post-${cleanPostId}`)
          }
        }
        if (estimate.status) {
          // Status values should be valid (pending, approved, rejected, completed)
          const validStatuses = ['pending', 'approved', 'rejected', 'completed']
          if (validStatuses.includes(estimate.status)) {
            tags.push(`status-${estimate.status}`)
          }
        }
        if (estimate.paymentStatus) {
          // Payment status values should be valid (paid, unpaid)
          const validPaymentStatuses = ['paid', 'unpaid']
          if (validPaymentStatuses.includes(estimate.paymentStatus)) {
            tags.push(`payment-${estimate.paymentStatus}`)
          }
        }
        const productTags = tags.length > 0 ? tags.join(',') : undefined
        
        // Validate all required fields before adding to catalog
        if (!estimateId || !destinationName || !address || !absoluteUrl || !absoluteImageUrl) {
          console.error(`Estimate ${estimateId} missing required fields:`, {
            destination_id: estimateId,
            name: destinationName,
            address,
            url: absoluteUrl,
            image: absoluteImageUrl
          })
          return null // Will be filtered out
        }

        return {
          destination_id: `estimate-${estimateId}`, // Unique identifier
          name: destinationName, // Required: destination name
          description: description, // Recommended: detailed description
          address: address, // Required: full address
          url: absoluteUrl, // Required: website link
          image: absoluteImageUrl, // Required: image URL
          type: 'hotel', // Required: destination type (valid values: hotel, flight, destination, event, restaurant, etc.)
          product_tags: productTags, // Optional: comma-separated tags
        }
      })
      .filter((destination): destination is MetaDestination => destination !== null) // Remove any null destinations

    console.log(`[Meta CSV Feed] Generated ${catalogDestinations.length} valid destinations from ${estimates.docs.length} estimates`)

    // Return CSV format
    if (format === 'csv' || !format || format === '') {
      if (catalogDestinations.length === 0) {
        // Meta rejects empty CSV files. Return an error response instead.
        console.error('[Meta CSV Feed] No valid destinations generated - Meta requires non-empty CSV files')
        return NextResponse.json(
          {
            error: 'No valid destinations found',
            message: 'Meta Commerce Manager requires non-empty CSV files. Please ensure there are valid estimates with posts and totals.',
            total: 0,
          },
          { status: 404 }
        )
      }
      return generateDestinationsCSVResponse(catalogDestinations)
    }

    // Default: JSON format
    return NextResponse.json({
      destinations: catalogDestinations,
      total: catalogDestinations.length,
      userId: targetUserId,
    })
  } catch (error) {
    console.error('Error generating Meta CSV catalog from estimates:', error)
    // Meta rejects empty CSV files. Return an error response instead.
    return NextResponse.json(
      {
        error: 'Failed to generate catalog',
        message: 'An error occurred while generating the Meta catalog feed. Meta requires non-empty CSV files.',
        details: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    )
  }
}

/**
 * Generate CSV response for Meta Commerce Manager Destinations Catalog
 * Meta requires specific field order and format for Destinations catalog
 */
function generateDestinationsCSVResponse(destinations: MetaDestination[]): NextResponse {
  // Meta Destinations Catalog CSV headers (required fields first, then recommended fields)
  // Required fields: destination_id, name, address, url, image, type
  // Recommended fields: description (improves catalog quality)
  // Optional fields: product_tags
  const headers = [
    'destination_id',
    'name',
    'description', // Recommended field for better catalog quality
    'address',
    'url',
    'image',
    'type',
    'product_tags',
  ]

  // Validate each destination before adding to CSV
  const validDestinations = destinations.filter(destination => {
    // Check all required fields
    const hasDestinationId = !!destination.destination_id && destination.destination_id.trim().length > 0
    const hasName = !!destination.name && destination.name.trim().length > 0
    const hasAddress = !!destination.address && destination.address.trim().length > 0
    const hasUrl = !!destination.url && destination.url.startsWith('https://')
    const hasImage = !!destination.image && destination.image.startsWith('https://')
    const hasType = !!destination.type && destination.type.trim().length > 0
    
    if (!hasDestinationId || !hasName || !hasAddress || !hasUrl || !hasImage || !hasType) {
      console.warn(`[Meta CSV Feed] Invalid destination skipped:`, {
        destination_id: destination.destination_id,
        hasDestinationId,
        hasName,
        hasAddress,
        hasUrl,
        hasImage,
        hasType
      })
      return false
    }
    
    return true
  })

  // Create CSV rows
  const csvRows = [
    headers.join(','), // Header row
    ...validDestinations.map(destination => 
      headers.map(header => {
        const value = destination[header as keyof MetaDestination] || ''
        // Escape commas, quotes, and newlines in CSV values
        const stringValue = String(value)
        if (stringValue.includes(',') || stringValue.includes('"') || stringValue.includes('\n')) {
          return `"${stringValue.replace(/"/g, '""')}"`
        }
        return stringValue
      }).join(',')
    )
  ]

  // If no destinations, return header row only (Meta needs valid CSV format)
  const csvContent = csvRows.length > 1 ? csvRows.join('\n') : headers.join(',')
  
  console.log(`[Meta CSV Feed] Generated CSV with ${validDestinations.length} valid destinations (${destinations.length - validDestinations.length} filtered out)`)

  return new NextResponse(csvContent, {
    status: 200,
    headers: {
      'Content-Type': 'text/csv; charset=utf-8',
      'Content-Disposition': 'attachment; filename="meta-destinations-catalog.csv"',
      'Cache-Control': 'public, max-age=3600', // Cache for 1 hour
      'Access-Control-Allow-Origin': '*', // Allow Meta's crawler to access
    },
  })
}

