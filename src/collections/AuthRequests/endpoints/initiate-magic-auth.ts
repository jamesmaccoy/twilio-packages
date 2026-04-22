import { Endpoint } from 'payload'
import { z } from 'zod'
import { HMAC } from 'oslo/crypto'
import { generateHOTP } from 'oslo/otp'
import { addMinutes } from 'date-fns'
import Twilio from 'twilio'

const bodySchema = z.object({
  mobile: z
    .string()
    .min(8)
    .max(20)
    .regex(/^\+[1-9]\d+$/, 'Mobile number must be in E.164 format (e.g. +27821234567)'),
})

function cleanEnv(value: string | undefined): string | undefined {
  if (!value) return undefined
  return value.trim().replace(/^['"]|['"]$/g, '')
}

export const InitiateMagicAuth: Endpoint = {
  method: 'post',
  path: '/magic',
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

    const { mobile } = body.data
    const accountSid = cleanEnv(process.env.TWILIO_ACCOUNT_SID)
    const authToken = cleanEnv(process.env.TWILIO_AUTH_TOKEN)
    const verifyServiceSid = cleanEnv(process.env.TWILIO_VERIFY_SERVICE_SID)

    if (!accountSid || !authToken || !verifyServiceSid) {
      return Response.json(
        {
          message: 'OTP service is not configured. Please contact support.',
        },
        { status: 500 },
      )
    }

    if (!accountSid.startsWith('AC')) {
      return Response.json(
        {
          message: 'Invalid TWILIO_ACCOUNT_SID configuration.',
        },
        { status: 500 },
      )
    }

    const secret = await new HMAC('SHA-1').generateKey()

    const code = await generateHOTP(secret, 10, 6)

    try {
      const authRequest = await req.payload.create({
        collection: 'authRequests',
        data: {
          mobile,
          code,
          expiresAt: addMinutes(new Date(), 15).toISOString(), // Code expires in 10 minutes
        },
        overrideAccess: true,
      })

      const twilioClient = Twilio(accountSid, authToken)
      await twilioClient.verify.v2.services(verifyServiceSid).verifications.create({
        to: mobile,
        channel: 'sms',
      })

      return Response.json(
        {
          message: `OTP auth initiated for ${mobile}`,
          mobile,
          authRequestId: authRequest.id,
        },
        {
          status: 200,
        },
      )
    } catch (error) {
      const message =
        error instanceof Error
          ? error.message
          : 'Failed to send OTP, please confirm Twilio Verify setup.'

      req.payload.logger.error(`OTP initiation failed: ${message}`)
      return Response.json(
        {
          message,
        },
        { status: 500 },
      )
    }
  },
}
