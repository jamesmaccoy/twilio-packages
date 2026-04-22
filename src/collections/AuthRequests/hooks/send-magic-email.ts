import { CollectionAfterChangeHook } from 'payload'
import Twilio from 'twilio'

const verifyServiceSid = process.env.TWILIO_VERIFY_SERVICE_SID

export const sendMagicEmail: CollectionAfterChangeHook = async ({ req, doc, operation }) => {
  if (operation !== 'create') {
    return doc
  }

  const accountSid = process.env.TWILIO_ACCOUNT_SID
  const authToken = process.env.TWILIO_AUTH_TOKEN

  if (!accountSid || !authToken || !verifyServiceSid) {
    req.payload.logger.error('Missing Twilio credentials for OTP delivery')
    throw new Error('SMS provider is not configured')
  }

  const mobile =
    typeof doc === 'object' && doc !== null && 'mobile' in doc && typeof doc.mobile === 'string'
      ? doc.mobile
      : undefined

  if (!mobile) {
    req.payload.logger.error('Auth request is missing mobile number')
    throw new Error('Mobile number is required')
  }

  const twilioClient = Twilio(accountSid, authToken)

  await twilioClient.verify.v2
    .services(verifyServiceSid)
    .verifications.create({ to: mobile, channel: 'sms' })

  req.payload.logger.info(`OTP SMS sent to ${mobile}`)
  return doc
}
