/** Host-facing yes/no quiz → catalog category + entitlement */

import type { PackageCategory, CustomerTier } from '@/lib/package-types'

export type PackagePlacementAnswers = {
  hostInvolved: boolean
  runSpecial: boolean
  exclusive: boolean
  onceOff: boolean
}

export const PLACEMENT_JSON_MARKER = '__placement_json__:'

export const PACKAGE_PLACEMENT_QUIZ_ITEMS = [
  {
    id: 'hostInvolved' as const,
    question: 'Do you want to be involved, or keep it autonomous?',
    yesLabel: 'Yes — I’ll be involved',
    noLabel: 'No — autonomous',
    help: 'Involved stays often use the hosted category.',
  },
  {
    id: 'runSpecial' as const,
    question: 'Do you want to run a special?',
    yesLabel: 'Yes',
    noLabel: 'No',
    help: 'Promotions and limited offers use the special category.',
  },
  {
    id: 'exclusive' as const,
    question: 'Should your plek be exclusive or publicly accessible?',
    yesLabel: 'Yes — exclusive',
    noLabel: 'No — open to everyone',
    help: 'Exclusive maps to Pro members; open access is for guests without a subscription.',
  },
  {
    id: 'onceOff' as const,
    question: 'Is this a once-off purchase?',
    yesLabel: 'Yes',
    noLabel: 'No',
    help: 'Cleaning, tours, and extras are usually add-ons.',
  },
] as const

export function resolvePlacementTargets(answers: PackagePlacementAnswers): {
  category: PackageCategory
  entitlement: CustomerTier
} {
  let category: PackageCategory = 'standard'
  if (answers.onceOff) category = 'addon'
  else if (answers.hostInvolved) category = 'hosted'
  else if (answers.runSpecial) category = 'special'

  const entitlement: CustomerTier = answers.exclusive ? 'pro' : 'none'
  return { category, entitlement }
}

export function parsePlacementFromHint(hint?: string): PackagePlacementAnswers | null {
  if (!hint?.includes(PLACEMENT_JSON_MARKER)) return null
  const raw = hint.slice(hint.indexOf(PLACEMENT_JSON_MARKER) + PLACEMENT_JSON_MARKER.length).trim()
  const jsonEnd = raw.indexOf('}')
  if (jsonEnd < 0) return null
  try {
    const parsed = JSON.parse(raw.slice(0, jsonEnd + 1)) as Partial<PackagePlacementAnswers>
    if (
      typeof parsed.hostInvolved === 'boolean' &&
      typeof parsed.runSpecial === 'boolean' &&
      typeof parsed.exclusive === 'boolean' &&
      typeof parsed.onceOff === 'boolean'
    ) {
      return {
        hostInvolved: parsed.hostInvolved,
        runSpecial: parsed.runSpecial,
        exclusive: parsed.exclusive,
        onceOff: parsed.onceOff,
      }
    }
  } catch {
    return null
  }
  return null
}

export function buildPlacementHint(answers: PackagePlacementAnswers): string {
  const { category, entitlement } = resolvePlacementTargets(answers)
  return `${PLACEMENT_JSON_MARKER}${JSON.stringify(answers)} required category=${category} entitlement=${entitlement}`
}

export function buildSuggestPackagesMessage(postId: string, answers: PackagePlacementAnswers): string {
  const { category, entitlement } = resolvePlacementTargets(answers)
  return (
    `For postId "${postId}": CALL suggestCatalogPackages NOW. ` +
    `Required: category "${category}", entitlement "${entitlement}". ` +
    `Hint: ${buildPlacementHint(answers)}`
  )
}

export function applyPlacementOverrides<T extends { details?: Record<string, unknown> }>(
  recommendations: T[],
  hint?: string,
  placement?: PackagePlacementAnswers | null,
): T[] {
  const structured = placement ?? parsePlacementFromHint(hint)
  if (structured) {
    const { category, entitlement } = resolvePlacementTargets(structured)
    return recommendations.map((r) => ({
      ...r,
      details: {
        ...(r.details || {}),
        category,
        customerTierRequired: entitlement,
      },
    }))
  }

  if (!hint?.trim()) return recommendations
  const h = hint.toLowerCase()
  const hostInvolved =
    /\bhosted\b|host involved|concierge/.test(h) && !/\bautonomous\b|self-service|not hosted/.test(h)
  const wantsNonMember =
    /non-?member|without (a )?subscription|guests without|publicly accessible|open to everyone|entitlement none/.test(
      h,
    ) && !/\bexclusive\b|pro entitlement|pro members/.test(h)
  const wantsPro = /\bexclusive\b|pro entitlement|pro members/.test(h)
  const wantsHosted = hostInvolved
  const wantsAddon =
    /(?<!not )\baddon\b|add-?on|once[- ]?off purchase|one[- ]?time purchase/.test(h)
  const wantsSpecial = /\bspecial\b|promotion|limited[- ]?time/.test(h)

  return recommendations.map((r) => {
    const details = { ...(r.details || {}) } as Record<string, unknown>
    if (wantsAddon) details.category = 'addon'
    else if (wantsHosted) details.category = 'hosted'
    else if (wantsSpecial) details.category = 'special'

    if (wantsPro) details.customerTierRequired = 'pro'
    else if (wantsNonMember) details.customerTierRequired = 'none'

    return { ...r, details }
  })
}
