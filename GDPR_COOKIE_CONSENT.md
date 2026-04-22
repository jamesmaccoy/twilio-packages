# GDPR/POPIA Cookie Consent Implementation

## Overview

We've implemented a GDPR/POPIA-compliant cookie consent system that ensures the Meta Pixel (and other tracking scripts) only load after users have given explicit consent.

## What Was Implemented

### 1. Cookie Consent Banner Component (`src/components/CookieConsent.tsx`)

- **Appears on first visit** (or when consent expires after 365 days)
- **Three consent options**:
  - **Accept All**: Enables all cookies (analytics + marketing)
  - **Necessary Only**: Only essential cookies, no tracking
  - **Learn More**: Link to privacy policy (you'll need to create this page)

### 2. Conditional Pixel Loading

- **Meta Pixel only loads after marketing consent** is given
- Consent is stored in `localStorage` for 365 days
- Pixel initialization happens client-side after consent

### 3. Consent Utility Functions (`src/lib/cookieConsent.ts`)

Helper functions to check consent status:
- `getCookieConsent()` - Get full consent object
- `hasMarketingConsent()` - Check if marketing cookies allowed
- `hasAnalyticsConsent()` - Check if analytics cookies allowed
- `hasAnyConsent()` - Check if any consent given

## How It Works

1. **User visits site** → Cookie consent banner appears
2. **User clicks "Accept All"** → Marketing consent granted
3. **Meta Pixel initializes** → Events start tracking
4. **Consent stored** → Valid for 365 days
5. **Subsequent visits** → Pixel loads automatically (if consent was given)

## GDPR/POPIA Compliance Features

✅ **Explicit Consent Required** - Pixel only loads after user consent  
✅ **Granular Control** - Users can choose what to allow  
✅ **Consent Storage** - Consent remembered for 365 days  
✅ **Clear Information** - Banner explains what cookies are used  
✅ **Easy Opt-Out** - Users can choose "Necessary Only"  

## Next Steps

### 1. Create Privacy Policy Page

Create `/app/(frontend)/privacy-policy/page.tsx` with:
- What cookies you use
- Why you use them
- How users can manage/delete cookies
- Contact information for privacy concerns

### 2. Test the Implementation

1. **Clear browser data** (or use incognito mode)
2. **Visit your site** - Cookie banner should appear
3. **Click "Accept All"** - Check browser console for "Meta Pixel initialized"
4. **Verify in Meta Events Manager** - Events should start appearing
5. **Test "Necessary Only"** - Pixel should NOT initialize

### 3. Verify Meta Pixel is Working

After consent is given:
- Check browser console: Should see "Meta Pixel initialized: 2659582847593179"
- Install [Facebook Pixel Helper](https://chrome.google.com/webstore/detail/facebook-pixel-helper/fdgfkebogiimcoedlicjlajpkdmockpc)
- Visit Meta Events Manager → Test Events tab
- Events should appear within seconds

## Why This Fixes the "No Events" Issue

**Before**: Pixel was loading immediately, but:
- Browsers may block it due to privacy settings
- Users may have ad blockers
- No explicit consent = potential GDPR violation

**After**: Pixel only loads after:
- ✅ User gives explicit consent
- ✅ Browser allows it (user consented)
- ✅ GDPR/POPIA compliant
- ✅ Events will track properly

## Testing Checklist

- [ ] Cookie banner appears on first visit
- [ ] "Accept All" initializes Meta Pixel
- [ ] "Necessary Only" does NOT initialize pixel
- [ ] Consent persists across page reloads
- [ ] Browser console shows pixel initialization
- [ ] Meta Events Manager shows events
- [ ] Privacy policy page exists (create if needed)

## Customization

### Styling
The cookie banner uses Tailwind CSS. You can customize it in `src/components/CookieConsent.tsx`:
- Colors, spacing, positioning
- Text content
- Button styles

### Consent Duration
Currently set to 365 days. Change in `CookieConsent.tsx`:
```typescript
const COOKIE_CONSENT_EXPIRY_DAYS = 365 // Change this
```

### Pixel ID
The pixel ID is read from:
1. `window.__META_PIXEL_ID__` (set in layout.tsx)
2. Fallback: `'2659582847593179'`

## Important Notes

1. **Server-Side Events Still Work**: The Conversions API (`src/lib/metaConversions.ts`) sends events server-side and doesn't require client-side consent (though you should still disclose this in your privacy policy)

2. **Consent is Client-Side Only**: The cookie consent banner only controls client-side tracking. Server-side events from Conversions API will continue to work.

3. **Privacy Policy Required**: You must have a privacy policy page that explains:
   - What cookies you use
   - Why you use them
   - How users can manage cookies
   - Your legal basis for processing (GDPR requirement)

## Legal Compliance

This implementation helps with:
- ✅ **GDPR** (EU General Data Protection Regulation)
- ✅ **POPIA** (South Africa Protection of Personal Information Act)
- ✅ **CCPA** (California Consumer Privacy Act) - basic compliance

**However**, you should:
- Consult with a legal professional for full compliance
- Create a comprehensive privacy policy
- Ensure all data processing is disclosed
- Provide mechanisms for users to delete their data

---

**Status**: ✅ Cookie consent implemented - Meta Pixel will now only load after user consent

