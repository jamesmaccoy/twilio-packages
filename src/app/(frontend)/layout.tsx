import type { Metadata } from 'next'

import { cn } from '@/utilities/ui'
import { GeistMono } from 'geist/font/mono'
import { GeistSans } from 'geist/font/sans'
import React from 'react'

import { AdminBar } from '@/components/AdminBar'
import { Footer } from '@/Footer/Component'
import { Header } from '@/Header/Component'
import { Providers } from '@/providers'
import { InitTheme } from '@/providers/Theme/InitTheme'
import { mergeOpenGraph } from '@/utilities/mergeOpenGraph'
import { draftMode } from 'next/headers'
import Script from 'next/script'
import { CookieConsent } from '@/components/CookieConsent'
import { GoogleAdsTracking } from '@/components/GoogleAdsTracking'
import { Suspense } from 'react'

import './globals.css'
import { getServerSideURL } from '@/utilities/getURL'


export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const { isEnabled } = await draftMode()
  // Google Tag Manager ID
  const gtmId = process.env.NEXT_PUBLIC_GTM_ID || 'GTM-5KT6R7LB'
  // Google Analytics 4 Measurement ID
  const ga4Id = process.env.NEXT_PUBLIC_GOOGLE_ANALYTICS || 'G-SMDR6QF6S0'
  // Google Ads conversion tag ID
  const googleAdsId = process.env.NEXT_PUBLIC_GOOGLE_ADS || 'AW-684914935'
  // Meta Pixel ID - use the pixel ID from your Meta Business account
  // Default to the organization's Meta Pixel ID: 1102454273276257
  const metaPixelId = process.env.NEXT_PUBLIC_META_PIXEL_ID || '1102454273276257'

  return (
    <html className={cn(GeistSans.variable, GeistMono.variable)} lang="en" suppressHydrationWarning>
      <head>
        <InitTheme />
        {/* Google Tag Manager */}
        <Script
          id="google-tag-manager"
          strategy="beforeInteractive"
          dangerouslySetInnerHTML={{
            __html: `
              (function(w,d,s,l,i){w[l]=w[l]||[];w[l].push({'gtm.start':
              new Date().getTime(),event:'gtm.js'});var f=d.getElementsByTagName(s)[0],
              j=d.createElement(s),dl=l!='dataLayer'?'&l='+l:'';j.async=true;j.src=
              'https://www.googletagmanager.com/gtm.js?id='+i+dl;f.parentNode.insertBefore(j,f);
              })(window,document,'script','dataLayer','${gtmId}');
            `,
          }}
        />
        {/* Google Analytics 4 */}
        <Script
          src={`https://www.googletagmanager.com/gtag/js?id=${ga4Id}`}
          strategy="afterInteractive"
        />
        <Script
          id="google-analytics-4"
          strategy="afterInteractive"
          dangerouslySetInnerHTML={{
            __html: `
              window.dataLayer = window.dataLayer || [];
              function gtag(){dataLayer.push(arguments);}
              gtag('js', new Date());
              gtag('config', '${ga4Id}', { send_page_view: true });
              gtag('config', '${googleAdsId}');
            `,
          }}
        />
        {/* Meta Pixel - Will be initialized by CookieConsent component after user consent */}
        {/* Note: Pixel initialization is now handled client-side after GDPR/POPIA consent */}
        {/* Store pixel ID in window for CookieConsent component */}
        {metaPixelId && (
          <Script
            id="meta-pixel-id-setup"
            strategy="beforeInteractive"
            dangerouslySetInnerHTML={{
              __html: `window.__META_PIXEL_ID__ = '${metaPixelId}';`,
            }}
          />
        )}
        <link href="/favicon.ico" rel="icon" sizes="32x32" />
        <link href="/favicon.svg" rel="icon" type="image/svg+xml" />
      </head>
      <body>
        {/* Google Tag Manager (noscript) */}
        <noscript>
          <iframe
            src={`https://www.googletagmanager.com/ns.html?id=${gtmId}`}
            height="0"
            width="0"
            style={{ display: 'none', visibility: 'hidden' }}
          />
        </noscript>
        {/* Meta Pixel (noscript) */}
        {metaPixelId && (
          <noscript>
            <img
              height="1"
              width="1"
              style={{ display: 'none' }}
              src={`https://www.facebook.com/tr?id=${metaPixelId}&ev=PageView&noscript=1`}
              alt=""
            />
          </noscript>
        )}
        <Providers>
          <AdminBar
            adminBarProps={{
              preview: isEnabled,
            }}
          />

          <Header />
          {children}
          <Footer />
          <CookieConsent />
          <Suspense fallback={null}>
            <GoogleAdsTracking />
          </Suspense>
        </Providers>
      </body>
    </html>
  )
}

export const metadata: Metadata = {
  metadataBase: new URL(getServerSideURL()),
  openGraph: mergeOpenGraph(),
  twitter: {
    card: 'summary_large_image',
    creator: '@payloadcms',
  },
}
