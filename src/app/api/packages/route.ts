import { NextRequest, NextResponse } from 'next/server'
import { getPayload } from 'payload'
import configPromise from '@/payload.config'
import { sendPackageActivityNotification } from '@/lib/emailNotifications'
import jwt from 'jsonwebtoken'

export async function GET(request: NextRequest) {
  try {
    const payload = await getPayload({ config: configPromise })
    
    // Check authentication - packages collection requires authenticated access
    let user: any = null
    try {
      const authResult = await payload.auth({ headers: request.headers })
      user = authResult.user
    } catch {
      // fall through to cookie token fallback
    }

    // Fallback: if Payload didn't pick up cookies, try JWT header auth using cookie token.
    const prefixToken = request.cookies.get(`${payload.config.cookiePrefix}-token`)?.value
    const legacyToken = request.cookies.get('payload-token')?.value
    const authTokens = [prefixToken, legacyToken].filter(
      (token, index, self): token is string => Boolean(token) && self.indexOf(token) === index,
    )

    if (!user && authTokens.length > 0) {
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
    
    if (!user) {
      return NextResponse.json(
        { error: 'Unauthorized. Please log in to access packages.' },
        { status: 401 }
      )
    }
    
    const { searchParams } = new URL(request.url)
    
    // Build where clause from query parameters
    const where: any = {}
    
    // Handle post filter
    const postId = searchParams.get('where[post][equals]')
    if (postId) {
      where.post = { equals: postId }
    }
    
    // Handle isEnabled filter
    const isEnabled = searchParams.get('where[isEnabled][equals]')
    if (isEnabled !== null) {
      where.isEnabled = { equals: isEnabled === 'true' }
    }
    
    const packages = await payload.find({
      collection: 'packages',
      where: Object.keys(where).length > 0 ? where : undefined,
      depth: 2, // Increased depth to include related page data
      user, // Pass user for access control
    })
    
    return NextResponse.json(packages)
  } catch (error) {
    console.error('Error fetching packages:', error)
    const errorMessage = error instanceof Error ? error.message : 'Failed to fetch packages'
    return NextResponse.json(
      { error: errorMessage, details: process.env.NODE_ENV === 'development' ? String(error) : undefined },
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
      user = null
    }

    // Fallback: if Payload didn't pick up cookies, try JWT header auth using cookie token.
    const prefixToken = request.cookies.get(`${payload.config.cookiePrefix}-token`)?.value
    const legacyToken = request.cookies.get('payload-token')?.value
    const authTokens = [prefixToken, legacyToken].filter(
      (token, index, self): token is string => Boolean(token) && self.indexOf(token) === index,
    )

    if (!user && authTokens.length > 0) {
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
    
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    
    // Handle different content types (Payload admin often sends multipart/form-data with `_payload`)
    let body: any = {}
    const contentType = request.headers.get('content-type') || ''
    const url = new URL(request.url)
    const searchParams = url.searchParams
    
    try {
      const clonedRequest = request.clone()

      if (contentType.includes('application/json')) {
        const rawBody = await clonedRequest.text()
        if (rawBody && rawBody.trim()) body = JSON.parse(rawBody)
      } else if (
        contentType.includes('application/x-www-form-urlencoded') ||
        contentType.includes('multipart/form-data')
      ) {
        const formData = await clonedRequest.formData()
        body = {}

        // Convert FormData to object, handling nested keys like name[value]
        for (const [key, value] of formData.entries()) {
          if (key.includes('[') && key.includes(']')) {
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
        const rawBody = await clonedRequest.text()
        if (rawBody && rawBody.trim()) body = JSON.parse(rawBody)
      }

      // Payload admin sometimes puts JSON into `_payload`
      if (body._payload && typeof body._payload === 'string') {
        try {
          const payloadData = JSON.parse(body._payload)
          body = { ...body, ...payloadData }
          delete body._payload
        } catch (err) {
          console.warn('Could not parse _payload field:', err)
        }
      }

      // Payload can nest under `data`
      if (body.data && typeof body.data === 'object' && !Array.isArray(body.data)) {
        body = { ...body, ...body.data }
        delete body.data
      }

      // Payload admin form state sometimes arrives as `{ state: { field: { value, initialValue, ... }}}`
      if (body.state && typeof body.state === 'object' && !Array.isArray(body.state)) {
        const stateObj = body.state as Record<string, any>
        for (const [key, fieldState] of Object.entries(stateObj)) {
          if (fieldState && typeof fieldState === 'object' && 'value' in fieldState) {
            ;(body as any)[key] = (fieldState as any).value
          }
        }
        delete body.state
      }

      // Normalize common admin field shapes: { value: ... }
      const normalizeValue = (v: any): any => {
        if (!v || typeof v !== 'object') return v
        if ('value' in v) {
          const inner = (v as any).value
          if (inner && typeof inner === 'object' && 'id' in inner) return (inner as any).id
          return inner
        }
        if ('id' in v) return (v as any).id
        return v
      }
      body.name = normalizeValue(body.name)
      body.post = normalizeValue(body.post)
      body.isEnabled = normalizeValue(body.isEnabled)
      body.price = normalizeValue(body.price)
    } catch (parseError) {
      console.error('Error parsing package request body:', parseError)
      return NextResponse.json(
        { error: 'Invalid request body', details: parseError instanceof Error ? parseError.message : 'Failed to parse body' },
        { status: 400 },
      )
    }

    // Payload admin relationship fields sometimes use POST to query/list options.
    // If this looks like a list query (has pagination/where params) and there's no create payload,
    // treat this request like GET /api/packages.
    const bodyKeys = Object.keys(body || {})
    const hasListQueryParams =
      searchParams.has('limit') ||
      searchParams.has('page') ||
      searchParams.has('sort') ||
      searchParams.has('select') ||
      Array.from(searchParams.keys()).some((k) => k.startsWith('where[') || k.startsWith('select[')) ||
      bodyKeys.includes('limit') ||
      bodyKeys.includes('page') ||
      bodyKeys.includes('sort') ||
      bodyKeys.includes('select') ||
      bodyKeys.some((k) => k.startsWith('where[') || k.startsWith('select['))

    const bodyLooksLikeCreate =
      (typeof body?.name === 'string' && body.name.trim().length > 0) ||
      (typeof body?.post === 'string' && body.post.trim().length > 0)

    if (hasListQueryParams && !bodyLooksLikeCreate) {
      const where: any = {}

      // Support a few common where shapes used by admin relationship queries
      const applyWhereKV = (key: string, value: any) => {
        if (key.endsWith('[post][equals]') && value != null && value !== '') {
          where.post = { equals: String(value) }
        }
        if (key.endsWith('[isEnabled][equals]') && value != null && value !== '') {
          where.isEnabled = { equals: String(value) === 'true' }
        }
      }

      searchParams.forEach((value, key) => applyWhereKV(key, value))
      for (const [key, value] of Object.entries(body || {})) {
        if (typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean') {
          applyWhereKV(key, value)
        }
      }

      const getParam = (k: string) => searchParams.get(k) ?? (body && k in body ? String((body as any)[k]) : null)
      const limit = Number(getParam('limit') || 50)
      const page = Number(getParam('page') || 1)
      const sort = getParam('sort') || undefined
      const depth = Number(getParam('depth') || 2)

      const result = await payload.find({
        collection: 'packages',
        where: Object.keys(where).length > 0 ? where : undefined,
        depth,
        limit: Number.isFinite(limit) ? limit : 50,
        page: Number.isFinite(page) ? page : 1,
        sort,
        user,
      })

      return NextResponse.json(result)
    }

    // Some Payload admin "quick create" flows send values via query params (no body)
    if (body?.name == null || body?.name === '') {
      const qpName = searchParams.get('name')
      if (qpName) body.name = qpName
    }
    if (body?.post == null || body?.post === '') {
      const qpPost =
        searchParams.get('post') ||
        // Seen in admin relationship modals
        searchParams.get('where[and][1][post][equals]') ||
        searchParams.get('where[post][equals]')
      if (qpPost) body.post = qpPost
    }
    if (body?.isEnabled == null || body?.isEnabled === '') {
      const qpIsEnabled = searchParams.get('isEnabled')
      if (qpIsEnabled != null) body.isEnabled = qpIsEnabled === 'true'
    }
    if (body?.price == null || body?.price === '') {
      const qpPrice = searchParams.get('price')
      if (qpPrice != null && qpPrice !== '') {
        const parsed = Number(qpPrice)
        if (!Number.isNaN(parsed)) body.price = parsed
      }
    }

    // Pre-validate required fields so the admin UI gets a clear actionable 400
    if (!body?.post || !body?.name) {
      return NextResponse.json(
        {
          error: 'Missing required fields',
          missing: [!body?.post ? 'post' : null, !body?.name ? 'name' : null].filter(Boolean),
          receivedKeys: Object.keys(body || {}),
          received: { post: body?.post, name: body?.name },
        },
        { status: 400 },
      )
    }

    // Normalize multi-select fields (supports legacy single values)
    if (body?.category && !Array.isArray(body.category)) {
      body.category = [body.category]
    }
    if (body?.entitlement && !Array.isArray(body.entitlement)) {
      body.entitlement = [body.entitlement]
    }
    
    const packageDoc = await payload.create({
      collection: 'packages',
      data: body,
      user,
    })

    // Fire-and-forget confirmation email to actor + admin
    try {
      const actorEmail =
        typeof (user as any)?.email === 'string' ? ((user as any).email as string) : ''
      const postId =
        typeof (packageDoc as any)?.post === 'string'
          ? (packageDoc as any).post
          : (packageDoc as any)?.post?.id
      let propertyTitle: string | undefined
      if (postId) {
        try {
          const post = await payload.findByID({ collection: 'posts', id: String(postId), depth: 0, user })
          propertyTitle = typeof (post as any)?.title === 'string' ? (post as any).title : undefined
        } catch {}
      }
      if (actorEmail) {
        await sendPackageActivityNotification({
          actorEmail,
          action: 'created',
          packageId: String((packageDoc as any).id),
          packageName: String((packageDoc as any).name || 'Package'),
          postId: postId ? String(postId) : undefined,
          propertyTitle,
          threadSubject: `Package activity: ${String((packageDoc as any).name || 'Package')}${propertyTitle ? ` (${propertyTitle})` : ''}`,
        })
      }
    } catch (emailErr) {
      console.warn('Package activity email failed (non-fatal):', emailErr)
    }
    
    return NextResponse.json(packageDoc)
  } catch (error) {
    console.error('Error creating package:', error)
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
      { error: 'Failed to create package', details },
      { status },
    )
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const payload = await getPayload({ config: configPromise })
    
    // Try to get the user from the request
    let user = null
    try {
      const authResult = await payload.auth({ headers: request.headers })
      user = authResult.user
    } catch (authError) {
      console.log('Authentication failed, trying admin context:', authError)
      // If authentication fails, this might be an admin request
    }
    
    const { searchParams } = new URL(request.url)

    // Parse package IDs from query parameters (Payload admin bulk delete shapes the URL)
    // where[and][0][id][in][0], where[and][0][id][in][1], … or where[id][in][0] / where[id][in][]
    const packageIds: string[] = []
    searchParams.forEach((value, key) => {
      if (key.match(/where\[and\]\[\d+\]\[id\]\[in\]\[\d+\]/)) {
        packageIds.push(value)
      } else if (key.match(/where\[id\]\[in\]\[\d+\]/)) {
        packageIds.push(value)
      } else if (key === 'where[id][in][]') {
        packageIds.push(value)
      }
    })
    const arrayIds = searchParams.getAll('where[id][in][]')
    if (arrayIds.length > 0) {
      packageIds.push(...arrayIds)
    }
    const ids = [...new Set(packageIds)]

    console.log('DELETE request for packages:', { ids, user: user?.id ? '[REDACTED]' : 'admin' })

    if (ids.length === 0) {
      return NextResponse.json(
        { error: 'No package IDs provided' },
        { status: 400 }
      )
    }
    
    // Delete packages one by one
    const deletedPackages = []
    const failedPackages = []
    
    for (const id of ids) {
      try {
        console.log(`Attempting to delete package: ${id}`)
        
        // For admin requests, we might not have a user object
        const deleteOptions: any = {
          collection: 'packages',
          id,
        }
        
        if (user) {
          deleteOptions.user = user
        }
        
        const deletedPackage = await payload.delete(deleteOptions)
        deletedPackages.push(deletedPackage)
        console.log(`Successfully deleted package: ${id}`)
      } catch (error) {
        console.error(`Error deleting package ${id}:`, error)
        failedPackages.push({ id, error: error instanceof Error ? error.message : 'Unknown error' })
        // Continue with other deletions even if one fails
      }
    }
    
    const response = {
      message: `Successfully deleted ${deletedPackages.length} packages${failedPackages.length > 0 ? `, ${failedPackages.length} failed` : ''}`,
      deletedPackages,
      failedPackages: failedPackages.length > 0 ? failedPackages : undefined,
    }
    
    console.log('DELETE response:', response)
    return NextResponse.json(response)
  } catch (error) {
    console.error('Error deleting packages:', error)
    return NextResponse.json(
      { error: 'Failed to delete packages', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    )
  }
} 