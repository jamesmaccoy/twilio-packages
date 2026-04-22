import { NextRequest, NextResponse } from 'next/server'
import { getPayload } from 'payload'
import configPromise from '@payload-config'

export async function POST(request: NextRequest) {
  try {
    const { targetRole } = await request.json()

    const payload = await getPayload({ config: configPromise })
    const { user } = await payload.auth({ headers: request.headers })

    if (!user) {
      return NextResponse.json({ error: 'Authentication required' }, { status: 401 })
    }

    // Validate target role - only allow upgrading to 'host', not 'admin'
    const validRoles = ['host']
    if (!validRoles.includes(targetRole)) {
      return NextResponse.json({ 
        error: 'Invalid target role. Must be one of: ' + validRoles.join(', '),
        currentRoles: user.role 
      }, { status: 400 })
    }

    // Check current role - only allow customers to upgrade
    const role = user.role
    const roleArray = Array.isArray(role) ? role : role ? [role] : []
    if (roleArray.includes('admin') || roleArray.includes('host')) {
      return NextResponse.json({ 
        error: 'Only customers can upgrade their role. You are already a ' + roleArray[0],
        currentRoles: roleArray
      }, { status: 403 })
    }

    const subscriptionCheck = await payload.find({
      collection: 'yoco-transactions',
      where: {
        and: [
          {
            user: {
              equals: user.id,
            },
          },
          {
            intent: {
              equals: 'subscription',
            },
          },
          {
            status: {
              equals: 'completed',
            },
          },
          {
            entitlement: {
              equals: 'pro',
            },
          },
        ],
      },
      sort: '-completedAt',
      limit: 1,
    })

    const activeTransaction = subscriptionCheck.docs[0]
    const now = new Date()
    const hasActiveSubscription = Boolean(
      activeTransaction && (!activeTransaction.expiresAt || new Date(activeTransaction.expiresAt) > now),
    )

    if (!hasActiveSubscription) {
      return NextResponse.json({
        error: 'Active pro subscription required to upgrade role',
        hasSubscription: false,
        activeEntitlements: activeTransaction ? [activeTransaction.entitlement] : [],
      }, { status: 403 })
    }

    // Update user role
    const updatedUser = await payload.update({
      collection: 'users',
      id: user.id,
      data: {
        role: targetRole,
      },
    })

    return NextResponse.json({
      success: true,
      message: `Successfully upgraded to ${targetRole} role`,
      previousRoles: user.role,
      newRoles: [updatedUser.role],
      hasActiveSubscription: true,
      activeEntitlements: [activeTransaction.entitlement],
    })

  } catch (error) {
    console.error('Error upgrading role:', error)
    return NextResponse.json({ 
      error: 'Failed to upgrade role',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 })
  }
} 