import { NextRequest, NextResponse } from 'next/server'
import { getPayload } from 'payload'
import configPromise from '@/payload.config'
import { sendPackageActivityNotification } from '@/lib/emailNotifications'

export async function GET(request: NextRequest) {
  try {
    const payload = await getPayload({ config: configPromise })
    
    // Check authentication - packages collection requires authenticated access
    let user = null
    try {
      const authResult = await payload.auth({ headers: request.headers })
      user = authResult.user
    } catch (authError) {
      // User not authenticated
      return NextResponse.json(
        { error: 'Unauthorized. Please log in to access packages.' },
        { status: 401 }
      )
    }
    
    if (!user) {
      return NextResponse.json(
        { error: 'Unauthorized. Please log in to access packages.' },
        { status: 401 }
      )
    }
    
    const { searchParams } = new URL(request.url)
    
    // Build where clause from query parameters
    const where: any = {}
    
    // Handle post filter
    const postId = searchParams.get('where[post][equals]')
    if (postId) {
      where.post = { equals: postId }
    }
    
    // Handle isEnabled filter
    const isEnabled = searchParams.get('where[isEnabled][equals]')
    if (isEnabled !== null) {
      where.isEnabled = { equals: isEnabled === 'true' }
    }
    
    const packages = await payload.find({
      collection: 'packages',
      where: Object.keys(where).length > 0 ? where : undefined,
      depth: 2, // Increased depth to include related page data
      user, // Pass user for access control
    })
    
    return NextResponse.json(packages)
  } catch (error) {
    console.error('Error fetching packages:', error)
    const errorMessage = error instanceof Error ? error.message : 'Failed to fetch packages'
    return NextResponse.json(
      { error: errorMessage, details: process.env.NODE_ENV === 'development' ? String(error) : undefined },
      { status: 500 }
    )
  }
}

export async function POST(request: NextRequest) {
  try {
    const payload = await getPayload({ config: configPromise })
    const { user } = await payload.auth({ headers: request.headers })
    
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    
    // Handle different content types
    let body: any
    const contentType = request.headers.get('content-type') || ''
    
    if (contentType.includes('application/json')) {
      body = await request.json()
    } else if (contentType.includes('application/x-www-form-urlencoded')) {
      const formData = await request.formData()
      body = Object.fromEntries(formData.entries())
    } else {
      // Try JSON first, fallback to text
      try {
        const text = await request.text()
        body = text ? JSON.parse(text) : {}
      } catch {
        body = {}
      }
    }
    
    const packageDoc = await payload.create({
      collection: 'packages',
      data: body,
      user,
    })

    // Fire-and-forget confirmation email to actor + admin
    try {
      const actorEmail =
        typeof (user as any)?.email === 'string' ? ((user as any).email as string) : ''
      const postId =
        typeof (packageDoc as any)?.post === 'string'
          ? (packageDoc as any).post
          : (packageDoc as any)?.post?.id
      let propertyTitle: string | undefined
      if (postId) {
        try {
          const post = await payload.findByID({ collection: 'posts', id: String(postId), depth: 0, user })
          propertyTitle = typeof (post as any)?.title === 'string' ? (post as any).title : undefined
        } catch {}
      }
      if (actorEmail) {
        await sendPackageActivityNotification({
          actorEmail,
          action: 'created',
          packageId: String((packageDoc as any).id),
          packageName: String((packageDoc as any).name || 'Package'),
          postId: postId ? String(postId) : undefined,
          propertyTitle,
          threadSubject: `Package activity: ${String((packageDoc as any).name || 'Package')}${propertyTitle ? ` (${propertyTitle})` : ''}`,
        })
      }
    } catch (emailErr) {
      console.warn('Package activity email failed (non-fatal):', emailErr)
    }
    
    return NextResponse.json(packageDoc)
  } catch (error) {
    console.error('Error creating package:', error)
    return NextResponse.json(
      { error: 'Failed to create package' },
      { status: 500 }
    )
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const payload = await getPayload({ config: configPromise })
    
    // Try to get the user from the request
    let user = null
    try {
      const authResult = await payload.auth({ headers: request.headers })
      user = authResult.user
    } catch (authError) {
      console.log('Authentication failed, trying admin context:', authError)
      // If authentication fails, this might be an admin request
    }
    
    const { searchParams } = new URL(request.url)
    const ids = searchParams.getAll('where[id][in][]')
    
    console.log('DELETE request for packages:', { ids, user: user?.id ? '[REDACTED]' : 'admin' })
    
    if (!ids || ids.length === 0) {
      return NextResponse.json(
        { error: 'No package IDs provided' },
        { status: 400 }
      )
    }
    
    // Delete packages one by one
    const deletedPackages = []
    const failedPackages = []
    
    for (const id of ids) {
      try {
        console.log(`Attempting to delete package: ${id}`)
        
        // For admin requests, we might not have a user object
        const deleteOptions: any = {
          collection: 'packages',
          id,
        }
        
        if (user) {
          deleteOptions.user = user
        }
        
        const deletedPackage = await payload.delete(deleteOptions)
        deletedPackages.push(deletedPackage)
        console.log(`Successfully deleted package: ${id}`)
      } catch (error) {
        console.error(`Error deleting package ${id}:`, error)
        failedPackages.push({ id, error: error instanceof Error ? error.message : 'Unknown error' })
        // Continue with other deletions even if one fails
      }
    }
    
    const response = {
      message: `Successfully deleted ${deletedPackages.length} packages${failedPackages.length > 0 ? `, ${failedPackages.length} failed` : ''}`,
      deletedPackages,
      failedPackages: failedPackages.length > 0 ? failedPackages : undefined,
    }
    
    console.log('DELETE response:', response)
    return NextResponse.json(response)
  } catch (error) {
    console.error('Error deleting packages:', error)
    return NextResponse.json(
      { error: 'Failed to delete packages', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    )
  }
} 