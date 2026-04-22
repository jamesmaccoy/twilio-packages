import Script from 'next/script'
import React from 'react'

/**
 * Google Ads (gtag.js) tracking code
 * This should be added to every page immediately after the <head> element
 * Set NEXT_PUBLIC_GOOGLE_ADS environment variable with your Google Ads tracking ID (e.g., G-81W4E12BC3)
 */
export const GoogleAds: React.FC = () => {
  const GA_MEASUREMENT_ID = process.env.NEXT_PUBLIC_GOOGLE_ADS

  // Don't render if no tracking ID is configured
  if (!GA_MEASUREMENT_ID) {
    return null
  }

  return (
    <>
      {/* Google tag (gtag.js) */}
      <Script
        src={`https://www.googletagmanager.com/gtag/js?id=${GA_MEASUREMENT_ID}`}
        strategy="beforeInteractive"
      />
      <Script
        id="google-ads"
        strategy="beforeInteractive"
        dangerouslySetInnerHTML={{
          __html: `
            window.dataLayer = window.dataLayer || [];
            function gtag(){dataLayer.push(arguments);}
            gtag('js', new Date());
            gtag('config', '${GA_MEASUREMENT_ID}');
          `,
        }}
      />
    </>
  )
}

