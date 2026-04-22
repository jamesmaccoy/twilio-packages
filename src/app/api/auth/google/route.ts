import { NextRequest, NextResponse } from 'next/server'
import { google } from 'googleapis'
import { validateRedirect } from '@/utils/validateRedirect'

export const runtime = 'nodejs'

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
    return NextResponse.json(
      { message: 'Google auth is not configured. Missing GOOGLE_CLIENT_ID/GOOGLE_CLIENT_SECRET.' },
      { status: 500 },
    )
  }

  const next = validateRedirect(request.nextUrl.searchParams.get('next'))
  const oauth2Client = new google.auth.OAuth2(clientId, clientSecret, redirectUri)

  const state = next || '/bookings'
  const authUrl = oauth2Client.generateAuthUrl({
    access_type: 'offline',
    scope: ['openid', 'email', 'profile'],
    prompt: 'consent',
    state,
  })

  return NextResponse.redirect(authUrl, 302)
}
