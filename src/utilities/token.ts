import jwt from 'jsonwebtoken'
import crypto from 'crypto'

const SECRET_KEY = process.env.JWT_SECRET || process.env.PAYLOAD_SECRET || 'your-secret-key' // Use env variable in production

export const generateJwtToken = <T extends object>(payload: T): string => {
  return jwt.sign(payload, SECRET_KEY, { expiresIn: '7d' })
}

export const verifyJwtToken = <T extends object>(token: string): T | null => {
  try {
    const decoded = jwt.verify(token, SECRET_KEY) as T
    return decoded
  } catch (error) {
    console.error('JWT verification error:', error)
    return null
  }
}

/**
 * Generate a short, URL-safe random token for invite links
 * Uses 10 characters by default for a good balance between uniqueness and URL length
 */
export const generateShortToken = (length: number = 10): string => {
  // Use URL-safe base64 encoding, but remove padding and replace non-URL-safe chars
  const bytes = crypto.randomBytes(Math.ceil(length * 0.75)) // 0.75 ratio for base64
  const token = bytes
    .toString('base64')
    .replace(/\+/g, '-') // Replace + with -
    .replace(/\//g, '_') // Replace / with _
    .replace(/=/g, '') // Remove padding
    .substring(0, length)
  
  return token
}
