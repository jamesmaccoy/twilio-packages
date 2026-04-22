// Email notification service using Resend API
import { Resend } from 'resend'

// Initialize Resend client
const resendApiKey = process.env.RESEND_API_KEY || process.env.SMTP_PASS
if (!resendApiKey) {
  console.error('❌ RESEND_API_KEY or SMTP_PASS environment variable is not set!')
} else {
  console.log('✅ Resend API key configured:', resendApiKey.substring(0, 10) + '...')
}
const resend = new Resend(resendApiKey)

type BookingConfirmationEmailInput = {
  recipientEmail: string
  recipientName?: string
  propertyTitle: string
  fromDate: string
  toDate: string
  bookingId: string
  bookingUrl: string
  packageName?: string
  isReschedule?: boolean
  sequence?: number
  createdAt?: string
  updatedAt?: string
}

export interface EstimateRequestNotification {
  hostEmail: string
  hostName: string
  customerName: string
  customerEmail: string
  propertyTitle: string
  fromDate: string
  toDate: string
  estimateRequestId: string
}

export type PackageActivityAction = 'created' | 'updated' | 'deleted'

export type PackageActivityNotification = {
  /** Email of the acting user (customer/host) */
  actorEmail: string
  actorName?: string
  /** Admin/operator recipient (defaults to info@simpleplek.co.za) */
  adminEmail?: string
  action: PackageActivityAction
  packageId: string
  packageName: string
  propertyTitle?: string
  postId?: string
  /** Stable subject for threading */
  threadSubject?: string
  /** Freeform details (what changed, etc.) */
  details?: string
}

function getAdminNotificationEmail(): string {
  const candidate =
    process.env.ADMIN_NOTIFICATION_EMAIL?.trim() ||
    process.env.ADMIN_EMAIL?.trim() ||
    process.env.EMAIL_ADMIN?.trim() ||
    ''
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
  if (candidate && emailRegex.test(candidate)) return candidate
  return 'info@simpleplek.co.za'
}

function escapeHtmlInline(value: string) {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
}

function getActionLabel(action: PackageActivityAction) {
  if (action === 'created') return 'Package created'
  if (action === 'updated') return 'Package updated'
  return 'Package deleted'
}

function buildPackageActivityEmailHTML(data: PackageActivityNotification): string {
  const title = getActionLabel(data.action)
  const property = data.propertyTitle ? escapeHtmlInline(data.propertyTitle) : 'Unknown property'
  const pkgName = escapeHtmlInline(data.packageName)
  const pkgId = escapeHtmlInline(data.packageId)
  const details = data.details ? escapeHtmlInline(data.details) : ''

  return `<!doctype html>
<html>
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width,initial-scale=1" />
    <title>${title}</title>
  </head>
  <body style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Arial,sans-serif;line-height:1.6;background:#f8fafc;margin:0;padding:0;">
    <div style="max-width:640px;margin:0 auto;background:#ffffff;border:1px solid #e2e8f0;border-radius:16px;overflow:hidden;">
      <div style="padding:20px 24px;background:#0f172a;color:#fff;">
        <h1 style="margin:0;font-size:18px;font-weight:700;">${title}</h1>
        <p style="margin:8px 0 0 0;opacity:0.85;font-size:14px;">${property}</p>
      </div>
      <div style="padding:22px 24px;">
        <p style="margin:0 0 14px 0;font-size:14px;color:#0f172a;"><strong>Package:</strong> ${pkgName}</p>
        <p style="margin:0 0 14px 0;font-size:14px;color:#0f172a;"><strong>Package ID:</strong> ${pkgId}</p>
        ${details ? `<div style="margin-top:14px;padding:14px 16px;border:1px solid #e2e8f0;border-radius:12px;background:#f8fafc;">
          <p style="margin:0;font-size:13px;color:#334155;white-space:pre-wrap;">${details}</p>
        </div>` : ''}
        <p style="margin:18px 0 0 0;font-size:12px;color:#64748b;">This is an automated confirmation from Simpleplek.</p>
      </div>
    </div>
  </body>
</html>`
}

function buildPackageActivityEmailText(data: PackageActivityNotification): string {
  const title = getActionLabel(data.action)
  const property = data.propertyTitle || 'Unknown property'
  const lines = [
    title,
    '',
    `Property: ${property}`,
    `Package: ${data.packageName}`,
    `Package ID: ${data.packageId}`,
  ]
  if (data.details) {
    lines.push('', 'Details:', data.details)
  }
  return lines.join('\n')
}

export async function sendPackageActivityNotification(input: PackageActivityNotification): Promise<void> {
  const actorEmail = input.actorEmail?.trim()
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
  if (!actorEmail || !emailRegex.test(actorEmail)) {
    throw new Error(`Invalid actor email address: ${actorEmail}`)
  }

  const adminEmail = (input.adminEmail?.trim() && emailRegex.test(input.adminEmail.trim()))
    ? input.adminEmail.trim()
    : getAdminNotificationEmail()

  const fromField = getFromField()
  const subject =
    input.threadSubject?.trim() ||
    `Package activity: ${input.packageName}${input.propertyTitle ? ` (${input.propertyTitle})` : ''}`

  const html = buildPackageActivityEmailHTML({ ...input, adminEmail })
  const text = buildPackageActivityEmailText({ ...input, adminEmail })

  // Send to both actor and admin. Using the same subject enables threading in many clients.
  const recipients = Array.from(new Set([actorEmail, adminEmail].filter(Boolean)))

  const { error } = await resend.emails.send({
    from: fromField,
    to: recipients,
    subject,
    html,
    text,
  })

  if (error) {
    throw new Error(`Failed to send package activity email: ${error.message}`)
  }
}

export async function sendEstimateRequestNotification(data: EstimateRequestNotification): Promise<void> {
  try {
    console.log('📧 Sending estimate request notification via Resend API')
    console.log('=====================================')
    console.log(`Host: ${data.hostName} (${data.hostEmail})`)
    console.log(`Customer: ${data.customerName} (${data.customerEmail})`)
    console.log(`Property: ${data.propertyTitle}`)
    console.log(`Dates: ${data.fromDate} to ${data.toDate}`)
    console.log(`Estimate Request ID: ${data.estimateRequestId}`)
    console.log('=====================================')
    
    // Validate recipient email
    const hostEmail = data.hostEmail?.trim()
    if (!hostEmail || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(hostEmail)) {
      throw new Error(`Invalid host email address: ${hostEmail}`)
    }
    
    const fromField = getFromField()

    console.log('📧 Email configuration:', {
      from: fromField,
      to: hostEmail,
    })
    
    // Send email using Resend API
    // Use unique X-Entity-Ref-ID header to prevent Gmail from threading emails together
    const uniqueEmailId = `${data.estimateRequestId}-${Date.now()}-${Math.random().toString(36).substring(7)}`
    
    const { data: emailData, error } = await resend.emails.send({
      from: fromField,
      to: hostEmail,
      subject: `New Estimate Request for ${data.propertyTitle}`,
      html: generateEstimateRequestEmailHTML(data),
      text: generateEstimateRequestEmailText(data),
      headers: {
        'X-Entity-Ref-ID': uniqueEmailId,
      },
    })

    if (error) {
      console.error('❌ Resend API error:', error)
      throw new Error(`Failed to send email: ${error.message}`)
    }
    
    console.log('✅ Estimate request notification sent successfully via Resend:', emailData?.id)
    
  } catch (error) {
    console.error('❌ Failed to send estimate request notification:', error)
    throw error
  }
}

// Helper function to extract email from formatted string like "Name <email@example.com>" or just "email@example.com"
function extractEmailAddress(input: string | undefined): string | null {
  if (!input) return null
  
  const trimmed = input.trim()
  
  // Check if it's already just an email address
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
  if (emailRegex.test(trimmed)) {
    return trimmed
  }
  
  // Try to extract email from format "Name <email@example.com>"
  const match = trimmed.match(/<([^\s@]+@[^\s@]+\.[^\s@]+)>/)
  if (match && match[1]) {
    return match[1]
  }
  
  return null
}

// Helper function to validate and format email address
function getFromAddress(): string {
  const fromAddressRaw = process.env.EMAIL_FROM_ADDRESS?.trim()
  
  // Extract email address (handles both "email@example.com" and "Name <email@example.com>" formats)
  let fromAddress = extractEmailAddress(fromAddressRaw)
  
  // If we extracted noreply@simpleplek.co.za, use info@simpleplek.co.za instead
  if (fromAddress === 'noreply@simpleplek.co.za') {
    console.log('📧 Replacing noreply@simpleplek.co.za with info@simpleplek.co.za')
    fromAddress = 'info@simpleplek.co.za'
  }
  
  if (fromAddress) {
    console.log('📧 Using EMAIL_FROM_ADDRESS from env:', fromAddress)
    return fromAddress
  }
  
  // Fallback to default if invalid or missing
  console.warn('⚠️ Invalid or missing EMAIL_FROM_ADDRESS, using default info@simpleplek.co.za')
  console.log('📧 EMAIL_FROM_ADDRESS raw value:', process.env.EMAIL_FROM_ADDRESS)
  return 'info@simpleplek.co.za'
}

// Helper function to extract name from formatted string like "Name <email@example.com>"
function extractNameFromFormattedString(input: string | undefined): string | null {
  if (!input) return null
  
  const trimmed = input.trim()
  
  // Check if it's just an email (no name)
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
  if (emailRegex.test(trimmed)) {
    return null
  }
  
  // Try to extract name from format "Name <email@example.com>"
  const match = trimmed.match(/^([^<]+)\s*<[^>]+>$/)
  if (match && match[1]) {
    return match[1].trim()
  }
  
  return null
}

// Helper function to get formatted from field for Resend API
function getFromField(): string {
  const fromAddress = getFromAddress()
  let fromName = process.env.EMAIL_FROM_NAME?.trim()
  
  // Clean up the name - remove any email formatting if it accidentally got in there
  if (fromName) {
    // Remove any email-like patterns from the name
    const emailInName = fromName.match(/<[^>]+>/)
    if (emailInName) {
      // If name contains email formatting, extract just the name part
      const nameMatch = fromName.match(/^([^<]+)\s*</)
      if (nameMatch && nameMatch[1]) {
        fromName = nameMatch[1].trim()
        console.log('📧 Cleaned name (removed email formatting):', fromName)
      } else {
        // If we can't extract, use a default
        fromName = 'Simpleplek'
        console.log('📧 Using default name due to invalid format')
      }
    }
  }
  
  // If EMAIL_FROM_NAME is not set or was invalid, try to extract name from EMAIL_FROM_ADDRESS
  if (!fromName || fromName.length === 0) {
    const extractedName = extractNameFromFormattedString(process.env.EMAIL_FROM_ADDRESS)
    if (extractedName) {
      fromName = extractedName
      console.log('📧 Extracted name from EMAIL_FROM_ADDRESS:', fromName)
    }
  }
  
  // Ensure fromAddress is clean (no extra formatting)
  const cleanAddress = fromAddress.trim()
  
  // Validate the address one more time
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
  if (!emailRegex.test(cleanAddress)) {
    console.error('❌ Invalid from address format:', cleanAddress)
    throw new Error(`Invalid from email address: ${cleanAddress}`)
  }
  
  // Resend API format: "Name <email@example.com>" or just "email@example.com"
  if (fromName && fromName.length > 0 && !emailRegex.test(fromName)) {
    return `${fromName} <${cleanAddress}>`
  }
  
  // If no valid name, just return the address
  return cleanAddress
}

export async function sendBookingConfirmationEmail(
  data: BookingConfirmationEmailInput,
): Promise<void> {
  const startDate = new Date(data.fromDate)
  const endDate = new Date(data.toDate)

  if (Number.isNaN(startDate.getTime()) || Number.isNaN(endDate.getTime())) {
    throw new Error('Invalid booking dates supplied for confirmation email')
  }

  // Validate recipient email
  const recipientEmail = data.recipientEmail?.trim()
  if (!recipientEmail || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(recipientEmail)) {
    throw new Error(`Invalid recipient email address: ${recipientEmail}`)
  }

  const summary = `Stay at ${data.propertyTitle}`
  const descriptionParts = [`Stay at ${data.propertyTitle}`]
  if (data.packageName) {
    descriptionParts.push(`Package: ${data.packageName}`)
  }
  const description = descriptionParts.join(' - ')
  
  const htmlBody = generateBookingConfirmationHTML({ ...data, summary, startDate, endDate })
  const textBody = generateBookingConfirmationText({ ...data, summary, startDate, endDate })
  const icsContent = buildBookingICS({
    summary,
    description,
    startDate,
    endDate,
    bookingId: data.bookingId,
    bookingUrl: data.bookingUrl,
    isReschedule: data.isReschedule || false,
    sequence: data.sequence,
    createdAt: data.createdAt,
    updatedAt: data.updatedAt,
  })

  const fromField = getFromField()
  
  // Always send a copy to info@simpleplek.co.za (BCC so customer doesn't see it)
  const adminEmail = 'info@simpleplek.co.za'
  const bcc = adminEmail !== recipientEmail ? [adminEmail] : undefined

  // Determine email subject based on whether this is a reschedule
  const emailSubject = data.isReschedule 
    ? `Booking rescheduled: ${data.propertyTitle}`
    : `Booking confirmed: ${data.propertyTitle}`

  console.log('📧 Email configuration:', {
    from: fromField,
    to: recipientEmail,
    bcc: bcc || 'none (admin email matches recipient)',
    isReschedule: data.isReschedule || false,
    subject: emailSubject,
  })

  // Send email using Resend API
  // Use unique X-Entity-Ref-ID header to prevent Gmail from threading emails together
  // Each email gets a unique ID based on booking ID and timestamp
  const uniqueEmailId = `${data.bookingId}-${Date.now()}-${Math.random().toString(36).substring(7)}`
  
  console.log('📧 Attempting to send email via Resend API...')
  const { data: emailResponse, error } = await resend.emails.send({
    from: fromField,
    to: recipientEmail,
    bcc: bcc,
    subject: emailSubject,
    html: htmlBody,
    text: textBody,
    headers: {
      'X-Entity-Ref-ID': uniqueEmailId,
    },
    attachments: [
      {
        filename: `booking-${data.bookingId}.ics`,
        content: Buffer.from(icsContent).toString('base64'),
        contentType: 'text/calendar; charset=utf-8; method=PUBLISH',
      },
    ],
  })

  if (error) {
    console.error('❌ Resend API error:', JSON.stringify(error, null, 2))
    throw new Error(`Failed to send email: ${error.message || JSON.stringify(error)}`)
  }

  console.log('✅ Email sent successfully via Resend. Email ID:', emailResponse?.id)
}

function generateEstimateRequestEmailHTML(data: EstimateRequestNotification): string {
  const fromDate = new Date(data.fromDate).toLocaleDateString('en-US', {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric'
  })
  
  const toDate = new Date(data.toDate).toLocaleDateString('en-US', {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric'
  })

  return `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>New Estimate Request - ${data.propertyTitle}</title>
    </head>
    <body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; line-height: 1.6; color: #333; margin: 0; padding: 0; background-color: #f8f9fa;">
      <div style="max-width: 600px; margin: 0 auto; background-color: #ffffff; box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);">
        <!-- Header -->
        <div style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); padding: 30px 20px; text-align: center;">
          <h1 style="color: #ffffff; margin: 0; font-size: 28px; font-weight: 600;">New Estimate Created</h1>
          <p style="color: #e8f4f8; margin: 10px 0 0 0; font-size: 16px;">A customer has requested a new estimate for different dates</p>
        </div>
        
        <!-- Content -->
        <div style="padding: 30px 20px;">
          <p style="font-size: 16px; margin-bottom: 20px;">Hello ${data.hostName},</p>
          
          <p style="font-size: 16px; margin-bottom: 25px;">A customer has requested a new estimate for your property for different dates. A new estimate has been created with all available packages. Here are the details:</p>
          
          <!-- Property Details Card -->
          <div style="background-color: #f8f9fa; border: 1px solid #e9ecef; border-radius: 12px; padding: 25px; margin: 25px 0;">
            <h3 style="margin: 0 0 20px 0; color: #495057; font-size: 20px; font-weight: 600;">Property Details</h3>
            
            <div style="margin-bottom: 15px;">
              <strong style="color: #495057; font-size: 14px; text-transform: uppercase; letter-spacing: 0.5px;">Property</strong>
              <p style="margin: 5px 0 0 0; font-size: 18px; color: #2c3e50; font-weight: 500;">${data.propertyTitle}</p>
            </div>
            
            <div style="margin-bottom: 15px;">
              <strong style="color: #495057; font-size: 14px; text-transform: uppercase; letter-spacing: 0.5px;">Requested Dates</strong>
              <p style="margin: 5px 0 0 0; font-size: 16px; color: #2c3e50;">${fromDate} to ${toDate}</p>
            </div>
            
            <div style="margin-bottom: 0;">
              <strong style="color: #495057; font-size: 14px; text-transform: uppercase; letter-spacing: 0.5px;">Customer</strong>
              <p style="margin: 5px 0 0 0; font-size: 16px; color: #2c3e50;">${data.customerName}</p>
              <p style="margin: 2px 0 0 0; font-size: 14px; color: #6c757d;">${data.customerEmail}</p>
            </div>
          </div>
          
          <!-- Call to Action -->
          <div style="text-align: center; margin: 30px 0;">
            <p style="font-size: 16px; margin-bottom: 20px; color: #495057;">Please log into your admin panel to review the new estimate and configure package options for the customer.</p>
            <div style="background-color: #007bff; color: #ffffff; padding: 12px 24px; border-radius: 6px; display: inline-block; text-decoration: none; font-weight: 600; font-size: 16px;">
              View Estimate Request
            </div>
          </div>
        </div>
        
        <!-- Footer -->
        <div style="background-color: #f8f9fa; padding: 20px; border-top: 1px solid #e9ecef; text-align: center;">
          <p style="font-size: 14px; color: #6c757d; margin: 0;">
            This is an automated notification from your Betaplek booking system.
          </p>
          <p style="font-size: 12px; color: #adb5bd; margin: 10px 0 0 0;">
            Estimate Request ID: ${data.estimateRequestId}
          </p>
        </div>
      </div>
    </body>
    </html>
  `
}

type BookingConfirmationTemplateInput = BookingConfirmationEmailInput & {
  summary: string
  startDate: Date
  endDate: Date
}

function formatDisplayRange(startDate: Date, endDate: Date) {
  return {
    start: startDate.toLocaleString('en-US', {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    }),
    end: endDate.toLocaleString('en-US', {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    }),
  }
}

function generateBookingConfirmationHTML(data: BookingConfirmationTemplateInput): string {
  const { start, end } = formatDisplayRange(data.startDate, data.endDate)
  const greeting = data.recipientName ? `Hello ${data.recipientName},` : 'Hello,'

  return `
    <!DOCTYPE html>
    <html lang="en">
      <head>
        <meta charset="utf-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1.0" />
        <title>${escapeHtml(data.summary)}</title>
      </head>
      <body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; background-color: #f8f9fa; margin: 0; padding: 0;">
        <div style="max-width: 640px; margin: 0 auto; background-color: #ffffff; box-shadow: 0 4px 12px rgba(15, 23, 42, 0.08); border-radius: 18px; overflow: hidden;">
          <div style="background: linear-gradient(135deg,rgb(128, 201, 206) 0%,rgb(1, 156, 147) 100%); padding: 32px 28px;">
            <h1 style="margin: 0; font-size: 28px; font-weight: 700; color: #ffffff;">We will see you at ${data.propertyTitle}!</h1>
            <p style="margin: 12px 0 0 0; color: rgba(255, 255, 255, 0.85); font-size: 16px;">
              We’ve attached a calendar invite so you never miss the dates. We can’t wait to host you!
            </p>
          </div>
          <div style="padding: 32px 28px;">
            <p style="font-size: 16px; color: #1f2937; line-height: 1.7;">${greeting}</p>
            <p style="font-size: 16px; color: #1f2937; line-height: 1.7;">
              Your booking for <strong>${escapeHtml(data.propertyTitle)}</strong> is officially confirmed.
              We’ve included a calendar invite with all the details for quick reference.
            </p>
            <div style="margin: 28px 0; padding: 24px; background-color: #f3f4f6; border-radius: 16px; border: 1px solid #e5e7eb;">
              <h2 style="margin: 0 0 18px 0; color: #111827; font-size: 20px; font-weight: 600;">Booking summary</h2>
              <p style="margin: 0 0 12px 0; color: #1f2937; font-size: 16px;"><strong>Dates:</strong> ${escapeHtml(
                `${start} to ${end}`,
              )}</p>
              <p style="margin: 0 0 12px 0; color: #1f2937; font-size: 16px;"><strong>Property:</strong> ${escapeHtml(
                data.propertyTitle,
              )}</p>
              ${data.packageName ? `<p style="margin: 0 0 12px 0; color: #1f2937; font-size: 16px;"><strong>Package:</strong> ${escapeHtml(data.packageName)}</p>` : ''}
              <p style="margin: 0; color: #1f2937; font-size: 16px;"><strong>Booking ID:</strong> ${escapeHtml(
                data.bookingId,
              )}</p>
            </div>
            <div style="text-align: center; margin-top: 32px;">
              <a href="${escapeHtml(
                data.bookingUrl,
              )}" style="display: inline-block; background-color: #2563eb; color: #ffffff; padding: 14px 30px; border-radius: 999px; text-decoration: none; font-weight: 600; font-size: 16px;">
                View booking details
              </a>
            </div>
            <p style="margin-top: 32px; font-size: 14px; color: #6b7280;">
              Add the attached calendar invite to keep everything in sync.
            </p>
          </div>
          <div style="padding: 20px 28px; background-color: #111827;">
            <p style="margin: 0; color: rgba(255, 255, 255, 0.7); font-size: 13px;">
              This email was sent by Simple Plek. You’re receiving it because you have a confirmed booking.
            </p>
          </div>
        </div>
      </body>
    </html>
  `
}

function generateBookingConfirmationText(data: BookingConfirmationTemplateInput): string {
  const { start, end } = formatDisplayRange(data.startDate, data.endDate)
  const greeting = data.recipientName ? `Hello ${data.recipientName},` : 'Hello,'

  return [
    'Your stay is confirmed!',
    '',
    greeting,
    '',
    `Your booking for ${data.propertyTitle} is officially confirmed.`,
    'We have attached a calendar invite with all the details for quick reference.',
    '',
    'Booking summary:',
    `- Dates: ${start} to ${end}`,
    `- Property: ${data.propertyTitle}`,
    ...(data.packageName ? [`- Package: ${data.packageName}`] : []),
    `- Booking ID: ${data.bookingId}`,
    '',
    `View booking details: ${data.bookingUrl}`,
    '',
    'Add the calendar invite to your calendar so you never miss check-in.',
    'We can’t wait to host you!',
  ].join('\n')
}

function buildBookingICS({
  summary,
  description,
  startDate,
  endDate,
  bookingId,
  bookingUrl,
  isReschedule = false,
  sequence = 0,
  createdAt,
  updatedAt,
}: {
  summary: string
  description: string
  startDate: Date
  endDate: Date
  bookingId: string
  bookingUrl: string
  isReschedule?: boolean
  sequence?: number
  createdAt?: string
  updatedAt?: string
}) {
  const formatDate = (date: Date) =>
    date.toISOString().replace(/[-:]/g, '').replace(/\.\d{3}Z$/, 'Z')

  const dtStamp = formatDate(new Date())
  const dtStart = formatDate(startDate)
  const dtEnd = formatDate(endDate)
  
  // Use actual created/updated times if provided, otherwise use current time
  const created = createdAt ? formatDate(new Date(createdAt)) : dtStamp
  const lastModified = updatedAt ? formatDate(new Date(updatedAt)) : dtStamp

  // Calculate sequence number if not provided
  // For reschedules, increment sequence to trigger calendar updates
  let calculatedSequence = sequence
  if (isReschedule && sequence === 0) {
    // If rescheduling and sequence not provided, calculate based on update time
    calculatedSequence = updatedAt && createdAt && updatedAt !== createdAt ? 1 : 0
  }

  // Use METHOD:REQUEST for reschedules to trigger calendar client updates
  // Use METHOD:PUBLISH for new bookings
  const method = isReschedule ? 'REQUEST' : 'PUBLISH'

  // Build description with proper line breaks
  const descriptionParts = [description]
  if (isReschedule) {
    descriptionParts.push('This booking has been rescheduled. Please update your calendar.')
  }
  descriptionParts.push(`Booking ID: ${bookingId}`)
  descriptionParts.push(`View details: ${bookingUrl}`)
  const fullDescription = descriptionParts.join('\\n')

  const lines = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//Simple Plek//Booking//EN',
    'CALSCALE:GREGORIAN',
    `METHOD:${method}`,
    'BEGIN:VEVENT',
    `UID:${escapeICSText(`booking-${bookingId}@simpleplek.co.za`)}`,
    `DTSTAMP:${dtStamp}`,
    `DTSTART:${dtStart}`,
    `DTEND:${dtEnd}`,
    `SUMMARY:${escapeICSText(summary)}`,
    `DESCRIPTION:${escapeICSText(fullDescription)}`,
    `URL:${escapeICSText(bookingUrl)}`,
    `CREATED:${created}`,
    `LAST-MODIFIED:${lastModified}`,
    'STATUS:CONFIRMED',
    `SEQUENCE:${calculatedSequence}`,
    'TRANSP:OPAQUE',
    'END:VEVENT',
    'END:VCALENDAR',
  ]

  return `${lines.join('\r\n')}\r\n`
}

function escapeICSText(value: string) {
  return value.replace(/\\/g, '\\\\').replace(/;/g, '\\;').replace(/,/g, '\\,').replace(/\n/g, '\\n')
}

function escapeHtml(value: string) {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
}

function generateEstimateRequestEmailText(data: EstimateRequestNotification): string {
  const fromDate = new Date(data.fromDate).toLocaleDateString('en-US', {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric'
  })
  
  const toDate = new Date(data.toDate).toLocaleDateString('en-US', {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric'
  })

  return `
NEW ESTIMATE CREATED

Hello ${data.hostName},

A customer has requested a new estimate for your property for different dates. A new estimate has been created with all available packages.

PROPERTY DETAILS:
- Property: ${data.propertyTitle}
- Requested Dates: ${fromDate} to ${toDate}
- Customer: ${data.customerName}
- Customer Email: ${data.customerEmail}

Please log into your admin panel to review the new estimate and configure package options for the customer.

This is an automated notification from your Betaplek booking system.
Estimate ID: ${data.estimateRequestId}
  `.trim()
}
