import { NextRequest, NextResponse } from 'next/server'
import { getPayload } from 'payload'
import configPromise from '@/payload.config'

export async function POST(request: NextRequest) {
  try {
    const payload = await getPayload({ config: configPromise })
    // Support JSON + form submissions (Payload Admin login uses urlencoded form posts)
    const contentType = request.headers.get('content-type') || ''
    let body: any = {}
    if (contentType.includes('application/json')) {
      body = await request.json()
    } else if (
      contentType.includes('application/x-www-form-urlencoded') ||
      contentType.includes('multipart/form-data')
    ) {
      const formData = await request.formData()
      body = {}
      for (const [key, value] of formData.entries()) {
        // Support Payload Admin style nested keys like `email[value]`
        const match = key.match(/^(\w+)\[(\w+)\]$/)
        if (match && match[1] && match[2]) {
          const parentKey = match[1]
          const childKey = match[2]
          if (!body[parentKey]) body[parentKey] = {}
          body[parentKey][childKey] = value
        } else {
          body[key] = value
        }
      }
    } else {
      // best-effort fallback
      try {
        body = await request.json()
      } catch {
        const formData = await request.formData()
        body = Object.fromEntries(formData.entries())
      }
    }

    // Payload admin sometimes puts JSON into `_payload`
    if (body?._payload && typeof body._payload === 'string') {
      try {
        const payloadData = JSON.parse(body._payload)
        body = { ...body, ...payloadData }
        delete body._payload
      } catch { }
    }

    // Normalize common admin field shapes: { value: ... }
    const normalizeValue = (v: any): string | undefined => {
      if (v == null) return undefined
      if (typeof v === 'string') return v
      if (typeof v === 'number' || typeof v === 'boolean') return String(v)
      if (typeof v === 'object' && 'value' in v) {
        const inner = (v as any).value
        if (inner == null) return undefined
        return typeof inner === 'string' ? inner : String(inner)
      }
      return undefined
    }

    // Validate required fields (Payload admin may send `username` instead of `email`)
    const email = normalizeValue((body as any).email) ?? normalizeValue((body as any).username)
    const password = normalizeValue((body as any).password)

    if (!email || !password) {
      if (process.env.NODE_ENV === 'development') {
        return NextResponse.json(
          {
            error: 'Email and password are required',
            debug: {
              keys: Object.keys(body || {}),
              contentType,
            },
          },
          { status: 400 },
        )
      }
      return NextResponse.json({
        error: 'Email and password are required'
      }, { status: 400 })
    }

    // Authenticate user with Payload
    const { user, token } = await payload.login({
      collection: 'users',
      data: {
        email,
        password,
      },
    })

    if (!user || !token) {
      return NextResponse.json({
        error: 'Invalid email or password'
      }, { status: 401 })
    }

    // Remove sensitive fields from response
    const { password: _, salt: __, hash: ___, ...safeUser } = user

    // Create response with user data
    const response = NextResponse.json({
      message: 'Login successful',
      user: safeUser
    })

    const collectionConfig = payload.collections['users']?.config
    if (!collectionConfig) {
      throw new Error('Users collection config not found')
    }

    const cookieOptions = {
      path: '/',
      httpOnly: true,
      maxAge: collectionConfig.auth.tokenExpiration,
      secure: collectionConfig.auth.cookies.secure,
      sameSite:
        typeof collectionConfig.auth.cookies.sameSite === 'string'
          ? (collectionConfig.auth.cookies.sameSite.toLowerCase() as 'lax' | 'strict' | 'none')
          : collectionConfig.auth.cookies.sameSite,
      domain: collectionConfig.auth.cookies.domain,
    } as const

    // Set the authentication cookies (support both legacy + Payload prefix)
    response.cookies.set(`${payload.config.cookiePrefix}-token`, token, cookieOptions)
    response.cookies.set('payload-token', token, cookieOptions)

    return response
  } catch (error) {
    console.error('Error during login:', error)

    // Handle specific authentication errors
    if (error instanceof Error && error.message?.includes('Invalid credentials')) {
      return NextResponse.json(
        { error: 'Invalid email or password' },
        { status: 401 }
      )
    }

    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Login failed' },
      { status: 500 }
    )
  }
} 