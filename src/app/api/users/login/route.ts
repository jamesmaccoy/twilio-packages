import { NextRequest, NextResponse } from 'next/server'
import { getPayload } from 'payload'
import configPromise from '@/payload.config'

export async function POST(request: NextRequest) {
  try {
    const payload = await getPayload({ config: configPromise })
    const body = await request.json()
    
    // Validate required fields
    const { email, password } = body
    
    if (!email || !password) {
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

    const cookieOptions = {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      path: '/',
      maxAge: 60 * 60 * 24 * 7, // 7 days
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