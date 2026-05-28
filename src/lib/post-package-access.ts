import type { Payload } from 'payload'
import {
  normalizePackageEntitlements,
  type CustomerEntitlement,
} from '@/utils/packageSuggestions'
import { categoryPriorityScore, hasPackageCategory } from '@/utils/packageCategories'

export type PostPackageAccessIndex = {
  /** Guest may book without a subscription (entitlement=none, enabled, non-addon). */
  guestBookable: boolean
  /** Lowest entitlement among enabled non-addon packages on this post. */
  minEntitlement: CustomerEntitlement
  /** Highest display category among enabled non-addon packages (special > hosted > standard). */
  primaryCategory: 'special' | 'hosted' | 'standard' | null
}

type PostPackageSettings = Array<{
  package?: string | { id?: string }
  enabled?: boolean | null
}> | null | undefined

function isPackageEnabledForPost(
  packageId: string,
  entitlement: unknown,
  packageSettings: PostPackageSettings,
): boolean {
  if (normalizePackageEntitlements(entitlement).includes('none')) {
    return true
  }
  if (!packageSettings?.length) {
    return true
  }
  const setting = packageSettings.find((entry) => {
    const pkgId =
      typeof entry.package === 'object' && entry.package
        ? entry.package.id
        : entry.package
    return pkgId === packageId
  })
  if (!setting) return true
  return setting.enabled !== false
}

function entitlementRank(value: CustomerEntitlement): number {
  if (value === 'none') return 0
  if (value === 'standard') return 1
  return 2
}

/**
 * Server-side index for a post's package access (independent of the viewer's subscription).
 * Use on post pages to avoid client-side flicker between the booking assistant and subscribe gate.
 */
export async function getPostPackageAccessIndex(
  payload: Payload,
  postId: string,
  postData?: { packageSettings?: PostPackageSettings } | null,
): Promise<PostPackageAccessIndex> {
  const packageSettings = postData?.packageSettings

  const dbPackages = await payload.find({
    collection: 'packages',
    where: {
      and: [{ post: { equals: postId } }, { isEnabled: { equals: true } }],
    },
    depth: 0,
    limit: 100,
    overrideAccess: true,
  })

  let guestBookable = false
  let minEntitlement: CustomerEntitlement = 'pro'
  let primaryCategory: PostPackageAccessIndex['primaryCategory'] = null
  let bestCategoryScore = -1

  for (const pkg of dbPackages.docs) {
    if (hasPackageCategory(pkg.category, 'addon')) continue

    const entitlement = (pkg as { entitlement?: unknown }).entitlement
    if (!isPackageEnabledForPost(pkg.id, entitlement, packageSettings)) continue

    const normalizedList = normalizePackageEntitlements(entitlement)
    if (normalizedList.includes('none')) {
      guestBookable = true
    }
    for (const normalized of normalizedList) {
      if (entitlementRank(normalized) < entitlementRank(minEntitlement)) {
        minEntitlement = normalized
      }
    }

    const score = categoryPriorityScore(pkg.category)
    if (score > bestCategoryScore) {
      bestCategoryScore = score
      if (hasPackageCategory(pkg.category, 'special')) primaryCategory = 'special'
      else if (hasPackageCategory(pkg.category, 'hosted')) primaryCategory = 'hosted'
      else primaryCategory = 'standard'
    }
  }

  if (dbPackages.docs.length === 0) {
    minEntitlement = 'pro'
  }

  return { guestBookable, minEntitlement, primaryCategory }
}
