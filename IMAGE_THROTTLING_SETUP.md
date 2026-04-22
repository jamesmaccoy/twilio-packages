# Image Throttling & Analytics Tracking Setup

## Overview

Image throttling has been implemented to restrict post cover/meta images for non-subscribers, leveraging Vercel's free plan throttling as a convenient solution. This creates valuable analytics data for Meta Pixel and Google Ads tracking, especially when non-members view restricted content.

## What's Implemented

### 1. Subscription-Based Image Access
- ✅ **Post cover/meta images are completely hidden for non-subscribers** (not just blurred)
- ✅ Subscribers with active subscriptions see full-quality images
- ✅ PostHero component checks subscription status and only renders image for subscribers
- ✅ Other images (thumbnails, cards) are blurred for non-subscribers
- ✅ Uses Vercel's free plan throttling + CSS blur for thumbnails
- ✅ Only applies to post cover/meta images (not all images)

### 2. Image View Tracking

#### Client-Side Tracking (`src/lib/imageTracking.ts`)
- **Meta Pixel**: Tracks `ViewContent` events for image views
- **Google Ads**: Tracks `view_item` and `restricted_content_view` events
- **Estimate Tracking Integration**: Restricted image views are tracked as potential conversions

#### Server-Side Tracking (`src/lib/metaConversions.ts`)
- Added `trackImageView()` function for server-side Meta Conversions API
- Tracks restricted content views as valuable conversion data

### 3. Components Updated

#### ImageMedia Component (`src/components/Media/ImageMedia/index.tsx`)
- Checks subscription status using `useSubscription()` hook
- Applies blur and low quality for non-subscribers
- Tracks image views automatically when images load
- Shows "Subscribe to view full image" overlay for restricted content

#### Media Component (`src/components/Media/index.tsx`)
- Updated to accept `postId`, `postTitle`, and `disableThrottling` props
- Passes post context to ImageMedia for tracking

#### Updated Components
- `PostHero`: **Completely hides image for non-subscribers**, only shows for subscribers
- `Card`: Passes post ID and title for tracking (blurs thumbnails)
- `SuggestedPackages`: Passes post context for package images
- `EstimatePage`: Passes post context for estimate images

## How It Works

### Image Access Logic

#### PostHero (Post Cover Images)
1. **Subscription Check**: Uses `useSubscription()` hook to check if user has active subscription
2. **Access Decision**: 
   - **Subscribers**: See full-quality image
   - **Non-subscribers**: Image is completely hidden (not rendered)
   - Shows gradient background with "Image Withheld - For members only" message
3. **Tracking**: Tracks when non-subscribers visit post page (restricted content view)

#### Other Images (Thumbnails, Cards)
1. **Subscription Check**: Uses `useSubscription()` hook
2. **Throttling Decision**: Only throttles if:
   - User is not subscribed
   - Post context is available (postId or postTitle)
   - `disableThrottling` prop is not set
3. **Visual Effects**:
   - CSS blur (`blur-md`)
   - Reduced brightness (`brightness-75`)
   - Low quality setting (`quality: 10`)
   - Vercel's free plan throttling (automatic)
   - Overlay message: "Image Withheld - For members only"

### Analytics Tracking

When an image loads:
1. **Client-Side**: Tracks with Meta Pixel and Google Ads
2. **Event Data**:
   - Post ID and title
   - Image ID
   - Whether content is restricted
   - User ID and email (if available)
3. **Restricted Views**: Tracked as potential conversions (value: 0, indicates interest)

## Integration with Estimate Tracking

Restricted image views are integrated with the estimate tracking system:
- When non-subscribers view restricted images, it's tracked as an `EstimateView` event
- This provides valuable data for retargeting campaigns
- Ties into the existing estimate tracking infrastructure

## Usage

### Basic Usage (with throttling)
```tsx
<Media 
  resource={post.meta.image}
  postId={post.id}
  postTitle={post.title}
/>
```

### Disable Throttling (for specific images)
```tsx
<Media 
  resource={image}
  disableThrottling={true}
/>
```

### Without Post Context (no throttling)
```tsx
<Media resource={image} />
```

## Analytics Events

### Meta Pixel Events
- **Event**: `ViewContent`
- **Data**:
  - `content_name`: Post title
  - `content_category`: `restricted_image` or `image`
  - `content_ids`: [postId]
  - `value`: 0 (for restricted views)
  - `currency`: ZAR

### Google Ads Events
- **Event**: `view_item`
- **Data**:
  - `item_id`: Post ID
  - `item_name`: Post title
  - `item_category`: `restricted_image` or `image`
  - `value`: 0 (for restricted views)

- **Event**: `restricted_content_view` (for restricted images)
- **Data**:
  - `content_id`: Post ID
  - `content_name`: Post title
  - `content_type`: `image`

## Benefits

1. **Vercel Free Plan**: Leverages existing throttling as a feature
2. **Analytics Data**: Creates valuable conversion signals for retargeting
3. **User Experience**: Clear indication that subscription unlocks content
4. **Estimate Tracking**: Integrates with existing estimate tracking system
5. **Pixel/Ad Data**: Provides rich data for Meta Pixel and Google Ads campaigns

## Testing

### Test Image Access
1. Log in as a non-subscriber
2. Visit a post page (`/posts/[slug]`)
3. Verify post cover image is **completely hidden** (not rendered, shows gradient background with "Image Withheld - For members only" message)
4. Verify thumbnails in cards are blurred with "Image Withheld - For members only" overlay message
5. Subscribe and verify post cover image appears clearly

### Test Analytics Tracking
1. Open browser console
2. Visit a post page as non-subscriber
3. Check console for tracking messages:
   - "Meta Pixel: Image view tracked"
   - "Google Ads: Image view tracked"
4. Verify events in Meta Events Manager and Google Ads dashboard

### Test Estimate Integration
1. View restricted images as non-subscriber
2. Check that `EstimateView` events are tracked
3. Verify in Meta Pixel and Google Ads dashboards

## Environment Variables

No new environment variables required. Uses existing:
- `NEXT_PUBLIC_META_PIXEL_ID` (for Meta Pixel)
- `META_ACCESS_TOKEN` (for Meta Conversions API)
- Google Ads Tag ID: `AW-684914935` (already configured)

## Files Modified

- `src/components/Media/ImageMedia/index.tsx` - Added throttling and tracking
- `src/components/Media/index.tsx` - Updated to pass post context
- `src/components/Media/types.ts` - Added post context props
- `src/lib/imageTracking.ts` - New file for image tracking utilities
- `src/lib/metaConversions.ts` - Added `trackImageView()` function
- `src/heros/PostHero/index.tsx` - Passes post context
- `src/components/Card/index.tsx` - Passes post context
- `src/components/Bookings/SuggestedPackages.tsx` - Passes post context
- `src/app/(frontend)/estimate/[estimateId]/page.client.tsx` - Passes post context

## Next Steps

1. ✅ Image throttling implemented
2. ✅ Analytics tracking integrated
3. ✅ Estimate tracking integration complete
4. ⏳ Test with real users
5. ⏳ Monitor analytics dashboards for restricted content views
6. ⏳ Create retargeting campaigns based on restricted content views

## Notes

- Throttling only applies to post cover/meta images, not all images
- Vercel's free plan throttling works automatically
- CSS blur provides additional visual effect
- Tracking happens automatically when images load
- Restricted views are valuable conversion signals for retargeting

