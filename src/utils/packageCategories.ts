import type { PackageCategory } from '@/lib/package-types'

export type PackageCategoryValue = PackageCategory | PackageCategory[] | string | string[] | null | undefined

export function normalizePackageCategories(value: PackageCategoryValue): PackageCategory[] {
  if (Array.isArray(value)) {
    return value
      .map((v) => String(v).trim().toLowerCase())
      .filter(Boolean) as PackageCategory[]
  }
  if (typeof value === 'string' && value.trim()) {
    return [value.trim().toLowerCase() as PackageCategory]
  }
  return []
}

export function hasPackageCategory(value: PackageCategoryValue, category: PackageCategory): boolean {
  return normalizePackageCategories(value).includes(category)
}

/** True when category is addon-only (not also standard/hosted/special). */
export function isAddonOnlyPackage(value: PackageCategoryValue): boolean {
  const cats = normalizePackageCategories(value)
  return cats.includes('addon') && cats.length === 1
}

/** Main booking assistant / post packages list (excludes addon-only; keeps standard+addon hybrids on main). */
export function isMainBookablePackage(value: PackageCategoryValue): boolean {
  return !isAddonOnlyPackage(value)
}

export function getPrimaryPackageCategory(value: PackageCategoryValue): PackageCategory {
  const list = normalizePackageCategories(value)
  return list[0] || 'standard'
}

export function categoryPriorityScore(value: PackageCategoryValue): number {
  // Higher priority first: special > hosted > standard > addon
  const set = new Set(normalizePackageCategories(value))
  if (set.has('special')) return 3
  if (set.has('hosted')) return 2
  if (set.has('standard')) return 1
  if (set.has('addon')) return 0
  return 0
}
