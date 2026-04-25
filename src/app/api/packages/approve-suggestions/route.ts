import { NextRequest, NextResponse } from 'next/server'
import { getPayload } from 'payload'
import configPromise from '@/payload.config'

type Suggestion = {
  revenueCatId?: string
  suggestedName?: string
  description?: string
  features?: string[]
  baseRate?: number
  details?: {
    minNights?: number
    maxNights?: number
    multiplier?: number
    category?: 'standard' | 'hosted' | 'addon' | 'special' | string
    customerTierRequired?: 'standard' | 'pro' | string
    features?: string
  }
}

export async function POST(req: NextRequest) {
  try {
    const payload = await getPayload({ config: configPromise })

    let user: any = null
    try {
      const authResult = await payload.auth({ headers: req.headers })
      user = authResult.user
    } catch {}

    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const role: string[] = Array.isArray(user.role) ? user.role : [user.role].filter(Boolean)
    const isHostOrAdmin = role.includes('host') || role.includes('admin')
    if (!isHostOrAdmin) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

    const body = await req.json().catch(() => ({}))
    const postId = typeof body?.postId === 'string' ? body.postId.trim() : ''
    const suggestions: Suggestion[] = Array.isArray(body?.suggestions) ? body.suggestions : []

    if (!postId) return NextResponse.json({ error: 'postId is required' }, { status: 400 })
    if (suggestions.length === 0) return NextResponse.json({ created: [] })

    const created: any[] = []

    for (const s of suggestions) {
      const name = String(s?.suggestedName || '📦 Package').trim()
      const description = String(s?.description || '').trim() || undefined
      const details = (s?.details || {}) as any

      const category = (String(details?.category || 'standard') || 'standard') as any
      const minNightsRaw = Number(details?.minNights ?? 1)
      const maxNightsRaw = Number(details?.maxNights ?? minNightsRaw ?? 1)
      const minNights = Number.isFinite(minNightsRaw) ? Math.max(0.5, minNightsRaw) : 1
      const maxNights = Number.isFinite(maxNightsRaw) ? Math.max(0.5, maxNightsRaw) : minNights

      const multiplierRaw = Number(details?.multiplier ?? 1)
      const multiplier = Number.isFinite(multiplierRaw) ? multiplierRaw : 1

      const customerTierRequired = String(details?.customerTierRequired || 'standard').toLowerCase()
      const entitlement = customerTierRequired.includes('pro') ? 'pro' : 'standard'

      const features =
        Array.isArray(s?.features) && s.features.length > 0
          ? s.features
          : typeof details?.features === 'string'
            ? String(details.features)
                .split(',')
                .map((x: string) => x.trim())
                .filter(Boolean)
            : []

      const baseRate = typeof s?.baseRate === 'number' && Number.isFinite(s.baseRate) ? s.baseRate : undefined
      const revenueCatId = typeof s?.revenueCatId === 'string' ? s.revenueCatId : undefined

      const doc = await payload.create({
        collection: 'packages',
        user,
        data: {
          post: postId,
          name,
          description,
          category,
          entitlement,
          minNights,
          maxNights,
          baseRate,
          multiplier,
          features: Array.isArray(features) ? features.map((f) => ({ feature: f })) : [],
          // Keep legacy id fields in sync for downstream:
          revenueCatId: revenueCatId || undefined,
          yocoId: revenueCatId || undefined,
          isEnabled: true,
        },
      })

      created.push(doc)
    }

    return NextResponse.json({ created })
  } catch (error) {
    console.error('Approve suggestions error:', error)
    return NextResponse.json({ error: 'Failed to approve suggestions' }, { status: 500 })
  }
}

