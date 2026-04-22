# Meta Pixel Setup & Troubleshooting Guide

## Current Configuration

Your Meta Pixel ID: `2659582847593179`

## Issues Identified

### 1. Meta Pixel Not Sending Events
**Problem**: Pixel is not firing events to Meta.

**Solutions**:
- ✅ Pixel ID is now hardcoded as fallback: `2659582847593179`
- Set `NEXT_PUBLIC_META_PIXEL_ID=2659582847593179` in your `.env` file
- Verify pixel is loading by checking browser console for "Meta Pixel initialized" message
- Install [Facebook Pixel Helper](https://chrome.google.com/webstore/detail/facebook-pixel-helper/fdgfkebogiimcoedlicjlajpkdmockpc) browser extension to test

### 2. Conversions API Not Sending Events
**Problem**: Server-side events are not being sent.

**Solutions**:
1. **Get your Meta Access Token**:
   - Go to [Meta Events Manager](https://business.facebook.com/events_manager2)
   - Select your Pixel (ID: 2659582847593179)
   - Go to **Settings** → **Conversions API**
   - Click **Generate Access Token** or use existing token
   - Copy the access token

2. **Add to Environment Variables**:
   ```env
   META_ACCESS_TOKEN=your_access_token_here
   ```

3. **Verify Setup**:
   - Visit `/api/meta-pixel/test` to check configuration
   - Check server logs for "Meta event sent successfully" messages
   - Events are tracked when:
     - Estimates are viewed (`/api/estimates/latest`)
     - Bookings are created (via hooks and booking confirmation page)

### 3. SSL/Connection Issues
**Problem**: "Your connection is not private" error on simpleplek.co.za

**This affects pixel loading** because:
- Browsers block insecure content on HTTPS pages
- Meta Pixel requires HTTPS to load properly
- Mixed content (HTTP/HTTPS) can prevent pixel from firing

**Solutions**:
1. **Fix SSL Certificate**:
   - Ensure your domain has a valid SSL certificate
   - Check certificate expiration date
   - Verify certificate is properly installed on your hosting provider

2. **DNS Configuration**:
   - The DNS screenshot shows CNAME records
   - Ensure `www.simpleplek.co.za` points to your hosting
   - Verify A records are correct for root domain

3. **Domain Verification**:
   - The error mentions "Custom domain setup has not been completed"
   - This might be related to Meta Business verification
   - Verify your domain in Meta Business Settings → Brand Safety → Domains

### 4. CORS Error with Custom Domain Endpoints
**Problem**: `Access to fetch at 'https://simpleplek.co.za/events/...' from origin 'https://www.simpleplek.co.za' has been blocked by CORS policy`

**Root Cause**: 
- Meta Pixel tries to POST to `/events/[hash]` endpoint
- Domain mismatch: pixel tries non-www (`simpleplek.co.za`) but site is www (`www.simpleplek.co.za`)
- 307 redirect from non-www to www causes CORS error (redirects strip CORS headers)

**Solutions**:
- ✅ **Fixed**: Events endpoint now handles CORS properly for both www and non-www domains
- ✅ **Fixed**: CORS headers include both `https://www.simpleplek.co.za` and `https://simpleplek.co.za`
- ✅ **Fixed**: Meta Pixel initialization disables custom domain endpoints (`autoConfig: false`)
- ✅ **Fixed**: URL rewriting intercepts non-www requests and rewrites them to www before they're sent
  - This prevents the redirect and CORS error by ensuring requests go directly to www domain
- ✅ **Fixed**: Created `/events/[...path]` route to handle Meta Pixel POST requests
  - Meta Pixel POSTs to `/events/[hash]` (not `/api/events/[hash]`)
  - Route now exists at `src/app/events/[...path]/route.ts`
- **Optional**: Configure Meta Events Manager to disable custom domain endpoints (Settings → Advanced → Custom Domain)

### 5. Event Match Quality (EMQ) Issues
**Problem**: No Event Match Quality score available

**Solutions**:
- EMQ requires both client-side pixel AND server-side Conversions API
- Ensure `META_ACCESS_TOKEN` is set
- Send user data (email, phone) when available - this improves matching
- Events need to include `client_ip_address` and `client_user_agent`

## Testing Your Setup

### 1. Test Pixel Configuration
Visit: `https://your-domain.com/api/meta-pixel/test`

This will show:
- Whether pixel ID is configured
- Whether access token is set
- Recommendations for fixing issues

### 2. Test Pixel in Browser
1. Install [Facebook Pixel Helper](https://chrome.google.com/webstore/detail/facebook-pixel-helper/fdgfkebogiimcoedlicjlajpkdmockpc)
2. Visit your website
3. Check if pixel fires PageView event
4. Look for any errors in the extension

### 3. Test Conversions API
1. Check server logs when:
   - Viewing an estimate (should see "Meta event sent successfully: EstimateView")
   - Creating a booking (should see "Meta event sent successfully: Purchase")
2. Check Meta Events Manager → Test Events tab
3. Trigger test events and verify they appear

### 4. Verify Events in Meta
1. Go to [Meta Events Manager](https://business.facebook.com/events_manager2)
2. Select your Pixel
3. Go to **Test Events** tab
4. Visit your site and perform actions (view estimate, create booking)
5. Events should appear within a few seconds

## Environment Variables Required

Add these to your `.env` file:

```env
# Meta Pixel ID (client-side tracking)
NEXT_PUBLIC_META_PIXEL_ID=2659582847593179

# Meta Conversions API Access Token (server-side tracking)
META_ACCESS_TOKEN=your_access_token_here
```

## Common Issues & Fixes

### Pixel Not Loading
- **Check**: Browser console for errors
- **Fix**: Ensure SSL certificate is valid
- **Fix**: Check if ad blockers are blocking the pixel
- **Fix**: Verify pixel ID is correct

### Events Not Appearing in Meta
- **Check**: Server logs for "Meta event sent successfully"
- **Fix**: Ensure `META_ACCESS_TOKEN` is set
- **Fix**: Verify access token has correct permissions
- **Fix**: Check if events are being deduplicated (same event_id)

### Conversions API Errors
- **Check**: Server logs for "Meta Conversions API errors"
- **Common errors**:
  - Invalid access token → Regenerate token
  - Invalid pixel ID → Verify pixel ID matches
  - Missing required fields → Check event data structure

### CORS Errors
- **Error**: `Access to fetch at 'https://simpleplek.co.za/events/...' has been blocked by CORS policy`
- **Fix**: ✅ Already fixed - events endpoint now handles CORS for both www and non-www
- **Fix**: If still occurring, check Meta Events Manager → Settings → Advanced → Custom Domain (disable if enabled)
- **Fix**: Ensure both `https://www.simpleplek.co.za` and `https://simpleplek.co.za` are verified in Meta Business Settings

## Next Steps

1. ✅ Pixel ID is now hardcoded (will work immediately)
2. ✅ CORS issues fixed for www/non-www domain mismatch
3. ⏳ Set `META_ACCESS_TOKEN` environment variable
4. ⏳ Fix SSL certificate for simpleplek.co.za
5. ⏳ Test pixel with Facebook Pixel Helper
6. ⏳ Verify events in Meta Events Manager
7. ⏳ (Optional) Disable custom domain endpoints in Meta Events Manager if CORS issues persist

## Support Resources

- [Meta Pixel Documentation](https://developers.facebook.com/docs/meta-pixel)
- [Conversions API Documentation](https://developers.facebook.com/docs/marketing-api/conversions-api)
- [Meta Events Manager](https://business.facebook.com/events_manager2)
- [Facebook Pixel Helper](https://chrome.google.com/webstore/detail/facebook-pixel-helper/fdgfkebogiimcoedlicjlajpkdmockpc)

