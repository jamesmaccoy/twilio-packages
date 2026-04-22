import { NextRequest, NextResponse } from 'next/server'
import { google } from 'googleapis'
import jwt from 'jsonwebtoken'
import crypto from 'node:crypto'
import { getPayload } from 'payload'
import configPromise from '@/payload.config'
import { validateRedirect } from '@/utils/validateRedirect'

type GoogleUserInfo = {
  email?: string
  name?: string
}

function getBaseUrl(request: NextRequest): string {
  const forwardedProto = request.headers.get('x-forwarded-proto')
  const forwardedHost = request.headers.get('x-forwarded-host')
  const host = forwardedHost || request.headers.get('host')

  if (host) {
    const protocol = forwardedProto || (host.includes('localhost') ? 'http' : 'https')
    return `${protocol}://${host}`
  }

  return process.env.NEXT_PUBLIC_URL || process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:3000'
}

export async function GET(request: NextRequest) {
  const clientId = process.env.GOOGLE_CLIENT_ID
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET
  const baseUrl = getBaseUrl(request)
  const redirectUri = `${baseUrl}/api/auth/google/callback`

  if (!clientId || !clientSecret) {
    return NextResponse.redirect(`${baseUrl}/login?error=google_not_configured`)
  }

  const code = request.nextUrl.searchParams.get('code')
  const state = validateRedirect(request.nextUrl.searchParams.get('state')) || '/bookings'

  if (!code) {
    return NextResponse.redirect(`${baseUrl}/login?error=google_code_missing`)
  }

  try {
    const payload = await getPayload({ config: configPromise })
    const oauth2Client = new google.auth.OAuth2(clientId, clientSecret, redirectUri)
    const tokenResult = await oauth2Client.getToken(code)
    oauth2Client.setCredentials(tokenResult.tokens)

    const oauth2 = google.oauth2({ auth: oauth2Client, version: 'v2' })
    const me = await oauth2.userinfo.get()
    const googleUser = (me.data || {}) as GoogleUserInfo

    if (!googleUser.email) {
      return NextResponse.redirect(`${baseUrl}/login?error=google_email_missing`)
    }

    const existing = await payload.find({
      collection: 'users',
      where: {
        email: {
          equals: googleUser.email.toLowerCase(),
        },
      },
      limit: 1,
      pagination: false,
    })

    let user = existing.docs[0]
    if (!user) {
      user = await payload.create({
        collection: 'users',
        data: {
          email: googleUser.email.toLowerCase(),
          name: googleUser.name || googleUser.email.split('@')[0],
          mobile: `+27${Math.floor(Math.random() * 900000000 + 100000000)}`,
          password: crypto.randomBytes(20).toString('hex'),
          role: 'customer',
        },
      })
    }

    const collectionConfig = payload.collections['users']?.config
    if (!collectionConfig) {
      return NextResponse.redirect(`${baseUrl}/login?error=collection_config_missing`)
    }

    const tokenPayload = {
      email: user.email,
      id: user.id,
      collection: collectionConfig.slug,
    }

    const authToken = jwt.sign(tokenPayload, payload.secret, {
      expiresIn: collectionConfig.auth.tokenExpiration,
    })

    const response = NextResponse.redirect(`${baseUrl}${state}`)
    response.cookies.set('payload-token', authToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      path: '/',
      maxAge: 60 * 60 * 24 * 7,
    })

    return response
  } catch (error) {
    console.error('Google auth callback failed:', error)
    return NextResponse.redirect(`${baseUrl}/login?error=google_auth_failed`)
  }
}
