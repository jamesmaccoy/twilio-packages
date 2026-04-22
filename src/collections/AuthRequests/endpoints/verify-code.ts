import { cookies } from 'next/headers'
import { Endpoint } from 'payload'
import { z } from 'zod'
import jwt from 'jsonwebtoken'
import Twilio from 'twilio'
import crypto from 'node:crypto'

const bodySchema = z.object({
  mobile: z
    .string()
    .min(8)
    .max(20)
    .regex(/^\+[1-9]\d+$/, 'Mobile number must be in E.164 format (e.g. +27821234567)'),
  requestId: z.string(),
  otp: z.string().min(6).max(6),
  mode: z.enum(['login', 'onboarding']).optional(),
})

function cleanEnv(value: string | undefined): string | undefined {
  if (!value) return undefined
  return value.trim().replace(/^['"]|['"]$/g, '')
}

function getCookieValue(cookieHeader: string | null, name: string): string | null {
  if (!cookieHeader) return null
  const parts = cookieHeader.split(';')
  for (const part of parts) {
    const [k, ...v] = part.trim().split('=')
    if (k === name) return decodeURIComponent(v.join('='))
  }
  return null
}

function getAnyTokenCookie(cookieHeader: string | null): string | null {
  if (!cookieHeader) return null
  const parts = cookieHeader.split(';').map((p) => p.trim())
  for (const part of parts) {
    const [k, ...v] = part.split('=')
    if (k && k.endsWith('-token')) return decodeURIComponent(v.join('='))
  }
  return null
}

function emailForMobile(mobile: string): string {
  const digits = mobile.replace(/\D/g, '')
  return `mobile-${digits}@phone.simpleplek.invalid`
}

export const VerifyCode: Endpoint = {
  method: 'post',
  path: '/verify-code',
  handler: async (req) => {
    const body = bodySchema.safeParse(await req.json?.())

    if (!body.success) {
      return Response.json(
        {
          message: 'Bad request',
          errors: body.error.flatten().fieldErrors,
        },
        { status: 400 },
      )
    }

    const { mobile, requestId, otp, mode = 'login' } = body.data

    const authRequest = await req.payload.findByID({
      id: requestId,
      collection: 'authRequests',
      overrideAccess: true,
    })

    if (!authRequest) {
      return Response.json(
        {
          message: 'Invalid or expired request',
        },
        { status: 400 },
      )
    }

    const authRequestMobile =
      typeof authRequest === 'object' && authRequest !== null && 'mobile' in authRequest
        ? authRequest.mobile
        : undefined

    if (new Date(authRequest.expiresAt) < new Date() || authRequestMobile !== mobile) {
      return Response.json(
        {
          message: 'Invalid or expired OTP',
        },
        { status: 400 },
      )
    }

    const accountSid = cleanEnv(process.env.TWILIO_ACCOUNT_SID)
    const authToken = cleanEnv(process.env.TWILIO_AUTH_TOKEN)
    const verifyServiceSid = cleanEnv(process.env.TWILIO_VERIFY_SERVICE_SID)

    if (!accountSid || !authToken || !verifyServiceSid) {
      return Response.json(
        {
          message: 'SMS provider is not configured',
        },
        { status: 500 },
      )
    }

    const twilioClient = Twilio(accountSid, authToken)
    const verification = await twilioClient.verify.v2
      .services(verifyServiceSid)
      .verificationChecks.create({ to: mobile, code: otp })

    if (verification.status !== 'approved') {
      return Response.json(
        {
          message: 'Invalid or expired OTP',
        },
        { status: 400 },
      )
    }

    // OTP is valid, proceed with onboarding flow for authenticated users
    if (mode === 'onboarding') {
      let userId = req.user?.id

      // In some runtimes, Payload endpoints may not populate req.user even though the session cookie exists.
      // For onboarding, fall back to verifying the JWT from cookies to identify the current user.
      if (!userId) {
        const cookieHeader = req.headers?.get?.('cookie') || null
        const legacyToken = getCookieValue(cookieHeader, 'payload-token')
        const prefixToken = getAnyTokenCookie(cookieHeader)
        const token = prefixToken || legacyToken

        if (token) {
          try {
            const decoded = jwt.verify(token, req.payload.secret) as unknown
            const id =
              typeof decoded === 'object' && decoded !== null && 'id' in decoded
                ? (decoded as { id?: unknown }).id
                : null
            if (typeof id === 'string' && id.length > 0) {
              userId = id
            }
          } catch {
            // ignore
          }
        }
      }

      if (!userId) {
        return Response.json(
          {
            message: 'Unauthorized',
          },
          { status: 401 },
        )
      }

      const existingUserForMobile = await req.payload.find({
        collection: 'users',
        where: {
          and: [
            {
              mobile: {
                equals: mobile,
              },
            },
            {
              id: {
                not_equals: userId,
              },
            },
          ],
        },
        overrideAccess: true,
        pagination: false,
        limit: 1,
      })

      if (existingUserForMobile.docs.length > 0) {
        return Response.json(
          {
            message: 'This mobile number is already linked to another account',
          },
          { status: 409 },
        )
      }

      await req.payload.update({
        collection: 'users',
        id: userId,
        data: {
          mobile,
          mobileVerified: true,
        },
        overrideAccess: true,
      })

      await req.payload.delete({
        collection: 'authRequests',
        id: authRequest.id,
        overrideAccess: true,
      })

      return Response.json(
        {
          message: 'Mobile number verified successfully',
          mobileVerified: true,
        },
        { status: 200 },
      )
    }

    // OTP is valid, proceed with login flow

    const users = await req.payload.find({
      collection: 'users',
      where: {
        mobile: {
          equals: mobile,
        },
      },
      overrideAccess: true,
      pagination: false,
      limit: 1,
    })

    let user = users.docs[0]

    // If the OTP is verified but the user doesn't exist yet, create a customer account.
    // We mark the mobile as verified since Twilio Verify approved the OTP.
    if (!user) {
      const newUserEmail = emailForMobile(mobile)

      const existingEmail = await req.payload.find({
        collection: 'users',
        where: {
          email: {
            equals: newUserEmail,
          },
        },
        overrideAccess: true,
        pagination: false,
        limit: 1,
      })

      if (existingEmail.docs.length > 0) {
        user = existingEmail.docs[0]
      } else {
        user = await req.payload.create({
          collection: 'users',
          data: {
            email: newUserEmail,
            name: mobile,
            mobile,
            mobileVerified: true,
            role: 'customer',
            password: crypto.randomBytes(20).toString('hex'),
          },
          overrideAccess: true,
        })
      }
    }

    const collectionConfig = req.payload.collections['users']?.config
    if (!collectionConfig) {
      throw new Error('Users collection config not found')
    }

    if (!user) {
      throw new Error('User not found after OTP verification')
    }

    const tokenPayload = {
      email: user.email,
      id: user.id,
      collection: collectionConfig.slug,
    }

    const token = jwt.sign(tokenPayload, req.payload.secret, {
      expiresIn: collectionConfig.auth.tokenExpiration,
    })

    const cookieStore = await cookies()

    cookieStore.set(`${req.payload.config.cookiePrefix}-token`, token, {
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
    cookieStore.set('payload-token', token, {
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

    return Response.json(
      {
        message: 'OTP verified successfully',
        mobileVerified: Boolean((user as any).mobileVerified),
      },
      { status: 200 },
    )
  },
}
