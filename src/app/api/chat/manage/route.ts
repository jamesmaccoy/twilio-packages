import { generateObject, streamText, tool, UIMessage } from 'ai'
import { createGoogleGenerativeAI } from '@ai-sdk/google'
import { NextRequest, NextResponse } from 'next/server'
import { getMeUser } from '@/utilities/getMeUser'
import { getPayload } from 'payload'
import configPromise from '@/payload.config'
import { z } from 'zod'
import { BASE_PACKAGE_TEMPLATES, getDefaultPackageTitle } from '@/lib/package-types'
import { sendPackageActivityNotification } from '@/lib/emailNotifications'

// Zod schemas to validate structured JSON that is streamed to the UI
const packagePreviewSchema = z.object({
  name: z.string(),
  description: z.string(),
  category: z.enum(['standard', 'hosted', 'addon', 'special']),
  entitlement: z.enum(['none', 'standard', 'pro']),
  minNights: z.number().int().min(1),
  maxNights: z.number().int().min(1),
  baseRate: z.number().int().min(0),
  multiplier: z.number().min(0.1).max(3.0),
  features: z.array(z.string()).min(1),
  postId: z.string().optional(),
  revenueCatId: z.string().optional(),
  yocoId: z.string().optional(),
  isPreview: z.literal(true),
})

const createdPackageSchema = z.object({
  success: z.literal(true),
  package: z.object({
    id: z.string(),
    name: z.string(),
    description: z.string().nullable().optional(),
    category: z.enum(['standard', 'hosted', 'addon', 'special']),
    isEnabled: z.boolean(),
    minNights: z.number(),
    maxNights: z.number(),
    baseRate: z.number().nullable().optional(),
    multiplier: z.number(),
    entitlement: z.enum(['none', 'standard', 'pro']),
    features: z.any(),
    postId: z.string().optional(),
  }),
  packageId: z.string(),
  message: z.string(),
  /** True when no listing was selected and a draft property was created first */
  createdNewPost: z.boolean().optional(),
  /** The property (post) the package is saved under */
  postId: z.string().optional(),
})

// Initialize Google provider with custom API key
const googleAI = createGoogleGenerativeAI({
  apiKey: process.env.GEMINI_API_KEY || process.env.GOOGLE_GENERATIVE_AI_API_KEY || '',
})

/** Minimal Lexical root for draft posts (matches createPostTool in this file) */
function extractLexicalFirstParagraph(content: any): string {
  const t = content?.root?.children?.[0]?.children?.[0]?.text
  return typeof t === 'string' ? t.trim() : ''
}

const catalogSuggestionSchema = z.object({
  recommendations: z
    .array(
      z.object({
        revenueCatId: z.string(),
        suggestedName: z.string(),
        description: z.string(),
        features: z.array(z.string()),
        baseRate: z.number().optional(),
      }),
    )
    .min(1)
    .max(4),
})

/** Shown after createPost and before catalog/preview tools on new listings */
export const PACKAGE_PLACEMENT_QUESTIONS = `Before I suggest packages, a few quick questions so guests see the right offers:

1. **Repeat add-on or stay package?** — Extras like cleaning or tours are usually **add-on** (one-off). Nightly or weekly stays are **standard** or **special**.
2. **Offer a deal to guests without a subscription?** — Yes → often **special** with **non-member** visibility. Member-only deals stay on **standard** entitlement.
3. **Hosted experience?** — Yes → **hosted** (you or staff involved during the stay).

Reply in your own words (e.g. "weekly stay, special for non-members, not hosted") and I'll match packages.`

function applyPlacementOverrides(
  recommendations: z.infer<typeof catalogSuggestionSchema>['recommendations'],
  hint?: string,
) {
  if (!hint?.trim()) return recommendations
  const h = hint.toLowerCase()
  const wantsNonMember =
    /non-?member|without (a )?subscription|guests without|unsubscribed|not subscribed|public (offer|deal)|anyone can (book|see)/.test(
      h,
    )
  const wantsHosted = /\bhosted\b|concierge|host (will |is )?involv|personalized service/.test(h)
  const wantsAddon =
    /\baddon\b|add-?on|once[- ]?off|one[- ]?time|cleaning|tour|extra service|not (a )?stay|repeat service/.test(h)
  const wantsSpecial = /\bspecial\b|promo|promotion|limited[- ]?time|deal for/.test(h)

  return recommendations.map((r) => {
    const details = { ...(r as any).details } as Record<string, unknown>
    if (wantsNonMember) details.customerTierRequired = 'none'
    if (wantsHosted) details.category = 'hosted'
    if (wantsAddon) details.category = 'addon'
    if (wantsSpecial && wantsNonMember) details.category = 'special'
    return { ...r, details }
  })
}

function fallbackCatalogBaseRateRands(category: string, minNights: number) {
  const c = String(category || 'standard')
  // Higher defaults than before; tuned for ZAR nightly pricing + obvious value ladder.
  if (c === 'addon') return 450
  if (c === 'hosted') return minNights <= 1 ? 650 : 850
  if (c === 'special') return minNights <= 1 ? 550 : 750
  // standard
  return minNights <= 1 ? 480 : 600
}

async function runCatalogPackageSuggestions(
  payload: any,
  user: any,
  postId: string,
  hint?: string,
): Promise<{
  success: boolean
  postId: string
  recommendations: z.infer<typeof catalogSuggestionSchema>['recommendations']
  message: string
}> {
  const pid = String(postId).trim()
  try {
    const post = await payload.findByID({
      collection: 'posts',
      id: pid,
      depth: 1,
      user,
    })
    const title = typeof post?.title === 'string' ? post.title.trim() : ''
    const metaDesc =
      typeof (post as any)?.meta?.description === 'string'
        ? (post as any).meta.description.trim()
        : ''
    const body = extractLexicalFirstParagraph((post as any)?.content)
    const postBaseRate =
      typeof (post as any)?.baseRate === 'number' && Number.isFinite((post as any).baseRate)
        ? Math.max(0, Math.round((post as any).baseRate))
        : null

    const knownTemplates = BASE_PACKAGE_TEMPLATES.map((t) => ({
      revenueCatId: t.revenueCatId,
      defaultName: getDefaultPackageTitle(t),
      category: t.category,
      customerTierRequired: t.customerTierRequired,
      minNights: t.minNights,
      maxNights: t.maxNights,
      features: t.features.map((f) => f.label).join(', '),
    }))

    const knownIds = new Set(BASE_PACKAGE_TEMPLATES.map((t) => t.revenueCatId))
    const modelName = process.env.GEMINI_STREAMING_MODEL || 'models/gemini-2.5-flash'

    const result = await generateObject({
      model: googleAI(modelName),
      schema: catalogSuggestionSchema,
      prompt: `Pick packages from this catalog only (use exact revenueCatId values).

Catalog:
${knownTemplates.map((t) => `- ${t.revenueCatId}: ${t.defaultName} [${t.category}, tier: ${t.customerTierRequired}, ${t.minNights}-${t.maxNights} nights, features: ${t.features}]`).join('\n')}

Property title: "${title || 'Untitled'}"
Property base rate (ZAR per night): "${typeof postBaseRate === 'number' ? postBaseRate : 'N/A'}"
Property meta description: "${metaDesc || 'N/A'}"
Property body (first paragraph): "${body || 'N/A'}"
User hint / host placement answers: "${hint || 'N/A'}"

Return 1–4 recommendations. suggestedName/description/features must be specific to this property, not generic.

Host placement (use hint when present):
- Add-on / once-off / cleaning / tours → prefer **addon** catalog rows
- Hosted / concierge → prefer **hosted** rows
- Special for non-members / guests without subscription → prefer **special** or tier **none** rows
- Member-only stays → tier **standard** or **pro** as appropriate

IMPORTANT: Include a baseRate for each recommendation as a whole-number ZAR amount (e.g. 650). Use the property's base rate as a reference if provided, and adjust for tier:
- hosted: higher than standard
- special: mid-to-high
- addon: one-time-ish fee (still use baseRate field)`,
    })

    const filtered = result.object.recommendations.filter((r) => knownIds.has(r.revenueCatId))
    const picked = filtered.length ? filtered : result.object.recommendations
    // Catalog rows do not include min/max in the LLM schema — attach template nights so
    // "Approve all" persists the same durations as the catalog (incl. 0.5-night hourly).
    const mapped = picked.map((r) => {
      const tpl = BASE_PACKAGE_TEMPLATES.find((t) => t.revenueCatId === r.revenueCatId)
      const tplCategory = String(tpl?.category || 'standard')
      const tplMin = typeof tpl?.minNights === 'number' ? tpl.minNights : 1
      const fallbackBase = fallbackCatalogBaseRateRands(tplCategory, tplMin)
      const baseRate =
        typeof (r as any)?.baseRate === 'number' && Number.isFinite((r as any).baseRate)
          ? Math.max(0, Math.round((r as any).baseRate))
          : typeof postBaseRate === 'number' && postBaseRate > 0
            ? Math.max(0, Math.round(postBaseRate))
            : fallbackBase
      if (!tpl) {
        return {
          ...r,
          baseRate,
          details: {
            minNights: 1,
            maxNights: 1,
            category: 'standard' as const,
            customerTierRequired: 'standard' as const,
            multiplier: 1,
          },
        }
      }
      return {
        ...r,
        baseRate,
        details: {
          minNights: tpl.minNights,
          maxNights: tpl.maxNights,
          category: tpl.category,
          customerTierRequired: tpl.customerTierRequired,
          multiplier: tpl.baseMultiplier,
        },
      }
    })
    const recommendations = applyPlacementOverrides(mapped, hint)
    return {
      success: true,
      postId: pid,
      recommendations,
      message:
        recommendations.length > 0
          ? `Here are ${recommendations.length} catalog package idea(s) tailored to this listing.`
          : 'Suggestions generated; verify revenueCatId values match the catalog.',
    }
  } catch (error: any) {
    return {
      success: false,
      postId: pid,
      recommendations: [],
      message: error?.message || 'Failed to suggest catalog packages',
    }
  }
}

function buildMinimalPostContent(text: string) {
  return {
    root: {
      type: 'root',
      children: [
        {
          type: 'paragraph',
          children: [
            {
              type: 'text',
              text,
              format: 0,
              style: '',
              mode: 'normal',
              detail: 0,
            },
          ],
          direction: 'ltr',
          format: '',
          indent: 0,
          version: 1,
        },
      ],
      direction: 'ltr',
      format: '',
      indent: 0,
      version: 1,
    },
  }
}

export async function POST(request: NextRequest) {
  try {
    const requestBody = await request.json()
    const pageData = requestBody?.pageData
    const incomingMessages = Array.isArray(requestBody?.messages) ? requestBody.messages : []
    const messages: UIMessage[] = incomingMessages as UIMessage[]
    const { user } = await getMeUser()

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const userRole = (user as any).role
    const roleArray = Array.isArray(userRole) ? userRole : userRole ? [userRole] : []
    const isHostOrAdmin = roleArray.includes('host') || roleArray.includes('admin')

    if (!isHostOrAdmin) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const payload = await getPayload({ config: configPromise })
    const posts = pageData?.posts || []
    /** Listing explicitly selected in Manage UI (sidebar); do not fall back to first post */
    const selectedPostId =
      typeof pageData?.postId === 'string' && pageData.postId.trim() ? pageData.postId.trim() : null

    const existingPackageIdFromContext =
      typeof pageData?.existingPackageId === 'string' && pageData.existingPackageId.trim()
        ? pageData.existingPackageId.trim()
        : null

    // Fetch post details for better context (only when a listing is selected)
    let postDetails: any = null
    if (selectedPostId) {
      try {
        postDetails = await payload.findByID({
          collection: 'posts',
          id: selectedPostId,
          depth: 1,
        })
      } catch (e) {
        console.warn('Could not fetch post details:', e)
      }
    }

    // Fetch existing packages for context (skip invalid query when host has no posts yet)
    const existingPackages =
      posts.length > 0
        ? await payload.find({
            collection: 'packages',
            where: {
              post: {
                in: posts.map((p: any) => p.id),
              },
            },
            depth: 1,
            limit: 100,
          })
        : { docs: [] as any[] }

    const normalizeBaseRateToRands = (value: any): number | undefined => {
      if (value === null || value === undefined || value === '') return undefined
      const n = typeof value === 'number' ? value : Number(value)
      if (!Number.isFinite(n) || n < 0) return undefined
      return Math.round(n)
    }

    // Helper function to guess missing package values
    const guessPackageDefaults = (category: string, userInput: any) => {
      const defaults: any = {
        addon: {
          baseRate: 300, // R300 (Rands)
          minNights: 1,
          maxNights: 1,
          multiplier: 1,
          features: ['Professional service', 'One-time fee', 'Quick setup', 'Quality guaranteed'],
        },
        standard: {
          baseRate: 200, // R200 (Rands)
          minNights: 2,
          maxNights: 7,
          multiplier: 1,
          features: ['Comfortable accommodation', 'Essential amenities', 'Flexible check-in', 'Free WiFi', 'Self-service'],
        },
        hosted: {
          baseRate: 450, // R450 (Rands)
          minNights: 3,
          maxNights: 14,
          multiplier: 1.2,
          features: ['Concierge service', 'Premium amenities', 'Personalized experience', '24/7 support', 'Luxury touches'],
        },
        special: {
          baseRate: 350, // R350 (Rands)
          minNights: 1,
          maxNights: 7,
          multiplier: 0.9,
          features: ['Special offer', 'Limited availability', 'Unique experience', 'Best value', 'Exclusive deal'],
        },
      }

      const categoryDefaults = defaults[category as keyof typeof defaults] || defaults.standard
      
      // Use user input if provided, otherwise use defaults
      return {
        baseRate: userInput.baseRate || categoryDefaults.baseRate,
        minNights: userInput.minNights || categoryDefaults.minNights,
        maxNights: userInput.maxNights || categoryDefaults.maxNights,
        multiplier: userInput.multiplier || categoryDefaults.multiplier,
        features: userInput.features && userInput.features.length > 0 
          ? userInput.features 
          : categoryDefaults.features,
      }
    }

    // Create a tool for previewing package creation
    // @ts-ignore - AI SDK tool type inference issue
    const previewPackageTool = tool({
      description:
        'Preview a package before creating it. Shows a mock package card with all details. For NEW listings, ask package placement questions first (see system prompt) unless the user already answered. When the user gives package details (name, price, category intent), call immediately with category and entitlement from their answers: addon = repeat/once-off extras, hosted = hosted stay, special + entitlement none = non-member deals, standard = member stays. Guess missing baseRate/features/nights from category defaults.',
      parameters: z.object({
        name: z.string().optional().describe('Package display name (include emoji if appropriate). If not provided, generate based on category and description.'),
        description: z.string().optional().describe('Detailed description of what the package offers. If not provided, generate based on category.'),
        category: z.enum(['standard', 'hosted', 'addon', 'special']).optional().describe('Package category. If not specified, infer from description or default to "standard".'),
        entitlement: z
          .enum(['none', 'standard', 'pro'])
          .default('standard')
          .describe(
            'Who can see/book: none = guests without subscription, standard = members, pro = pro members only',
          ),
        minNights: z.number().int().min(1).optional().describe('Minimum number of nights. If not provided, will be guessed based on category.'),
        maxNights: z.number().int().min(1).optional().describe('Maximum number of nights. If not provided, will be guessed based on category.'),
        baseRate: z.number().min(0).optional().describe('Base rate in whole Rands (ZAR). Example: 300 means R300.'),
        multiplier: z.number().min(0.1).max(3.0).optional().describe('Price multiplier. If not provided, will be guessed (addon/standard: 1.0, hosted: 1.2, special: 0.9).'),
        features: z.array(z.string()).optional().describe('Array of key features/amenities. If not provided, will generate 4-5 relevant features based on category.'),
        postId: z.string().optional().describe('The property (post) ID. If omitted, uses the listing selected in Manage (sidebar).'),
        revenueCatId: z.string().optional().describe('RevenueCat product ID if known'),
      }),
      // @ts-expect-error - AI SDK type inference issue
      execute: async (input: any) => {
        // Determine category if not provided
        const category = input.category || (() => {
          const desc = (input.description || '').toLowerCase()
          if (desc.includes('addon') || desc.includes('cleaning') || desc.includes('wine') || desc.includes('service')) return 'addon'
          if (desc.includes('hosted') || desc.includes('concierge') || desc.includes('luxury')) return 'hosted'
          if (desc.includes('special') || desc.includes('promo') || desc.includes('deal')) return 'special'
          return 'standard'
        })()

        // Get defaults for the category
        const defaults = guessPackageDefaults(category, input)

        // Generate name if not provided
        const name = input.name || (() => {
          const emojis: Record<string, string> = {
            addon: '🧹',
            standard: '🏠',
            hosted: '✨',
            special: '🎁',
          }
          const categoryNames: Record<string, string> = {
            addon: 'Add-on Service',
            standard: 'Standard Package',
            hosted: 'Hosted Experience',
            special: 'Special Offer',
          }
          return `${emojis[category] || '📦'} ${categoryNames[category] || 'Package'}`
        })()

        // Generate description if not provided
        const description = input.description || (() => {
          const descs: Record<string, string> = {
            addon: 'Professional add-on service to enhance your stay experience.',
            standard: 'Comfortable accommodation with essential amenities for a pleasant stay.',
            hosted: 'Premium hosted experience with concierge services and personalized attention.',
            special: 'Special promotional package offering great value and unique experiences.',
          }
          return descs[category] || 'A great package option for your stay.'
        })()

        const finalPostId =
          (typeof input.postId === 'string' && input.postId.trim() ? input.postId.trim() : '') ||
          selectedPostId ||
          ''

        if (!finalPostId) {
          console.warn('⚠️ No postId for package preview (no sidebar selection). A draft listing will be created when the user confirms save.', {
            inputPostId: input.postId,
            selectedPostId,
            postsAvailable: posts.length,
          })
        }

        // Build preview data with ALL values filled in and validate with Zod
        const baseRateRands = normalizeBaseRateToRands(input.baseRate ?? defaults.baseRate)
        const preview = {
          name,
          description,
          category,
          entitlement: input.entitlement || 'standard',
          minNights: input.minNights || defaults.minNights,
          maxNights: input.maxNights || defaults.maxNights,
          baseRate: typeof baseRateRands === 'number' ? baseRateRands : 0,
          multiplier: input.multiplier || defaults.multiplier,
          features: input.features && input.features.length > 0 ? input.features : defaults.features,
          postId: finalPostId, // CRITICAL: Always include postId in preview
          revenueCatId: input.revenueCatId || undefined,
          yocoId: input.yocoId || undefined,
          isPreview: true,
        }

        // Ensure the streamed JSON matches the expected shape
        return packagePreviewSchema.parse(preview)
      },
    })

    // Create a tool for actually creating the package
    // @ts-ignore - AI SDK tool type inference issue
    const createPackageTool = tool({
      description:
        '🚨 CREATE PACKAGE: Persist the package in the database. Use when the user confirms the preview. Prefer pageData.postId / tool input postId for the listing. If no property is selected, a draft property (post) is created first so the package always belongs to a listing.',
      parameters: z.object({
        name: z.string().describe('Package name'),
        description: z.string().describe('Package description'),
        category: z.enum(['standard', 'hosted', 'addon', 'special']).describe('Package category'),
        entitlement: z
          .enum(['none', 'standard', 'pro'])
          .default('standard')
          .describe('Who can see/book: none = non-subscribers, standard = members, pro = pro only'),
        minNights: z.number().min(0.5).describe('Minimum nights (can be 0.5 for half-day packages)'),
        maxNights: z.number().min(0.5).describe('Maximum nights'),
        baseRate: z.number().min(0).optional().describe('Base rate in whole Rands (ZAR). Example: 300 means R300.'),
        multiplier: z.number().min(0.1).max(3.0).default(1).describe('Price multiplier'),
        features: z.array(z.string()).default([]).describe('Array of feature strings'),
        postId: z
          .string()
          .optional()
          .describe(
            'Property (post) ID. If omitted, uses the selected listing from the manage UI; if none exists, creates a draft property then attaches the package.',
          ),
        revenueCatId: z.string().optional().describe('Legacy RevenueCat product ID (deprecated, use yocoId instead)'),
        yocoId: z.string().optional().describe('Yoco product ID for payment processing (recommended)'),
      }),
      // @ts-expect-error - AI SDK type inference issue
      execute: async (input: any) => {
        const { name, description, category, entitlement, minNights, maxNights, baseRate, multiplier, features, postId, revenueCatId, yocoId } = input

        try {
          const baseRateRands = normalizeBaseRateToRands(baseRate)
          // Resolve listing: tool input → sidebar selection in Manage (pageData.postId). If none, create draft post below.
          let resolvedPostId: string | null =
            (typeof postId === 'string' && postId.trim() ? postId.trim() : null) ||
            selectedPostId

          let createdNewPost = false

          if (resolvedPostId) {
            try {
              await payload.findByID({
                collection: 'posts',
                id: resolvedPostId,
                depth: 0,
              })
            } catch {
              console.warn('⚠️ Resolved postId not found, will create draft property:', resolvedPostId)
              resolvedPostId = null
            }
          }

          if (!resolvedPostId) {
            const titleBase = (name || 'New property').trim().slice(0, 120) || 'New property'
            const bodyText = (
              description?.trim() ||
              `Property listing created for package “${name || 'package'}”. Edit title, content, and publish when ready.`
            ).slice(0, 8000)

            const draftPost = await payload.create({
              collection: 'posts',
              data: {
                title: titleBase,
                content: buildMinimalPostContent(bodyText) as any,
                _status: 'draft',
                baseRate:
                  typeof baseRate === 'number' && baseRate > 0
                    ? baseRate
                    : undefined,
              },
              user,
            })

            resolvedPostId = draftPost.id
            createdNewPost = true
            console.log('✅ Draft property created for package:', { postId: resolvedPostId, title: titleBase })
          }

          const finalPostId = resolvedPostId

          console.log('📦 Creating package with data:', {
            inputPostId: postId,
            contextPostId: pageData?.postId,
            firstPostId: posts.length > 0 ? posts[0].id : null,
            finalPostId,
            createdNewPost,
            name,
            description,
            category,
            entitlement,
            minNights,
            maxNights,
            baseRate,
            multiplier,
            features,
            revenueCatId,
            yocoId,
          })

          const packageData = {
            post: finalPostId,
            name,
            description: description || undefined,
            category: category || 'standard',
            entitlement: entitlement || 'standard',
            minNights: minNights || 1,
            maxNights: maxNights || 1,
            baseRate: typeof baseRateRands === 'number' && baseRateRands > 0 ? baseRateRands : undefined,
            multiplier: multiplier || 1,
            features: Array.isArray(features) ? features.map(f => ({ feature: f })) : [],
            revenueCatId: revenueCatId || undefined,
            yocoId: yocoId || undefined,
            isEnabled: true,
          }

          console.log('📦 Package data to create:', packageData)

          const created = await payload.create({
            collection: 'packages',
            data: packageData,
            user,
          })

          console.log('✅ Package created successfully:', {
            id: created.id,
            name: created.name,
            postId: typeof created.post === 'string' ? created.post : created.post?.id,
            post: created.post,
          })

          // Return structured response with package ID prominently displayed
          const categoryEmojiMap: Record<string, string> = {
            standard: '🏠',
            hosted: '✨',
            addon: '🧹',
            special: '🎁',
          }
          const categoryEmoji = (created.category && categoryEmojiMap[created.category]) || '📦'

          const categoryMessage = created.category === 'special' 
            ? ' Special packages are very popular with customers and can help attract more bookings!'
            : ''

          const createdPayload = {
            success: true as const,
            postId: finalPostId,
            createdNewPost,
            package: {
              id: created.id,
              name: created.name,
              description: created.description,
              category: created.category,
              isEnabled: created.isEnabled,
              minNights: created.minNights,
              maxNights: created.maxNights,
              baseRate: created.baseRate,
              multiplier: created.multiplier,
              entitlement: created.entitlement,
              features: created.features,
              postId: typeof created.post === 'string' ? created.post : created.post?.id,
            },
            packageId: created.id, // Also include at top level for easy access
            message: `${categoryEmoji} Package "${name}" has been created successfully!${categoryMessage}${
              createdNewPost
                ? ` A draft property listing was created and linked to this package — open /admin/collections/posts/${finalPostId} or /manage/packages/${finalPostId} to finish editing.`
                : ''
            } You can view and manage packages at /manage/packages/${finalPostId}.`,
          }

          // Validate the JSON we stream back to the client
          return createdPackageSchema.parse(createdPayload)
        } catch (error: any) {
          console.error('Error creating package:', error)
          return {
            success: false,
            error: error.message || 'Failed to create package',
            message: `Failed to create package: ${error.message || 'Unknown error'}`,
          }
        }
      },
    })

    // Tool for reading/finding packages
    // @ts-ignore - AI SDK tool type inference issue
    const findPackagesTool = tool({
      description: 'Find and list packages for a property. Use this when user asks to see, list, or view their packages.',
      parameters: z.object({
        postId: z.string().optional().describe('Property ID to filter packages. If not provided, shows all packages for user\'s properties.'),
        category: z.enum(['standard', 'hosted', 'addon', 'special']).optional().describe('Filter by category'),
        isEnabled: z.boolean().optional().describe('Filter by enabled status'),
      }),
      // @ts-expect-error - AI SDK type inference issue
      execute: async ({ postId, category, isEnabled }: any) => {
        try {
          if (!postId && posts.length === 0) {
            return {
              success: true,
              packages: [],
              count: 0,
              message: 'No properties yet — create a listing first, or ask the assistant to create a package (a draft property can be created automatically).',
            }
          }

          const where: any = {}
          
          if (postId) {
            where.post = { equals: postId }
          } else if (posts.length > 0) {
            where.post = { in: posts.map((p: any) => p.id) }
          }
          
          if (category) {
            where.category = { equals: category }
          }
          
          if (isEnabled !== undefined) {
            where.isEnabled = { equals: isEnabled }
          }

          const result = await payload.find({
            collection: 'packages',
            where: Object.keys(where).length > 0 ? where : undefined,
            depth: 1,
            limit: 100,
          })

          return {
            success: true,
            packages: result.docs.map((pkg: any) => ({
              id: pkg.id,
              name: pkg.name,
              description: pkg.description,
              category: pkg.category,
              isEnabled: pkg.isEnabled,
              minNights: pkg.minNights,
              maxNights: pkg.maxNights,
              baseRate: pkg.baseRate,
              multiplier: pkg.multiplier,
              entitlement: pkg.entitlement,
              postTitle: typeof pkg.post === 'object' ? pkg.post.title : 'Unknown',
            })),
            count: result.docs.length,
            message: `Found ${result.docs.length} package(s)`,
          }
        } catch (error: any) {
          return {
            success: false,
            error: error.message || 'Failed to find packages',
            message: `Failed to find packages: ${error.message || 'Unknown error'}`,
          }
        }
      },
    })

    // Tool for updating packages
    // @ts-ignore - AI SDK tool type inference issue
    const updatePackageTool = tool({
      description: 'Update an existing package. Use this when user wants to modify package details like name, description, price, or settings.',
      parameters: z.object({
        packageId: z.string().describe('The ID of the package to update'),
        name: z.string().optional(),
        description: z.string().optional(),
        category: z.enum(['standard', 'hosted', 'addon', 'special']).optional(),
        entitlement: z.enum(['none', 'standard', 'pro']).optional(),
        minNights: z.number().int().min(1).optional(),
        maxNights: z.number().int().min(1).optional(),
        baseRate: z.number().int().min(0).optional(),
        multiplier: z.number().min(0.1).max(3.0).optional(),
        features: z.array(z.string()).optional(),
        isEnabled: z.boolean().optional(),
      }),
      // @ts-expect-error - AI SDK type inference issue
      execute: async (params: any) => {
        try {
          const { packageId, ...updates } = params
          // Remove undefined values
          const updateData: any = {}
          Object.entries(updates).forEach(([key, value]) => {
            if (value !== undefined) {
              if (key === 'features' && Array.isArray(value)) {
                updateData[key] = value.map(f => ({ feature: f }))
              } else {
                updateData[key] = value
              }
            }
          })

          const updated = await payload.update({
            collection: 'packages',
            id: packageId,
            data: updateData,
            user,
          })

          try {
            const actorEmail = typeof (user as any)?.email === 'string' ? ((user as any).email as string) : ''
            const postId =
              typeof (updated as any)?.post === 'string' ? (updated as any).post : (updated as any)?.post?.id
            const propertyTitle =
              typeof (updated as any)?.post === 'object' && typeof (updated as any)?.post?.title === 'string'
                ? (updated as any).post.title
                : undefined
            if (actorEmail) {
              await sendPackageActivityNotification({
                actorEmail,
                action: 'updated',
                packageId: String((updated as any).id),
                packageName: String((updated as any).name || 'Package'),
                postId: postId ? String(postId) : undefined,
                propertyTitle,
                threadSubject: `Package activity: ${String((updated as any).name || 'Package')}${propertyTitle ? ` (${propertyTitle})` : ''}`,
              })
            }
          } catch (emailErr) {
            console.warn('Package activity email failed (non-fatal):', emailErr)
          }

          return {
            success: true,
            package: {
              id: updated.id,
              name: updated.name,
              description: updated.description,
              category: updated.category,
              isEnabled: updated.isEnabled,
            },
            message: `Package "${updated.name}" has been updated successfully!`,
          }
        } catch (error: any) {
          return {
            success: false,
            error: error.message || 'Failed to update package',
            message: `Failed to update package: ${error.message || 'Unknown error'}`,
          }
        }
      },
    })

    // Tool for deleting packages
    // @ts-ignore - AI SDK tool type inference issue
    const deletePackageTool = tool({
      description: 'Delete a package. Use this when user wants to remove a package permanently. Always confirm before deleting.',
      parameters: z.object({
        packageId: z.string().describe('The ID of the package to delete'),
      }),
      // @ts-expect-error - AI SDK type inference issue
      execute: async ({ packageId }: any) => {
        try {
          const deleted = await payload.delete({
            collection: 'packages',
            id: packageId,
            user,
          })

          try {
            const actorEmail = typeof (user as any)?.email === 'string' ? ((user as any).email as string) : ''
            const postId =
              typeof (deleted as any)?.post === 'string' ? (deleted as any).post : (deleted as any)?.post?.id
            const propertyTitle =
              typeof (deleted as any)?.post === 'object' && typeof (deleted as any)?.post?.title === 'string'
                ? (deleted as any).post.title
                : undefined
            if (actorEmail) {
              await sendPackageActivityNotification({
                actorEmail,
                action: 'deleted',
                packageId: String((deleted as any).id || packageId),
                packageName: String((deleted as any).name || 'Package'),
                postId: postId ? String(postId) : undefined,
                propertyTitle,
                threadSubject: `Package activity: ${String((deleted as any).name || 'Package')}${propertyTitle ? ` (${propertyTitle})` : ''}`,
              })
            }
          } catch (emailErr) {
            console.warn('Package activity email failed (non-fatal):', emailErr)
          }

          return {
            success: true,
            message: `Package "${deleted.name || 'Unknown'}" has been deleted successfully!`,
          }
        } catch (error: any) {
          return {
            success: false,
            error: error.message || 'Failed to delete package',
            message: `Failed to delete package: ${error.message || 'Unknown error'}`,
          }
        }
      },
    })

    // Tool for creating posts (properties)
    // @ts-ignore - AI SDK tool type inference issue
    const createPostTool = tool({
      description:
        'Create a new property (post) for the host. Does NOT auto-suggest packages. After success, ask the package placement questions in text, then call suggestCatalogPackages or previewPackage once the host answers.',
      parameters: z.object({
        title: z.string().describe('Property title/name (e.g., "Beachfront Studio", "Mountain Cabin")'),
        description: z.string().optional().describe('Property description. If not provided, will generate based on title.'),
        baseRate: z.number().min(0).optional().describe('Base rate per night in whole Rands (ZAR). If not provided, will default to 0.'),
        featured: z.boolean().optional().default(false).describe('Feature this property on the home page'),
        metaTitle: z.string().optional().describe('SEO meta title'),
        metaDescription: z.string().optional().describe('SEO meta description'),
        wifi: z
          .string()
          .optional()
          .describe('WiFi network name and password for the guest house manual'),
        lockbox: z
          .string()
          .optional()
          .describe('Lockbox code or key-safe / smart-lock instructions for guests'),
      }),
      // @ts-expect-error - AI SDK type inference issue
      execute: async (input: any) => {
        try {
          const {
            title: titleRaw,
            description,
            baseRate,
            featured,
            metaTitle,
            metaDescription,
            wifi,
            lockbox,
          } = input

          const title = typeof titleRaw === 'string' ? titleRaw.trim() : ''
          if (!title) {
            return {
              success: false,
              error: 'Title is required',
              message: 'Failed to create property: Title is required',
            }
          }

          // Generate description if not provided
          const postDescription =
            (typeof description === 'string' && description.trim().length > 0
              ? description.trim()
              : `A beautiful ${title.toLowerCase()} property available for booking.`)

          // Create minimal content structure for Lexical editor
          const content = {
            root: {
              type: 'root',
              children: [
                {
                  type: 'paragraph',
                  children: [
                    {
                      type: 'text',
                      text: postDescription,
                      format: 0,
                      style: '',
                      mode: 'normal',
                      detail: 0,
                    },
                  ],
                  direction: 'ltr',
                  format: '',
                  indent: 0,
                  version: 1,
                },
              ],
              direction: 'ltr',
              format: '',
              indent: 0,
              version: 1,
            },
          }

          const postData: any = {
            title,
            content,
            _status: 'draft', // Create as draft, user can publish later
            baseRate: baseRate || undefined,
            featured: featured || false,
            ...(typeof wifi === 'string' && wifi.trim() ? { wifi: wifi.trim().slice(0, 500) } : {}),
            ...(typeof lockbox === 'string' && lockbox.trim()
              ? { lockbox: lockbox.trim().slice(0, 500) }
              : {}),
          }

          // Meta helps /api/packages/suggest-copy and catalog suggestions use property context
          postData.meta = {}
          if (metaTitle) postData.meta.title = metaTitle
          else postData.meta.title = title.slice(0, 60)
          if (metaDescription) postData.meta.description = metaDescription
          else postData.meta.description = postDescription.slice(0, 160)

          const created = await payload.create({
            collection: 'posts',
            data: postData,
            user,
          })

          console.log('Post created successfully:', created.id)

          const message = `"${title}" is saved as a draft.\n\n${PACKAGE_PLACEMENT_QUESTIONS}`

          return {
            success: true,
            post: {
              id: created.id,
              title: created.title,
              slug: created.slug,
              baseRate: created.baseRate,
              status: created._status,
            },
            recommendations: [],
            message,
          }
        } catch (error: any) {
          console.error('Error creating post:', error)
          return {
            success: false,
            error: error.message || 'Failed to create post',
            message: `Failed to create property: ${error.message || 'Unknown error'}`,
          }
        }
      },
    })

    // @ts-ignore - AI SDK tool type inference issue
    const suggestCatalogPackagesForPostTool = tool({
      description:
        'Suggest 1–4 packages from the fixed catalog for a property. Call ONLY after package placement questions are answered (add-on vs stay, non-member specials, hosted) — pass those answers in hint. Use when the user wants starter ideas or after a new listing + placement Q&A.',
      parameters: z.object({
        postId: z.string().describe('Property (post) ID'),
        hint: z
          .string()
          .optional()
          .describe(
            'Host placement answers: add-on vs stay, non-member/special, hosted — plus any property context',
          ),
      }),
      // @ts-expect-error - AI SDK type inference issue
      execute: async ({ postId: pid, hint }: any) => {
        const out = await runCatalogPackageSuggestions(payload, user, String(pid).trim(), hint)
        if (!out.success) {
          return {
            success: false,
            message: out.message,
            recommendations: [],
            postId: String(pid).trim(),
          }
        }
        return {
          success: true,
          postId: out.postId,
          recommendations: out.recommendations,
          message: out.message,
        }
      },
    })

    // Keep model configurable because availability varies by Google project/API rollout.
    const streamingModelName = process.env.GEMINI_STREAMING_MODEL || 'models/gemini-2.5-flash'
    const model = googleAI(streamingModelName)

    // Analyze existing packages to provide insights
    const specialPackages = existingPackages.docs.filter((pkg: any) => pkg.category === 'special')
    const packageStats = {
      total: existingPackages.docs.length,
      byCategory: {
        standard: existingPackages.docs.filter((pkg: any) => pkg.category === 'standard').length,
        hosted: existingPackages.docs.filter((pkg: any) => pkg.category === 'hosted').length,
        addon: existingPackages.docs.filter((pkg: any) => pkg.category === 'addon').length,
        special: specialPackages.length,
      },
      enabled: existingPackages.docs.filter((pkg: any) => pkg.isEnabled).length,
      disabled: existingPackages.docs.filter((pkg: any) => !pkg.isEnabled).length,
    }

    const systemPrompt = `You are an AI assistant helping a host manage their properties and packages.

🏠 NEW LISTING / PROPERTY FIRST (overrides generic “jump straight to package preview”):
- If the user wants a **new** property/listing/post, call **createPostTool** first (title + description from their message).
- **createPostTool** does NOT return package ideas. After it succeeds, reply with the **package placement questions** (add-on vs stay, non-member special, hosted) — do NOT call suggestCatalogPackages or previewPackage until they answer.
- When they answer, call **suggestCatalogPackages** with **postId** = new post.id and **hint** = their placement answers, OR **previewPackageTool** if they named a specific package/price.
- Only skip createPostTool if they are clearly working with an **existing** listing already in context.
- For every new or updated listing, collect **house-manual** details when possible: **wifi** (network + password) and **lockbox** (access code / key-safe instructions). Pass them into createPostTool or remind the host to add them in property settings. Guests see these on their booking assistant.

📋 PACKAGE PLACEMENT (ask before first catalog/preview on a listing):
Ask these unless the user already answered in the same thread:
1. **Repeat add-on or stay package?** → add-on category for cleaning/tours/extras; standard/special for stays.
2. **Offer a deal to guests without a subscription?** → special category + entitlement **none** for non-members; standard entitlement for members only.
3. **Hosted experience?** → hosted category when host/staff is involved.

Map answers into **category** and **entitlement** on previewPackageTool and into **hint** for suggestCatalogPackages.

📦 STARTER PACKAGE IDEAS (existing listing):
- If the user asks to "Generate packages" or starter ideas for an **existing** property with postId: if placement is unknown, ask the three questions first; then call **suggestCatalogPackages** with postId + hint (their answers).
- After suggestions are shown, the UI offers "Approve all"; do not create packages unless the user approves.

🚨 TOOL CALLING RULES:
1. **New listing flow**: createPost → placement questions (text) → suggestCatalogPackages or previewPackage after answers.
2. When the user says "CALL previewPackageTool NOW" or gives explicit package details (name, price, category), call **previewPackageTool** immediately with **category** and **entitlement** from placement answers — **unless** you still need placement Q&A for a brand-new listing with no answers yet.
2b. When the user says "CALL suggestCatalogPackages NOW" with postId: call suggestCatalogPackages only if placement is known or included in the message; otherwise ask placement questions first.
3. For vague "create a package" with no placement context on a **new** listing, ask placement questions before tools.
4. After previewPackageTool completes, provide a brief text response explaining the preview.

EXAMPLES:
- User drafts new plek → createPost → ask placement questions (text only).
- User: "weekly stay, special for non-members, not hosted" → suggestCatalogPackages(postId, hint=their answer) OR previewPackage(category=special, entitlement=none).
- User: "CALL previewPackageTool NOW with name=X, category=hosted, entitlement=standard" → previewPackage immediately.

AFTER TOOL CALLS:
- When user confirms (says "yes", "create", "confirm", "create it", "that looks good"), IMMEDIATELY call createPackageTool with the exact values from the preview - NO TEXT FIRST
- When user wants to modify, call previewPackageTool again with updated values

HOST'S PROPERTIES:
${posts.map((post: any) => `- ${post.title} (ID: ${post.id}, Slug: ${post.slug})`).join('\n') || 'No properties yet'}

PACKAGE STATISTICS:
- Total Packages: ${packageStats.total}
- By Category: Standard (${packageStats.byCategory.standard}), Hosted (${packageStats.byCategory.hosted}), Addon (${packageStats.byCategory.addon}), Special (${packageStats.byCategory.special})
- Enabled: ${packageStats.enabled}, Disabled: ${packageStats.disabled}

EXISTING PACKAGES:
${existingPackages.docs.map((pkg: any) => `- ${pkg.name} (${pkg.category}, ${pkg.minNights}-${pkg.maxNights} nights, ${pkg.isEnabled ? 'enabled' : 'disabled'})`).join('\n') || 'No packages yet'}

⭐ SPECIAL PACKAGES INSIGHT:
${specialPackages.length > 0 
  ? `You have ${specialPackages.length} special package(s). Special packages are popular with customers and offer unique experiences. Consider creating more special packages for seasonal promotions, unique experiences, or limited-time offers.`
  : 'You don\'t have any special packages yet. Special packages are great for promotions, unique experiences, and attracting customers. Consider creating special packages for seasonal offers or unique experiences.'}

PROPERTY & PACKAGE MANAGEMENT GUIDELINES:

PROPERTY CREATION:
1. When user wants a new listing:
   - createPostTool → package placement questions → suggestCatalogPackages or previewPackage → createPackageTool after they confirm a preview
2. If user wants to create a package but doesn't specify a property:
   - Prefer the listing selected in Manage (sidebar). If none is selected, createPackageTool will create a draft property automatically and attach the package.
   - Hosts can also use createPostTool explicitly if they want to name/configure a listing before packages.

PACKAGE MANAGEMENT:
1. Base rates are entered and stored in Rands (ZAR) (e.g., 300 means R300.00).
2. Categories: 
   - standard: Regular accommodation packages (most common)
   - hosted: Packages with concierge services and premium amenities
   - addon: One-time extras like cleaning, wine, guided tours (not accommodation)
   - special: Promotional/unique packages - these are VERY POPULAR with customers! Consider creating special packages for seasonal promotions, unique experiences, or limited-time offers
3. Entitlements:
   - **none**: visible to guests without a subscription (non-members)
   - **standard**: subscription members (standard and pro plans)
   - **pro**: pro subscribers only
4. When user wants to create a package with enough detail (name, price, or category intent):
   - Use previewPackageTool with category and entitlement from placement answers
   - Extract price in Rands (e.g., R300 → baseRate 300) and fill missing fields from category defaults
   - The preview should show complete package details including guessed baseRate, features, nights, etc.
   - Wait for user confirmation
   - THEN use createPackageTool to actually create it
   - IMPORTANT: When user explicitly says "create", "confirm", "yes", or "create this package", you MUST call createPackageTool immediately with the exact values from the preview
   - CRITICAL: Never say "I can't create" - always use previewPackageTool first, then createPackageTool after confirmation
5. Guess reasonable defaults if user doesn't specify:
   - For addon packages: baseRate R200-R500, minNights: 1, maxNights: 1, features: ["Professional service", "One-time fee", "Quick setup"]
   - For standard packages: baseRate R150-R300, minNights: 2, maxNights: 7, features: ["Comfortable accommodation", "Essential amenities", "Flexible check-in"]
   - For hosted packages: baseRate R300-R600, minNights: 3, maxNights: 14, features: ["Concierge service", "Premium amenities", "Personalized experience"]
   - For special packages: baseRate R250-R500, minNights: 1, maxNights: 7, features: ["Special offer", "Limited availability", "Unique experience", "Best value"]
   - Always generate 3-5 relevant features based on category and package type
6. CRUD Operations:
   - CREATE PROPERTY: Use createPostTool when user wants to create a new property
   - CREATE PACKAGE: Use previewPackageTool first, then createPackageTool after confirmation
   - READ: Use findPackagesTool when user asks to see, list, or view packages
   - UPDATE: Use updatePackageTool to modify existing packages (name, price, settings, etc.)
   - DELETE: Use deletePackageTool to remove packages (always confirm first!)
7. Always format currency as R (Rands), not $
8. Be helpful and guide the host through decisions
9. When showing package previews, ensure ALL fields are filled with reasonable guesses so the user can see a complete package before confirming
10. After creating a property, automatically offer to create a package for it
11. SPECIAL PACKAGES: These are very popular with customers! When appropriate, suggest creating special packages for promotions, seasonal offers, or unique experiences. After creating a package, mention that special packages tend to attract more bookings.
12. PACKAGE MANAGEMENT: After creating a package, remind the host they can view and manage all packages at /manage/packages/[postId]. They can enable/disable packages, update pricing, and see which packages are performing well.

When user asks to create a package from a property they offer, create the property first, then create the package and assign it to that property.${
      existingPackageIdFromContext
        ? `

🎯 PACKAGE ONBOARDING — EDIT EXISTING PACKAGE:
- The client is editing package ID: ${existingPackageIdFromContext} (property post: ${selectedPostId || 'use tool input / message'}).
- When the user describes changes or the message asks to CALL updatePackageTool, use updatePackageTool IMMEDIATELY with packageId="${existingPackageIdFromContext}" and merge in inferred fields (name, description, category, minNights, maxNights, baseRate in Rands, multiplier, features, entitlement, isEnabled) from their text.
- Do NOT call previewPackage or createPackage for this onboarding session unless the user explicitly asks to create a duplicate/new package.`
        : ''
    }`

    const lastUserMessage = [...messages]
      .reverse()
      .find((m: any) => m?.role === 'user')

    const lastUserText =
      typeof (lastUserMessage as any)?.content === 'string'
        ? (lastUserMessage as any).content.toLowerCase()
        : Array.isArray((lastUserMessage as any)?.parts)
          ? (lastUserMessage as any).parts
              .filter((p: any) => p?.type === 'text' && typeof p?.text === 'string')
              .map((p: any) => p.text.toLowerCase())
              .join(' ')
          : ''

    // Must catch phrases like "create a new property" (word "new" between verb and noun).
    const looksLikeNewProperty =
      /\b(new\s+(property|listing|post|place|airbnb))\b/i.test(lastUserText) ||
      /\b(another|second|additional)\s+(property|listing|post)\b/i.test(lastUserText) ||
      /(add\s+(a\s+)?(property|listing|post)|draft\s+(property|listing)|list\s+my\s+(place|home|property|house|apartment)|I\s+('m|'ve|am)\s+list|I\s+have\s+(a\s+)?(new\s+)?(place|property|listing|house|cottage|cabin|apartment|studio|villa|flat)|register\s+(my\s+)?(property|listing)|listing\s+called|property\s+called|airbnb|guesthouse|guest house)/i.test(
        lastUserText,
      ) ||
      /\b(create|add|start|open|register|set\s+up)\b[\s\S]{0,40}\b(property|listing|post)\b/i.test(
        lastUserText,
      ) &&
      !/\bpackage(s)?\b/i.test(lastUserText)

    // Do NOT use bare "create" / "make" — they match "create a new property" and wrongly force previewPackage.
    const looksLikePackagePreviewIntent =
      /(new\s+package|create\s+(a\s+)?package|make\s+(a\s+)?package|build\s+package|package\s+for|packages?\s+for|package\s+called|package\s+named|preview\s+(the\s+)?package|suggest\s+.{0,48}packag|winter\s+package|special\s+package|addon\s+package|add-?on)/i.test(
        lastUserText,
      ) ||
      (/\bpackage\b/i.test(lastUserText) &&
        /\b(R\s?\d{2,}|rand|\bzar\b|price|rate|per\s+night|nightly|weekly)\b/i.test(lastUserText))

    const shouldForcePreviewTool =
      !looksLikeNewProperty && looksLikePackagePreviewIntent

    const normalizedModelMessages = messages
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

    const fallbackText =
      typeof requestBody?.message === 'string' && requestBody.message.trim().length > 0
        ? requestBody.message.trim()
        : ''

    const result = streamText({
      model: model as any,
      system: systemPrompt,
      messages:
        normalizedModelMessages.length > 0
          ? (normalizedModelMessages as any)
          : fallbackText
            ? ([{ role: 'user', content: fallbackText }] as any)
            : ([] as any),
      ...(shouldForcePreviewTool ? { toolChoice: { type: 'tool' as const, toolName: 'previewPackage' } } : {}),
      tools: {
        createPost: createPostTool,
        suggestCatalogPackages: suggestCatalogPackagesForPostTool,
        previewPackage: previewPackageTool,
        createPackage: createPackageTool,
        findPackages: findPackagesTool,
        updatePackage: updatePackageTool,
        deletePackage: deletePackageTool,
      },
    })

    return result.toUIMessageStreamResponse()
  } catch (error) {
    console.error('Error in manage chat:', error)
    return NextResponse.json(
      { error: 'Failed to process request', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    )
  }
}

