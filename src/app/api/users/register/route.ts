import { NextRequest, NextResponse } from 'next/server'
import { getPayload } from 'payload'
import configPromise from '@/payload.config'

export async function POST(request: NextRequest) {
  try {
    const payload = await getPayload({ config: configPromise })
    const body = await request.json()
    
    // Validate required fields
    const { email, password, name, role, mobile } = body
    
    if (!email || !password || !name || !mobile) {
      return NextResponse.json({ 
        error: 'Email, mobile, password, and name are required' 
      }, { status: 400 })
    }

    // Validate email format
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
    if (!emailRegex.test(email)) {
      return NextResponse.json({ 
        error: 'Invalid email format' 
      }, { status: 400 })
    }

    // Validate mobile format (E.164)
    const mobileRegex = /^\+[1-9]\d{7,19}$/
    if (!mobileRegex.test(mobile)) {
      return NextResponse.json(
        { error: 'Invalid mobile format. Use E.164 format, e.g. +27821234567' },
        { status: 400 },
      )
    }

    // Validate password length
    if (password.length < 6) {
      return NextResponse.json({ 
        error: 'Password must be at least 6 characters long' 
      }, { status: 400 })
    }

    // Restrict role to only 'customer' or 'guest' (not admin or host)
    const allowedRoles = ['customer', 'guest']
    const userRole = role && allowedRoles.includes(role) ? role : 'customer'

    // Check if user already exists
    const existingUsers = await payload.find({
      collection: 'users',
      where: {
        email: {
          equals: email,
        },
      },
      limit: 1,
    })

    if (existingUsers.docs.length > 0) {
      return NextResponse.json({ 
        error: 'An account with this email already exists' 
      }, { status: 400 })
    }

    const existingMobileUsers = await payload.find({
      collection: 'users',
      where: {
        mobile: {
          equals: mobile,
        },
      },
      limit: 1,
    })

    if (existingMobileUsers.docs.length > 0) {
      return NextResponse.json(
        { error: 'An account with this mobile number already exists' },
        { status: 400 },
      )
    }

    // Create user - using payload.create bypasses access control when called from an endpoint
    const user = await payload.create({
      collection: 'users',
      data: {
        email,
        mobile,
        password,
        name,
        role: userRole,
      },
    })

    // Remove sensitive fields from response
    const { password: _, salt: __, hash: ___, ...safeUser } = user

    return NextResponse.json({
      message: 'Registration successful',
      user: safeUser
    }, { status: 201 })
  } catch (error) {
    console.error('Error during registration:', error)
    
    // Handle duplicate email/mobile error
    if (error instanceof Error && error.message?.includes('E11000')) {
      return NextResponse.json(
        { error: 'An account with this email or mobile number already exists' },
        { status: 400 }
      )
    }

    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Registration failed' },
      { status: 500 }
    )
  }
}

