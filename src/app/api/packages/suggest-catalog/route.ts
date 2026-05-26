import { NextRequest, NextResponse } from 'next/server'
import { getPayload } from 'payload'
import configPromise from '@/payload.config'
import { getMeUser } from '@/utilities/getMeUser'
import { runCatalogPackageSuggestions } from '@/lib/catalog-suggestions'
import type { PackagePlacementAnswers } from '@/lib/package-placement'

export async function POST(req: NextRequest) {
  try {
    const { user } = await getMeUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const role: string[] = Array.isArray(user.role) ? user.role : [user.role].filter(Boolean)
    if (!role.includes('host') && !role.includes('admin')) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const body = await req.json().catch(() => ({}))
    const postId = typeof body?.postId === 'string' ? body.postId.trim() : ''
    const placement = body?.placement as PackagePlacementAnswers | undefined

    if (!postId) return NextResponse.json({ error: 'postId is required' }, { status: 400 })
    if (
      !placement ||
      typeof placement.hostInvolved !== 'boolean' ||
      typeof placement.runSpecial !== 'boolean' ||
      typeof placement.exclusive !== 'boolean' ||
      typeof placement.onceOff !== 'boolean'
    ) {
      return NextResponse.json({ error: 'placement answers are required' }, { status: 400 })
    }

    const payload = await getPayload({ config: configPromise })
    const result = await runCatalogPackageSuggestions(payload, user, postId, undefined, placement)

    if (!result.success) {
      return NextResponse.json({ error: result.message }, { status: 500 })
    }

    return NextResponse.json({
      success: true,
      postId: result.postId,
      recommendations: result.recommendations,
      message: result.message,
    })
  } catch (error: any) {
    console.error('suggest-catalog error:', error)
    return NextResponse.json(
      { error: error?.message || 'Failed to suggest catalog packages' },
      { status: 500 },
    )
  }
}
