import type { User } from '@/payload-types'

export function toRoleArray(role: unknown): string[] {
  if (Array.isArray(role)) return role.filter((r): r is string => typeof r === 'string')
  if (typeof role === 'string' && role.length > 0) return [role]
  return []
}

export function isAdminUser(user: unknown): user is User {
  const roles = toRoleArray((user as any)?.role)
  return roles.includes('admin')
}

export function isHostUser(user: unknown): user is User {
  const roles = toRoleArray((user as any)?.role)
  return roles.includes('host')
}

