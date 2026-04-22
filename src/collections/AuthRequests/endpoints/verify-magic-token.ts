import { APIError, Endpoint } from 'payload'
import crypto from 'node:crypto'
import jwt from 'jsonwebtoken'
import { cookies } from 'next/headers'
import { validateRedirect } from '@/utils/validateRedirect'

function buildMobileCandidate(seed: string, attempt: number): string {
  const input = `${seed}:${attempt}`
  const hash = crypto.createHash('sha256').update(input).digest('hex')
  const digits = BigInt(`0x${hash}`).toString().slice(0, 11).padEnd(11, '0')
  return `+27${digits}`
}

export const VerifyMagicToken: Endpoint = {
  method: 'get',
  path: '/verify-magic-token',
  handler: async (req) => {
    const token = req.query?.token

    if (!token || typeof token !== 'string') {
      return Response.json(
        {
          message: 'Bad request, token is required',
        },
        {
          status: 400,
        },
      )
    }

    try {
      const decodedPayload = jwt.verify(token, req.payload.secret)

      if (
        typeof decodedPayload !== 'object' ||
        !decodedPayload.email ||
        !decodedPayload.authRequestId
      ) {
        return Response.json(
          {
            message: 'Invalid token',
          },
          {
            status: 400,
          },
        )
      }

      const { email, authRequestId } = decodedPayload

      const authRequest = await req.payload.findByID({
        id: authRequestId,
        collection: 'authRequests',
        overrideAccess: true,
      })

      if (
        !authRequest ||
        authRequest.email !== email ||
        new Date(authRequest.expiresAt) < new Date()
      ) {
        if (authRequest && new Date(authRequest.expiresAt) < new Date()) {
          await req.payload.delete({
            collection: 'authRequests',
            id: authRequest.id,
            overrideAccess: true,
          })
        }
        return Response.json(
          {
            message: 'Invalid token',
          },
          {
            status: 400,
          },
        )
      }

      // Magic token is valid, proceed with authentication
      const users = await req.payload.find({
        collection: 'users',
        where: {
          email: {
            equals: email,
          },
        },
        overrideAccess: true,
        pagination: false,
        limit: 1,
      })

      let user = users.docs[0]

      if (!user) {
        const generatedPassword = crypto.randomBytes(16).toString('hex')
        const generatedName = email.split('@')[0]

        for (let attempt = 0; attempt < 5; attempt++) {
          const mobile = buildMobileCandidate(email, attempt)
          try {
            user = await req.payload.create({
              collection: 'users',
              data: {
                email,
                password: generatedPassword,
                name: generatedName,
                mobile,
                role: 'customer',
                mobileVerified: false,
              },
              overrideAccess: true,
            })
            break
          } catch (createError) {
            if (
              createError instanceof Error &&
              (createError.message.includes('mobile') || createError.message.includes('E11000'))
            ) {
              continue
            }
            throw createError
          }
        }

        if (!user) {
          throw new Error('Could not create user for magic link authentication')
        }
      }

      const collectionConfig = req.payload.collections['users']?.config
      if (!collectionConfig) {
        throw new Error('Users collection config not found')
      }

      const tokenPayload = {
        email,
        id: user.id,
        collection: collectionConfig.slug,
      }

      const authToken = jwt.sign(tokenPayload, req.payload.secret, {
        expiresIn: collectionConfig.auth.tokenExpiration,
      })

      const cookieStore = await cookies()

      cookieStore.set(`${req.payload.config.cookiePrefix}-token`, authToken, {
        path: '/',
        httpOnly: true,
        maxAge: collectionConfig.auth.tokenExpiration,
        secure: collectionConfig.auth.cookies.secure,
        sameSite:
          typeof collectionConfig.auth.cookies.sameSite === 'string'
            ? (collectionConfig.auth.cookies.sameSite.toLowerCase() as 'lax' | 'strict' | 'none')
            : collectionConfig.auth.cookies.sameSite,
        domain: collectionConfig.auth.cookies.domain,
      })
      cookieStore.set('payload-token', authToken, {
        path: '/',
        httpOnly: true,
        maxAge: collectionConfig.auth.tokenExpiration,
        secure: collectionConfig.auth.cookies.secure,
        sameSite:
          typeof collectionConfig.auth.cookies.sameSite === 'string'
            ? (collectionConfig.auth.cookies.sameSite.toLowerCase() as 'lax' | 'strict' | 'none')
            : collectionConfig.auth.cookies.sameSite,
        domain: collectionConfig.auth.cookies.domain,
      })

      await req.payload.delete({
        collection: 'authRequests',
        id: authRequest.id,
        overrideAccess: true,
      })

      const next =
        typeof decodedPayload === 'object' && decodedPayload && 'next' in decodedPayload
          ? validateRedirect((decodedPayload as any).next)
          : null

      const baseUrl =
        process.env.NEXT_PUBLIC_URL || process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:3000'

      const target = user.mobileVerified
        ? next || '/bookings'
        : `/onboarding/mobile?next=${encodeURIComponent(next || '/bookings')}`

      return Response.redirect(`${baseUrl}${target}`)
    } catch (err) {
      console.error('Error verifying magic token:', err)

      if (err instanceof APIError) {
        if (err.status !== 500) {
          return Response.json(
            {
              message: 'Invalid token',
            },
            {
              status: 400,
            },
          )
        }
      }

      return Response.json(
        {
          message: 'Internal server error',
        },
        {
          status: 500,
        },
      )
    }
  },
}
