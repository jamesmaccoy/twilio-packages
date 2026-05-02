import { NextRequest, NextResponse } from 'next/server'
import { getPayload } from 'payload'
import configPromise from '@/payload.config'
import { resolvePayloadUserFromRequest } from '@/utilities/resolvePayloadUserFromRequest'

function isPlaceholderMobileEmail(email: string): boolean {
  return email.endsWith('@phone.simpleplek.invalid')
}

export async function PATCH(request: NextRequest) {
  try {
    const payload = await getPayload({ config: configPromise })

    const user = await resolvePayloadUserFromRequest(request, payload)
    if (!user?.id) {
      return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })
    }

    const body = (await request.json().catch(() => ({}))) as {
      name?: string
      email?: string
    }

    const name = typeof body.name === 'string' ? body.name.trim() : ''
    const email = typeof body.email === 'string' ? body.email.trim().toLowerCase() : ''

    if (!name) {
      return NextResponse.json({ error: 'Name is required' }, { status: 400 })
    }

    if (!email) {
      return NextResponse.json({ error: 'Email is required' }, { status: 400 })
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
    if (!emailRegex.test(email)) {
      return NextResponse.json({ error: 'Invalid email format' }, { status: 400 })
    }

    if (isPlaceholderMobileEmail(email)) {
      return NextResponse.json({ error: 'Please provide a real email address' }, { status: 400 })
    }

    const existing = await payload.find({
      collection: 'users',
      where: {
        and: [
          {
            email: {
              equals: email,
            },
          },
          {
            id: {
              not_equals: user.id,
            },
          },
        ],
      },
      overrideAccess: true,
      pagination: false,
      limit: 1,
    })

    if (existing.docs.length > 0) {
      return NextResponse.json({ error: 'That email is already in use' }, { status: 409 })
    }

    const updated = await payload.update({
      collection: 'users',
      id: user.id,
      data: {
        name,
        email,
      },
      overrideAccess: true,
    })

    const { password: _, salt: __, hash: ___, ...safeUser } = updated as any
    return NextResponse.json({ user: safeUser }, { status: 200 })
  } catch (error) {
    console.error('Error updating profile:', error)
    return NextResponse.json({ error: 'Failed to update profile' }, { status: 500 })
  }
}

