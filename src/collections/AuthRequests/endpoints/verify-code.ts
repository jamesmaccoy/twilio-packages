import { cookies } from 'next/headers'
import { Endpoint } from 'payload'
import { z } from 'zod'
import jwt from 'jsonwebtoken'
import Twilio from 'twilio'

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

    const accountSid = process.env.TWILIO_ACCOUNT_SID?.trim()
    const authToken = process.env.TWILIO_AUTH_TOKEN?.trim()
    const verifyServiceSid = process.env.TWILIO_VERIFY_SERVICE_SID?.trim()

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
      if (!req.user?.id) {
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
                not_equals: req.user.id,
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
        id: req.user.id,
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

    const user = users.docs[0]

    if (!user) {
      return Response.json(
        {
          message: 'No account found for this mobile number',
        },
        { status: 404 },
      )
    }

    const collectionConfig = req.payload.collections['users']?.config
    if (!collectionConfig) {
      throw new Error('Users collection config not found')
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
