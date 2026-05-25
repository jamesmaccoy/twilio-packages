/** Host-facing yes/no quiz → catalog category + entitlement hints */

export type PackagePlacementAnswers = {
  hostInvolved: boolean
  runSpecial: boolean
  exclusive: boolean
  onceOff: boolean
}

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

export function buildPlacementHint(answers: PackagePlacementAnswers): string {
  const parts: string[] = []
  if (answers.hostInvolved) {
    parts.push('hosted', 'host involved', 'concierge')
  } else {
    parts.push('autonomous', 'self-service stay', 'not hosted')
  }
  if (answers.runSpecial) {
    parts.push('special', 'promotion', 'limited-time offer')
  }
  if (answers.exclusive) {
    parts.push('exclusive', 'pro entitlement', 'pro members only')
  } else {
    parts.push(
      'publicly accessible',
      'non-member',
      'guests without subscription',
      'entitlement none',
    )
  }
  if (answers.onceOff) {
    parts.push('addon', 'once-off', 'one-time purchase', 'extra service')
  } else {
    parts.push('stay package', 'nightly or weekly stay', 'not addon')
  }
  return parts.join(', ')
}

export function buildSuggestPackagesMessage(postId: string, answers: PackagePlacementAnswers): string {
  const hint = buildPlacementHint(answers)
  return (
    `For postId "${postId}": CALL suggestCatalogPackages NOW with this hint: ${hint}. ` +
    `Return 1–4 catalog package ideas I can approve.`
  )
}

export function applyPlacementOverrides<T extends { details?: Record<string, unknown> }>(
  recommendations: T[],
  hint?: string,
): T[] {
  if (!hint?.trim()) return recommendations
  const h = hint.toLowerCase()
  const hostInvolved =
    /\bhosted\b|host involved|concierge|i'll be involved|involved host/.test(h) &&
    !/\bautonomous\b|self-service|not hosted/.test(h)
  const autonomous = /\bautonomous\b|self-service|not hosted/.test(h) && !hostInvolved
  const wantsNonMember =
    /non-?member|without (a )?subscription|guests without|unsubscribed|not subscribed|publicly accessible|open to everyone|entitlement none/.test(
      h,
    )
  const wantsPro = /\bexclusive\b|pro entitlement|pro members/.test(h)
  const wantsHosted = hostInvolved || /\bhosted\b|concierge/.test(h)
  const wantsAddon =
    /\baddon\b|add-?on|once[- ]?off|one[- ]?time|once-off purchase|extra service|cleaning|tour/.test(h)
  const wantsSpecial =
    /\bspecial\b|promo|promotion|limited[- ]?time|run a special/.test(h)

  return recommendations.map((r) => {
    const details = { ...(r.details || {}) } as Record<string, unknown>
    if (wantsAddon) details.category = 'addon'
    else if (wantsHosted && !wantsAddon) details.category = 'hosted'
    else if (wantsSpecial) details.category = 'special'
    else if (autonomous && !wantsSpecial) details.category = 'standard'

    if (wantsPro) details.customerTierRequired = 'pro'
    else if (wantsNonMember) details.customerTierRequired = 'none'
    else if (wantsSpecial && wantsNonMember) details.customerTierRequired = 'none'

    return { ...r, details }
  })
}
