import { NextRequest, NextResponse } from 'next/server'
import { getPayload } from 'payload'
import configPromise from '@/payload.config'
import { Resend } from 'resend'
import PasswordResetEmail from '@/emails/PasswordReset'
import { render } from '@react-email/components'

const resendApiKey = process.env.RESEND_API_KEY || process.env.SMTP_PASS
if (!resendApiKey) {
  console.error('❌ RESEND_API_KEY or SMTP_PASS environment variable is not set!')
}
const resend = new Resend(resendApiKey)

// Simple in-memory rate limiting store
// In production, consider using Redis or a database
const resetAttempts = new Map<string, { count: number; lastAttempt: number }>()

// Rate limiting: max 3 requests per email per hour
const MAX_ATTEMPTS = 3
const RATE_LIMIT_WINDOW = 60 * 60 * 1000 // 1 hour in milliseconds

function checkRateLimit(email: string): { allowed: boolean; remainingTime?: number } {
  const normalizedEmail = email.toLowerCase().trim()
  const now = Date.now()
  const record = resetAttempts.get(normalizedEmail)

  if (!record) {
    resetAttempts.set(normalizedEmail, { count: 1, lastAttempt: now })
    return { allowed: true }
  }

  // Reset if window has passed
  if (now - record.lastAttempt > RATE_LIMIT_WINDOW) {
    resetAttempts.set(normalizedEmail, { count: 1, lastAttempt: now })
    return { allowed: true }
  }

  // Check if limit exceeded
  if (record.count >= MAX_ATTEMPTS) {
    const remainingTime = Math.ceil((RATE_LIMIT_WINDOW - (now - record.lastAttempt)) / 1000 / 60) // minutes
    return { allowed: false, remainingTime }
  }

  // Increment count
  record.count++
  record.lastAttempt = now
  resetAttempts.set(normalizedEmail, record)
  return { allowed: true }
}


export async function POST(request: NextRequest) {
  try {
    console.log('📧 Password reset request received')
    const payload = await getPayload({ config: configPromise })
    
    let body
    try {
      body = await request.json()
    } catch (parseError) {
      console.error('❌ Failed to parse request body:', parseError)
      return NextResponse.json({ 
        error: 'Invalid request body' 
      }, { status: 400 })
    }
    
    // Validate required fields
    const { email } = body
    
    if (!email || typeof email !== 'string') {
      return NextResponse.json({ 
        error: 'Email is required' 
      }, { status: 400 })
    }

    const normalizedEmail = email.toLowerCase().trim()

    // Validate email format
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
    if (!emailRegex.test(normalizedEmail)) {
      return NextResponse.json({ 
        error: 'Invalid email format' 
      }, { status: 400 })
    }

    // Check rate limit
    const rateLimit = checkRateLimit(normalizedEmail)
    if (!rateLimit.allowed) {
      return NextResponse.json({ 
        error: `Too many password reset requests. Please try again in ${rateLimit.remainingTime} minutes.` 
      }, { status: 429 })
    }

    // Check if user exists
    const users = await payload.find({
      collection: 'users',
      where: {
        email: {
          equals: normalizedEmail,
        },
      },
      limit: 1,
    })

    // Always return success message to prevent email enumeration
    // Even if user doesn't exist, we return the same message
    if (users.docs.length === 0) {
      return NextResponse.json({
        message: 'If an account exists with this email, a password reset link has been sent.'
      })
    }

    const user = users.docs[0]
    if (!user) {
      // This should never happen due to the check above, but TypeScript needs it
      console.error('❌ User not found after length check (should not happen)')
      return NextResponse.json({
        message: 'If an account exists with this email, a password reset link has been sent.'
      })
    }

    console.log(`📧 Processing password reset for user: ${user.email} (ID: ${user.id})`)

    // Manually generate reset token to avoid Payload's email sending
    // This gives us full control over the email sending process
    try {
      // Generate a secure random token (similar to what Payload does internally)
      let resetToken: string
      try {
        const crypto = await import('crypto')
        resetToken = crypto.randomBytes(32).toString('hex')
      } catch (cryptoError: any) {
        console.error('❌ Failed to import crypto module:', cryptoError)
        // Fallback: use a combination of timestamp and random values
        resetToken = `${Date.now()}-${Math.random().toString(36).substring(2)}-${Math.random().toString(36).substring(2)}`
      }
      

      if (!resetToken || resetToken.length === 0) {
        console.error('Failed to generate reset token: token is empty')
        // Still return success to prevent email enumeration
        return NextResponse.json({
          message: 'If an account exists with this email, a password reset link has been sent.'
        })
      }
      
      // Set expiration to 1 hour from now
      const resetPasswordExpiration = new Date()
      resetPasswordExpiration.setHours(resetPasswordExpiration.getHours() + 1)

      // Update user with reset token and expiration
      // Use overrideAccess to bypass access control for password reset tokens
      console.log('📧 Saving reset token to database...')
      try {
        const updateResult = await payload.update({
          collection: 'users',
          id: user.id,
          data: {
            resetPasswordToken: resetToken,
            resetPasswordExpiration: resetPasswordExpiration.toISOString(),
          },
          overrideAccess: true, // Bypass access control for password reset
        })
        console.log('✅ User updated successfully, reset token saved')
        
        // Try to verify, but don't fail if verification doesn't work
        // The update succeeded, so we'll proceed with sending the email
        try {
          const updatedUser = await payload.findByID({
            collection: 'users',
            id: user.id,
            overrideAccess: true,
          })
          const savedToken = (updatedUser as any)?.resetPasswordToken
          if (savedToken && savedToken === resetToken) {
            console.log('✅ Reset token verified successfully')
          } else {
            console.warn('⚠️ Could not verify token (may be filtered), but update succeeded - proceeding with email')
          }
        } catch (verifyError) {
          console.warn('⚠️ Token verification failed, but update succeeded - proceeding with email:', verifyError)
        }
      } catch (updateError: any) {
        console.error('❌ Failed to update user with reset token:', updateError)
        console.error('❌ Update error details:', {
          message: updateError?.message,
          stack: updateError?.stack,
        })
        // Still return success to prevent email enumeration
        return NextResponse.json({
          message: 'If an account exists with this email, a password reset link has been sent.'
        })
      }

      // Build reset link using the token we just generated
      const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:3000'
      const resetLink = `${baseUrl}/reset-password?token=${resetToken}`

      // Render email template
      console.log('📧 Rendering password reset email template...')
      console.log('📧 Reset link:', resetLink)
      const emailHtml = await render(
        PasswordResetEmail({
          resetLink,
          userName: user.name || user.email.split('@')[0],
          expiryTime: '1 hour',
        }),
      )
      console.log('📧 Email template rendered successfully, length:', emailHtml?.length || 0)

      // Get from address with validation (same logic as magic auth email)
      let fromAddress = process.env.EMAIL_FROM_ADDRESS?.trim() || process.env.EMAIL_FROM?.trim() || 'info@simpleplek.co.za'
      
      // Extract email if formatted as "Name <email@example.com>"
      const emailMatch = fromAddress.match(/<([^>]+)>/)
      if (emailMatch && emailMatch[1]) {
        fromAddress = emailMatch[1]
      }
      
      // Replace noreply with info
      if (fromAddress === 'noreply@simpleplek.co.za') {
        fromAddress = 'info@simpleplek.co.za'
      }
      
      // Validate email format
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
      if (!emailRegex.test(fromAddress)) {
        console.error(`Invalid EMAIL_FROM_ADDRESS format: ${fromAddress}`)
        // Still return success to prevent email enumeration
        return NextResponse.json({
          message: 'If an account exists with this email, a password reset link has been sent.'
        })
      }

      // Get name, cleaning it if needed
      let fromName = process.env.EMAIL_FROM_NAME?.trim()
      if (fromName) {
        // Remove email formatting if present
        const nameMatch = fromName.match(/^([^<]+)\s*</)
        if (nameMatch && nameMatch[1]) {
          fromName = nameMatch[1].trim()
        }
      }

      const fromField = fromName && fromName.length > 0
        ? `${fromName} <${fromAddress}>`
        : fromAddress

      // Send email using Resend API
      console.log('📧 Attempting to send password reset email via Resend API...')
      console.log('📧 Email details:', {
        from: fromField,
        to: normalizedEmail,
        subject: 'Reset Your Password - Simpleplek',
        hasHtml: !!emailHtml,
        htmlLength: emailHtml?.length || 0,
      })

      const emailResponse = await resend.emails.send({
        from: fromField,
        to: normalizedEmail,
        subject: 'Reset Your Password - Simpleplek',
        html: emailHtml,
      })

      if (emailResponse.error) {
        console.error('❌ Failed to send password reset email:', JSON.stringify(emailResponse.error, null, 2))
        // Still return success to prevent email enumeration
        return NextResponse.json({
          message: 'If an account exists with this email, a password reset link has been sent.'
        })
      }

      console.log(`✅ Password reset email sent successfully to ${normalizedEmail}`)
      console.log('📧 Resend response:', JSON.stringify(emailResponse.data, null, 2))
    } catch (error: any) {
      // Log the error for debugging but return generic success message
      console.error('❌ Password reset request error:', error)
      console.error('❌ Error details:', {
        message: error?.message,
        stack: error?.stack,
        name: error?.name,
      })
    }

    // Always return success message to prevent email enumeration
    return NextResponse.json({
      message: 'If an account exists with this email, a password reset link has been sent.'
    })
  } catch (error: any) {
    console.error('❌ Error during forgot password:', error)
    console.error('❌ Error stack:', error?.stack)
    console.error('❌ Error message:', error?.message)
    console.error('❌ Error name:', error?.name)
    
    // In development, return more details about the error
    const isDevelopment = process.env.NODE_ENV === 'development'
    
    return NextResponse.json(
      { 
        error: 'An error occurred. Please try again later.',
        ...(isDevelopment && {
          details: error?.message,
          stack: error?.stack,
        }),
      },
      { status: 500 }
    )
  }
}

