import type { CollectionAfterChangeHook } from 'payload'

import { sendBookingConfirmationEmail } from '@/lib/emailNotifications'
import { createNotification } from '@/lib/notificationUtils'

type Recipient = {
  id: string
  email: string
  name?: string
}

const normalizeRelationshipId = (value: unknown): string | undefined => {
  if (!value) return undefined
  if (typeof value === 'string') return value
  if (typeof value === 'object' && value !== null && 'id' in value) {
    const possibleId = (value as { id?: unknown }).id
    if (typeof possibleId === 'string') {
      return possibleId
    }
  }
  return undefined
}

const extractRecipientFromRelation = (value: unknown): Recipient | null => {
  if (!value || typeof value !== 'object') return null

  const id =
    'id' in value && typeof (value as { id?: unknown }).id === 'string'
      ? ((value as { id: string }).id as string)
      : undefined
  const email =
    'email' in value && typeof (value as { email?: unknown }).email === 'string'
      ? ((value as { email: string }).email as string)
      : undefined
  const name =
    'name' in value && typeof (value as { name?: unknown }).name === 'string'
      ? ((value as { name: string }).name as string)
      : undefined

  if (id && email) {
    return { id, email, name }
  }

  return null
}

export const sendBookingConfirmationHook: CollectionAfterChangeHook = async ({
  doc,
  operation,
  previousDoc,
  req,
}) => {
  console.log('📧 sendBookingConfirmationHook called:', { operation, bookingId: doc.id })
  
  // Send emails on both create and update operations
  if (operation !== 'create' && operation !== 'update') {
    console.log('📧 Skipping email - operation is not "create" or "update":', operation)
    return doc
  }

  // Track what changed for notifications
  const changes: Record<string, { from: any; to: any }> = {}
  if (previousDoc && operation === 'update') {
    // Track key field changes
    if (previousDoc.fromDate !== doc.fromDate) {
      changes.fromDate = { from: previousDoc.fromDate, to: doc.fromDate }
    }
    if (previousDoc.toDate !== doc.toDate) {
      changes.toDate = { from: previousDoc.toDate, to: doc.toDate }
    }
    if (previousDoc.paymentStatus !== doc.paymentStatus) {
      changes.paymentStatus = { from: previousDoc.paymentStatus, to: doc.paymentStatus }
    }
    if (previousDoc.total !== doc.total) {
      changes.total = { from: previousDoc.total, to: doc.total }
    }
  }

  try {
    const resolvedRecipients: Recipient[] = []
    const pendingIds = new Set<string>()

    const includeRelation = (value: unknown) => {
      const directRecipient = extractRecipientFromRelation(value)
      if (directRecipient) {
        resolvedRecipients.push(directRecipient)
        return
      }

      const id = normalizeRelationshipId(value)
      if (id) {
        pendingIds.add(id)
      }
    }

    includeRelation(doc.customer)

    if (Array.isArray(doc.guests)) {
      for (const guest of doc.guests) {
        includeRelation(guest)
      }
    }

    const payload = req.payload

    if (pendingIds.size > 0) {
      const usersResult = await payload.find({
        collection: 'users',
        where: {
          id: {
            in: Array.from(pendingIds),
          },
        },
        limit: pendingIds.size,
        depth: 0,
        overrideAccess: true,
      })

      usersResult.docs.forEach((user) => {
        if (!user || typeof user !== 'object') return

        const id = normalizeRelationshipId(user)
        const email =
          'email' in user && typeof user.email === 'string' ? (user.email as string) : undefined
        const name =
          'name' in user && typeof user.name === 'string' ? (user.name as string) : undefined

        if (id && email) {
          resolvedRecipients.push({ id, email, name })
        }
      })
    }

    const uniqueRecipients = Array.from(
      new Map(resolvedRecipients.map((recipient) => [recipient.email, recipient] as const)).values(),
    )

    if (uniqueRecipients.length === 0) {
      console.warn(
        `⚠️ Booking ${doc.id} confirmation skipped — no recipients with email after resolving relations.`,
      )
      return doc
    }

    const post =
      typeof doc.post === 'string'
        ? await payload.findByID({
            collection: 'posts',
            id: doc.post,
            depth: 0,
            overrideAccess: true,
          })
        : doc.post

    const propertyTitle =
      (typeof doc.title === 'string' && doc.title.trim().length > 0 ? doc.title : undefined) ??
      (typeof post === 'object' && post !== null && 'title' in post
        ? String((post as { title?: unknown }).title)
        : undefined) ??
      'Booking'

    // Get package information
    let packageName: string | undefined
    if (doc.selectedPackage && typeof doc.selectedPackage === 'object') {
      const selectedPackage = doc.selectedPackage as { package?: unknown; customName?: string | null }
      
      // Check for custom name first
      if (selectedPackage.customName && selectedPackage.customName.trim().length > 0) {
        packageName = selectedPackage.customName.trim()
      } else if (selectedPackage.package) {
        // Fetch package details if it's a relationship
        const packageId = typeof selectedPackage.package === 'string' 
          ? selectedPackage.package 
          : (typeof selectedPackage.package === 'object' && selectedPackage.package !== null && 'id' in selectedPackage.package
            ? String((selectedPackage.package as { id?: unknown }).id)
            : null)
        
        if (packageId) {
          try {
            const packageDoc = typeof selectedPackage.package === 'object' && selectedPackage.package !== null && 'name' in selectedPackage.package
              ? selectedPackage.package
              : await payload.findByID({
                  collection: 'packages',
                  id: packageId,
                  depth: 0,
                  overrideAccess: true,
                })
            
            if (packageDoc && typeof packageDoc === 'object' && 'name' in packageDoc) {
              packageName = String(packageDoc.name)
            }
          } catch (error) {
            console.warn(`⚠️ Could not fetch package ${packageId} for email:`, error)
          }
        }
      }
    }

    const baseUrl = process.env.NEXT_PUBLIC_URL || 'https://www.simpleplek.co.za'
    const bookingUrl = `${baseUrl}/bookings/${doc.id}`

    console.log('📧 Sending booking confirmation email(s)', {
      bookingId: doc.id,
      recipients: uniqueRecipients.map((recipient) => ({
        id: recipient.id,
        email: recipient.email,
      })),
      packageName: packageName || 'none',
    })

    // Determine if this is a reschedule (dates changed)
    const isReschedule = operation === 'update' && Boolean(changes.fromDate || changes.toDate)
    
    // Calculate sequence number for calendar ICS
    // Sequence should increment each time the booking is updated
    // We'll use a simple calculation: 0 for new bookings, 1+ for updates
    let sequence = 0
    if (isReschedule) {
      // For reschedules, calculate sequence based on update history
      // If updatedAt differs from createdAt, this is at least the first update
      if (doc.updatedAt && doc.createdAt) {
        const updatedTime = new Date(doc.updatedAt).getTime()
        const createdTime = new Date(doc.createdAt).getTime()
        // Simple sequence: 0 for new, 1+ for each update
        // We can't track exact count without a counter field, so use timestamp difference as proxy
        // For now, use 1 for any reschedule
        sequence = updatedTime > createdTime ? 1 : 0
      }
    }

    const emailResults = await Promise.allSettled(
      uniqueRecipients.map((recipient) =>
        sendBookingConfirmationEmail({
          recipientEmail: recipient.email,
          recipientName: recipient.name,
          propertyTitle,
          fromDate: doc.fromDate,
          toDate: doc.toDate,
          bookingId: doc.id,
          bookingUrl,
          packageName,
          isReschedule,
          sequence,
          createdAt: doc.createdAt,
          updatedAt: doc.updatedAt,
        }),
      ),
    )

    const failedEmails = emailResults
      .map((result, index) => ({ result, recipient: uniqueRecipients[index] }))
      .filter(
        (entry): entry is { result: PromiseRejectedResult; recipient: Recipient } =>
          entry.result.status === 'rejected',
      )

    if (failedEmails.length > 0) {
      console.error('❌ Some booking confirmation emails failed to send:', {
        bookingId: doc.id,
        failures: failedEmails.map(({ recipient, result }) => ({
          id: recipient.id,
          email: recipient.email,
          reason: result.reason instanceof Error ? result.reason.message : String(result.reason),
        })),
      })
    }

    // Create notifications for all recipients
    type NotificationType = 'booking_created' | 'booking_cancelled' | 'booking_rescheduled' | 'booking_updated'
    let notificationType: NotificationType
    let notificationTitle: string
    let notificationDescription: string

    if (operation === 'create') {
      notificationType = 'booking_created'
      notificationTitle = `Booking confirmed: ${propertyTitle}`
      notificationDescription = `Your booking for ${propertyTitle} from ${new Date(doc.fromDate).toLocaleDateString()} to ${doc.toDate ? new Date(doc.toDate).toLocaleDateString() : 'TBD'} has been confirmed.`
    } else if (doc.paymentStatus === 'cancelled') {
      notificationType = 'booking_cancelled'
      notificationTitle = `Booking cancelled: ${propertyTitle}`
      notificationDescription = `Your booking for ${propertyTitle} has been cancelled.`
    } else if (changes.fromDate || changes.toDate) {
      // Check if this is a reschedule (dates changed)
      notificationType = 'booking_rescheduled'
      notificationTitle = `Booking rescheduled: ${propertyTitle}`
      const oldDates = changes.fromDate?.from && changes.toDate?.from
        ? `${new Date(changes.fromDate.from).toLocaleDateString()} - ${new Date(changes.toDate.from).toLocaleDateString()}`
        : 'previous dates'
      const newDates = `${new Date(doc.fromDate).toLocaleDateString()} - ${doc.toDate ? new Date(doc.toDate).toLocaleDateString() : 'TBD'}`
      notificationDescription = `Your booking for ${propertyTitle} has been rescheduled from ${oldDates} to ${newDates}.`
    } else {
      notificationType = 'booking_updated'
      notificationTitle = `Booking updated: ${propertyTitle}`
      const changeList = Object.entries(changes)
        .map(([field, change]) => {
          if (field === 'paymentStatus') {
            return `Payment status changed from ${change.from} to ${change.to}`
          }
          if (field === 'total') {
            return `Total changed from R${change.from} to R${change.to}`
          }
          return `${field} updated`
        })
        .join(', ')
      notificationDescription = `Your booking for ${propertyTitle} has been updated. ${changeList}`
    }

    // Create notification for each recipient using consolidated utility
    await Promise.all(
      uniqueRecipients.map(async (recipient) => {
        try {
          await createNotification({
            payload,
            userId: recipient.id,
            type: notificationType,
            title: notificationTitle,
            description: notificationDescription,
            metadata: {
              propertyTitle,
              fromDate: doc.fromDate,
              toDate: doc.toDate,
              packageName: packageName || null,
              bookingId: doc.id,
              operation,
              paymentStatus: doc.paymentStatus,
              changes: Object.keys(changes).length > 0 ? changes : undefined,
              previousValues: previousDoc && operation === 'update' ? {
                fromDate: previousDoc.fromDate,
                toDate: previousDoc.toDate,
                paymentStatus: previousDoc.paymentStatus,
                total: previousDoc.total,
              } : undefined,
            },
            relatedBooking: doc.id,
            actionUrl: bookingUrl,
            req,
          })
          console.log(`✅ Notification created for user ${recipient.id}`)
        } catch (notificationError) {
          console.error(`❌ Failed to create notification for user ${recipient.id}:`, notificationError)
          // Don't throw - email sending is more critical than notification creation
        }
      }),
    )
  } catch (error) {
    console.error('❌ Failed to send booking confirmation email:', error)
  }

  return doc
}

