import { NextRequest, NextResponse } from 'next/server'
import { getPayload } from 'payload'
import configPromise from '@payload-config'

export async function GET(req: NextRequest) {
  try {
    const payload = await getPayload({ config: configPromise })
    const { searchParams } = new URL(req.url)
    
    // Build query parameters
    const where: any = {}
    const limit = parseInt(searchParams.get('limit') || '50')
    const depth = parseInt(searchParams.get('depth') || '1')
    
    // Handle status filter
    const status = searchParams.get('where[_status][equals]')
    if (status) {
      where._status = { equals: status }
    }
    
    // Handle other filters if needed
    searchParams.forEach((value, key) => {
      if (key.startsWith('where[') && key !== 'where[_status][equals]') {
        // Parse complex where conditions if needed
        console.log('Additional filter:', key, value)
      }
    })
    
    const posts = await payload.find({
      collection: 'posts',
      where,
      limit,
      depth,
    })

    return NextResponse.json(posts)
  } catch (error: any) {
    console.error('Error fetching posts:', error)
    return NextResponse.json(
      { error: error.message || 'Failed to fetch posts' },
      { status: 500 }
    )
  }
}

export async function POST(req: NextRequest) {
  try {
    const payload = await getPayload({ config: configPromise })
    
    // Get the authenticated user from the request
    const { user } = await payload.auth({ headers: req.headers })
    
    if (!user) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      )
    }

    // Check if user has permission to create posts
    const userRoles = user.role || []
    if (!userRoles.includes('admin') && !userRoles.includes('customer') && !userRoles.includes('host')) {
      return NextResponse.json(
        { error: 'Insufficient permissions' },
        { status: 403 }
      )
    }

    let body: any
    const contentType = req.headers.get('content-type') || ''
    
    try {
      if (contentType.includes('application/json')) {
        // Handle JSON requests
        body = await req.json()
      } else if (contentType.includes('application/x-www-form-urlencoded') || contentType.includes('multipart/form-data')) {
        // Handle form data requests (Payload admin interface uses this)
        const formData = await req.formData()
        body = {} as any
        
        // Convert FormData to regular object
        for (const [key, value] of formData.entries()) {
          if (key === '_payload') {
            // Payload admin interface sends data as JSON string in _payload field
            try {
              const payloadData = JSON.parse(value as string)
              body = { ...body, ...payloadData }
            } catch (parseError) {
              console.error('Failed to parse _payload JSON:', parseError)
              body[key] = value
            }
          } else if (key.includes('[') && key.includes(']')) {
            // Handle nested form fields like "meta[title]"
            const match = key.match(/^(\w+)\[(\w+)\]$/)
            if (match && match.length >= 3) {
              const parentKey = match[1]
              const childKey = match[2]
              if (parentKey && childKey) {
                if (!body[parentKey]) body[parentKey] = {}
                body[parentKey][childKey] = value
              }
            } else {
              body[key] = value
            }
          } else {
            body[key] = value
          }
        }
      } else {
        // Try to parse as JSON as fallback
        body = await req.json()
      }
    } catch (jsonError) {
      console.error('Request parsing error:', jsonError)
      console.error('Content-Type:', contentType)
      console.error('Request URL:', req.url)
      return NextResponse.json(
        { error: 'Invalid request body format' },
        { status: 400 }
      )
    }

    // Log the request details for debugging admin interface calls
    console.log('POST /api/posts request details:')
    console.log('Content-Type:', contentType)
    console.log('Request body:', JSON.stringify(body, null, 2))
    console.log('User:', { id: '[REDACTED]', role: user.role })

    // Check if this is a query/search request from admin interface
    if (body.where || body.limit || body.depth || body.sort || body.page) {
      console.log('Detected admin interface query request, redirecting to find operation')
      
      // This is likely a query request from the admin interface
      // Convert it to a find operation instead of create
      const findOptions: any = {
        collection: 'posts',
        where: body.where || {},
        limit: body.limit || 50,
        depth: body.depth || 1,
      }
      
      if (body.sort) findOptions.sort = body.sort
      if (body.page) findOptions.page = body.page
      
      const result = await payload.find(findOptions)
      return NextResponse.json(result)
    }

    // Validate and clean the data
    const cleanData: any = {
      title: String(body.title || '').trim(),
      authors: body.authors || [user.id],
      _status: body._status || body.status || 'draft', // Handle both field names
    }

    // Validate required fields - but only for actual post creation
    if (!cleanData.title) {
      console.log('No title provided, checking if this is an admin interface request')
      
      // If there's no title but other admin-like parameters, treat as query
      if (Object.keys(body).length === 0 || 
          (Object.keys(body).length === 1 && body.depth !== undefined) ||
          body.fallbackLocale !== undefined) {
        console.log('Treating as admin query request')
        
        // Return a basic find operation for admin interface
        const result = await payload.find({
          collection: 'posts',
          limit: 50,
          depth: 1,
        })
        return NextResponse.json(result)
      }
      
      return NextResponse.json(
        { error: 'Title is required for post creation' },
        { status: 400 }
      )
    }

    // Handle content properly - convert simple text to Lexical structure if needed
    if (body.content) {
      if (typeof body.content === 'string') {
        // Convert simple text to Lexical format
        cleanData.content = {
          root: {
            type: "root",
            children: [
              {
                type: "paragraph",
                children: [
                  {
                    type: "text",
                    text: body.content
                  }
                ]
              }
            ],
            direction: null,
            format: '',
            indent: 0,
            version: 1
          }
        }
      } else if (body.content.root) {
        // Already in Lexical format, but ensure all nodes have proper types
        const ensureNodeTypes = (node: any): any => {
          if (typeof node === 'object' && node !== null) {
            // Ensure text nodes have type
            if (node.text !== undefined && !node.type) {
              node.type = "text"
            }
            // Recursively process children
            if (Array.isArray(node.children)) {
              node.children = node.children.map(ensureNodeTypes)
            }
          }
          return node
        }
        
        cleanData.content = {
          root: ensureNodeTypes(body.content.root)
        }
      } else if (Array.isArray(body.content)) {
        // Convert array format to Lexical
        cleanData.content = {
          root: {
            type: "root",
            children: body.content.map((item: any) => ({
              type: item.type || "paragraph",
              children: item.children ? item.children.map((child: any) => ({
                type: child.type || "text",
                text: child.text || '',
                ...child
              })) : [{ type: "text", text: item.text || '' }],
              direction: item.direction || 'ltr',
              format: item.format || '',
              indent: item.indent || 0,
              version: item.version || 1
            })),
            direction: null,
            format: '',
            indent: 0,
            version: 1
          }
        }
      }
    }

    // Handle categories safely
    if (body.categories && Array.isArray(body.categories)) {
      cleanData.categories = body.categories.filter((cat: any) => 
        cat && typeof cat === 'string' && cat.trim() !== ''
      )
    }

    // Handle hero image
    if (body.heroImage && typeof body.heroImage === 'string') {
      cleanData.heroImage = body.heroImage
    }

    // Handle baseRate safely
    if (body.baseRate !== undefined) {
      if (body.baseRate === null || body.baseRate === '') {
        cleanData.baseRate = null
      } else {
        const baseRateNum = Number(body.baseRate)
        if (!isNaN(baseRateNum) && baseRateNum >= 0) {
          cleanData.baseRate = baseRateNum
        }
      }
    }

    // Handle packageTypes safely
    if (body.packageTypes !== undefined && Array.isArray(body.packageTypes)) {
      console.log('=== PACKAGE TYPES PROCESSING ===')
      console.log('Raw body.packageTypes received:', JSON.stringify(body.packageTypes, null, 2))
      console.log('Post baseRate:', cleanData.baseRate)
      
      cleanData.packageTypes = body.packageTypes
        .filter((pkg: any) => {
          const isValid = pkg && typeof pkg === 'object' && pkg.name
          console.log(`Package "${pkg?.name}" validation:`, isValid)
          return isValid
        })
        .map((pkg: any) => {
          // Use post's baseRate if package price is empty/undefined
          const packagePrice = (pkg.price !== undefined && pkg.price !== null && pkg.price !== '') 
            ? Number(pkg.price) 
            : (cleanData.baseRate || 150) // Fallback to baseRate or 150 if no baseRate
          
          const processedPkg = {
            name: String(pkg.name || '').trim(),
            description: String(pkg.description || '').trim(),
            price: packagePrice,
            multiplier: Number(pkg.multiplier) || 1,
            features: Array.isArray(pkg.features) 
              ? pkg.features.map((f: any) => {
                  // Handle both string format and object format
                  if (typeof f === 'string') {
                    return { feature: f.trim() }
                  } else if (f && typeof f === 'object' && f.feature) {
                    return { feature: String(f.feature).trim() }
                  }
                  return null
                }).filter(Boolean)
              : [],
            revenueCatId: String(pkg.revenueCatId || '').trim(),
            category: pkg.category || 'standard',
            isHosted: Boolean(pkg.isHosted),
          }
          console.log(`Processed package "${pkg.name}":`, JSON.stringify(processedPkg, null, 2))
          return processedPkg
        })
        .filter((pkg: any) => {
          const isValidFinal = pkg.name && pkg.price >= 0
          console.log(`Final validation for "${pkg.name}":`, isValidFinal)
          return isValidFinal
        })
        
      console.log('Final cleanData.packageTypes:', JSON.stringify(cleanData.packageTypes, null, 2))
      console.log('=== END PACKAGE TYPES PROCESSING ===')
    } else {
      console.log('No packageTypes in body or not an array:', typeof body.packageTypes, body.packageTypes)
    }

    // Handle meta fields safely
    if (body.meta && typeof body.meta === 'object') {
      cleanData.meta = {}
      if (body.meta.title && typeof body.meta.title === 'string') {
        cleanData.meta.title = body.meta.title.trim()
      }
      if (body.meta.description && typeof body.meta.description === 'string') {
        cleanData.meta.description = body.meta.description.trim()
      }
      if (body.meta.image && typeof body.meta.image === 'string') {
        cleanData.meta.image = body.meta.image
      }
    }

    // Handle publishedAt
    if (body.publishedAt) {
      try {
        cleanData.publishedAt = new Date(body.publishedAt).toISOString()
      } catch (dateError) {
        console.warn('Invalid publishedAt date:', body.publishedAt)
      }
    } else if (cleanData._status === 'published') {
      cleanData.publishedAt = new Date().toISOString()
    }

    console.log('Creating post with clean data:', JSON.stringify(cleanData, null, 2))

    const post = await payload.create({
      collection: 'posts',
      data: cleanData,
      user,
    })

    return NextResponse.json({ 
      message: 'Post created successfully',
      doc: post 
    })
  } catch (error: any) {
    console.error('Error creating post:', error)
    
    // Provide more specific error messages
    if (error.message?.includes('validation')) {
      return NextResponse.json(
        { error: 'Validation error: ' + error.message },
        { status: 400 }
      )
    }
    
    if (error.message?.includes('duplicate')) {
      return NextResponse.json(
        { error: 'A post with this title already exists' },
        { status: 409 }
      )
    }

    return NextResponse.json(
      { error: error.message || 'Failed to create post' },
      { status: 500 }
    )
  }
}

export async function DELETE(req: NextRequest) {
  try {
    const payload = await getPayload({ config: configPromise })
    
    // Get the authenticated user from the request
    const { user } = await payload.auth({ headers: req.headers })
    
    if (!user) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      )
    }

    // Check if user has permission to delete posts
    const userRoles = user.role || []
    if (!userRoles.includes('admin') && !userRoles.includes('customer') && !userRoles.includes('host')) {
      return NextResponse.json(
        { error: 'Insufficient permissions' },
        { status: 403 }
      )
    }

    const { searchParams } = new URL(req.url)
    
    // Get the post IDs from query parameters
    // The admin interface sends them as where[id][in][0], where[id][in][1], etc.
    const postIds: string[] = []
    
    // Parse the query parameters to extract post IDs
    searchParams.forEach((value, key) => {
      if (key.match(/where\[id\]\[in\]\[\d+\]/)) {
        postIds.push(value)
      }
    })

    if (postIds.length === 0) {
      return NextResponse.json(
        { error: 'No post IDs provided for deletion' },
        { status: 400 }
      )
    }

    console.log('Bulk deleting posts:', postIds)

    // Delete each post individually
    const deletionResults = []
    for (const postId of postIds) {
      try {
        await payload.delete({
          collection: 'posts',
          id: postId,
          user,
        })
        deletionResults.push({ id: postId, success: true })
      } catch (error) {
        console.error(`Failed to delete post ${postId}:`, error)
        deletionResults.push({ 
          id: postId, 
          success: false, 
          error: error instanceof Error ? error.message : 'Unknown error' 
        })
      }
    }

    const successCount = deletionResults.filter(r => r.success).length
    const failureCount = deletionResults.filter(r => !r.success).length

    return NextResponse.json({ 
      message: `Deleted ${successCount} posts successfully${failureCount > 0 ? `, ${failureCount} failed` : ''}`,
      results: deletionResults
    })
  } catch (error: any) {
    console.error('Error in bulk delete:', error)
    return NextResponse.json(
      { error: error.message || 'Failed to delete posts' },
      { status: 500 }
    )
  }
}

export async function PATCH(req: NextRequest) {
  try {
    const payload = await getPayload({ config: configPromise })
    
    // Get the authenticated user from the request
    const { user } = await payload.auth({ headers: req.headers })
    
    if (!user) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      )
    }

    // Check if user has permission to update posts
    const userRoles = user.role || []
    if (!userRoles.includes('admin') && !userRoles.includes('customer') && !userRoles.includes('host')) {
      return NextResponse.json(
        { error: 'Insufficient permissions' },
        { status: 403 }
      )
    }

    const { searchParams } = new URL(req.url)
    
    // Parse the request body
    let body: any
    try {
      body = await req.json()
    } catch (error) {
      console.log('No JSON body, treating as query-based update')
      body = {}
    }

    // Get the post IDs from query parameters
    const postIds: string[] = []
    
    // Parse the query parameters to extract post IDs
    searchParams.forEach((value, key) => {
      if (key.match(/where\[.*\]\[id\]\[in\]\[\d+\]/)) {
        postIds.push(value)
      }
    })

    // Check if this is a draft operation
    const isDraft = searchParams.get('draft') === 'true'

    if (postIds.length === 0) {
      return NextResponse.json(
        { error: 'No post IDs provided for update' },
        { status: 400 }
      )
    }

    console.log('Bulk updating posts:', postIds, 'isDraft:', isDraft)

    // Update each post individually
    const updateResults = []
    for (const postId of postIds) {
      try {
        // For draft operations, we typically just need to save the current state
        const updateData: any = {}
        
        // If there's body data, include it
        if (Object.keys(body).length > 0) {
          Object.assign(updateData, body)
        }

        // Handle draft-specific logic
        if (isDraft) {
          // For drafts, we might want to preserve the current status
          // The admin interface handles draft saving automatically
        }

        const updatedPost = await payload.update({
          collection: 'posts',
          id: postId,
          data: updateData,
          user,
          draft: isDraft,
        })

        updateResults.push({ 
          id: postId, 
          success: true,
          doc: updatedPost
        })
      } catch (error) {
        console.error(`Failed to update post ${postId}:`, error)
        updateResults.push({ 
          id: postId, 
          success: false, 
          error: error instanceof Error ? error.message : 'Unknown error' 
        })
      }
    }

    const successCount = updateResults.filter(r => r.success).length
    const failureCount = updateResults.filter(r => !r.success).length

    return NextResponse.json({ 
      message: `Updated ${successCount} posts successfully${failureCount > 0 ? `, ${failureCount} failed` : ''}`,
      results: updateResults,
      docs: updateResults.filter(r => r.success).map(r => r.doc)
    })
  } catch (error: any) {
    console.error('Error in bulk update:', error)
    return NextResponse.json(
      { error: error.message || 'Failed to update posts' },
      { status: 500 }
    )
  }
} 