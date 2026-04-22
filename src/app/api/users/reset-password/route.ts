import { NextRequest, NextResponse } from 'next/server'
import { getPayload } from 'payload'
import configPromise from '@/payload.config'

export async function POST(request: NextRequest) {
  try {
    const payload = await getPayload({ config: configPromise })
    const body = await request.json()
    
    // Validate required fields
    const { token, password } = body
    
    if (!token || typeof token !== 'string') {
      return NextResponse.json({ 
        error: 'Reset token is required' 
      }, { status: 400 })
    }

    if (!password || typeof password !== 'string') {
      return NextResponse.json({ 
        error: 'Password is required' 
      }, { status: 400 })
    }

    // Validate password strength
    if (password.length < 8) {
      return NextResponse.json({ 
        error: 'Password must be at least 8 characters long' 
      }, { status: 400 })
    }

    // Use Payload's built-in resetPassword operation
    try {
      await payload.resetPassword({
        collection: 'users',
        data: {
          token,
          password,
        },
      })

      return NextResponse.json({
        message: 'Password has been reset successfully. You can now log in with your new password.'
      })
    } catch (error: any) {
      console.error('Password reset error:', error)
      
      // Handle specific errors
      if (error.message?.includes('expired') || error.message?.includes('invalid')) {
        return NextResponse.json(
          { error: 'Invalid or expired reset token. Please request a new password reset.' },
          { status: 400 }
        )
      }

      return NextResponse.json(
        { error: 'Failed to reset password. Please try again or request a new reset link.' },
        { status: 400 }
      )
    }
  } catch (error) {
    console.error('Error during password reset:', error)
    
    return NextResponse.json(
      { error: 'An error occurred. Please try again later.' },
      { status: 500 }
    )
  }
}

