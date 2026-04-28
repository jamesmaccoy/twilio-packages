import { NextRequest, NextResponse } from 'next/server'
import { getPayload } from 'payload'
import configPromise from '@/payload.config'
import { sendPackageActivityNotification } from '@/lib/emailNotifications'

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    
    const payload = await getPayload({ config: configPromise })
    
    // Get depth from query params, default to 2
    const searchParams = new URL(request.url).searchParams
    const depth = parseInt(searchParams.get('depth') || '2', 10)
    
    // Check authentication
    let user = null
    try {
      const authResult = await payload.auth({ headers: request.headers })
      user = authResult.user
    } catch (authError) {
      // User not authenticated
      return NextResponse.json(
        { error: 'Unauthorized. Please log in to access packages.' },
        { status: 401 }
      )
    }
    
    if (!user) {
      return NextResponse.json(
        { error: 'Unauthorized. Please log in to access packages.' },
        { status: 401 }
      )
    }
    
    // Fetch the package
    const packageDoc = await payload.findByID({
      collection: 'packages',
      id: id,
      depth: depth,
      user, // Pass user for access control
    })
    
    if (!packageDoc) {
      return NextResponse.json({ error: 'Package not found' }, { status: 404 })
    }
    
    return NextResponse.json(packageDoc)
  } catch (error) {
    console.error('Error fetching package:', error)
    return NextResponse.json(
      { error: 'Failed to fetch package', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    )
  }
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const payload = await getPayload({ config: configPromise })
    let user: any = null
    try {
      const authResult = await payload.auth({ headers: request.headers })
      user = authResult.user
    } catch {
      user = null
    }
    
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    
    // Parse request body - handle both JSON and form data
    let body: any
    const contentType = request.headers.get('content-type') || ''
    
    try {
      if (contentType.includes('multipart/form-data')) {
        // Handle multipart/form-data (Payload CMS form submissions)
        const formData = await request.formData()
        const payloadField = formData.get('_payload')
        
        if (!payloadField) {
          return NextResponse.json(
            { error: 'Missing _payload field in form data' },
            { status: 400 }
          )
        }
        
        // Parse the JSON from the _payload field
        try {
          body = typeof payloadField === 'string' 
            ? JSON.parse(payloadField) 
            : JSON.parse(payloadField.toString())
        } catch (parseError) {
          console.error('JSON parse error from _payload:', parseError)
          return NextResponse.json(
            { error: 'Invalid JSON in _payload field', details: parseError instanceof Error ? parseError.message : 'Unknown error' },
            { status: 400 }
          )
        }
      } else if (contentType.includes('application/json')) {
        // Handle JSON requests
        const requestText = await request.text()
        if (!requestText || requestText.trim() === '') {
          return NextResponse.json(
            { error: 'Request body is empty' },
            { status: 400 }
          )
        }
        body = JSON.parse(requestText)
      } else if (contentType.includes('application/x-www-form-urlencoded')) {
        // Handle URL-encoded form data
        const formData = await request.formData()
        body = {} as any
        
        // Convert FormData to regular object
        for (const [key, value] of formData.entries()) {
          if (key.includes('[') && key.includes(']')) {
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
        const requestText = await request.text()
        if (!requestText || requestText.trim() === '') {
          return NextResponse.json(
            { error: 'Request body is empty' },
            { status: 400 }
          )
        }
        body = JSON.parse(requestText)
      }
    } catch (parseError) {
      console.error('Request parse error:', parseError)
      console.error('Content-Type:', contentType)
      return NextResponse.json(
        { 
          error: 'Invalid request body format', 
          details: parseError instanceof Error ? parseError.message : 'Unknown parse error' 
        },
        { status: 400 }
      )
    }

    // Payload admin form state sometimes arrives as `{ state: { field: { value, initialValue, ... }}}`
    if (body?.state && typeof body.state === 'object' && !Array.isArray(body.state)) {
      const stateObj = body.state as Record<string, any>
      for (const [key, fieldState] of Object.entries(stateObj)) {
        if (fieldState && typeof fieldState === 'object' && 'value' in fieldState) {
          ;(body as any)[key] = (fieldState as any).value
        }
      }
      delete body.state
    }

    // Normalize common Payload admin field shapes: { value: ... }
    const normalizeValue = (v: any) => (v && typeof v === 'object' && 'value' in v ? (v as any).value : v)
    body = {
      ...body,
      post: normalizeValue(body.post),
      name: normalizeValue(body.name),
      isEnabled: normalizeValue(body.isEnabled),
    }
    
    // Validate and sanitize the data
    const cleanData: any = {}
    
    // Handle post field - if it's a slug or title, look up the ID
    if (body.post !== undefined) {
      if (typeof body.post === 'string') {
        // Check if it's already an ID (MongoDB ObjectId format)
        if (/^[0-9a-fA-F]{24}$/.test(body.post)) {
          cleanData.post = body.post
        } else {
          // It's likely a slug or title, try to find the post
          try {
            // First try by slug
            let posts = await payload.find({
              collection: 'posts',
              where: {
                slug: {
                  equals: body.post,
                },
              },
              limit: 1,
            })
            
            // If not found by slug, try by title (case-insensitive, partial match)
            if (posts.docs.length === 0) {
              posts = await payload.find({
                collection: 'posts',
                where: {
                  title: {
                    contains: body.post,
                  },
                },
                limit: 1,
              })
            }
            
            if (posts.docs.length > 0 && posts.docs[0]) {
              const foundPost = posts.docs[0]
              cleanData.post = foundPost.id
              console.log(`Found post "${foundPost.title}" (${foundPost.id}) for query "${body.post}"`)
            } else {
              return NextResponse.json(
                { error: `Post with slug or title "${body.post}" not found` },
                { status: 404 }
              )
            }
          } catch (postError) {
            console.error('Error looking up post:', postError)
            return NextResponse.json(
              { error: 'Failed to look up post', details: postError instanceof Error ? postError.message : 'Unknown error' },
              { status: 500 }
            )
          }
        }
      } else if (typeof body.post === 'object' && body.post?.id) {
        cleanData.post = body.post.id
      } else if (body.post === null) {
        // Allow null to clear the post field
        return NextResponse.json(
          { error: 'Post field is required and cannot be null' },
          { status: 400 }
        )
      } else {
        return NextResponse.json(
          { error: 'Invalid post field format. Expected string ID, slug, or title; or object with id property.' },
          { status: 400 }
        )
      }
    }
    
    // Copy other fields that are safe to update
    const allowedFields = [
      'name',
      'description',
      'multiplier',
      'category',
      'entitlement',
      'minNights',
      'maxNights',
      'maxConcurrentBookings',
      'baseRate',
      'isEnabled',
      'revenueCatId',
      'yocoId',
      'relatedPage',
      'features',
    ]
    
    for (const field of allowedFields) {
      if (body[field] !== undefined) {
        cleanData[field] = normalizeValue(body[field])
      }
    }
    
    console.log('Updating package with clean data:', JSON.stringify(cleanData, null, 2))
    
    const updated = await payload.update({
      collection: 'packages',
      id,
      data: cleanData,
      user,
    })

    try {
      const actorEmail = typeof (user as any)?.email === 'string' ? ((user as any).email as string) : ''
      const postId =
        typeof (updated as any)?.post === 'string' ? (updated as any).post : (updated as any)?.post?.id
      const propertyTitle =
        typeof (updated as any)?.post === 'object' && typeof (updated as any)?.post?.title === 'string'
          ? (updated as any).post.title
          : undefined
      if (actorEmail) {
        await sendPackageActivityNotification({
          actorEmail,
          action: 'updated',
          packageId: String((updated as any).id),
          packageName: String((updated as any).name || 'Package'),
          postId: postId ? String(postId) : undefined,
          propertyTitle,
          threadSubject: `Package activity: ${String((updated as any).name || 'Package')}${propertyTitle ? ` (${propertyTitle})` : ''}`,
        })
      }
    } catch (emailErr) {
      console.warn('Package activity email failed (non-fatal):', emailErr)
    }
    
    return NextResponse.json(updated)
  } catch (error) {
    console.error('Error updating package:', error)
    const errAny = error as any
    const status =
      typeof errAny?.status === 'number'
        ? errAny.status
        : typeof errAny?.httpStatus === 'number'
          ? errAny.httpStatus
          : 500
    const details =
      errAny?.data ||
      errAny?.errors ||
      (errAny instanceof Error ? errAny.message : undefined)
    return NextResponse.json(
      { error: 'Failed to update package', details },
      { status }
    )
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const payload = await getPayload({ config: configPromise })
    const { user } = await payload.auth({ headers: request.headers })
    
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    
    const deleted = await payload.delete({
      collection: 'packages',
      id,
      user,
    })

    try {
      const actorEmail = typeof (user as any)?.email === 'string' ? ((user as any).email as string) : ''
      const postId =
        typeof (deleted as any)?.post === 'string' ? (deleted as any).post : (deleted as any)?.post?.id
      const propertyTitle =
        typeof (deleted as any)?.post === 'object' && typeof (deleted as any)?.post?.title === 'string'
          ? (deleted as any).post.title
          : undefined
      if (actorEmail) {
        await sendPackageActivityNotification({
          actorEmail,
          action: 'deleted',
          packageId: String((deleted as any).id || id),
          packageName: String((deleted as any).name || 'Package'),
          postId: postId ? String(postId) : undefined,
          propertyTitle,
          threadSubject: `Package activity: ${String((deleted as any).name || 'Package')}${propertyTitle ? ` (${propertyTitle})` : ''}`,
        })
      }
    } catch (emailErr) {
      console.warn('Package activity email failed (non-fatal):', emailErr)
    }
    
    return NextResponse.json({ success: true, deleted })
  } catch (error) {
    console.error('Error deleting package:', error)
    return NextResponse.json(
      { error: 'Failed to delete package', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    )
  }
}
