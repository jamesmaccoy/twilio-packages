import { NextRequest, NextResponse } from 'next/server'
import { getPayload } from 'payload'
import configPromise from '@/payload.config'
import jwt from 'jsonwebtoken'

export async function GET(req: NextRequest) {
  try {
    const payload = await getPayload({ config: configPromise })

    let user: any = null
    try {
      const authResult = await payload.auth({ headers: req.headers })
      user = authResult.user
    } catch {}

    const prefixToken = req.cookies.get(`${payload.config.cookiePrefix}-token`)?.value
    const legacyToken = req.cookies.get('payload-token')?.value
    const authTokens = [prefixToken, legacyToken].filter(
      (token, index, self): token is string => Boolean(token) && self.indexOf(token) === index,
    )

    let jwtId: string | null = null
    for (const token of authTokens) {
      try {
        const decoded = jwt.verify(token, payload.secret) as any
        jwtId = decoded?.id ? String(decoded.id) : null
        if (jwtId) break
      } catch {}
    }

    return NextResponse.json({
      hasCookieHeader: Boolean(req.headers.get('cookie')),
      cookieNames: req.cookies.getAll().map((c) => c.name),
      payloadCookiePrefix: payload.config.cookiePrefix,
      hasPrefixToken: Boolean(prefixToken),
      hasLegacyToken: Boolean(legacyToken),
      authTokensCount: authTokens.length,
      jwtId,
      authedUserId: user?.id ?? null,
      authedUserRole: (user as any)?.role ?? null,
    })
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || 'debug failed' }, { status: 500 })
  }
}

