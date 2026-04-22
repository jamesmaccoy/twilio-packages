import { NextResponse } from 'next/server'
import { GoogleGenerativeAI } from '@google/generative-ai'
import { getPayload } from 'payload'
import configPromise from '@payload-config'
import { getMeUser } from '@/utilities/getMeUser'
import { z } from 'zod'
import { streamText, tool } from 'ai'
import { createGoogleGenerativeAI } from '@ai-sdk/google'

// Use the GEMINI_API_KEY environment variable defined in your .env file
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY || '')

// AI SDK provider for streaming (matches /api/chat/manage)
const googleAI = createGoogleGenerativeAI({
  apiKey: process.env.GEMINI_API_KEY || process.env.GOOGLE_GENERATIVE_AI_API_KEY || '',
})

// Zod schema for a generic suggested package (used in tool calling)
const suggestPackageSchema = z.object({
  name: z.string().describe('Catchy name for the package'),
  price: z.number().describe('Price in ZAR (not cents)'),
  description: z.string().describe('Clear value proposition for the package'),
  items: z.array(z.string()).describe('List of items, services, or benefits included'),
  marketingCopy: z
    .string()
    .describe('One or two sentences of marketing copy suitable for a Google Business / Yoco payment link description'),
})

// Schema for a package payload that is ready to be saved to DB.
const packageDraftSchema = z.object({
  name: z.string().describe('Package name'),
  description: z.string().describe('Package description'),
  category: z.enum(['standard', 'hosted', 'addon', 'special']).describe('Package category'),
  entitlement: z.enum(['standard', 'pro']).default('standard').describe('Required customer entitlement'),
  minNights: z.number().min(0.5).describe('Minimum nights'),
  maxNights: z.number().min(0.5).describe('Maximum nights'),
  baseRate: z.number().int().min(0).optional().describe('Base rate in whole Rands (ZAR)'),
  multiplier: z.number().min(0.1).max(3.0).default(1).describe('Price multiplier'),
  features: z.array(z.string()).default([]).describe('Feature list'),
  postId: z.string().optional().describe('Property (post) ID'),
  revenueCatId: z.string().optional().describe('Legacy RevenueCat product ID'),
  yocoId: z.string().optional().describe('Yoco product ID'),
})

const serializeUsageMetadata = (usage: any) => {
  if (!usage) return undefined

  const safeNumber = (value: any) => (typeof value === 'number' && Number.isFinite(value) ? value : null)

  return {
    total: safeNumber(usage.totalTokenCount),
    prompt: safeNumber(usage.promptTokenCount),
    candidates: safeNumber(usage.candidatesTokenCount),
    cached: safeNumber(usage.cachedContentTokenCount),
    thoughts: safeNumber(usage.thoughtsTokenCount),
  }
}

export async function POST(req: Request) {
  try {
    const requestBody = await req.json()
    
    // Debug: Log request body structure in development
    if (process.env.NODE_ENV === 'development') {
      console.log('📥 /api/chat request body:', {
        keys: Object.keys(requestBody),
        hasMessage: 'message' in requestBody,
        hasMessages: 'messages' in requestBody,
        messageType: typeof requestBody.message,
        messageValue: requestBody.message,
        messagesLength: Array.isArray(requestBody.messages) ? requestBody.messages.length : 0,
        messagesSample: Array.isArray(requestBody.messages) && requestBody.messages.length > 0
          ? JSON.stringify(requestBody.messages[0]).substring(0, 200)
          : 'N/A',
        fullBody: JSON.stringify(requestBody).substring(0, 300)
      })
    }
    
    // Handle multiple request formats:
    // 1. Old format: { message: "text" }
    // 2. New AI SDK v2.0+ format: { messages: [{ parts: [{ type: "text", text: "..." }] }] }
    // 3. Alternative formats: { text: "..." }, { content: "..." }
    // Google Generative AI SDK expects a string, so normalize it here
    let message: string = ''
    
    try {
      // First, try to extract from messages array (new AI SDK v2.0+ format)
      // Format: { messages: [{ parts: [{ type: "text", text: "..." }] }] }
      if (Array.isArray(requestBody.messages) && requestBody.messages.length > 0) {
        // Get the last user message
        const userMessages = requestBody.messages.filter((msg: any) => msg.role === 'user')
        const lastUserMessage = userMessages.length > 0 
          ? userMessages[userMessages.length - 1] 
          : requestBody.messages[requestBody.messages.length - 1]
        
        // Extract text from parts array
        if (lastUserMessage.parts && Array.isArray(lastUserMessage.parts)) {
          const textParts = lastUserMessage.parts
            .filter((part: any) => part.type === 'text' && part.text)
            .map((part: any) => part.text)
          if (textParts.length > 0) {
            message = textParts.join(' ').trim()
          }
        }
        
        // Fallback: check if message has content directly
        if (!message && lastUserMessage.content) {
          message = String(lastUserMessage.content).trim()
        }
        
        // Fallback: check if message itself is a string
        if (!message && typeof lastUserMessage === 'string') {
          message = lastUserMessage.trim()
        }
      }
      
      // If no message from messages array, try direct message field (old format)
      if (!message) {
        const messageValue = requestBody.message || requestBody.text || requestBody.content || requestBody.prompt
        
        if (typeof messageValue === 'string') {
          message = messageValue.trim()
        } else if (messageValue && typeof messageValue === 'object') {
          // Handle object format: { text: "message" } or { content: "message" }
          message = (messageValue.text || messageValue.content || '').trim()
          // Fallback: try to stringify if it's an object
          if (!message && messageValue) {
            message = String(messageValue).trim()
          }
        } else if (messageValue !== undefined && messageValue !== null) {
          message = String(messageValue).trim()
        }
      }
      
      // If still no message, check if requestBody itself is a string (edge case)
      if (!message && typeof requestBody === 'string') {
        message = requestBody.trim()
      }
    } catch (normalizeError) {
      console.error('Error normalizing message:', normalizeError)
      return NextResponse.json({ 
        error: 'Invalid message format',
        details: 'Could not parse message from request body'
      }, { status: 400 })
    }
    
    const { bookingContext, context, packageId, postId, pageData } = requestBody
    const { user } = await getMeUser()
    
    // Validate message is not empty and is actually a string
    if (!message || typeof message !== 'string' || message.length === 0) {
      console.error('Invalid or empty message:', { 
        type: typeof requestBody.message, 
        value: requestBody.message,
        normalized: message,
        requestBodyKeys: Object.keys(requestBody),
        hasMessages: Array.isArray(requestBody.messages),
        messagesLength: Array.isArray(requestBody.messages) ? requestBody.messages.length : 0,
        messagesSample: Array.isArray(requestBody.messages) && requestBody.messages.length > 0
          ? JSON.stringify(requestBody.messages).substring(0, 500)
          : 'N/A',
        requestBodySample: JSON.stringify(requestBody).substring(0, 500)
      })
      return NextResponse.json({ 
        error: 'Message is required and must be a non-empty string',
        details: `Received type: ${typeof requestBody.message}, normalized: "${message}". Available keys: ${Object.keys(requestBody).join(', ')}. Has messages array: ${Array.isArray(requestBody.messages)}`
      }, { status: 400 })
    }
    
    // Final safety check: ensure message is a primitive string
    message = String(message)

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Check if user is host/admin for MCP capabilities
    const userRole = (user as any).role
    const roleArray = Array.isArray(userRole) ? userRole : userRole ? [userRole] : []
    const isHostOrAdmin = roleArray.includes('host') || roleArray.includes('admin')

    // If this request comes from the Vercel AI SDK useChat hook (messages array present),
    // switch to streaming mode using the AI SDK with tool calling.
    if (Array.isArray((requestBody as any).messages) && (requestBody as any).messages.length > 0) {
      const uiMessages = (requestBody as any).messages

      // Build a lightweight system prompt using high-level context only.
      const businessType =
        bookingContext?.businessType ||
        (pageData?.businessType as string | undefined) ||
        (context === 'bookings' ? 'accommodation business' : 'customer')

      const businessName =
        bookingContext?.postTitle ||
        pageData?.businessName ||
        'this business'

      const system = `You are an AI assistant helping a customer of ${businessName}, a ${businessType} in South Africa.

You can freely answer questions about their bookings and packages, but when they clearly ask you to create or design a package
("winter package", "special", "bundle", "deal", "offer", etc.), you should call the suggestPackage tool to propose a structured package.

When the user asks to create/manage a package from a prompt, call the buildPackageDraft tool.
It must return a complete package object ready to save in the database (all required fields populated, sensible defaults filled in).

Always express prices in South African Rand (R), not cents.`

      // Keep model configurable because availability varies by Google project/API rollout.
      const streamingModelName = process.env.GEMINI_STREAMING_MODEL || 'models/gemini-2.5-flash'
      const model = googleAI(streamingModelName)

      const normalizedModelMessages = uiMessages
        .map((msg: any) => {
          const role = msg?.role === 'assistant' ? 'assistant' : 'user'

          if (Array.isArray(msg?.parts)) {
            const content = msg.parts
              .filter((part: any) => part?.type === 'text' && typeof part?.text === 'string')
              .map((part: any) => part.text)
              .join(' ')
              .trim()

            if (content) return { role, content }
          }

          if (typeof msg?.content === 'string' && msg.content.trim()) {
            return { role, content: msg.content.trim() }
          }

          return null
        })
        .filter(Boolean)

      const result = streamText({
        model: model as any,
        system,
        messages:
          normalizedModelMessages.length > 0
            ? (normalizedModelMessages as any)
            : ([{ role: 'user', content: message }] as any),
        // Note: toolCallStreaming is not supported in all AI SDK versions.
        tools: {
          // @ts-ignore - tool typing differs across AI SDK versions
          suggestPackage: tool({
            description:
              'Suggest a new package/bundle for this business. Use this when the user is describing or asking for a package/offer.',
            parameters: suggestPackageSchema,
            // For now, we just echo the structured suggestion back; persistence is handled by other routes.
            // The frontend can render this as a "Magic Apply" / preview card.
            // @ts-expect-error - AI SDK tool typing differs across versions
            execute: async (args: any) => {
              return {
                ...args,
                status: 'draft',
              }
            },
          }),
          // @ts-ignore - tool typing differs across AI SDK versions
          buildPackageDraft: tool({
            description:
              'Build a complete package payload from user prompt, auto-filling missing fields so it is ready to save to DB.',
            parameters: packageDraftSchema.partial(),
            // @ts-expect-error - AI SDK tool typing differs across versions
            execute: async (input: any) => {
              const category = input.category ?? 'standard'
              const defaultsByCategory: Record<string, { baseRate: number; minNights: number; maxNights: number; multiplier: number; features: string[] }> = {
                standard: {
                  baseRate: 200,
                  minNights: 1,
                  maxNights: 7,
                  multiplier: 1,
                  features: ['Comfortable stay', 'Essential amenities', 'Flexible check-in'],
                },
                hosted: {
                  baseRate: 450,
                  minNights: 2,
                  maxNights: 14,
                  multiplier: 1.2,
                  features: ['Concierge support', 'Premium amenities', 'Personalized experience'],
                },
                addon: {
                  baseRate: 300,
                  minNights: 0.5,
                  maxNights: 1,
                  multiplier: 1,
                  features: ['One-time service', 'Quick turnaround', 'Quality guaranteed'],
                },
                special: {
                  baseRate: 350,
                  minNights: 1,
                  maxNights: 7,
                  multiplier: 0.9,
                  features: ['Limited offer', 'High value', 'Exclusive experience'],
                },
              }

              const defaults = (defaultsByCategory[category] ?? defaultsByCategory.standard)!
              const inferredPostId =
                input.postId ||
                bookingContext?.postId ||
                pageData?.postId ||
                (Array.isArray(pageData?.posts) && pageData.posts.length > 0 ? pageData.posts[0].id : undefined)

              const draft = packageDraftSchema.parse({
                name: input.name ?? `${category === 'special' ? 'Special' : 'Custom'} Package`,
                description:
                  input.description ??
                  `A ${category} package designed from your prompt, ready for database creation.`,
                category,
                entitlement: input.entitlement ?? 'standard',
                minNights: input.minNights ?? defaults.minNights,
                maxNights: input.maxNights ?? defaults.maxNights,
                baseRate: input.baseRate ?? defaults.baseRate,
                multiplier: input.multiplier ?? defaults.multiplier,
                features: input.features && input.features.length > 0 ? input.features : defaults.features,
                postId: inferredPostId,
                revenueCatId: input.revenueCatId,
                yocoId: input.yocoId,
              })

              return {
                success: true,
                status: 'ready_to_save',
                package: draft,
              }
            },
          }),
        },
      })

      return result.toUIMessageStreamResponse()
    }

    // Legacy path: plain JSON chat response (non-streaming) for callers that send a single `message` field.
    // Fetch user's bookings, estimates, and available packages
    const payload = await getPayload({ config: configPromise })

    const [bookings, estimates, packages] = await Promise.all([
      payload.find({
        collection: 'bookings',
        where: {
          customer: { equals: user.id },
        },
        depth: 2,
        sort: '-fromDate',
      }),
      payload.find({
        collection: 'estimates',
        where: {
          customer: { equals: user.id },
        },
        depth: 2,
        sort: '-createdAt',
      }),
      // Fetch all packages to provide recommendations and enabled status
      payload.find({
        collection: 'packages',
        depth: 2,
        sort: 'name',
        limit: 100, // Get a good sample of packages
      }),
    ])

    // Get post details if context provided
    let postDetails = null
    if (bookingContext?.postId) {
      try {
        const post = await payload.findByID({
          collection: 'posts',
          id: bookingContext.postId,
          depth: 1
        })
        postDetails = post
      } catch (error) {
        console.error('Error fetching post details:', error)
      }
    }

    // Format bookings and estimates data for the AI
    const bookingsInfo = bookings.docs.map((booking: any) => {
      const post = typeof booking.post === 'object' && booking.post ? booking.post : null
      const categories = Array.isArray(post?.categories)
        ? post.categories.map((c: any) =>
          typeof c === 'object'
            ? (c.title || c.slug || c.id || '').toString()
            : String(c)
        ).filter(Boolean)
        : []

      return {
        id: booking.id,
        title: booking.title,
        fromDate: new Date(booking.fromDate).toLocaleDateString(),
        toDate: new Date(booking.toDate).toLocaleDateString(),
        status: booking.paymentStatus || 'unknown',
        propertyTitle: post?.title || '',
        propertySlug: post?.slug || '',
        proximityCategories: categories,
      }
    })

    const estimatesInfo = estimates.docs.map((estimate) => ({
      id: estimate.id,
      title:
        typeof estimate.post === 'string' ? estimate.title : estimate.post?.title || estimate.title,
      total: estimate.total,
      fromDate: new Date(estimate.fromDate).toLocaleDateString(),
      toDate: new Date(estimate.toDate).toLocaleDateString(),
      status: estimate.paymentStatus,
      packageName: (estimate as any).packageLabel || estimate.packageType || '',
      link: `${process.env.NEXT_PUBLIC_URL}/estimate/${estimate.id}`,
    }))

    // Format packages data for the AI
    const packagesInfo = packages.docs.map((pkg) => ({
      id: pkg.id,
      name: pkg.name,
      description: pkg.description,
      isEnabled: pkg.isEnabled,
      category: pkg.category,
      multiplier: pkg.multiplier,
      minNights: pkg.minNights,
      maxNights: pkg.maxNights,
      baseRate: pkg.baseRate,
      revenueCatId: pkg.revenueCatId,
      features: pkg.features?.map((f: any) => typeof f === 'string' ? f : f.feature).filter(Boolean) || [],
      postTitle: typeof pkg.post === 'object' && pkg.post ? pkg.post.title : 'Unknown Property',
      durationText: pkg.minNights === pkg.maxNights
        ? `${pkg.minNights} ${pkg.minNights === 1 ? 'night' : 'nights'}`
        : `${pkg.minNights}-${pkg.maxNights} nights`
    }))

    // Create a context with the user's data
    const userContext = {
      bookings: bookingsInfo,
      estimates: estimatesInfo,
      packages: packagesInfo,
      user: {
        id: user.id,
        email: user.email,
      },
      // Add booking context if provided
      currentBooking: bookingContext ? {
        postId: bookingContext.postId,
        postTitle: bookingContext.postTitle || postDetails?.title || 'this property',
        postDescription: bookingContext.postDescription || postDetails?.meta?.description || '',
        baseRate: bookingContext.baseRate || 150,
        duration: bookingContext.duration || 1,
        availablePackages: bookingContext.packages || 0,
        customerEntitlement: bookingContext.customerEntitlement || 'none',
        selectedPackage: bookingContext.selectedPackage || null,
        fromDate: bookingContext.fromDate || null,
        toDate: bookingContext.toDate || null,
        postDetails: postDetails ? {
          title: postDetails.title,
          description: postDetails.meta?.description || ''
        } : null
      } : null
    }

    // Get the generative model
    const model = genAI.getGenerativeModel({ model: 'gemini-2.5-flash' })

    // Handle package update context
    if (context === 'package-update' && packageId && postId) {
      try {
        // Fetch the specific package to update
        const packageToUpdate = await payload.findByID({
          collection: 'packages',
          id: packageId,
          depth: 1
        })

        // Fetch post details
        const post = await payload.findByID({
          collection: 'posts',
          id: postId,
          depth: 1
        })

        const systemPrompt = `You are an AI assistant helping a host update a package for their property.

CURRENT PACKAGE:
- Name: ${packageToUpdate.name}
- Category: ${packageToUpdate.category}
- Description: ${packageToUpdate.description || 'No description'}
- Base Rate: ${packageToUpdate.baseRate ? `R${packageToUpdate.baseRate}` : 'Not set'}
- Features: ${packageToUpdate.features?.map((f: any) => typeof f === 'string' ? f : f.feature).join(', ') || 'No features'}
- RevenueCat ID: ${packageToUpdate.revenueCatId}
- Enabled: ${packageToUpdate.isEnabled}

PROPERTY CONTEXT:
- Property: ${post.title}
- Description: ${post.meta?.description || 'No description'}

AVAILABLE CATEGORIES:
- standard: Regular accommodation packages
- hosted: Packages with host services/concierge
- addon: One-time services or extras (cleaning, wine, guided tours, etc.)
- special: Unique or promotional packages

INSTRUCTIONS:
1. Analyze the user's request for package updates
2. If they want to change the category to 'addon', suggest appropriate changes:
   - Update category to 'addon'
   - Suggest appropriate base rate for addon services
   - Update features to reflect addon nature
   - Update description to focus on the service/extra
3. Provide specific, actionable suggestions
4. Include reasoning for your recommendations
5. Be helpful and professional

Respond with clear, specific suggestions for updating the package.`

        const chat = model.startChat({
          history: [
            {
              role: 'user',
              parts: [{ text: systemPrompt }],
            },
            {
              role: 'model',
              parts: [{ text: 'I understand. I\'m ready to help you update this package.' }],
            },
          ],
        })

        // Ensure message is a string (Google Generative AI SDK requirement)
        const messageText = String(message || '').trim()
        if (!messageText) {
          return NextResponse.json({ error: 'Message is required' }, { status: 400 })
        }
        const result = await chat.sendMessage(messageText)
        const response = await result.response
        const text = response.text()
        const usage = serializeUsageMetadata(response.usageMetadata)

        return NextResponse.json({ response: text, usage })
      } catch (error) {
        console.error('Error in package update:', error)
        return NextResponse.json({ response: 'Sorry, I encountered an error while updating the package. Please try again.' })
      }
    }

    // Handle cleaning schedule optimization for hosts/admins
    if (context === 'cleaning-schedule') {
      try {
        // Fetch ALL bookings (not just user's bookings) for cleaning schedule
        // Hosts need to see all bookings across all properties
        const allBookings = await payload.find({
          collection: 'bookings',
          where: {
            paymentStatus: { equals: 'paid' }, // Only paid bookings
          },
          depth: 2,
          sort: 'toDate',
          limit: 200, // Get upcoming bookings
        })

        // Check for guest transactions (bookings paid by guests)
        const customerIds = allBookings.docs
          .map((b: any) => typeof b.customer === 'object' ? b.customer?.id : b.customer)
          .filter(Boolean) as string[]

        const guestTransactions = customerIds.length > 0 ? await payload.find({
          collection: 'yoco-transactions',
          where: {
            user: { in: customerIds },
            intent: { equals: 'booking' },
            status: { equals: 'completed' },
          },
          limit: 1000,
        }) : { docs: [] }

        const guestTransactionUserIds = new Set(
          guestTransactions.docs.map((t: any) =>
            typeof t.user === 'object' ? t.user?.id : t.user
          ).filter(Boolean) as string[]
        )

        // Format bookings with full property details including sleep capacity
        const cleaningBookingsInfo = allBookings.docs.map((booking: any) => {
          const post = typeof booking.post === 'object' && booking.post ? booking.post : null
          const categories = Array.isArray(post?.categories)
            ? post.categories.map((c: any) =>
              typeof c === 'object'
                ? (c.title || c.slug || c.id || '').toString()
                : String(c)
            ).filter(Boolean)
            : []

          // Extract sleep capacity from post meta description or content
          let sleepCapacity = 'Unknown'
          if (post?.meta?.description) {
            const desc = post.meta.description
            const match1 = desc.match(/(?:sleeps?|accommodates?|fits?)\s+(\d+)/i)?.[1]
            const match2 = desc.match(/(\d+)\s+(?:person|people|guest|bedroom)/i)?.[1]
            const match3 = desc.match(/(?:couple|double|single|twin)/i) ? '2' : null
            sleepCapacity = match1 || match2 || match3 || 'Unknown'
          }

          // Also try to extract from post content if it's a string (simple text)
          if (sleepCapacity === 'Unknown' && post?.content && typeof post.content === 'string') {
            const content = post.content
            const match1 = content.match(/(?:sleeps?|accommodates?|fits?)\s+(\d+)/i)?.[1]
            const match2 = content.match(/(\d+)\s+(?:person|people|guest|bedroom)/i)?.[1]
            sleepCapacity = match1 || match2 || sleepCapacity
          }

          const checkoutDateISO = booking.toDate.split('T')[0] // YYYY-MM-DD format
          const checkinDateISO = booking.fromDate.split('T')[0] // YYYY-MM-DD format

          // Check if booking was paid by a guest (has completed transaction)
          const customerId = typeof booking.customer === 'object' ? booking.customer?.id : booking.customer
          const isGuestBooking = customerId && guestTransactionUserIds.has(customerId)

          // Get package info for current booking
          const currentPackage = booking.selectedPackage?.package
          const currentPackageName = typeof currentPackage === 'object' && currentPackage
            ? (currentPackage.name || booking.selectedPackage?.customName || 'Unknown Package')
            : (booking.selectedPackage?.customName || 'Unknown Package')

          return {
            id: booking.id,
            propertyTitle: post?.title || booking.title || 'Unknown Property',
            propertySlug: post?.slug || '',
            propertyId: post?.id || '',
            fromDate: booking.fromDate,
            toDate: booking.toDate,
            checkoutDate: new Date(booking.toDate).toLocaleDateString('en-US', {
              weekday: 'short',
              year: 'numeric',
              month: 'short',
              day: 'numeric'
            }),
            checkinDate: new Date(booking.fromDate).toLocaleDateString('en-US', {
              weekday: 'short',
              year: 'numeric',
              month: 'short',
              day: 'numeric'
            }),
            checkoutDateISO: checkoutDateISO,
            checkinDateISO: checkinDateISO,
            status: booking.paymentStatus || 'unknown',
            proximityCategories: categories,
            sleepCapacity: sleepCapacity,
            isGuestBooking: isGuestBooking,
            currentPackageName: currentPackageName,
          }
        })

        // Find next bookings for each property to determine cleaning needs before check-in
        // Also calculate time windows between checkout and next check-in
        const propertyNextBookings: Record<string, typeof cleaningBookingsInfo[0] & {
          timeWindowHours: number
          timeWindowDays: number
          nextPackageName: string
        } | null> = {}

        cleaningBookingsInfo.forEach((booking) => {
          const propertyId = booking.propertyId
          if (!propertyId) return

          // Find the next booking for this property (earliest check-in after this checkout)
          const nextBooking = cleaningBookingsInfo
            .filter(b => b.propertyId === propertyId && b.checkinDateISO > booking.checkoutDateISO)
            .sort((a, b) => a.checkinDateISO.localeCompare(b.checkinDateISO))[0]

          if (nextBooking) {
            // Calculate time window between checkout and next check-in
            const checkoutDate = new Date(booking.toDate)
            const nextCheckinDate = new Date(nextBooking.fromDate)
            const timeWindowMs = nextCheckinDate.getTime() - checkoutDate.getTime()
            const timeWindowHours = Math.floor(timeWindowMs / (1000 * 60 * 60))
            const timeWindowDays = Math.floor(timeWindowMs / (1000 * 60 * 60 * 24))

            propertyNextBookings[booking.id] = {
              ...nextBooking,
              timeWindowHours,
              timeWindowDays,
              nextPackageName: nextBooking.currentPackageName,
            }
          }
        })

        // Get today's date in YYYY-MM-DD format
        const today = new Date()
        today.setHours(0, 0, 0, 0)
        const todayISO = today.toISOString().split('T')[0]
        const tomorrow = new Date(today)
        tomorrow.setDate(tomorrow.getDate() + 1)
        const tomorrowISO = tomorrow.toISOString().split('T')[0]

        // Filter bookings checking out today and tomorrow
        const todayCheckouts = cleaningBookingsInfo.filter(b => b.checkoutDateISO === todayISO)
        const tomorrowCheckouts = cleaningBookingsInfo.filter(b => b.checkoutDateISO === tomorrowISO)

        // Group bookings by checkout date for same-day analysis
        const bookingsByCheckoutDate: Record<string, typeof cleaningBookingsInfo> = {}
        cleaningBookingsInfo.forEach((booking) => {
          if (!bookingsByCheckoutDate[booking.checkoutDateISO]) {
            bookingsByCheckoutDate[booking.checkoutDateISO] = []
          }
          const dateGroup = bookingsByCheckoutDate[booking.checkoutDateISO]
          if (dateGroup) {
            dateGroup.push(booking)
          }
        })

        // Group bookings by checkin date to detect same-day checkout/checkin overlaps
        const bookingsByCheckinDate: Record<string, typeof cleaningBookingsInfo> = {}
        cleaningBookingsInfo.forEach((booking) => {
          if (!bookingsByCheckinDate[booking.checkinDateISO]) {
            bookingsByCheckinDate[booking.checkinDateISO] = []
          }
          const dateGroup = bookingsByCheckinDate[booking.checkinDateISO]
          if (dateGroup) {
            dateGroup.push(booking)
          }
        })

        // Build detailed booking info with next booking context
        const detailedBookingsInfo = cleaningBookingsInfo.map((b) => {
          const nextBooking = propertyNextBookings[b.id]
          return {
            ...b,
            nextCheckin: nextBooking ? {
              date: nextBooking.checkinDate,
              dateISO: nextBooking.checkinDateISO,
              propertyTitle: nextBooking.propertyTitle,
              timeWindowHours: nextBooking.timeWindowHours,
              timeWindowDays: nextBooking.timeWindowDays,
              packageName: nextBooking.nextPackageName,
            } : null,
          }
        })

        const systemPrompt = `You are an expert operations assistant helping a host plan cleaner routes.

HOST CONTEXT:
- User ID: ${user.id}
- Email: ${user.email}
- Today's date: ${today.toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}

ALL UPCOMING BOOKINGS WITH CLEANING CONTEXT:
${detailedBookingsInfo.length > 0
            ? detailedBookingsInfo.map(
              (b) => {
                const nextInfo = b.nextCheckin
                  ? ` → Next check-in: ${b.nextCheckin.propertyTitle} on ${b.nextCheckin.date} (clean on ${b.checkoutDate} before next guest)`
                  : ` → No immediate next booking (clean on ${b.checkoutDate})`
                return `- ${b.propertyTitle} (sleeps ${b.sleepCapacity}) • Checkout: ${b.checkoutDate} • Check-in: ${b.checkinDate}${nextInfo} • Categories: ${b.proximityCategories.length ? b.proximityCategories.join(', ') : 'None'}`
              }
            ).join('\n')
            : 'No upcoming bookings found.'}

SAME-DAY CHECKOUTS BY DATE:
${Object.entries(bookingsByCheckoutDate)
            .sort(([dateA], [dateB]) => dateA.localeCompare(dateB))
            .map(([date, bookings]) => {
              const dateFormatted = new Date(date + 'T00:00:00').toLocaleDateString('en-US', {
                weekday: 'long',
                year: 'numeric',
                month: 'long',
                day: 'numeric'
              })
              const sameDayCheckins = bookingsByCheckinDate[date] || []
              const checkinsText = sameDayCheckins.length > 0
                ? `\n  ⚠️ CRITICAL: ${sameDayCheckins.length} ${sameDayCheckins.length === 1 ? 'property' : 'properties'} checking IN on this same date:\n${sameDayCheckins.map(c => `    - ${c.propertyTitle} (sleeps ${c.sleepCapacity}) • Categories: ${c.proximityCategories.join(', ') || 'None'}`).join('\n')}`
                : ''
              return `\n${dateFormatted} (${bookings.length} checkout${bookings.length !== 1 ? 's' : ''}):\n${bookings.map(b => `  - ${b.propertyTitle} (sleeps ${b.sleepCapacity}) • Categories: ${b.proximityCategories.join(', ') || 'None'}`).join('\n')}${checkinsText}`
            }).join('\n')}

TODAY'S CHECKOUTS (${todayCheckouts.length}):
${todayCheckouts.length > 0
            ? todayCheckouts.map(
              (b) => {
                const nextInfo = propertyNextBookings[b.id]
                  ? ` → Next: ${propertyNextBookings[b.id]!.propertyTitle} checks in ${propertyNextBookings[b.id]!.checkinDate} (clean today before next guest)`
                  : ''
                return `- ${b.propertyTitle} (sleeps ${b.sleepCapacity}) • Categories: ${b.proximityCategories.join(', ') || 'None'}${nextInfo}`
              }
            ).join('\n')
            : 'No checkouts today.'}

TOMORROW'S CHECKOUTS (${tomorrowCheckouts.length}):
${tomorrowCheckouts.length > 0
            ? tomorrowCheckouts.map(
              (b) => {
                const nextInfo = propertyNextBookings[b.id]
                  ? ` → Next: ${propertyNextBookings[b.id]!.propertyTitle} checks in ${propertyNextBookings[b.id]!.checkinDate} (clean tomorrow before next guest)`
                  : ''
                return `- ${b.propertyTitle} (sleeps ${b.sleepCapacity}) • Categories: ${b.proximityCategories.join(', ') || 'None'}${nextInfo}`
              }
            ).join('\n')
            : 'No checkouts tomorrow.'}

CRITICAL INSTRUCTIONS - BE CONCISE AND USE RELATIVE DATES:

1. **ALWAYS use relative date references instead of specific dates**:
   - Use: "tomorrow", "next week", "this Sunday", "in 3 weeks", "twice next week", "next month"
   - Avoid: "Dec 19", "January 17", "December 21" (only use if absolutely necessary)
   - Examples: "Tomorrow, and twice next week" or "This Sunday, next Wednesday, and in 3 weeks"

2. **If there are overlapping checkouts (same day)**: 
   - Briefly mention: "X properties checking out [relative date]" and if they're in close proximity
   - Example: "2 properties checking out tomorrow in southern peninsular area"
   - Example: "3 properties checking out this Sunday"
   - **CRITICAL**: If properties are checking IN on the same date as checkouts, explicitly call this out as it requires immediate cleaning before check-in time

3. **If NO overlapping checkouts**:
   - Simply list when to send cleaners using relative dates: "Tomorrow, and twice next week" or "This Sunday, next Wednesday, and in 3 weeks"
   - Be concise - just the relative dates/times, no elaboration

4. **Only mention proximity if properties share categories AND checkout on the same day** - otherwise skip proximity details

5. **Do NOT elaborate on**:
   - Individual property details unless asked
   - Sleep capacity unless relevant to cleaner count
   - Detailed routes unless there are same-day checkouts
   - Next check-in dates unless critical

6. **Keep response under 3-4 sentences** - focus on key insights only

Respond concisely with just the essential information using relative date references.`

        const chat = model.startChat({
          history: [
            {
              role: 'user',
              parts: [{ text: systemPrompt }],
            },
            {
              role: 'model',
              parts: [{ text: "I understand. I'm ready to help you plan cleaner schedules and routes." }],
            },
          ],
        })

        // Ensure message is a string (Google Generative AI SDK requirement)
        const messageText = String(message || '').trim()
        if (!messageText) {
          return NextResponse.json({ error: 'Message is required' }, { status: 400 })
        }
        const result = await chat.sendMessage(messageText)
        const response = await result.response
        const text = response.text()
        const usage = serializeUsageMetadata(response.usageMetadata)

        // Structure same-day checkouts by date for the Plan component
        // Also include checkins on the same date (critical cleaning insight)
        const sameDayCheckoutsByDate = Object.entries(bookingsByCheckoutDate)
          .sort(([dateA], [dateB]) => dateA.localeCompare(dateB))
          .map(([dateISO, bookings]) => {
            const dateFormatted = new Date(dateISO + 'T00:00:00').toLocaleDateString('en-US', {
              weekday: 'long',
              year: 'numeric',
              month: 'long',
              day: 'numeric'
            })

            // Find checkins happening on the same date (different properties)
            const sameDayCheckins = bookingsByCheckinDate[dateISO] || []

            return {
              date: dateFormatted,
              dateISO: dateISO,
              properties: bookings.map(b => {
                const nextBooking = propertyNextBookings[b.id]
                return {
                  id: b.id,
                  propertyTitle: b.propertyTitle,
                  propertySlug: b.propertySlug,
                  checkoutDate: b.checkoutDate,
                  checkinDate: b.checkinDate,
                  sleepCapacity: b.sleepCapacity,
                  proximityCategories: b.proximityCategories,
                  isGuestBooking: b.isGuestBooking,
                  currentPackageName: b.currentPackageName,
                  nextCheckin: nextBooking ? {
                    date: nextBooking.checkinDate,
                    propertyTitle: nextBooking.propertyTitle,
                    timeWindowHours: nextBooking.timeWindowHours,
                    timeWindowDays: nextBooking.timeWindowDays,
                    packageName: nextBooking.nextPackageName,
                  } : null,
                }
              }),
              // Include checkins on the same date (for cleaning insight)
              sameDayCheckins: sameDayCheckins
                .filter(checkin => !bookings.some(checkout => checkout.id === checkin.id)) // Exclude if it's the same booking
                .map(checkin => {
                  return {
                    id: checkin.id,
                    propertyTitle: checkin.propertyTitle,
                    propertySlug: checkin.propertySlug,
                    checkinDate: checkin.checkinDate,
                    sleepCapacity: checkin.sleepCapacity,
                    proximityCategories: checkin.proximityCategories,
                    isGuestBooking: checkin.isGuestBooking,
                    currentPackageName: checkin.currentPackageName,
                  }
                }),
            }
          })

        // Create date suggestions showing checkout schedules grouped by date
        // Format: "Tuesday, October 14, 2025 (1 property) - Friday, December 19, 2025 (1 property)"
        const checkoutScheduleSuggestions = Object.entries(bookingsByCheckoutDate)
          .sort(([dateA], [dateB]) => dateA.localeCompare(dateB))
          .map(([dateISO, bookings]) => {
            const dateFormatted = new Date(dateISO + 'T00:00:00').toLocaleDateString('en-US', {
              weekday: 'long',
              year: 'numeric',
              month: 'long',
              day: 'numeric'
            })

            // Get next checkout dates for properties in this group
            const nextCheckouts = bookings
              .map(b => {
                const nextBooking = propertyNextBookings[b.id]
                if (!nextBooking) return null
                return {
                  checkoutDate: nextBooking.checkoutDateISO,
                  checkoutDateFormatted: new Date(nextBooking.checkoutDateISO + 'T00:00:00').toLocaleDateString('en-US', {
                    weekday: 'long',
                    year: 'numeric',
                    month: 'long',
                    day: 'numeric'
                  }),
                  propertyTitle: b.propertyTitle,
                }
              })
              .filter((nc): nc is { checkoutDate: string; checkoutDateFormatted: string; propertyTitle: string } => nc !== null)

            // Group next checkouts by date
            const nextCheckoutsByDate: Record<string, Array<{ checkoutDate: string; checkoutDateFormatted: string; propertyTitle: string }>> = {}
            nextCheckouts.forEach(nc => {
              if (!nextCheckoutsByDate[nc.checkoutDate]) {
                nextCheckoutsByDate[nc.checkoutDate] = []
              }
              const dateGroup = nextCheckoutsByDate[nc.checkoutDate]
              if (dateGroup) {
                dateGroup.push(nc)
              }
            })

            return {
              checkoutDate: dateISO,
              checkoutDateFormatted: dateFormatted,
              propertyCount: bookings.length,
              properties: bookings.map(b => ({
                id: b.id,
                propertyTitle: b.propertyTitle,
                propertySlug: b.propertySlug,
                checkoutDate: b.checkoutDate,
                checkinDate: b.checkinDate,
                sleepCapacity: b.sleepCapacity,
                proximityCategories: b.proximityCategories,
                isGuestBooking: b.isGuestBooking,
                currentPackageName: b.currentPackageName,
                nextCheckin: propertyNextBookings[b.id] ? {
                  date: propertyNextBookings[b.id]!.checkinDate,
                  checkoutDate: propertyNextBookings[b.id]!.checkoutDateISO,
                  checkoutDateFormatted: new Date(propertyNextBookings[b.id]!.checkoutDateISO + 'T00:00:00').toLocaleDateString('en-US', {
                    weekday: 'long',
                    year: 'numeric',
                    month: 'long',
                    day: 'numeric'
                  }),
                  propertyTitle: propertyNextBookings[b.id]!.propertyTitle,
                  timeWindowHours: propertyNextBookings[b.id]!.timeWindowHours,
                  timeWindowDays: propertyNextBookings[b.id]!.timeWindowDays,
                  packageName: propertyNextBookings[b.id]!.nextPackageName,
                } : null,
              })),
              nextCheckoutsByDate: Object.entries(nextCheckoutsByDate)
                .map(([nextDateISO, props]) => {
                  const firstProp = props[0]
                  if (!firstProp) return null
                  return {
                    checkoutDate: nextDateISO,
                    checkoutDateFormatted: firstProp.checkoutDateFormatted,
                    propertyCount: props.length,
                  }
                })
                .filter((item): item is { checkoutDate: string; checkoutDateFormatted: string; propertyCount: number } => item !== null),
            }
          })

        // Create schedule suggestions showing date ranges with property counts
        // Format: "Tuesday, October 14, 2025 (1 property) - Friday, December 19, 2025 (1 property)"
        const scheduleSuggestions = checkoutScheduleSuggestions
          .filter(schedule => schedule.nextCheckoutsByDate.length > 0)
          .flatMap(schedule =>
            schedule.nextCheckoutsByDate.map(nextCheckout => ({
              label: `${schedule.checkoutDateFormatted} (${schedule.propertyCount} ${schedule.propertyCount === 1 ? 'property' : 'properties'}) - ${nextCheckout.checkoutDateFormatted} (${nextCheckout.propertyCount} ${nextCheckout.propertyCount === 1 ? 'property' : 'properties'})`,
              fromCheckoutDate: schedule.checkoutDate,
              fromCheckoutDateFormatted: schedule.checkoutDateFormatted,
              fromPropertyCount: schedule.propertyCount,
              toCheckoutDate: nextCheckout.checkoutDate,
              toCheckoutDateFormatted: nextCheckout.checkoutDateFormatted,
              toPropertyCount: nextCheckout.propertyCount,
              properties: schedule.properties,
            }))
          )

        // Also keep the time window suggestions for the existing display
        const dateSuggestions = cleaningBookingsInfo
          .filter(b => propertyNextBookings[b.id]) // Only bookings with next check-ins
          .map(b => {
            const nextBooking = propertyNextBookings[b.id]!
            const checkoutDate = new Date(b.toDate)
            const nextCheckinDate = new Date(nextBooking.fromDate)

            // Format time window
            let timeWindowLabel = ''
            if (nextBooking.timeWindowHours < 24) {
              timeWindowLabel = `${nextBooking.timeWindowHours} hour${nextBooking.timeWindowHours !== 1 ? 's' : ''}`
            } else if (nextBooking.timeWindowDays === 1) {
              timeWindowLabel = '1 day'
            } else {
              timeWindowLabel = `${nextBooking.timeWindowDays} days`
            }

            return {
              checkoutDate: b.checkoutDateISO,
              checkoutDateFormatted: b.checkoutDate,
              nextCheckinDate: nextBooking.checkinDateISO,
              nextCheckinDateFormatted: nextBooking.checkinDate,
              propertyTitle: b.propertyTitle,
              timeWindowHours: nextBooking.timeWindowHours,
              timeWindowDays: nextBooking.timeWindowDays,
              timeWindowLabel: timeWindowLabel,
              nextPackageName: nextBooking.nextPackageName,
              isGuestBooking: b.isGuestBooking,
            }
          })
          .sort((a, b) => a.checkoutDate.localeCompare(b.checkoutDate))

        return NextResponse.json({
          response: text,
          usage,
          cleaningSchedule: {
            sameDayCheckouts: sameDayCheckoutsByDate,
            dateSuggestions: dateSuggestions,
            scheduleSuggestions: scheduleSuggestions,
          },
        })
      } catch (error) {
        console.error('Error in cleaning-schedule context:', error)
        return NextResponse.json({
          response:
            'Sorry, I encountered an error while planning the cleaning schedule. Please try again in a moment.',
        })
      }
    }

    // Handle manage context with MCP capabilities
    if (context === 'manage' && isHostOrAdmin && pageData) {
      const posts = pageData.posts || []
      const systemPrompt = `You are an AI assistant helping a host manage their property packages using MCP (Model Context Protocol) tools.

MCP CAPABILITIES:
You have access to MCP tools that allow you to create, update, delete, and find packages through the Payload CMS MCP server. The MCP endpoint is available at /api/mcp.

AVAILABLE MCP TOOLS FOR PACKAGES:
- Create Package: Create new packages for properties
- Update Package: Modify existing package details (name, description, baseRate, category, minNights, maxNights, multiplier, entitlement, isEnabled)
- Delete Package: Remove packages
- Find Packages: Search and list packages

HOST'S PROPERTIES:
${posts.map((post: any) => `- ${post.title} (ID: ${post.id}, Slug: ${post.slug})`).join('\n') || 'No properties yet'}

PACKAGE MANAGEMENT GUIDELINES:
1. Base rates are stored in Rands (ZAR). For example, R150.00 = 150
2. Categories: standard, hosted, addon, special
3. Entitlements: standard, pro
4. Always confirm which property (post) the package should be associated with
5. When creating packages, include: name, description, category, minNights, maxNights, baseRate (in Rands), multiplier, entitlement, and isEnabled status
6. When updating packages, you can modify any field
7. Be helpful and guide the host through package management decisions

INSTRUCTIONS:
- When asked to create a package, guide the user through providing all necessary details
- When asked to update a package, confirm which package and what changes to make
- When asked to delete a package, confirm before proceeding
- Always format currency as R (Rands), not $
- Provide clear, actionable responses
- Use MCP tools when appropriate to actually perform package operations

Respond naturally and helpfully to package management requests.`

      const chat = model.startChat({
        history: [
          {
            role: 'user',
            parts: [{ text: systemPrompt }],
          },
          {
            role: 'model',
            parts: [{ text: 'I understand. I can help you manage packages using MCP tools. What would you like to do?' }],
          },
        ],
      })

      // Ensure message is a string (Google Generative AI SDK requirement)
      const messageText = String(message || '').trim()
      if (!messageText) {
        return NextResponse.json({ error: 'Message is required' }, { status: 400 })
      }
      const result = await chat.sendMessage(messageText)
      const response = await result.response
      const text = response.text()
      const usage = serializeUsageMetadata(response.usageMetadata)

      return NextResponse.json({ message: text, response: text, usage })
    }

    // Create enhanced prompt for booking assistant
    const systemPrompt = bookingContext ? `You are a helpful AI booking assistant for ${userContext.currentBooking?.postTitle}. 

CURRENT BOOKING CONTEXT:
- Property: ${userContext.currentBooking?.postTitle}
- Base Rate: R${userContext.currentBooking?.baseRate}/night
- Customer Entitlement: ${userContext.currentBooking?.customerEntitlement}
- Available Packages: ${userContext.currentBooking?.availablePackages}
${userContext.currentBooking?.selectedPackage ? `- Selected Package: ${userContext.currentBooking.selectedPackage}` : ''}
${userContext.currentBooking?.fromDate && userContext.currentBooking?.toDate ?
        `- Selected Dates: ${new Date(userContext.currentBooking.fromDate).toLocaleDateString()} to ${new Date(userContext.currentBooking.toDate).toLocaleDateString()} (${userContext.currentBooking.duration} ${userContext.currentBooking.duration === 1 ? 'night' : 'nights'})` :
        '- Dates: Not yet selected'
      }
${userContext.currentBooking?.postDetails?.description ? `- Description: ${userContext.currentBooking.postDetails.description}` : ''}

USER'S BOOKING HISTORY:
- Total Bookings: ${userContext.bookings.length}
- Recent Estimates: ${userContext.estimates.length}

AVAILABLE PACKAGES FOR THIS PROPERTY:
${packagesInfo.filter(pkg => pkg.isEnabled).map(pkg =>
        `- ${pkg.name} (${pkg.durationText}): ${pkg.description} - Features: ${pkg.features.join(', ')}`
      ).join('\n')}

ENTITLEMENT INFORMATION:
- Customer has ${userContext.currentBooking?.customerEntitlement} entitlement
- Pro-only packages (like "🏘️ Annual agreement", hosted experiences) require pro subscription
- Standard packages are available to all customers
- Guests can see all packages but need to log in to book

INSTRUCTIONS:
1. Be conversational and helpful
2. If dates are already selected, acknowledge them and focus on package recommendations or other aspects
3. If dates are not selected, guide users to select dates first
4. Recommend packages based on duration and customer needs
5. Explain package benefits clearly
6. For pro-only packages (like "🏘️ Annual agreement"), mention they require a pro subscription if user isn't pro
7. Help with date selection and duration planning when needed
8. Provide pricing estimates when relevant
9. Guide users through the booking process step by step
10. Keep responses concise but informative
11. Use emojis sparingly for a friendly tone
12. When user asks about packages without dates, suggest they select dates first for better recommendations
13. If user asks about pro packages but has standard entitlement, suggest upgrading to pro
14. If Related Posts are available and the user's question suggests they might be interested in similar properties or related content, naturally suggest checking out the related posts. For example, if they ask about similar properties, alternatives, or related experiences, mention the related posts by name.

Respond to the user's message naturally, as if you're a knowledgeable booking assistant who knows this property well.`
      :
      `You are a helpful AI assistant for a booking platform. You have access to the user's booking history and can help with general questions about properties, packages, and bookings.

USER'S DATA:
- Total Bookings: ${userContext.bookings.length}
- Recent Estimates: ${userContext.estimates.length}
 - Available Packages: ${packagesInfo.length}
 - Available Addons: ${packagesInfo.filter(pkg => pkg.category === 'addon' && pkg.isEnabled).length}
 - Page Summary: ${userContext.currentBooking?.postDetails?.description || 'No additional property summary'}

INSTRUCTIONS:
1. Be helpful, concise, and guide users to make great booking decisions
2. If the user's message mentions Related Posts or asks about similar properties, alternatives, or related content, and Related Posts are available in the context, naturally suggest checking them out by name
3. When suggesting related posts, be conversational and explain why they might be relevant to the user's interests

Be helpful, concise, and guide users to make great booking decisions.`

    // Create a chat context with the user's data
    const chat = model.startChat({
      history: [
        {
          role: 'user',
          parts: [{ text: systemPrompt }],
        },
        {
          role: 'model',
          parts: [{ text: 'I understand. I\'m ready to help with booking assistance.' }],
        },
      ],
    })

    // Generate response
    // Ensure message is a string (Google Generative AI SDK requirement)
    // message is already normalized at the top, but add final safety check
    const messageText = String(message || '').trim()
    if (!messageText) {
      return NextResponse.json({ error: 'Message is required' }, { status: 400 })
    }
    const result = await chat.sendMessage(messageText)
    const response = await result.response
    const text = response.text()
    const usage = serializeUsageMetadata(response.usageMetadata)

    return NextResponse.json({ message: text, usage })
  } catch (error) {
    console.error('Error in chat API:', error)
    const errorMessage = error instanceof Error ? error.message : 'Unknown error'
    const errorStack = error instanceof Error ? error.stack : undefined
    
    // Log more details for debugging
    if (process.env.NODE_ENV === 'development') {
      console.error('Full error details:', {
        message: errorMessage,
        stack: errorStack,
        error: error
      })
    }
    
    return NextResponse.json({
      error: 'Failed to process your request',
      message: `Error: ${errorMessage}`,
      details: process.env.NODE_ENV === 'development' ? errorStack : undefined
    }, { status: 500 })
  }
}