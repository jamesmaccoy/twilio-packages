import { NextRequest, NextResponse } from 'next/server'
import { getPayload } from 'payload'
import configPromise from '@/payload.config'
import { BASE_PACKAGE_TEMPLATES } from '@/lib/package-types'
import jwt from 'jsonwebtoken'

type Suggestion = {
  revenueCatId?: string
  suggestedName?: string
  description?: string
  features?: string[]
  baseRate?: number
  /** Top-level nights (optional; merged from catalog templates when missing) */
  minNights?: number
  maxNights?: number
  details?: {
    minNights?: number
    maxNights?: number
    multiplier?: number
    category?: 'standard' | 'hosted' | 'addon' | 'special' | string
    customerTierRequired?: 'standard' | 'pro' | string
    features?: string
  }
}

function parseFiniteNumber(v: unknown, fallback: number): number {
  if (typeof v === 'number' && Number.isFinite(v)) return v
  if (typeof v === 'string' && v.trim()) {
    const n = Number(v.trim())
    if (Number.isFinite(n)) return n
  }
  return fallback
}

function resolveSuggestionFields(s: Suggestion) {
  const tpl = BASE_PACKAGE_TEMPLATES.find((t) => t.revenueCatId === s.revenueCatId)
  const d = (s.details || {}) as Record<string, unknown>
  const tplMin = tpl?.minNights ?? 1
  const tplMax = tpl?.maxNights ?? tplMin

  let minNights = parseFiniteNumber(d.minNights ?? s.minNights, tplMin)
  let maxNights = parseFiniteNumber(d.maxNights ?? s.maxNights, tplMax)
  minNights = Math.max(0.5, minNights)
  maxNights = Math.max(0.5, maxNights)
  if (maxNights < minNights) maxNights = minNights

  const category = (String(d.category || tpl?.category || 'standard') || 'standard') as any
  const multiplierRaw = parseFiniteNumber(d.multiplier ?? tpl?.baseMultiplier, 1)
  const multiplier = Number.isFinite(multiplierRaw) ? Math.min(3, Math.max(0.1, multiplierRaw)) : 1

  const tierRaw = String(d.customerTierRequired || tpl?.customerTierRequired || 'standard').toLowerCase()
  const entitlement = tierRaw.includes('pro') ? ('pro' as const) : ('standard' as const)

  return { minNights, maxNights, category, multiplier, entitlement }
}

export async function POST(req: NextRequest) {
  try {
    const payload = await getPayload({ config: configPromise })

    let user: any = null
    try {
      const authResult = await payload.auth({ headers: req.headers })
      user = authResult.user
    } catch {}

    // Fallback: if Payload didn't pick up cookies, try JWT auth using cookie token.
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

    // Final fallback: directly verify JWT and load user.
    if (!user && authTokens.length > 0) {
      for (const token of authTokens) {
        try {
          const decoded = jwt.verify(token, payload.secret) as unknown
          const id =
            typeof decoded === 'object' && decoded !== null && 'id' in decoded
              ? (decoded as any).id
              : null
          if (typeof id === 'string' && id.length > 0) {
            user = await payload.findByID({
              collection: 'users',
              id,
              overrideAccess: true,
            })
            break
          }
        } catch {
          continue
        }
      }
    }

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

      const { minNights, maxNights, category, multiplier, entitlement } = resolveSuggestionFields(s)

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

