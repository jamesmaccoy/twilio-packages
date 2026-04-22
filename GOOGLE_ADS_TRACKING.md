# Google Ads Tracking Setup

## Overview

Google Ads conversion tracking has been implemented to track user behavior and conversions for retargeting campaigns.

**Tag ID**: `AW-684914935` (simpleplek retarget)

## What's Implemented

### 1. Base Tracking (Already in Layout)
- ✅ Google Ads tag loads on every page via `layout.tsx`
- ✅ Tag ID: `AW-684914935`
- ✅ Tracks PageView automatically

### 2. Conversion Events

#### Estimate View Tracking
- **Location**: `src/app/(frontend)/estimate/[estimateId]/page.client.tsx`
- **Event**: `estimate_view`
- **Triggers**: When user views an estimate detail page
- **Data Tracked**:
  - Estimate ID
  - Estimate value
  - Post ID and title
  - Package type

#### Booking Conversion Tracking
- **Location**: `src/components/GoogleAdsTracking.tsx`
- **Event**: `purchase` + conversion label `booking_conversion`
- **Triggers**: When booking is successfully completed (via URL params)
- **Data Tracked**:
  - Booking ID
  - Booking value
  - Post ID and title
  - Package type

### 3. Utility Functions (`src/lib/googleAdsTracking.ts`)

Available functions:
- `trackGoogleAdsConversion()` - Track conversion events
- `trackGoogleAdsEvent()` - Track custom events
- `trackEstimateViewGoogleAds()` - Track estimate views
- `trackBookingConversionGoogleAds()` - Track booking conversions

## How to Use

### Track Custom Events

```typescript
import { trackGoogleAdsEvent } from '@/lib/googleAdsTracking'

// Track a custom event
trackGoogleAdsEvent('button_click', {
  button_name: 'book_now',
  page: 'homepage'
})
```

### Track Conversions

```typescript
import { trackGoogleAdsConversion } from '@/lib/googleAdsTracking'

// Track a conversion
trackGoogleAdsConversion('booking_conversion', 1500, 'ZAR')
```

## Testing

### 1. Verify Tag is Loading
1. Open browser console
2. Type: `window.gtag` - should return a function
3. Check Network tab - should see requests to `googletagmanager.com`

### 2. Test Estimate View Tracking
1. Visit an estimate detail page: `/estimate/[estimateId]`
2. Open browser console
3. Should see: `Google Ads event tracked: estimate_view`
4. Check Google Ads dashboard → Conversions → Should see event

### 3. Test Booking Conversion
1. Complete a booking successfully
2. Should redirect to booking confirmation with `?success=true&estimateId=...&total=...`
3. Open browser console
4. Should see: `Google Ads conversion tracked: booking_conversion`
5. Check Google Ads dashboard → Conversions → Should see conversion

### 4. Verify in Google Ads Dashboard
1. Go to [Google Ads](https://ads.google.com)
2. Navigate to **Tools & Settings** → **Conversions**
3. Check conversion tracking status
4. View conversion data

## Google Ads Conversion Labels

To set up conversion labels in Google Ads:

1. Go to Google Ads → **Tools & Settings** → **Conversions**
2. Create conversion action:
   - **Category**: Purchase
   - **Value**: Use different values for each conversion
   - **Count**: One
3. Get conversion label (e.g., `booking_conversion`)
4. Update `trackGoogleAdsConversion()` calls with your conversion label

## Current Conversion Labels

- `booking_conversion` - Tracks completed bookings

## Troubleshooting

### No Events Showing in Google Ads

1. **Check tag is loading**:
   - Browser console: `window.gtag` should exist
   - Network tab: Should see gtag.js requests

2. **Check events are firing**:
   - Browser console: Should see "Google Ads event tracked" messages
   - Check for JavaScript errors

3. **Verify conversion setup**:
   - Google Ads → Conversions → Check conversion action is active
   - Verify conversion label matches code

4. **Check ad blockers**:
   - Disable ad blockers temporarily
   - Test in incognito mode

### Events Not Tracking

- **Check cookie consent**: Google Ads may be blocked until user consents
- **Check SSL**: HTTPS required for tracking
- **Check domain**: Tag must be on same domain as site

## Next Steps

1. ✅ Base tracking implemented
2. ✅ Estimate view tracking added
3. ✅ Booking conversion tracking added
4. ⏳ Set up conversion actions in Google Ads dashboard
5. ⏳ Test and verify events are appearing
6. ⏳ Configure retargeting audiences based on events

## Files Modified

- `src/lib/googleAdsTracking.ts` - Utility functions
- `src/components/GoogleAdsTracking.tsx` - Client-side tracking component
- `src/app/(frontend)/layout.tsx` - Added tracking component
- `src/app/(frontend)/estimate/[estimateId]/page.client.tsx` - Estimate view tracking
- `src/app/(frontend)/home-editorial/page.tsx` - Removed redundant GoogleAds component

---

**Status**: ✅ Google Ads tracking implemented
**Next**: Set up conversion actions in Google Ads dashboard and test

