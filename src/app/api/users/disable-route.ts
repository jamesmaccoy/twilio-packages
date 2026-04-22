import { NextRequest, NextResponse } from 'next/server'
import { getPayload } from 'payload'
import configPromise from '@/payload.config'

export async function POST(request: NextRequest) {
  try {
    const payload = await getPayload({ config: configPromise })
    const body = await request.json()
    
    // Validate required fields
    const { email, password, name, role = 'customer' } = body
    
    if (!email || !password || !name) {
      return NextResponse.json({ 
        error: 'Email, password, and name are required' 
      }, { status: 400 })
    }

    // Validate email format
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
    if (!emailRegex.test(email)) {
      return NextResponse.json({ 
        error: 'Invalid email format' 
      }, { status: 400 })
    }

    // Validate password strength (minimum 6 characters)
    if (password.length < 6) {
      return NextResponse.json({ 
        error: 'Password must be at least 6 characters long' 
      }, { status: 400 })
    }

    // Validate role
    const allowedRoles = ['customer', 'guest']
    if (!allowedRoles.includes(role)) {
      return NextResponse.json({ 
        error: 'Invalid role. Must be customer or guest' 
      }, { status: 400 })
    }

    // Check if user already exists
    try {
      const existingUser = await payload.find({
        collection: 'users',
        where: {
          email: {
            equals: email
          }
        }
      })

      if (existingUser.docs.length > 0) {
        return NextResponse.json({ 
          error: 'User with this email already exists' 
        }, { status: 409 })
      }
    } catch (error) {
      console.error('Error checking existing user:', error)
    }

    // Create the user
    const user = await payload.create({
      collection: 'users',
      data: {
        email,
        password,
        name,
        role,
        subscriptionStatus: {
          status: 'none',
          plan: 'free'
        }
      }
    })

    // Remove sensitive fields from response
    const { password: _, salt: __, hash: ___, ...safeUser } = user

    return NextResponse.json({
      message: 'User created successfully',
      user: safeUser
    })
  } catch (error) {
    console.error('Error creating user:', error)
    
    // Provide specific error messages
    if (error instanceof Error && error.message?.includes('validation')) {
      return NextResponse.json(
        { error: 'Validation error: ' + error.message },
        { status: 400 }
      )
    }
    
    if (error instanceof Error && error.message?.includes('duplicate')) {
      return NextResponse.json(
        { error: 'User with this email already exists' },
        { status: 409 }
      )
    }

    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to create user' },
      { status: 500 }
    )
  }
} 