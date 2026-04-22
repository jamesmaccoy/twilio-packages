import { NextRequest, NextResponse } from 'next/server'
import { getPayload } from 'payload'
import configPromise from '@/payload.config'
import { yocoService } from '@/lib/yocoService'

export async function POST(request: NextRequest) {
  try {
    const payload = await getPayload({ config: configPromise })
    const { user } = await payload.auth({ headers: request.headers })
    
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await request.json()
    const { targetUserId, productId } = body

    if (!targetUserId) {
      return NextResponse.json({ error: 'Target user ID is required' }, { status: 400 })
    }

    // Only admins can promote users
    if (!user.role || !user.role.includes('admin')) {
      return NextResponse.json({ error: 'Insufficient permissions' }, { status: 403 })
    }

    // Don't let users promote themselves
    if (user.id === targetUserId) {
      return NextResponse.json({ error: 'Users cannot promote themselves' }, { status: 403 })
    }

    // Get the target user
    const targetUser = await payload.findByID({
      collection: 'users',
      id: targetUserId,
    })

    if (!targetUser) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 })
    }

    // Check if user is already a host
    if (targetUser.role === 'host') {
      return NextResponse.json({ 
        message: 'User is already a host',
        user: targetUser 
      })
    }

    // Validate payment if productId is provided
    if (productId) {
      const hasValidSubscription = await yocoService.validateSubscription(
        targetUser.id,
        productId
      )

      if (!hasValidSubscription) {
        return NextResponse.json({ 
          error: 'Valid subscription required for host promotion',
          requiredProduct: productId
        }, { status: 402 }) // Payment Required
      }
    }

    // Update user role to host
    const updatedUser = await payload.update({
      collection: 'users',
      id: targetUserId,
      data: {
        role: 'host',
        subscriptionStatus: {
          status: 'active',
          plan: 'pro',
        },
        hostProfile: {
          isVerified: true,
          verificationDate: new Date().toISOString(),
        },
      },
      user
    })

    return NextResponse.json({
      message: 'User successfully promoted to host',
      user: updatedUser
    })
  } catch (error) {
    console.error('Error promoting user to host:', error)
    return NextResponse.json(
      { error: 'Failed to promote user', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    )
  }
} 