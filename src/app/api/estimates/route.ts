import { NextRequest, NextResponse } from 'next/server'
import { getPayload } from 'payload'
import configPromise from '@/payload.config'
import { yocoService } from '@/lib/yocoService'
import type { Estimate } from '@/payload-types'
import { verifyJwtToken } from '@/utilities/token'
import { getServerSideURL } from '@/utilities/getURL'
import { getCustomerEntitlement, type CustomerEntitlement } from '@/utils/packageSuggestions'
import jwt from 'jsonwebtoken'

export async function GET(request: NextRequest) {
  try {
    const payload = await getPayload({ config: configPromise })
    const searchParams = request.nextUrl.searchParams
    
    // Support both header-based auth and token-based auth (for Google Sheets)
    let isAuthorized = false
    let isAdmin = false
    let customerId: string | null = null
    let user = null
    
    // Try header-based authentication first
    try {
      const authResult = await payload.auth({ headers: request.headers })
      user = authResult.user
      if (user && (user as any).role?.includes('admin')) {
        isAuthorized = true
        isAdmin = true
      } else if (user) {
        isAuthorized = true
        customerId = user.id
      }
    } catch (error) {
      // Header auth failed, try token-based auth
    }
    
    // If not authorized via headers, try token query parameter (for Google Sheets)
    if (!isAuthorized) {
      const token = searchParams.get('token')
      if (token) {
        const decoded = verifyJwtToken<{ estimateId?: string; customerId?: string; admin?: boolean }>(token)
        if (decoded && decoded.admin) {
          isAuthorized = true
          isAdmin = true
        } else if (decoded && decoded.customerId) {
          // Allow customers to see their own estimates
          isAuthorized = true
          customerId = decoded.customerId
        }
      }
    }
    
    // Check for API key in environment (for Google Sheets access - admin only)
    if (!isAuthorized) {
      const apiKey = searchParams.get('apiKey')
      const expectedApiKey = process.env.ESTIMATES_EXPORT_API_KEY
      if (apiKey && expectedApiKey && apiKey === expectedApiKey) {
        isAuthorized = true
        isAdmin = true
      }
    }
    
    if (!isAuthorized) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const format = searchParams.get('format') || 'csv' // Default to CSV for Google Sheets
    const metaFormat = searchParams.get('meta') === 'true' // Meta Commerce Manager format
    const limit = parseInt(searchParams.get('limit') || '1000', 10)
    const depth = parseInt(searchParams.get('depth') || '2', 10)

    // Build where clause - filter by customer if not admin
    const where: any = {}
    if (!isAdmin && customerId) {
      where.customer = { equals: customerId }
    }

    // Fetch estimates with full depth to get customer and post details
    const estimates = await payload.find({
      collection: 'estimates',
      where: Object.keys(where).length > 0 ? where : undefined,
      limit,
      depth,
      sort: '-createdAt',
    })

    // Get base URL for constructing click-through URLs
    const baseUrl = getServerSideURL()

    // Helper function to truncate text for Google Ads (headlines max 30 chars, descriptions max 90 chars)
    const truncateText = (text: string, maxLength: number): string => {
      if (!text) return ''
      return text.length > maxLength ? text.substring(0, maxLength - 3) + '...' : text
    }

    // Helper function to generate Google Ads headlines (max 30 characters each)
    const generateHeadlines = (postTitle: string, packageName: string, postMetaDesc?: string): string[] => {
      const headlines: string[] = []
      
      // Headline 1: Post title (truncated)
      if (postTitle) {
        headlines.push(truncateText(postTitle, 30))
      }
      
      // Headline 2: Package name if available
      if (packageName && packageName !== postTitle) {
        headlines.push(truncateText(packageName, 30))
      }
      
      // Headline 3: "Complete Your Booking"
      headlines.push('Complete Your Booking')
      
      // Headline 4: "Reserve Your Stay"
      headlines.push('Reserve Your Stay')
      
      // Headline 5: "Book Now - Special Rate"
      headlines.push('Book Now - Special Rate')
      
      // Headline 6: Post title + "Available"
      if (postTitle) {
        const available = truncateText(`${postTitle} Available`, 30)
        if (available !== headlines[0]) {
          headlines.push(available)
        }
      }
      
      return headlines.slice(0, 15) // Google Ads allows up to 15 headlines
    }

    // Helper function to generate Google Ads descriptions (max 90 characters each)
    const generateDescriptions = (
      postMetaDesc: string | null | undefined,
      packageDesc: string | null | undefined,
      postTitle: string,
      packageName: string,
      total: number
    ): string[] => {
      const descriptions: string[] = []
      
      // Description 1: Meta description if available
      if (postMetaDesc) {
        descriptions.push(truncateText(postMetaDesc, 90))
      }
      
      // Description 2: Package description if available
      if (packageDesc && packageDesc !== postMetaDesc) {
        descriptions.push(truncateText(packageDesc, 90))
      }
      
      // Description 3: Generic booking message
      descriptions.push('Continue your booking and secure your stay. Complete your reservation today.')
      
      // Description 4: Price-focused message
      if (total > 0) {
        const formattedTotal = new Intl.NumberFormat('en-ZA', { 
          style: 'currency', 
          currency: 'ZAR' 
        }).format(total)
        descriptions.push(`Secure your booking for ${formattedTotal}. Don't miss out on this opportunity.`)
      }
      
      // Description 5: Urgency message
      descriptions.push('Your estimate is ready. Complete your booking now before availability changes.')
      
      // Description 6: Value proposition
      descriptions.push(`Experience ${postTitle}${packageName ? ` with ${packageName}` : ''}. Book now to confirm.`)
      
      return descriptions.slice(0, 4) // Google Ads allows up to 4 descriptions
    }

    // Transform estimates to include flattened customer and post data
    const transformedEstimates = estimates.docs.map((estimate: any) => {
      const customer = typeof estimate.customer === 'object' ? estimate.customer : null
      const post = typeof estimate.post === 'object' ? estimate.post : null
      const selectedPackage = estimate.selectedPackage
      const packageData = selectedPackage?.package && typeof selectedPackage.package === 'object' 
        ? selectedPackage.package 
        : null

      // Construct click-through URL for Google Ads retargeting
      const postSlug = post?.slug || ''
      const estimateId = estimate.id || ''
      const clickThroughUrl = postSlug && estimateId 
        ? `${baseUrl}/posts/${postSlug}?restoreEstimate=${estimateId}`
        : ''

      // Get post and package data for ad copy
      const postTitle = post?.title || ''
      const postMetaDesc = post?.meta?.description || null
      const packageName = packageData?.name || selectedPackage?.customName || ''
      const packageDesc = packageData?.description || null
      const total = estimate.total || 0

      // Get post meta image - use OG size (1200x630) if available, perfect for Meta Commerce Manager
      const postImage = post?.meta?.image && typeof post.meta.image === 'object'
        ? post.meta.image
        : null

      // Prefer OG image size for Meta (1200x630 optimized for social media)
      let imageUrl = `${baseUrl}/placeholder-image.jpg`
      if (postImage) {
        // Check for OG size first (optimized for Meta/social media)
        const ogImageUrl = (postImage as any)?.sizes?.og?.url
        if (ogImageUrl) {
          imageUrl = ogImageUrl.startsWith('http')
            ? ogImageUrl
            : `${baseUrl}${ogImageUrl}`
        } else if (postImage.url) {
          // Fall back to regular image URL
          imageUrl = postImage.url.startsWith('http')
            ? postImage.url
            : `${baseUrl}${postImage.url}`
        }
      }

      // Generate Google Ads assets
      const headlines = generateHeadlines(postTitle, packageName, postMetaDesc || undefined)
      const descriptions = generateDescriptions(postMetaDesc, packageDesc, postTitle, packageName, total)

      return {
        id: estimate.id,
        title: estimate.title || '',
        customerId: typeof estimate.customer === 'string' ? estimate.customer : estimate.customer?.id || '',
        customerName: customer?.name || estimate.customerName || '',
        customerEmail: customer?.email || estimate.customerEmail || '',
        postId: typeof estimate.post === 'string' ? estimate.post : estimate.post?.id || '',
        postTitle: postTitle,
        postSlug: postSlug,
        postMetaDescription: postMetaDesc || '',
        postImageUrl: imageUrl, // Add image URL to CSV export
        clickThroughUrl: clickThroughUrl,
        // Google Ads Assets
        finalUrl: clickThroughUrl, // Google Ads uses "Final URL" field
        headline1: headlines[0] || '',
        headline2: headlines[1] || '',
        headline3: headlines[2] || '',
        headline4: headlines[3] || '',
        headline5: headlines[4] || '',
        headline6: headlines[5] || '',
        headline7: headlines[6] || '',
        headline8: headlines[7] || '',
        headline9: headlines[8] || '',
        headline10: headlines[9] || '',
        headline11: headlines[10] || '',
        headline12: headlines[11] || '',
        headline13: headlines[12] || '',
        headline14: headlines[13] || '',
        headline15: headlines[14] || '',
        description1: descriptions[0] || '',
        description2: descriptions[1] || '',
        description3: descriptions[2] || '',
        description4: descriptions[3] || '',
        fromDate: estimate.fromDate || '',
        toDate: estimate.toDate || '',
        guests: Array.isArray(estimate.guests) 
          ? estimate.guests.map((g: any) => typeof g === 'object' ? g.email || g.name || g.id : g).join('; ')
          : '',
        total: total,
        packageType: estimate.packageType || '',
        packageName: packageName,
        packageId: packageData?.id || '',
        packageDescription: packageDesc || '',
        paymentStatus: estimate.paymentStatus || 'unpaid',
        status: estimate.status || 'pending',
        requestType: estimate.requestType || 'initial',
        createdAt: estimate.createdAt || '',
        updatedAt: estimate.updatedAt || '',
        notes: estimate.notes || '',
      }
    })

    // Return CSV format for Google Sheets
    if (format === 'csv') {
      if (transformedEstimates.length === 0) {
        return new NextResponse('No estimates found', {
          status: 200,
          headers: {
            'Content-Type': 'text/csv',
            'Content-Disposition': `attachment; filename="${metaFormat ? 'meta-catalog-estimates.csv' : 'estimates.csv'}"`,
          },
        })
      }

      // Meta Commerce Manager Destinations Catalog format
      if (metaFormat) {
        const metaDestinations = estimates.docs
          .filter((estimate: any) => estimate.post && estimate.total && estimate.total > 0)
          .map((estimate: any) => {
            const post = typeof estimate.post === 'object' ? estimate.post : null
            const postId = typeof estimate.post === 'string' ? estimate.post : post?.id || ''
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
            
            const packageType = estimate.packageType || 'standard'
            const packageName = estimate.selectedPackage?.package && typeof estimate.selectedPackage.package === 'object'
              ? estimate.selectedPackage.package.name || packageType
              : estimate.selectedPackage?.customName || packageType
            
            // Get post meta image - use OG size (1200x630) if available, perfect for Meta Commerce Manager
            const postImage = post?.meta?.image && typeof post.meta.image === 'object'
              ? post.meta.image
              : null
            
            // Helper function to properly format and encode image URLs for Meta's crawler
            // IMPORTANT: Uses direct static file paths from /public/media to bypass any throttling/restrictions
            const formatImageUrl = (url: string | null | undefined, imageData?: any): string => {
              if (!url) return `${baseUrl}/placeholder-image.jpg`
              
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
              return `https://${baseUrl.replace(/^https?:\/\//, '')}${encodedPath}`
            }
            
            // Prefer OG size first (optimized for Meta/social media)
            // Use direct static file paths to ensure Meta's crawler can access images
            // CRITICAL: Bypasses throttling by using direct /media/ paths (public static files)
            let imageUrl = `${baseUrl}/placeholder-image.jpg`
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
              ? `${baseUrl}/${postSlug}`
              : `${baseUrl}/post/${postId}`
            
            // Ensure image URL is absolute HTTPS and properly encoded
            let absoluteImageUrl = formatImageUrl(imageUrl)
            
            // Validate image URL format (must be valid HTTPS URL)
            if (!absoluteImageUrl.match(/^https:\/\/[^\s]+\.[^\s]+/)) {
              console.warn(`Invalid image URL format for estimate ${estimateId}: ${absoluteImageUrl}, using placeholder`)
              absoluteImageUrl = `https://${baseUrl.replace(/^https?:\/\//, '')}/placeholder-image.jpg`
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
            
            // Ensure link URL is absolute HTTPS
            let absoluteUrl = postUrl.startsWith('http')
              ? postUrl.replace(/^http:/, 'https:') // Force HTTPS
              : `https://${baseUrl.replace(/^https?:\/\//, '')}${postUrl.startsWith('/') ? postUrl : `/${postUrl}`}`
            
            // Validate link URL format
            if (!absoluteUrl.match(/^https:\/\/.+\..+/)) {
              console.warn(`Invalid URL for estimate ${estimateId}: ${absoluteUrl}`)
            }
            
            // Build destination name (required field)
            const destinationName = postTitle && postTitle.trim().length > 0
              ? postTitle.trim()
              : `Property ${postId || estimateId}`
            
            // Build address (required field) - using placeholder since address is not stored in Post
            // Format: "Street Address, City, State/Province, Postal Code, Country"
            // Meta requires a complete address format
            const address = `${postTitle || 'Property'}, Cape Town, Western Cape, South Africa`
            
            // Build description (recommended field) - use post meta description or generate from post title and duration
            const postMetaDesc = post?.meta?.description || ''
            const description = postMetaDesc || 
              `${postTitle} - ${duration} ${duration === 1 ? 'night' : 'nights'} accommodation stay in South Africa`
            
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
        
        // Meta Destinations Catalog CSV headers (required fields first, then recommended fields)
        const metaHeaders = [
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
        const validDestinations = metaDestinations.filter(destination => {
          const hasDestinationId = !!destination.destination_id && destination.destination_id.trim().length > 0
          const hasName = !!destination.name && destination.name.trim().length > 0
          const hasAddress = !!destination.address && destination.address.trim().length > 0
          const hasUrl = !!destination.url && destination.url.startsWith('https://')
          const hasImage = !!destination.image && destination.image.startsWith('https://')
          const hasType = !!destination.type && destination.type.trim().length > 0
          
          return hasDestinationId && hasName && hasAddress && hasUrl && hasImage && hasType
        })
        
        const csvRows = [
          metaHeaders.join(','),
          ...validDestinations.map(destination =>
            metaHeaders.map(header => {
              const value = destination[header as keyof typeof destination] || ''
              const stringValue = String(value)
              if (stringValue.includes(',') || stringValue.includes('"') || stringValue.includes('\n')) {
                return `"${stringValue.replace(/"/g, '""')}"`
              }
              return stringValue
            }).join(',')
          )
        ]
        
        return new NextResponse(csvRows.join('\n'), {
          status: 200,
          headers: {
            'Content-Type': 'text/csv; charset=utf-8',
            'Content-Disposition': 'attachment; filename="meta-destinations-catalog.csv"',
            'Cache-Control': 'public, max-age=3600', // Cache for 1 hour
            'Access-Control-Allow-Origin': '*', // Allow Meta's crawler to access
          },
        })
      }

      // Default Google Ads format
      // Get headers from first estimate (guaranteed to exist due to check above)
      const firstEstimate = transformedEstimates[0]
      if (!firstEstimate) {
        return new NextResponse('No estimates found', {
          status: 200,
          headers: {
            'Content-Type': 'text/csv',
            'Content-Disposition': 'attachment; filename="estimates.csv"',
          },
        })
      }
      const headers = Object.keys(firstEstimate)
      
      // Create CSV rows
      const csvRows = [
        headers.join(','), // Header row
        ...transformedEstimates.map(estimate => 
          headers.map(header => {
            const value = estimate[header as keyof typeof estimate] || ''
            // Escape commas and quotes in CSV values
            const stringValue = String(value)
            if (stringValue.includes(',') || stringValue.includes('"') || stringValue.includes('\n')) {
              return `"${stringValue.replace(/"/g, '""')}"`
            }
            return stringValue
          }).join(',')
        )
      ]

      return new NextResponse(csvRows.join('\n'), {
        status: 200,
        headers: {
          'Content-Type': 'text/csv; charset=utf-8',
          'Cache-Control': 'no-cache',
        },
      })
    }

    // Return JSON format (default)
    return NextResponse.json({
      totalDocs: estimates.totalDocs,
      limit: estimates.limit,
      totalPages: estimates.totalPages,
      page: estimates.page,
      hasNextPage: estimates.hasNextPage,
      hasPrevPage: estimates.hasPrevPage,
      nextPage: estimates.nextPage,
      prevPage: estimates.prevPage,
      docs: transformedEstimates,
    })
  } catch (err) {
    console.error('Estimate export error:', err)
    return NextResponse.json(
      { error: (err instanceof Error ? err.message : 'Unknown error') },
      { status: 500 }
    )
  }
}

export async function POST(request: NextRequest) {
  try {
    const payload = await getPayload({ config: configPromise })
    let user: any = null
    try {
      const authResult = await payload.auth({ headers: request.headers })
      user = authResult.user
    } catch {
      // fall through to cookie token fallback
    }

    // Fallback: if Payload didn't pick up cookies, try JWT header auth using cookie token.
    if (!user) {
      const prefixToken = request.cookies.get(`${payload.config.cookiePrefix}-token`)?.value
      const legacyToken = request.cookies.get('payload-token')?.value
      const authTokens = [prefixToken, legacyToken].filter(
        (token, index, self): token is string => Boolean(token) && self.indexOf(token) === index,
      )

      if (authTokens.length > 0) {
        for (const token of authTokens) {
          try {
            const headersWithToken = new Headers(request.headers)
            headersWithToken.set('authorization', `JWT ${token}`)
            const tokenAuthResult = await payload.auth({ headers: headersWithToken })
            if (tokenAuthResult.user) {
              user = tokenAuthResult.user
              break
            }
          } catch {
            continue
          }
        }
      }

      // Final fallback: directly verify JWT and load user.
      if (!user && authTokens.length > 0) {
        for (const token of authTokens) {
          try {
            const decoded = jwt.verify(token, payload.secret) as unknown
            const id =
              typeof decoded === 'object' && decoded !== null && 'id' in decoded
                ? (decoded as any).id
                : null
            if (typeof id === 'string' && id.length > 0) {
              user = await payload.findByID({
                collection: 'users',
                id,
                overrideAccess: true,
              })
              break
            }
          } catch {
            continue
          }
        }
      }
    }

    if (!user) {
      // Dev-only: return auth debugging signals to quickly diagnose missing cookies/headers.
      if (process.env.NODE_ENV === 'development') {
        const tokenCookieName =
          request.cookies.getAll().find((cookie) => cookie.name.endsWith('-token'))?.name ||
          (request.cookies.get('payload-token') ? 'payload-token' : null)
        const hasAuthHeader = Boolean(request.headers.get('authorization'))
        const hasCookieHeader = Boolean(request.headers.get('cookie'))
        return NextResponse.json(
          {
            error: 'Unauthorized',
            debug: {
              hasAuthHeader,
              hasCookieHeader,
              tokenCookieName,
              cookieNames: request.cookies.getAll().map((c) => c.name),
            },
          },
          { status: 401 },
        )
      }
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await request.json()
    const { postId, fromDate, toDate, guests, title, packageType, total, estimateId } = body

    const rawPackageType =
      typeof packageType === 'string' && packageType.trim().length > 0 ? packageType.trim() : null

    // If estimateId is provided, fetch the existing estimate to preserve package information
    let existingEstimate: any = null
    if (estimateId) {
      try {
        existingEstimate = await payload.findByID({
          collection: 'estimates',
          id: estimateId,
          depth: 1,
        })
        // Verify it belongs to the current user
        const estimateCustomerId = typeof existingEstimate.customer === 'string' ? existingEstimate.customer : existingEstimate.customer?.id
        if (estimateCustomerId !== user.id) {
          existingEstimate = null // Don't use if it doesn't belong to user
        }
      } catch (error) {
        console.warn('Could not fetch existing estimate:', error)
        existingEstimate = null
      }
    }

    // Use existing package info if available and no new packageType provided
    const effectivePackageType = rawPackageType || existingEstimate?.packageType || null

    if (!effectivePackageType) {
      return NextResponse.json({ error: 'packageType is required' }, { status: 400 })
    }

    console.log('Looking for package:', { postId, packageType: effectivePackageType, estimateId, hasExistingEstimate: !!existingEstimate })
    console.log('Package type (original):', effectivePackageType)
    console.log('Package type (lowercase):', effectivePackageType.toLowerCase())
    let pkg: any = null
    let multiplier = 1
    let customName: string | null = null // Store custom name from package settings

    // Get the post data to access packageSettings for custom names
    let postData: any = null
    try {
      postData = await payload.findByID({
        collection: 'posts',
        id: postId,
        depth: 1,
      })
    } catch (error) {
      console.log('Failed to fetch post data:', error)
    }

    // Initialize baseRate with post's baseRate or default
    let baseRate = postData?.baseRate || 150

    // Helper function to check if package is enabled for this post
    const isPackageEnabledForPost = (packageId: string) => {
      if (!postData?.packageSettings || !Array.isArray(postData.packageSettings)) {
        return true // Default to enabled if no settings exist
      }
      const packageSetting = postData.packageSettings.find((setting: any) => {
        const pkgId = typeof setting.package === 'object' ? setting.package.id : setting.package
        return pkgId === packageId
      })
      return packageSetting?.enabled !== false // Default to true if not explicitly set to false
    }

    // First, get all available packages for this post (including Yoco products)
    try {
      // Get database packages
      const dbPackages = await payload.find({
        collection: 'packages',
        where: {
          post: { equals: postId },
          isEnabled: { equals: true }
        },
        depth: 1,
      })

      // Get Yoco products
      const yocoProducts = await yocoService.getProducts()
      
      // Combine database packages with Yoco products
      const allPackages = [
        ...dbPackages.docs.map(pkg => {
          // Map revenueCatId to yocoId for backward compatibility
          const yocoId = (pkg as any).yocoId || pkg.revenueCatId
          return {
            id: pkg.id,
            name: pkg.name,
            description: pkg.description,
            multiplier: pkg.multiplier,
            category: pkg.category,
            minNights: pkg.minNights,
            maxNights: pkg.maxNights,
            revenueCatId: pkg.revenueCatId, // Keep for backward compatibility
            yocoId: yocoId, // Primary identifier for Yoco integration
            baseRate: pkg.baseRate,
            isEnabled: pkg.isEnabled && isPackageEnabledForPost(pkg.id),
            features: pkg.features?.map((f: any) => f.feature) || [],
            source: 'database'
          }
        }),
        ...yocoProducts.map(product => ({
          id: product.id,
          name: product.title,
          description: product.description,
          multiplier: 1, // Default multiplier for Yoco products
          category: product.category,
          minNights: product.period === 'hour' ? 1 : product.periodCount,
          maxNights: product.period === 'hour' ? 1 : product.periodCount,
          revenueCatId: product.id, // Keep for backward compatibility
          yocoId: product.id, // Yoco products use their own ID as yocoId
          baseRate: product.price,
          isEnabled: product.isEnabled && isPackageEnabledForPost(product.id),
          features: product.features,
          source: 'yoco'
        }))
      ].filter(pkg => pkg.isEnabled) // Only include enabled packages

      console.log('Available packages:', allPackages.map(p => ({ id: p.id, name: p.name, source: p.source, yocoId: (p as any).yocoId, revenueCatId: p.revenueCatId })))
      console.log('Looking for packageType:', effectivePackageType)

      // Find the package by ID, yocoId, or revenueCatId (works for both database and Yoco packages)
      // Use case-insensitive comparison for package lookup
      // Priority: id > yocoId > revenueCatId
      pkg = allPackages.find((p: any) => {
        const code = effectivePackageType.toLowerCase()
        return (
          p.id?.toString().toLowerCase() === code ||
          p.id === effectivePackageType ||
          (p.yocoId && p.yocoId.toString().toLowerCase() === code) ||
          (p.yocoId && p.yocoId === effectivePackageType) ||
          (p.revenueCatId && p.revenueCatId.toString().toLowerCase() === code) ||
          (p.revenueCatId && p.revenueCatId === effectivePackageType)
        )
      })
      
      if (pkg) {
        const matchedBy = 
          pkg.id === rawPackageType ? 'id' :
          (pkg as any).yocoId === rawPackageType ? 'yocoId' :
          pkg.revenueCatId === rawPackageType ? 'revenueCatId' :
          'case-insensitive'
        
        console.log('Found package:', {
          id: pkg.id,
          name: pkg.name,
          source: pkg.source,
          yocoId: (pkg as any).yocoId,
          revenueCatId: pkg.revenueCatId,
          packageType: effectivePackageType,
          matchedBy
        })
        multiplier = pkg.multiplier || 1
        baseRate = pkg.baseRate || 150
        
        // Check if there's a custom name in package settings
        if (postData?.packageSettings) {
          const packageSetting = postData.packageSettings.find((setting: any) => {
            const settingPackageId = typeof setting.package === 'object' ? setting.package.id : setting.package
            return settingPackageId === pkg.id
          })
          if (packageSetting?.customName) {
            customName = packageSetting.customName
          }
        }
      }
    } catch (error) {
      console.error('Error fetching packages:', error)
      // Continue with default values
    }

    // If not found, try database lookup by ID
    if (!pkg) {
      try {
        const packageResult = await payload.findByID({
          collection: 'packages',
          id: effectivePackageType,
        })
        
        if (packageResult && packageResult.post === postId) {
          pkg = {
            ...packageResult,
            source: 'database'
          }
          if (pkg) {
            multiplier = typeof pkg.multiplier === 'number' ? pkg.multiplier : 1
            baseRate = typeof pkg.baseRate === 'number' ? pkg.baseRate : (postData?.baseRate || 150)
            
            // Check for custom name in packageSettings
            if (postData?.packageSettings && Array.isArray(postData.packageSettings)) {
              const packageSetting = postData.packageSettings.find((setting: any) => {
                const pkgId = typeof setting.package === 'object' ? setting.package.id : setting.package
                return pkgId === pkg.id
              })
              if (packageSetting?.customName) {
                customName = packageSetting.customName
                console.log('Found custom name for package:', customName)
              }
            }
            
            console.log('Found package by ID in database:', customName || pkg.name)
          }
        }
      } catch (error) {
        console.log('Package not found by ID in database')
      }
    }

    // If not found by ID, try to find by name in database
    if (!pkg) {
      const packageResult = await payload.find({
        collection: 'packages',
        where: {
          post: { equals: postId },
          name: { equals: effectivePackageType },
          isEnabled: { equals: true }
        },
        limit: 1,
      })
      
      if (packageResult.docs.length > 0) {
        pkg = {
          ...packageResult.docs[0],
          source: 'database'
        }
        if (pkg) {
          multiplier = typeof pkg.multiplier === 'number' ? pkg.multiplier : 1
          baseRate = typeof pkg.baseRate === 'number' ? pkg.baseRate : (postData?.baseRate || 150)
          
          // Check for custom name in packageSettings
          if (postData?.packageSettings && Array.isArray(postData.packageSettings)) {
            const packageSetting = postData.packageSettings.find((setting: any) => {
              const pkgId = typeof setting.package === 'object' ? setting.package.id : setting.package
              return pkgId === pkg.id
            })
            if (packageSetting?.customName) {
              customName = packageSetting.customName
              console.log('Found custom name for package:', customName)
            }
          }
          
          console.log('Found package by name in database:', customName || pkg.name)
        }
      }
    }

    // If still not found, check Yoco products directly
    if (!pkg) {
      try {
        const yocoProducts = await yocoService.getProducts()
        const yocoProduct = yocoProducts.find(product => 
          product.id.toLowerCase() === effectivePackageType.toLowerCase() || 
          product.id === effectivePackageType
        )
        
        if (yocoProduct) {
          pkg = {
            id: yocoProduct.id,
            name: yocoProduct.title,
            description: yocoProduct.description,
            multiplier: 1, // Default multiplier for Yoco products
            baseRate: yocoProduct.price,
            category: yocoProduct.category,
            minNights: yocoProduct.period === 'hour' ? 1 : yocoProduct.periodCount,
            maxNights: yocoProduct.period === 'hour' ? 1 : yocoProduct.periodCount,
            revenueCatId: yocoProduct.id, // Keep for backward compatibility
            yocoId: yocoProduct.id, // Primary identifier
            isEnabled: yocoProduct.isEnabled && isPackageEnabledForPost(yocoProduct.id),
            features: yocoProduct.features,
            source: 'yoco'
          }
          multiplier = pkg.multiplier
          baseRate = pkg.baseRate
          
          // Check for custom name in packageSettings for Yoco products too
          if (postData?.packageSettings && Array.isArray(postData.packageSettings)) {
            const packageSetting = postData.packageSettings.find((setting: any) => {
              const pkgId = typeof setting.package === 'object' ? setting.package.id : setting.package
              return pkgId === pkg.id
            })
            if (packageSetting?.customName) {
              customName = packageSetting.customName
              console.log('Found custom name for Yoco package:', customName)
            }
          }
          
          console.log('Found Yoco product:', customName || pkg.name)
        }
      } catch (error) {
        console.error('Error fetching Yoco products:', error)
      }
    }

    // Final fallback: Try direct database lookup by ID without post/enabled filters
    // This ensures packages can be found even if filtered out by packageSettings
    // This is important for non-subscribers who can see special/hosted packages
    if (!pkg) {
      try {
        const directPackageResult = await payload.findByID({
          collection: 'packages',
          id: effectivePackageType,
        })
        
        if (directPackageResult) {
          const packagePostId = typeof directPackageResult.post === 'string' 
            ? directPackageResult.post 
            : directPackageResult.post?.id
          
          // Allow if post matches OR if we're updating an existing estimate
          // This allows packages to be found even if they're filtered elsewhere
          if (!postId || packagePostId === postId || existingEstimate) {
            pkg = {
              ...directPackageResult,
              source: 'database'
            }
            multiplier = typeof pkg.multiplier === 'number' ? pkg.multiplier : 1
            baseRate = typeof pkg.baseRate === 'number' ? pkg.baseRate : (postData?.baseRate || 150)
            
            // Check for custom name in packageSettings
            if (postData?.packageSettings && Array.isArray(postData.packageSettings)) {
              const packageSetting = postData.packageSettings.find((setting: any) => {
                const pkgId = typeof setting.package === 'object' ? setting.package.id : setting.package
                return pkgId === pkg.id
              })
              if (packageSetting?.customName) {
                customName = packageSetting.customName
              }
            }
            
            console.log('Found package by direct ID lookup (fallback):', pkg.name)
          }
        }
      } catch (error) {
        console.log('Direct package lookup failed:', error)
      }
    }

    // If package not found but we have existing estimate with package info, preserve it
    if (!pkg && existingEstimate) {
      console.log('Package not found, but preserving existing package info from estimate')
      // Use existing package information
      if (existingEstimate.selectedPackage && typeof existingEstimate.selectedPackage.package === 'object') {
        pkg = {
          id: existingEstimate.selectedPackage.package.id,
          name: existingEstimate.selectedPackage.customName || existingEstimate.selectedPackage.package.name,
          description: existingEstimate.selectedPackage.package.description,
          multiplier: existingEstimate.selectedPackage.package.multiplier || 1,
          baseRate: existingEstimate.selectedPackage.package.baseRate,
          source: 'database'
        }
        customName = existingEstimate.selectedPackage.customName || null
      } else if (existingEstimate.packageType) {
        // Fallback: use packageType as identifier
        pkg = {
          id: existingEstimate.packageType,
          name: existingEstimate.packageType,
          multiplier: 1,
          baseRate: postData?.baseRate || 150,
          source: 'unknown'
        }
      }
    }

    if (!pkg) {
      console.error('Package not found:', { packageType: effectivePackageType, postId, estimateId })
      return NextResponse.json({ 
        error: 'Package not found', 
        details: `Package ${effectivePackageType} not found in database or Yoco products for post ${postId}` 
      }, { status: 400 })
    }

    // Enforce entitlement server-side so protected package tiers are not selectable by non-entitled users.
    const now = new Date()
    const transactions = await payload.find({
      collection: 'yoco-transactions',
      where: {
        and: [
          { user: { equals: user.id } },
          { status: { equals: 'completed' } },
          { intent: { equals: 'subscription' } },
        ],
      },
      sort: '-completedAt',
      limit: 10,
    })
    const activeTransaction = transactions.docs.find((tx: any) => {
      if (!tx) return false
      if (!tx.expiresAt) return true
      return new Date(tx.expiresAt) > now
    })
    const subscriptionStatus = {
      isSubscribed: Boolean(activeTransaction),
      entitlements: activeTransaction?.entitlement ? [activeTransaction.entitlement] : [],
      expirationDate: activeTransaction?.expiresAt ? new Date(activeTransaction.expiresAt) : null,
      isLoading: false,
      error: null,
    }
    const customerEntitlement = getCustomerEntitlement(subscriptionStatus)
    const normalizedCategory = String((pkg as any).category || '').trim().toLowerCase()

    const isPackageAllowedForEntitlement = (entitlement: CustomerEntitlement): boolean => {
      if (entitlement === 'pro') return true
      if (entitlement === 'standard') {
        return ['standard', 'hosted', 'special'].includes(normalizedCategory)
      }
      return ['hosted', 'special'].includes(normalizedCategory)
    }

    if (!isPackageAllowedForEntitlement(customerEntitlement)) {
      return NextResponse.json(
        {
          error: 'Package requires a higher entitlement',
          details: `Package category '${normalizedCategory || 'unknown'}' is not available for '${customerEntitlement}' users`,
        },
        { status: 403 },
      )
    }

    const duration = fromDate && toDate
      ? Math.max(1, Math.ceil((new Date(toDate).getTime() - new Date(fromDate).getTime()) / (1000 * 60 * 60 * 24)))
      : 1
    const calculatedTotal = total !== undefined ? Number(total) : baseRate * duration * multiplier

    // Use custom name if available, otherwise fall back to package name
    // For packageType, ALWAYS use package ID (most reliable, unambiguous identifier)
    // Package ID is unique and avoids conflicts when multiple packages share the same yocoId/revenueCatId
    const packageTypeId = pkg.id // Always use package ID
    const displayName = customName || pkg.name || pkg.id
    // Use package ID as canonical identifier (not yocoId/revenueCatId which can be duplicated)
    const canonicalPackageType = pkg.id

    // Check for existing estimate - prioritize estimateId if provided, otherwise match by customer/post
    let estimateToUpdate: any = null
    
    if (estimateId && existingEstimate) {
      // Use the existing estimate found by ID
      estimateToUpdate = existingEstimate
    } else {
      // First try to find by dates (for exact matches)
      const existingByDates = await payload.find({
        collection: 'estimates',
        where: {
          post: { equals: postId },
          customer: { equals: user.id },
          fromDate: { equals: fromDate },
          toDate: { equals: toDate },
        },
        limit: 1,
      })
      if (existingByDates.docs.length && existingByDates.docs[0]) {
        estimateToUpdate = existingByDates.docs[0]
      } else {
        // If not found by dates, try to find by customer/post (for date updates)
        // Get the most recent estimate for this customer/post
        const existingByPost = await payload.find({
          collection: 'estimates',
          where: {
            post: { equals: postId },
            customer: { equals: user.id },
            paymentStatus: { not_equals: 'paid' }, // Only update unpaid estimates
          },
          sort: '-createdAt',
          limit: 1,
        })
        if (existingByPost.docs.length && existingByPost.docs[0]) {
          estimateToUpdate = existingByPost.docs[0]
          console.log('Found existing estimate by customer/post for date update:', estimateToUpdate.id)
        }
      }
    }

    let estimate: any
    if (estimateToUpdate) {
      // Update existing estimate
      const updateData: any = {
        total: calculatedTotal,
        guests: guests !== undefined ? guests : estimateToUpdate.guests,
        fromDate,
        toDate,
        customer: user.id,
        packageType: canonicalPackageType,
      }

      // Preserve or update selectedPackage
      if (pkg.source === 'database') {
        console.log('Adding/updating selectedPackage relationship for database package:', pkg.id)
        updateData.selectedPackage = {
          package: pkg.id,
          customName: displayName,
          enabled: true
        }
      } else if (pkg.source === 'yoco') {
        // For Yoco packages, preserve existing selectedPackage if it exists, or create minimal one
        if (estimateToUpdate.selectedPackage) {
          // Keep existing selectedPackage but update customName if we have one
          updateData.selectedPackage = {
            ...estimateToUpdate.selectedPackage,
            customName: displayName || estimateToUpdate.selectedPackage.customName,
          }
        } else {
          // Create minimal selectedPackage for Yoco product
          updateData.selectedPackage = {
            enabled: true,
            customName: displayName,
          }
        }
        console.log('Preserving/updating selectedPackage for Yoco package:', pkg.id)
      } else {
        // Unknown source - preserve existing if available
        if (estimateToUpdate.selectedPackage) {
          updateData.selectedPackage = estimateToUpdate.selectedPackage
        }
        console.log('Preserving existing selectedPackage for unknown source package')
      }

      estimate = await payload.update({
        collection: 'estimates',
        id: estimateToUpdate.id,
        data: updateData,
        user: user
      })
    } else {
      // Create
      const createData: any = {
        title: title || `Estimate for ${postId}`,
        post: postId,
        fromDate,
        toDate,
        guests,
        total: calculatedTotal,
        customer: user.id,
        packageType: canonicalPackageType,
      }

      // Only add selectedPackage if it's a database package (has valid ObjectId)
      if (pkg.source === 'database') {
        console.log('Adding selectedPackage relationship for database package:', pkg.id)
        createData.selectedPackage = {
          package: pkg.id,
          customName: displayName,
          enabled: true
        }
      } else {
        console.log('Skipping selectedPackage relationship for Yoco package:', pkg.id, 'source:', pkg.source)
      }

      estimate = await payload.create({
        collection: 'estimates',
        data: createData,
        user: user
      })
    }

    const responseEstimate = {
      ...estimate,
      packageLabel: displayName, // Include display name (custom name or package name) for frontend
    }

    return NextResponse.json(responseEstimate, { status: estimateToUpdate ? 200 : 201 })
  } catch (err) {
    console.error('Estimate creation error:', err)
    return NextResponse.json({ error: (err instanceof Error ? err.message : 'Unknown error') }, { status: 500 })
  }
}