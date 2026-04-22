/**
 * Cookie Consent Utility
 * Helper functions for checking GDPR/POPIA cookie consent status
 */

const COOKIE_CONSENT_KEY = 'cookie-consent'

export interface CookieConsent {
  analytics: boolean
  marketing: boolean
  timestamp: number
}

/**
 * Get current cookie consent status
 */
export function getCookieConsent(): CookieConsent | null {
  if (typeof window === 'undefined') {
    return null
  }

  const stored = localStorage.getItem(COOKIE_CONSENT_KEY)
  if (!stored) {
    return null
  }

  try {
    const consent = JSON.parse(stored) as CookieConsent
    // Check if consent is still valid (not expired)
    const daysSinceConsent = (Date.now() - consent.timestamp) / (1000 * 60 * 60 * 24)
    if (daysSinceConsent < 365) {
      return consent
    }
  } catch (error) {
    console.error('Error parsing cookie consent:', error)
  }

  return null
}

/**
 * Check if marketing cookies are consented to
 */
export function hasMarketingConsent(): boolean {
  const consent = getCookieConsent()
  return consent?.marketing === true
}

/**
 * Check if analytics cookies are consented to
 */
export function hasAnalyticsConsent(): boolean {
  const consent = getCookieConsent()
  return consent?.analytics === true
}

/**
 * Check if any tracking consent has been given
 */
export function hasAnyConsent(): boolean {
  const consent = getCookieConsent()
  return consent !== null && (consent.analytics || consent.marketing)
}

