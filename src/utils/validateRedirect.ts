/**
 * Validates a redirect URL to prevent open redirect vulnerabilities
 *
 * @param url The URL to validate
 * @returns The validated URL if safe, or a default fallback path
 */
export function validateRedirect(url: string | null | undefined): string | null {
  // If URL is null, undefined or empty, return null
  if (!url) {
    return null
  }

  try {
    // Check if it's an absolute URL or protocol-relative URL
    // which could lead to external sites
    if (url.startsWith('//') || /^[a-zA-Z][a-zA-Z\d+\-.]*:/.test(url)) {
      return null
    }

    // Make sure the URL starts with a slash (relative to the root)
    if (!url.startsWith('/')) {
      url = '/' + url
    }

    // Additional checks for path traversal attempts
    if (url.includes('..') || url.includes('\\')) {
      return null
    }

    // Optional: whitelist allowed paths
    // const ALLOWED_PATHS = ['/bookings', '/subscribe', '/account', '/profile'];
    // const isAllowedPath = ALLOWED_PATHS.some(path => url.startsWith(path));
    // if (!isAllowedPath) return null;

    return url
  } catch (error) {
    console.error('Error validating redirect URL:', error)
    return null
  }
}
