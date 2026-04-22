import { NextRequest, NextResponse } from 'next/server'
import { getPayload } from 'payload'
import configPromise from '@/payload.config'
import { getMeUser } from '@/utilities/getMeUser'

export async function GET(request: NextRequest) {
  try {
    const { user } = await getMeUser()
    
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const payload = await getPayload({ config: configPromise })
    const { searchParams } = new URL(request.url)
    
    const limit = parseInt(searchParams.get('limit') || '50')
    const page = parseInt(searchParams.get('page') || '1')
    const unreadOnly = searchParams.get('unreadOnly') === 'true'

    const where: any = {
      user: {
        equals: user.id,
      },
    }

    if (unreadOnly) {
      where.read = {
        equals: false,
      }
    }

    // Query yoco-transactions collection for notification records (type field exists)
    const notifications = await payload.find({
      collection: 'yoco-transactions',
      where: {
        ...where,
        type: {
          exists: true,
        },
      },
      limit,
      page,
      sort: '-createdAt',
      depth: 2, // Populate relationships
    })

    return NextResponse.json({
      notifications: notifications.docs,
      totalDocs: notifications.totalDocs,
      totalPages: notifications.totalPages,
      page: notifications.page,
    })
  } catch (error) {
    console.error('Error fetching notifications:', error)
    return NextResponse.json(
      { error: 'Failed to fetch notifications' },
      { status: 500 }
    )
  }
}

export async function PATCH(request: NextRequest) {
  try {
    const { user } = await getMeUser()
    
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const payload = await getPayload({ config: configPromise })
    const body = await request.json()
    const { notificationId, read } = body

    if (!notificationId) {
      return NextResponse.json({ error: 'Notification ID is required' }, { status: 400 })
    }

    // Verify the notification belongs to the user
    const notification = await payload.findByID({
      collection: 'yoco-transactions',
      id: notificationId,
      depth: 0,
    })

    if (!notification) {
      return NextResponse.json({ error: 'Notification not found' }, { status: 404 })
    }

    const notificationUserId = typeof notification.user === 'string' 
      ? notification.user 
      : notification.user?.id

    if (notificationUserId !== user.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 403 })
    }

    const updated = await payload.update({
      collection: 'yoco-transactions',
      id: notificationId,
      data: {
        read: read !== undefined ? read : !notification.read,
      },
    })

    return NextResponse.json({ notification: updated })
  } catch (error) {
    console.error('Error updating notification:', error)
    return NextResponse.json(
      { error: 'Failed to update notification' },
      { status: 500 }
    )
  }
}

