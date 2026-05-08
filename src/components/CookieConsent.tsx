'use client'

import React, { useEffect, useState } from 'react'
import { Button } from '@/components/ui/button'
import { X } from 'lucide-react'

const COOKIE_CONSENT_KEY = 'cookie-consent'
const COOKIE_CONSENT_EXPIRY_DAYS = 365

interface CookieConsent {
  analytics: boolean
  marketing: boolean
  timestamp: number
}

export function CookieConsent() {
  const [showBanner, setShowBanner] = useState(false)
  const [consent, setConsent] = useState<CookieConsent | null>(null)

  useEffect(() => {
    // Check if consent has been given
    const storedConsent = localStorage.getItem(COOKIE_CONSENT_KEY)
    
    if (storedConsent) {
      try {
        const parsed = JSON.parse(storedConsent) as CookieConsent
        // Check if consent is still valid (not expired)
        const daysSinceConsent = (Date.now() - parsed.timestamp) / (1000 * 60 * 60 * 24)
        if (daysSinceConsent < COOKIE_CONSENT_EXPIRY_DAYS) {
          setConsent(parsed)
          // Trigger pixel initialization if marketing consent was given
          if (parsed.marketing && typeof window !== 'undefined') {
            initializeMetaPixel()
          }
          return
        }
      } catch (error) {
        console.error('Error parsing cookie consent:', error)
      }
    }
    
    // Show banner if no valid consent found
    setShowBanner(true)
  }, [])

  const saveConsent = (analytics: boolean, marketing: boolean) => {
    const consentData: CookieConsent = {
      analytics,
      marketing,
      timestamp: Date.now(),
    }
    
    localStorage.setItem(COOKIE_CONSENT_KEY, JSON.stringify(consentData))
    setConsent(consentData)
    setShowBanner(false)
    
    // Initialize Meta Pixel if marketing consent was given
    if (marketing && typeof window !== 'undefined') {
      initializeMetaPixel()
    }
    
    // Dispatch custom event for other scripts to listen to
    window.dispatchEvent(new CustomEvent('cookieConsent', { detail: consentData }))
  }

  const acceptAll = () => {
    saveConsent(true, true)
  }

  const acceptNecessary = () => {
    saveConsent(false, false)
  }

  const acceptCustom = (analytics: boolean, marketing: boolean) => {
    saveConsent(analytics, marketing)
  }

  if (!showBanner) {
    return null
  }

  return (
    <div className="fixed bottom-0 left-0 right-0 z-50 bg-white border-t border-gray-200 shadow-lg p-4 md:p-6">
      <div className="max-w-4xl mx-auto">
        <div className="flex flex-col md:flex-row md:items-start md:justify-between gap-4">
          <div className="flex-1">
            <h3 className="text-lg font-semibold mb-2">Cookie Consent</h3>
            <p className="text-sm text-gray-600 mb-4">
              We use cookies to run the site and (optionally) measure and improve it. Choose “Accept All” to allow analytics and
              marketing cookies, or “Necessary Only” to continue with essential cookies.
            </p>
            <div className="mt-4 flex flex-wrap gap-2">
              <Button
                onClick={acceptAll}
                className="bg-teal-600 hover:bg-teal-700 text-white"
                size="sm"
              >
                Accept All
              </Button>
              <Button
                onClick={acceptNecessary}
                variant="outline"
                size="sm"
              >
                Necessary Only
              </Button>
              <a
                href="/privacy-policy"
                className="text-sm text-teal-600 hover:underline self-center ml-2"
              >
                Learn More
              </a>
            </div>
          </div>
          <button
            onClick={acceptNecessary}
            className="text-gray-400 hover:text-gray-600 transition-colors"
            aria-label="Close"
          >
            <X className="w-5 h-5" />
          </button>
        </div>
      </div>
    </div>
  )
}

// Initialize Meta Pixel after consent
function initializeMetaPixel() {
  // Get pixel ID from window or use default
  const pixelId = (typeof window !== 'undefined' && (window as any).__META_PIXEL_ID__) || '1102454273276257'
  
  if (typeof window === 'undefined' || (window as any).fbq) {
    return // Already initialized or server-side
  }

  // Load Meta Pixel script
  ;(function (f: any, b: any, e: string, v: string, n: any, t: any, s: any) {
    if (f.fbq) return
    n = f.fbq = function() {
      n.callMethod ? n.callMethod.apply(n, arguments) : n.queue.push(arguments)
    }
    if (!f._fbq) f._fbq = n
    n.push = n
    n.loaded = !0
    n.version = '2.0'
    n.queue = []
    t = b.createElement(e)
    t.async = !0
    t.src = v
    s = b.getElementsByTagName(e)[0]
    s.parentNode.insertBefore(t, s)
  })(window, document, 'script', 'https://connect.facebook.net/en_US/fbevents.js', null, null, null)

  // Initialize pixel with error handling
  try {
    ;(window as any).fbq('init', pixelId, {
      // Disable automatic event tracking to prevent custom endpoint issues
      autoConfig: false,
      // Explicitly disable custom domain endpoint to prevent CORS issues
      // This ensures events go directly to Facebook's servers, not to /events/[hash]
    })
    
    // Track PageView
    ;(window as any).fbq('track', 'PageView')
    console.log('Meta Pixel initialized after consent:', pixelId)
  } catch (error) {
    console.warn('Meta Pixel initialization error (non-critical):', error)
  }
}

