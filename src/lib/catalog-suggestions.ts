import {
  BASE_PACKAGE_TEMPLATES,
  getDefaultPackageTitle,
  type BasePackageConfig,
} from '@/lib/package-types'
import {
  applyPlacementOverrides,
  parsePlacementFromHint,
  resolvePlacementTargets,
  type PackagePlacementAnswers,
} from '@/lib/package-placement'

export type CatalogRecommendation = {
  revenueCatId: string
  suggestedName: string
  description: string
  features: string[]
  baseRate?: number
  details: {
    minNights: number
    maxNights: number
    category: string
    customerTierRequired: string
    multiplier: number
  }
}

function fallbackCatalogBaseRateRands(category: string, minNights: number) {
  const c = String(category || 'standard')
  if (c === 'addon') return 450
  if (c === 'hosted') return minNights <= 1 ? 650 : 850
  if (c === 'special') return minNights <= 1 ? 550 : 750
  return minNights <= 1 ? 480 : 600
}

const CATEGORY_EMOJI: Record<string, string> = {
  standard: '🏠',
  hosted: '✨',
  addon: '🧹',
  special: '🎁',
}

function pickTemplatesForPlacement(answers: PackagePlacementAnswers): BasePackageConfig[] {
  const { category, entitlement } = resolvePlacementTargets(answers)

  let matches = BASE_PACKAGE_TEMPLATES.filter(
    (t) => t.category === category && t.customerTierRequired === entitlement,
  )
  if (matches.length === 0) {
    matches = BASE_PACKAGE_TEMPLATES.filter((t) => t.category === category)
  }
  if (matches.length === 0) {
    matches = BASE_PACKAGE_TEMPLATES.filter((t) => t.customerTierRequired === entitlement)
  }

  matches.sort((a, b) => a.minNights - b.minNights)

  const picked: BasePackageConfig[] = []
  for (const tpl of matches) {
    if (picked.length >= 4) break
    if (!picked.some((p) => p.durationTier === tpl.durationTier)) picked.push(tpl)
  }
  for (const tpl of matches) {
    if (picked.length >= 4) break
    if (!picked.includes(tpl)) picked.push(tpl)
  }
  return picked.slice(0, 4)
}

function describeTemplate(tpl: BasePackageConfig, propertyTitle: string): string {
  const tier =
    tpl.customerTierRequired === 'pro'
      ? 'Exclusive for Pro members'
      : tpl.customerTierRequired === 'none'
        ? 'Open to all guests'
        : 'For subscribers'
  const nights =
    tpl.minNights === tpl.maxNights
      ? `${tpl.minNights} night`
      : `${tpl.minNights}–${tpl.maxNights} nights`
  return `${tier} · ${getDefaultPackageTitle(tpl).toLowerCase()} at ${propertyTitle} (${nights}).`
}

export function buildRecommendationsFromPlacement(
  answers: PackagePlacementAnswers,
  opts: { propertyTitle: string; postBaseRate: number | null },
): CatalogRecommendation[] {
  const templates = pickTemplatesForPlacement(answers)
  const { category, entitlement } = resolvePlacementTargets(answers)
  const title = opts.propertyTitle.trim() || 'your property'
  const emoji = CATEGORY_EMOJI[category] || '📦'

  return templates.map((tpl) => {
    const fallbackBase = fallbackCatalogBaseRateRands(tpl.category, tpl.minNights)
    const baseRate =
      typeof opts.postBaseRate === 'number' && opts.postBaseRate > 0
        ? Math.max(
            fallbackBase,
            Math.round(opts.postBaseRate * (tpl.category === 'hosted' ? 1.35 : 1)),
          )
        : fallbackBase

    return {
      revenueCatId: tpl.revenueCatId,
      suggestedName: `${emoji} ${getDefaultPackageTitle(tpl)} — ${title}`,
      description: describeTemplate(tpl, title),
      features: tpl.features.map((f) => f.label),
      baseRate,
      details: {
        minNights: tpl.minNights,
        maxNights: tpl.maxNights,
        category: tpl.category,
        customerTierRequired: entitlement,
        multiplier: tpl.baseMultiplier,
      },
    }
  })
}

export async function runCatalogPackageSuggestions(
  payload: any,
  user: any,
  postId: string,
  hint?: string,
  placementInput?: PackagePlacementAnswers,
): Promise<{
  success: boolean
  postId: string
  recommendations: CatalogRecommendation[]
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
    const propertyTitle = typeof post?.title === 'string' ? post.title.trim() : 'Untitled'
    const postBaseRate =
      typeof (post as any)?.baseRate === 'number' && Number.isFinite((post as any).baseRate)
        ? Math.max(0, Math.round((post as any).baseRate))
        : null

    const placement = placementInput ?? parsePlacementFromHint(hint)
    if (placement) {
      const recommendations = buildRecommendationsFromPlacement(placement, {
        propertyTitle,
        postBaseRate,
      })
      const { category, entitlement } = resolvePlacementTargets(placement)
      return {
        success: true,
        postId: pid,
        recommendations,
        message:
          recommendations.length > 0
            ? `Here are ${recommendations.length} ${category} package idea(s) (${entitlement} access) for this listing.`
            : 'No catalog templates matched those settings.',
      }
    }

    // Legacy path: LLM pick (hint text only) — kept for non-quiz flows
    const { generateObject } = await import('ai')
    const { createGoogleGenerativeAI } = await import('@ai-sdk/google')
    const { z } = await import('zod')

    const googleAI = createGoogleGenerativeAI({
      apiKey: process.env.GEMINI_API_KEY || process.env.GOOGLE_GENERATIVE_AI_API_KEY || '',
    })

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
${knownTemplates.map((t) => `- ${t.revenueCatId}: ${t.defaultName} [${t.category}, tier: ${t.customerTierRequired}]`).join('\n')}

Property: "${propertyTitle}"
Hint: "${hint || 'N/A'}"`,
    })

    const filtered = result.object.recommendations.filter((r) => knownIds.has(r.revenueCatId))
    const picked = filtered.length ? filtered : result.object.recommendations
    const mapped: CatalogRecommendation[] = picked.map((r) => {
      const tpl = BASE_PACKAGE_TEMPLATES.find((t) => t.revenueCatId === r.revenueCatId)
      const tplCategory = String(tpl?.category || 'standard')
      const tplMin = typeof tpl?.minNights === 'number' ? tpl.minNights : 1
      const fallbackBase = fallbackCatalogBaseRateRands(tplCategory, tplMin)
      const baseRate =
        typeof r.baseRate === 'number' && Number.isFinite(r.baseRate)
          ? Math.max(0, Math.round(r.baseRate))
          : postBaseRate && postBaseRate > 0
            ? postBaseRate
            : fallbackBase
      return {
        ...r,
        baseRate,
        details: {
          minNights: tpl?.minNights ?? 1,
          maxNights: tpl?.maxNights ?? 1,
          category: tpl?.category ?? 'standard',
          customerTierRequired: tpl?.customerTierRequired ?? 'standard',
          multiplier: tpl?.baseMultiplier ?? 1,
        },
      }
    })
    const recommendations = applyPlacementOverrides(mapped, hint) as CatalogRecommendation[]
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
