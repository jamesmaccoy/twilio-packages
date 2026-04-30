import { NextRequest, NextResponse } from 'next/server'
import { getPayload } from 'payload'
import configPromise from '@/payload.config'
import jwt from 'jsonwebtoken'

export const runtime = 'nodejs'

async function getAuthedUser(payload: any, req: NextRequest): Promise<any | null> {
  let user: any = null
  try {
    const authResult = await payload.auth({ headers: req.headers })
    user = authResult.user
  } catch {
    user = null
  }

  const prefixToken = req.cookies.get(`${payload.config.cookiePrefix}-token`)?.value
  const legacyToken = req.cookies.get('payload-token')?.value
  const authTokens = [prefixToken, legacyToken].filter(
    (token, index, self): token is string => Boolean(token) && self.indexOf(token) === index,
  )

  if (!user && authTokens.length > 0) {
    for (const token of authTokens) {
      try {
        const headersWithToken = new Headers(req.headers)
        headersWithToken.set('authorization', `JWT ${token}`)
        const tokenAuthResult = await payload.auth({ headers: headersWithToken })
        if (tokenAuthResult.user) {
          user = tokenAuthResult.user
          break
        }
      } catch {
        continue
      }
    }
  }

  if (!user && authTokens.length > 0) {
    for (const token of authTokens) {
      try {
        const decoded = jwt.verify(token, payload.secret) as unknown
        const id =
          typeof decoded === 'object' && decoded !== null && 'id' in decoded ? (decoded as any).id : null
        if (typeof id === 'string' && id.length > 0) {
          user = await payload.findByID({ collection: 'users', id, overrideAccess: true, depth: 0 })
          break
        }
      } catch {
        continue
      }
    }
  }

  return user || null
}

export async function GET(req: NextRequest) {
  try {
    const payload = await getPayload({ config: configPromise })
    const url = new URL(req.url)
    const limit = Number(url.searchParams.get('limit') || 50)
    const page = Number(url.searchParams.get('page') || 1)
    const sort = url.searchParams.get('sort') || undefined
    const depth = Number(url.searchParams.get('depth') || 2)

    const result = await payload.find({
      collection: 'media',
      limit: Number.isFinite(limit) ? limit : 50,
      page: Number.isFinite(page) ? page : 1,
      sort,
      depth,
    })

    return NextResponse.json(result)
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || 'Failed to fetch media' }, { status: 500 })
  }
}

export async function POST(req: NextRequest) {
  try {
    const payload = await getPayload({ config: configPromise })
    const user = await getAuthedUser(payload, req)
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const formData = await req.formData()
    const file = formData.get('file')
    const payloadField = formData.get('_payload')

    if (!(file instanceof File)) {
      return NextResponse.json({ error: 'Missing file' }, { status: 400 })
    }

    let data: Record<string, any> = {}
    if (typeof payloadField === 'string' && payloadField.trim()) {
      try {
        data = JSON.parse(payloadField)
      } catch {
        // ignore
      }
    }

    const arrayBuffer = await file.arrayBuffer()
    const buffer = Buffer.from(arrayBuffer)

    const created = await payload.create({
      collection: 'media',
      data: {
        alt: typeof data.alt === 'string' ? data.alt : undefined,
        caption: data.caption,
      },
      file: {
        data: buffer,
        mimetype: file.type || 'application/octet-stream',
        name: file.name || 'upload',
        size: buffer.length,
      },
      user,
    })

    return NextResponse.json({ doc: created })
  } catch (e: any) {
    const message = e?.message || 'Upload failed'
    const status = typeof e?.status === 'number' ? e.status : 403
    return NextResponse.json({ error: message }, { status })
  }
}

