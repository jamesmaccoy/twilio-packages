import { NextRequest, NextResponse } from 'next/server'
import { getMeUser } from '@/utilities/getMeUser'
import { getPayload } from 'payload'
import configPromise from '@/payload.config'

function buildMinimalPostContent(text: string) {
  return {
    root: {
      type: 'root',
      children: [
        {
          type: 'paragraph',
          children: [
            {
              type: 'text',
              text,
              format: 0,
              style: '',
              mode: 'normal',
              detail: 0,
            },
          ],
          direction: 'ltr',
          format: '',
          indent: 0,
          version: 1,
        },
      ],
      direction: 'ltr',
      format: '',
      indent: 0,
      version: 1,
    },
  }
}

export async function POST(req: NextRequest) {
  const { user } = await getMeUser()
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const role = (user as any).role
  const roleArray = Array.isArray(role) ? role : role ? [role] : []
  const isHostOrAdmin = roleArray.includes('host') || roleArray.includes('admin')
  if (!isHostOrAdmin) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  let body: any = null
  try {
    body = await req.json()
  } catch {
    body = {}
  }

  const title = typeof body?.title === 'string' ? body.title.trim() : ''
  const description = typeof body?.description === 'string' ? body.description.trim() : ''
  const heroImageRaw = body?.heroImage
  const heroImage =
    typeof heroImageRaw === 'string' && heroImageRaw.trim().length > 0 ? heroImageRaw.trim() : undefined
  const wifi = typeof body?.wifi === 'string' ? body.wifi.trim() : ''
  const lockbox = typeof body?.lockbox === 'string' ? body.lockbox.trim() : ''

  if (!title) {
    return NextResponse.json({ error: 'Title is required' }, { status: 400 })
  }

  const payload = await getPayload({ config: configPromise })

  const post = await payload.create({
    collection: 'posts',
    data: {
      title: title.slice(0, 120),
      meta: {
        description: description ? description.slice(0, 300) : null,
        ...(heroImage ? { image: heroImage } : {}),
      },
      content: buildMinimalPostContent(
        (description || 'Draft property created from Manage. Add details and publish when ready.').slice(0, 8000),
      ) as any,
      _status: 'draft',
      ...(heroImage ? { heroImage } : {}),
      ...(wifi ? { wifi: wifi.slice(0, 500) } : {}),
      ...(lockbox ? { lockbox: lockbox.slice(0, 500) } : {}),
    },
    user,
  })

  return NextResponse.json({ success: true, post, postId: post.id })
}

