import { Endpoint } from 'payload'
import { z } from 'zod'
import jwt from 'jsonwebtoken'
import { addMinutes } from 'date-fns'
import { validateRedirect } from '@/utils/validateRedirect'

const bodySchema = z.object({
  email: z.string().email(),
  next: z.string().optional(),
})

function getBaseUrl(req: any): string {
  const host = req.headers?.get?.('x-forwarded-host') || req.headers?.get?.('host')
  const proto = req.headers?.get?.('x-forwarded-proto')
  if (host) {
    const protocol = proto || (String(host).includes('localhost') ? 'http' : 'https')
    return `${protocol}://${host}`
  }
  return process.env.NEXT_PUBLIC_URL || process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:3000'
}

export const InitiateMagicEmail: Endpoint = {
  method: 'post',
  path: '/magic-email',
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

    const email = body.data.email.trim().toLowerCase()
    const next = validateRedirect(body.data.next) || '/bookings'

    const authRequest = await req.payload.create({
      collection: 'authRequests',
      data: {
        email,
        expiresAt: addMinutes(new Date(), 15).toISOString(),
      },
      overrideAccess: true,
    })

    const magicToken = jwt.sign(
      { email, authRequestId: authRequest.id, next },
      req.payload.secret,
      { expiresIn: '15m' },
    )

    const baseUrl = getBaseUrl(req)
    const verifyUrl = `${baseUrl}/api/authRequests/verify-magic-token?token=${encodeURIComponent(
      magicToken,
    )}`

    await req.payload.sendEmail({
      to: email,
      from: process.env.EMAIL_FROM_ADDRESS || 'info@simpleplek.co.za',
      subject: 'Your sign-in link',
      html: `
        <p>Use the link below to sign in. This link expires in 15 minutes.</p>
        <p><a href="${verifyUrl}">Sign in</a></p>
        <p>If you didn’t request this, you can ignore this email.</p>
      `,
    })

    return Response.json(
      {
        message: 'Magic link sent',
      },
      { status: 200 },
    )
  },
}

